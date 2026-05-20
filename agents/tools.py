"""
Shared tool definitions for all agents.
Each agent receives a scoped subset of these tools.
"""

import os
import subprocess
import glob as glob_module
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent


# ---------------------------------------------------------------------------
# Tool implementations (called by the agent runner when Claude invokes a tool)
# ---------------------------------------------------------------------------

def read_file(path: str) -> str:
    abs_path = _resolve(path)
    try:
        return abs_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return f"ERROR: File not found: {path}"
    except Exception as e:
        return f"ERROR: {e}"


def write_file(path: str, content: str) -> str:
    abs_path = _resolve(path)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(content, encoding="utf-8")
    return f"OK: wrote {len(content)} chars to {path}"


def list_files(directory: str, pattern: str = "*") -> str:
    abs_dir = _resolve(directory)
    if not abs_dir.exists():
        return f"ERROR: Directory not found: {directory}"
    matches = sorted(abs_dir.glob(pattern))
    lines = [
        str(p.relative_to(PROJECT_ROOT)) if p.is_relative_to(PROJECT_ROOT) else str(p)
        for p in matches if p.is_file()
    ]
    return "\n".join(lines) if lines else "(no files matched)"


def search_in_files(pattern: str, directory: str) -> str:
    abs_dir = _resolve(directory)
    try:
        result = subprocess.run(
            ["grep", "-rn", "--include=*.py", "--include=*.js",
             "--include=*.html", "--include=*.css", pattern, str(abs_dir)],
            capture_output=True, text=True, timeout=10,
        )
        out = result.stdout.strip()
        # Trim to 4000 chars so we don't blow the context window
        return out[:4000] if out else "(no matches)"
    except subprocess.TimeoutExpired:
        return "ERROR: grep timed out"


def run_command(command: str, cwd: str | None = None) -> str:
    """Run a shell command; restricted to safe prefixes."""
    allowed_prefixes = (
        "pytest", "python", "pip", "curl", "cat", "ls", "find",
        "grep", "wc", "echo", "uvicorn --version", "npm",
    )
    cmd_lower = command.lstrip()
    if not any(cmd_lower.startswith(p) for p in allowed_prefixes):
        return f"BLOCKED: command not in allowlist — '{command}'"
    abs_cwd = str(_resolve(cwd)) if cwd else str(PROJECT_ROOT)
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=60, cwd=abs_cwd,
        )
        output = (result.stdout + result.stderr).strip()
        return output[:4000] if output else "(no output)"
    except subprocess.TimeoutExpired:
        return "ERROR: command timed out (60 s)"
    except Exception as e:
        return f"ERROR: {e}"


def _resolve(path: str) -> Path:
    p = Path(path)
    if not p.is_absolute():
        p = PROJECT_ROOT / p
    return p.resolve()


# ---------------------------------------------------------------------------
# Tool schemas (sent to Claude via the API)
# ---------------------------------------------------------------------------

READ_FILE_SCHEMA = {
    "name": "read_file",
    "description": "Read the full contents of a file. Path is relative to the project root.",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "File path relative to project root, e.g. 'frontend/app.js'"},
        },
        "required": ["path"],
    },
}

WRITE_FILE_SCHEMA = {
    "name": "write_file",
    "description": "Write (overwrite) a file with the given content. Creates parent directories as needed.",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string", "description": "Full file content to write"},
        },
        "required": ["path", "content"],
    },
}

LIST_FILES_SCHEMA = {
    "name": "list_files",
    "description": "List files in a directory, optionally filtered by glob pattern.",
    "input_schema": {
        "type": "object",
        "properties": {
            "directory": {"type": "string"},
            "pattern": {"type": "string", "default": "*"},
        },
        "required": ["directory"],
    },
}

SEARCH_IN_FILES_SCHEMA = {
    "name": "search_in_files",
    "description": "Grep for a pattern across source files in a directory.",
    "input_schema": {
        "type": "object",
        "properties": {
            "pattern": {"type": "string"},
            "directory": {"type": "string"},
        },
        "required": ["pattern", "directory"],
    },
}

RUN_COMMAND_SCHEMA = {
    "name": "run_command",
    "description": (
        "Run a shell command (pytest, python, curl, ls, grep, etc.). "
        "cwd defaults to project root. Commands outside the allowlist are blocked."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "command": {"type": "string"},
            "cwd": {"type": "string", "description": "Working directory (relative to project root)"},
        },
        "required": ["command"],
    },
}

# Per-agent tool sets
UI_TOOLS    = [READ_FILE_SCHEMA, WRITE_FILE_SCHEMA, LIST_FILES_SCHEMA, SEARCH_IN_FILES_SCHEMA]
API_TOOLS   = [READ_FILE_SCHEMA, WRITE_FILE_SCHEMA, LIST_FILES_SCHEMA, SEARCH_IN_FILES_SCHEMA, RUN_COMMAND_SCHEMA]
TEST_TOOLS  = [READ_FILE_SCHEMA, WRITE_FILE_SCHEMA, LIST_FILES_SCHEMA, SEARCH_IN_FILES_SCHEMA, RUN_COMMAND_SCHEMA]

TOOL_DISPATCH = {
    "read_file": read_file,
    "write_file": write_file,
    "list_files": list_files,
    "search_in_files": search_in_files,
    "run_command": run_command,
}
