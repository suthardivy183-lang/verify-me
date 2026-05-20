"""
Orchestrator — uses Gemini 2.5 Pro to read the project and assign work,
then dispatches to specialist agents (Gemini 2.5 Flash).

Models:
  Orchestrator (plan + summarise) → gemini-2.5-pro
  Worker agents (UI / API / Test) → gemini-2.5-flash
"""

from __future__ import annotations

import concurrent.futures
import json
import os
import textwrap
from dataclasses import dataclass, field
from typing import Literal

from google import genai
from google.genai import types

from . import ui_agent, api_agent, test_agent
from .gemini_base import AgentResult, ORCHESTRATOR_MODEL
from .tools import read_file, list_files


# ── Sub-task dataclass ────────────────────────────────────────────────────────

@dataclass
class SubTask:
    agent: Literal["ui", "api", "test"]
    task: str
    depends_on: list[str] = field(default_factory=list)


# ── Project snapshot ──────────────────────────────────────────────────────────

def _build_project_snapshot() -> str:
    sections: list[str] = []

    for directory, pattern in [("backend", "*.py"), ("frontend", "*"), ("tests", "*.py")]:
        listing = list_files(directory, pattern)
        sections.append(f"=== {directory}/ ({pattern}) ===\n{listing}")

    for path in [
        "backend/main.py",
        "backend/detector.py",
        "frontend/app.js",
        "frontend/index.html",
        "frontend/styles.css",
        "backend/requirements.txt",
    ]:
        content = read_file(path)
        if content.startswith("ERROR:"):
            continue
        lines = content.splitlines()
        preview = "\n".join(lines[:300])
        truncated = f"\n... ({len(lines)-300} more lines)" if len(lines) > 300 else ""
        sections.append(f"=== {path} ===\n{preview}{truncated}")

    return "\n\n".join(sections)


# ── Autonomous discovery planner ──────────────────────────────────────────────

DISCOVERY_SYSTEM = """\
You are a senior engineering lead doing a code review of a deepfake-detection web app
called VerifyMe. You have been given a snapshot of the full codebase.

Your job: identify the 3-5 most impactful improvements that can be made RIGHT NOW and
assign each to the correct specialist agent.

Available agents:
  ui   — edits frontend/ (HTML, CSS, JavaScript)
  api  — edits backend/  (FastAPI endpoints, Python logic)
  test — writes & runs pytest tests in tests/

Criteria for choosing tasks (concrete and completable):
  - Missing error handling on endpoints
  - Missing or weak input validation
  - UI feedback gaps (no loading state, no error messages shown to user)
  - Missing tests for critical endpoints
  - Security gaps (no file-size limit, no MIME-type check, etc.)

Output ONLY a JSON array — no prose, no markdown fences:
[
  {
    "agent": "api",
    "task": "...(specific, self-contained instruction)...",
    "depends_on": [],
    "rationale": "one sentence why this matters"
  }
]

Rules:
- Each task must be completable by a single agent.
- Prefer depth over breadth — 3 great tasks beat 6 vague ones.
- test tasks should depend on any api task they cover: "depends_on": ["api"]
- Do NOT invent features not hinted at in the existing code.
"""


def _discover_tasks(api_key: str, verbose: bool) -> list[SubTask]:
    if verbose:
        print("  [Orchestrator/Gemini-Pro] Reading project files...")

    snapshot = _build_project_snapshot()

    if verbose:
        print(f"  [Orchestrator/Gemini-Pro] Snapshot built ({len(snapshot)} chars). Planning...")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=ORCHESTRATOR_MODEL,
        contents=f"Here is the full project snapshot:\n\n{snapshot}",
        config=types.GenerateContentConfig(system_instruction=DISCOVERY_SYSTEM),
    )
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    items = json.loads(raw)
    subtasks = []
    for item in items:
        if verbose:
            print(f"  → [{item['agent'].upper()}] {item['task'][:80]}...")
            if "rationale" in item:
                print(f"       Why: {item['rationale']}")
        subtasks.append(SubTask(
            agent=item["agent"],
            task=item["task"],
            depends_on=item.get("depends_on", []),
        ))
    return subtasks


# ── Manual planner ────────────────────────────────────────────────────────────

PLANNER_SYSTEM = """\
You are a task router for a multi-agent software engineering system.
Given a user request, decompose it into sub-tasks and assign each to the correct agent.

Available agents:
  ui   — edits frontend/  (HTML, CSS, JavaScript)
  api  — edits backend/   (FastAPI endpoints, Python logic)
  test — writes & runs pytest tests in tests/

Output ONLY a JSON array — no prose, no markdown fences:
[
  {"agent": "api",  "task": "...", "depends_on": []},
  {"agent": "ui",   "task": "...", "depends_on": []},
  {"agent": "test", "task": "...", "depends_on": ["api"]}
]

Rules:
- Minimal sub-tasks that fully cover the request.
- Use depends_on when ordering matters.
- Always include a test sub-task that depends on any api sub-task unless told "no tests".
"""


def _plan(api_key: str, user_task: str) -> list[SubTask]:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=ORCHESTRATOR_MODEL,
        contents=user_task,
        config=types.GenerateContentConfig(system_instruction=PLANNER_SYSTEM),
    )
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    items = json.loads(raw)
    return [SubTask(**item) for item in items]


# ── Summariser ────────────────────────────────────────────────────────────────

