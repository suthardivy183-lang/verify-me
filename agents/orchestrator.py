"""
Orchestrator — receives a high-level task, uses Claude to decompose it into
sub-tasks, assigns each to the right specialist agent, and assembles the report.

Execution modes:
  sequential  — agents run one-after-another (API → UI → Test is the default order)
  parallel    — agents run concurrently via asyncio (faster, but log output interleaves)
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import os
import textwrap
from dataclasses import dataclass, field
from typing import Literal

import anthropic

from . import ui_agent, api_agent, test_agent
from .base_agent import AgentResult, MODEL

# ── Sub-task dataclass ────────────────────────────────────────────────────────

@dataclass
class SubTask:
    agent: Literal["ui", "api", "test"]
    task: str
    depends_on: list[str] = field(default_factory=list)  # agent names that must run first


# ── Planner ───────────────────────────────────────────────────────────────────

PLANNER_SYSTEM = """\
You are a task router for a multi-agent software engineering system.
Given a user request, decompose it into sub-tasks and assign each to the correct agent.

Available agents:
  ui   — edits frontend/  (HTML, CSS, JavaScript)
  api  — edits backend/   (FastAPI endpoints, Python logic)
  test — writes & runs pytest tests in tests/

Output ONLY a JSON array of objects, no prose:
[
  {"agent": "api",  "task": "...", "depends_on": []},
  {"agent": "ui",   "task": "...", "depends_on": []},
  {"agent": "test", "task": "...", "depends_on": ["api"]}
]

Rules:
- Split the user request into the minimal number of sub-tasks that cover it fully.
- A sub-task should be self-contained and unambiguous.
- Use depends_on when one agent needs the other to finish first (e.g. test depends on api).
- If the request is purely frontend, return only a ui sub-task.
- If the request is purely backend, return only an api sub-task.
- Always include a test sub-task that depends on any api sub-task unless the user explicitly
  says "no tests".
"""


def _plan(client: anthropic.Anthropic, user_task: str) -> list[SubTask]:
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=PLANNER_SYSTEM,
        messages=[{"role": "user", "content": user_task}],
    )
    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    items = json.loads(raw)
    return [SubTask(**item) for item in items]


# ── Agent dispatcher ──────────────────────────────────────────────────────────

_AGENT_MAP = {"ui": ui_agent, "api": api_agent, "test": test_agent}


def _run_subtask(client: anthropic.Anthropic, subtask: SubTask, verbose: bool) -> AgentResult:
    module = _AGENT_MAP[subtask.agent]
    return module.run(client, subtask.task, verbose=verbose)


# ── Sequential execution ──────────────────────────────────────────────────────

def run_sequential(
    client: anthropic.Anthropic,
    subtasks: list[SubTask],
    verbose: bool = True,
) -> dict[str, AgentResult]:
    """
    Run sub-tasks in dependency order:
    agents with no depends_on first, then those that depend on completed ones.
    """
    results: dict[str, AgentResult] = {}
    remaining = list(subtasks)

    while remaining:
        # Find all tasks whose dependencies are satisfied
        ready = [
            st for st in remaining
            if all(dep in results for dep in st.depends_on)
        ]
        if not ready:
            raise RuntimeError(f"Circular dependency or unresolvable deps: {remaining}")

        for st in ready:
            if verbose:
                print(f"\n{'─'*60}")
                print(f"  Dispatching [{st.agent.upper()} AGENT]")
                print(f"  Task: {st.task}")
                print(f"{'─'*60}")
            result = _run_subtask(client, st, verbose)
            results[st.agent] = result
            remaining.remove(st)

    return results


# ── Parallel execution ────────────────────────────────────────────────────────

def run_parallel(
    client: anthropic.Anthropic,
    subtasks: list[SubTask],
    verbose: bool = True,
) -> dict[str, AgentResult]:
    """
    Run independent sub-tasks concurrently using a thread pool.
    Tasks with depends_on still wait for their dependencies.
    """
    results: dict[str, AgentResult] = {}
    futures: dict[str, concurrent.futures.Future] = {}
    remaining = list(subtasks)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        while remaining or futures:
            # Submit all ready tasks
            to_submit = [
                st for st in remaining
                if all(dep in results for dep in st.depends_on)
            ]
            for st in to_submit:
                if verbose:
                    print(f"\n  [PARALLEL] Launching [{st.agent.upper()} AGENT]: {st.task[:60]}...")
                futures[st.agent] = pool.submit(_run_subtask, client, st, verbose)
                remaining.remove(st)

            # Collect any completed futures
            if futures:
                done, _ = concurrent.futures.wait(
                    futures.values(),
                    timeout=1,
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )
                for future in done:
                    # Find which agent this future belongs to
                    agent_name = next(k for k, v in futures.items() if v is future)
                    results[agent_name] = future.result()
                    del futures[agent_name]

    return results


# ── Summariser ────────────────────────────────────────────────────────────────

SUMMARISER_SYSTEM = """\
You are a tech lead writing a concise pull-request summary.
Given the outputs from multiple specialist agents, produce a short (max 200 words)
summary of all changes made, grouped by layer (Frontend / Backend / Tests).
Use bullet points. Be factual and precise.
"""


def _summarise(client: anthropic.Anthropic, results: dict[str, AgentResult]) -> str:
    combined = "\n\n".join(
        f"=== {r.agent_name.upper()} AGENT ({r.turns} turns) ===\n{r.answer}"
        for r in results.values()
    )
    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=SUMMARISER_SYSTEM,
        messages=[{"role": "user", "content": combined}],
    )
    return response.content[0].text.strip()


# ── Main entry point ──────────────────────────────────────────────────────────

def orchestrate(
    task: str,
    api_key: str | None = None,
    mode: Literal["sequential", "parallel"] = "sequential",
    verbose: bool = True,
    summarise: bool = True,
) -> dict:
    """
    Run the full multi-agent pipeline for a given task.

    Returns a dict:
      {
        "plan": [{"agent": ..., "task": ...}, ...],
        "results": {agent_name: AgentResult},
        "summary": "..."   # only if summarise=True
      }
    """
    client = anthropic.Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])

    # ── 1. Plan ──────────────────────────────────────────────────────────────
    if verbose:
        print(f"\n{'═'*60}")
        print(f"  ORCHESTRATOR — planning task")
        print(f"  {task[:100]}")
        print(f"{'═'*60}")

    subtasks = _plan(client, task)

    if verbose:
        print(f"\n  Plan ({len(subtasks)} sub-task(s)):")
        for i, st in enumerate(subtasks, 1):
            deps = f"  [depends on: {st.depends_on}]" if st.depends_on else ""
            print(f"    {i}. [{st.agent.upper()}] {st.task[:80]}...{deps}")

    # ── 2. Execute ───────────────────────────────────────────────────────────
    runner = run_parallel if mode == "parallel" else run_sequential
    results = runner(client, subtasks, verbose=verbose)

    # ── 3. Summarise ─────────────────────────────────────────────────────────
    summary = ""
    if summarise and results:
        if verbose:
            print(f"\n{'─'*60}")
            print("  ORCHESTRATOR — generating summary")
            print(f"{'─'*60}")
        summary = _summarise(client, results)

    if verbose and summary:
        print(f"\n{'═'*60}")
        print("  FINAL SUMMARY")
        print(f"{'═'*60}")
        print(textwrap.indent(summary, "  "))

    return {
        "plan": [{"agent": st.agent, "task": st.task} for st in subtasks],
        "results": results,
        "summary": summary,
    }
