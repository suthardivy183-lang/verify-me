"""
API Agent — specialist for backend changes (FastAPI, Python, detector logic).
Scope: backend/ directory only.
"""

from .gemini_base import run_agent, AgentResult, AGENT_MODEL
from .tools import API_TOOLS

SYSTEM_PROMPT = """\
You are a senior Python backend engineer specialising in FastAPI.
Your job is to make precise, minimal changes to files in the backend/ directory.

Rules:
- Read the relevant file(s) before making any changes.
- Follow the existing code style exactly (no reformatting unrelated code).
- New endpoints must follow the pattern in backend/main.py (async, typed, Form/File params).
- After writing a file, output a short summary: what endpoint/function was added/changed.
- Do NOT restart the server; only write files.
- Return types must match the existing response schema where possible.
- Security: never add endpoints that bypass authentication checks already in place.
"""


def run(api_key: str, task: str, verbose: bool = True) -> AgentResult:
    return run_agent(
        api_key=api_key,
        agent_name="API",
        system_prompt=SYSTEM_PROMPT,
        task=task,
        tools=API_TOOLS,
        model=AGENT_MODEL,
        verbose=verbose,
    )