SUMMARISER_SYSTEM = """\
You are a tech lead writing a concise pull-request summary.
Given the outputs from multiple specialist agents, produce a short (max 200 words)
summary of all changes made, grouped by layer (Frontend / Backend / Tests).
Use bullet points. Be factual and precise.
"""


def _summarise(api_key: str, results: dict[str, AgentResult]) -> str:
    combined = "\n\n".join(
        f"=== {r.agent_name.upper()} AGENT ({r.turns} turns) ===\n{r.answer}"
        for r in results.values()
    )
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=ORCHESTRATOR_MODEL,
        contents=combined,
        config=types.GenerateContentConfig(system_instruction=SUMMARISER_SYSTEM),
    )
    return response.text.strip()


# ── Agent dispatcher ──────────────────────────────────────────────────────────

_AGENT_MAP = {"ui": ui_agent, "api": api_agent, "test": test_agent}


def _run_subtask(api_key: str, subtask: SubTask, verbose: bool) -> AgentResult:
    return _AGENT_MAP[subtask.agent].run(api_key, subtask.task, verbose=verbose)


# ── Sequential execution ──────────────────────────────────────────────────────

def run_sequential(
    api_key: str,
    subtasks: list[SubTask],
    verbose: bool = True,
) -> dict[str, AgentResult]:
    results: dict[str, AgentResult] = {}
    remaining = list(subtasks)

    while remaining:
        ready = [st for st in remaining if all(dep in results for dep in st.depends_on)]
        if not ready:
            raise RuntimeError(f"Circular dependency or unresolvable deps: {remaining}")
        for st in ready:
            if verbose:
                print(f"\n{'─'*60}")
                print(f"  Dispatching [{st.agent.upper()} AGENT] (Gemini Flash)")
                print(f"  Task: {st.task}")
                print(f"{'─'*60}")
            results[st.agent] = _run_subtask(api_key, st, verbose)
            remaining.remove(st)

    return results


# ── Parallel execution ────────────────────────────────────────────────────────

def run_parallel(
    api_key: str,
    subtasks: list[SubTask],
    verbose: bool = True,
) -> dict[str, AgentResult]:
    results: dict[str, AgentResult] = {}
    futures: dict[str, concurrent.futures.Future] = {}
    remaining = list(subtasks)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        while remaining or futures:
            to_submit = [st for st in remaining if all(dep in results for dep in st.depends_on)]
            for st in to_submit:
                if verbose:
                    print(f"\n  [PARALLEL] Launching [{st.agent.upper()} AGENT]: {st.task[:60]}...")
                futures[st.agent] = pool.submit(_run_subtask, api_key, st, verbose)
                remaining.remove(st)
            if futures:
                done, _ = concurrent.futures.wait(
                    futures.values(), timeout=1,
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )
                for future in done:
                    agent_name = next(k for k, v in futures.items() if v is future)
                    results[agent_name] = future.result()
                    del futures[agent_name]

    return results


# ── Public entry points ───────────────────────────────────────────────────────

def _finish(api_key, subtasks, results, mode, verbose, summarise):
    runner = run_parallel if mode == "parallel" else run_sequential
    results = runner(api_key, subtasks, verbose=verbose)

    summary = ""
    if summarise and results:
        if verbose:
            print(f"\n{'─'*60}")
            print("  ORCHESTRATOR (Gemini-Pro) — generating summary")
            print(f"{'─'*60}")
        summary = _summarise(api_key, results)

    if verbose and summary:
        print(f"\n{'═'*60}")
        print("  FINAL SUMMARY")
        print(f"{'═'*60}")
        print(textwrap.indent(summary, "  "))

    return {"plan": [{"agent": st.agent, "task": st.task} for st in subtasks],
            "results": results, "summary": summary}


def orchestrate(
    task: str,
    api_key: str | None = None,
    mode: Literal["sequential", "parallel"] = "sequential",
    verbose: bool = True,
    summarise: bool = True,
) -> dict:
    """Run the pipeline for a user-supplied task."""
    key = api_key or os.environ["GEMINI_API_KEY"]

    if verbose:
        print(f"\n{'═'*60}")
        print(f"  ORCHESTRATOR (Gemini-Pro) — planning task")
        print(f"  {task[:100]}")
        print(f"{'═'*60}")

    subtasks = _plan(key, task)

    if verbose:
        print(f"\n  Plan ({len(subtasks)} sub-task(s)):")
        for i, st in enumerate(subtasks, 1):
            deps = f"  [depends on: {st.depends_on}]" if st.depends_on else ""
            print(f"    {i}. [{st.agent.upper()}] {st.task[:80]}{deps}")

    return _finish(key, subtasks, {}, mode, verbose, summarise)


def autodiscover(
    api_key: str | None = None,
    mode: Literal["sequential", "parallel"] = "sequential",
    verbose: bool = True,
    summarise: bool = True,
) -> dict:
    """Autonomous mode: Gemini Pro reads the project, decides what needs doing."""
    key = api_key or os.environ["GEMINI_API_KEY"]

    if verbose:
        print(f"\n{'═'*60}")
        print("  ORCHESTRATOR (Gemini-Pro) — autonomous project discovery")
        print(f"{'═'*60}")

    subtasks = _discover_tasks(key, verbose=verbose)

    if not subtasks:
        print("  No tasks found. Project looks good!")
        return {"plan": [], "results": {}, "summary": ""}

    if verbose:
        print(f"\n  Assigned {len(subtasks)} task(s). Starting agents...\n")

    return _finish(key, subtasks, {}, mode, verbose, summarise)
