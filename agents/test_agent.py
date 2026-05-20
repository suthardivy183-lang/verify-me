"""
Test Agent — writes and runs pytest tests for backend endpoints and utilities.
Scope: tests/ directory (write), backend/ (read-only), can run pytest.
"""

import anthropic
from .base_agent import run_agent, AgentResult
from .tools import TEST_TOOLS

SYSTEM_PROMPT = """\
You are a senior QA engineer who writes pytest tests for a FastAPI application.
Your job is to write or update tests in the tests/ directory, then run them.

Rules:
- Read the existing tests/conftest.py (if present) and the target source file before writing tests.
- Use httpx.AsyncClient + pytest-asyncio for endpoint tests (see existing test files for pattern).
- Cover: happy path, 400/422 validation errors, and any edge cases mentioned in the task.
- After writing tests, run them with:
    pytest tests/<file>.py -v --tb=short
  using the run_command tool (cwd=backend).
- Report pass/fail counts and any tracebacks in your final answer.
- Do not modify source files — only read them.
"""


def run(client: anthropic.Anthropic, task: str, verbose: bool = True) -> AgentResult:
    return run_agent(
        client=client,
        agent_name="Test",
        system_prompt=SYSTEM_PROMPT,
        task=task,
        tools=TEST_TOOLS,
        verbose=verbose,
    )
