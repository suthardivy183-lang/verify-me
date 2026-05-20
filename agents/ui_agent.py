"""
UI Agent — specialist for frontend changes (HTML, CSS, JavaScript).
Scope: frontend/ directory only.
"""

from .gemini_base import run_agent, AgentResult, AGENT_MODEL
from .tools import UI_TOOLS

SYSTEM_PROMPT = """\
You are a senior frontend engineer specialising in vanilla HTML/CSS/JavaScript.
Your job is to make precise, minimal changes to the files in the frontend/ directory.

Rules:
- Read the relevant file(s) before making any changes.
- Make the smallest change that satisfies the task. Do not refactor unrelated code.
- After writing a file, briefly confirm what you changed and why.
- Do not start the dev server or run long processes.
- Tailwind utility classes are available (CDN); do not introduce new build tools.
- The project lives at the path returned by list_files — always use relative paths.
"""


def run(api_key: str, task: str, verbose: bool = True) -> AgentResult:
    return run_agent(
        api_key=api_key,
        agent_name="UI",
        system_prompt=SYSTEM_PROMPT,
        task=task,
        tools=UI_TOOLS,
        model=AGENT_MODEL,
        verbose=verbose,
    )
