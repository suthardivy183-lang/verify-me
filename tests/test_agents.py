"""
Unit tests for the multi-agent orchestration system.
These tests mock the Anthropic API so no real API key is needed.
"""

import json
from unittest.mock import MagicMock, patch, call
import pytest

from agents.tools import read_file, write_file, list_files, run_command, TOOL_DISPATCH
from agents.base_agent import run_agent, AgentResult
from agents.orchestrator import _plan, SubTask, run_sequential


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_text_response(text: str, stop_reason: str = "end_turn"):
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    response.stop_reason = stop_reason
    return response


def _make_tool_then_text_response(tool_name: str, tool_input: dict, tool_id: str, text: str):
    """First call returns a tool_use block; second call returns final text."""
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.id = tool_id
    tool_block.name = tool_name
    tool_block.input = tool_input

    resp1 = MagicMock()
    resp1.content = [tool_block]
    resp1.stop_reason = "tool_use"

    resp2 = _make_text_response(text)
    return resp1, resp2


# ── tools.py ─────────────────────────────────────────────────────────────────

class TestTools:
    def test_read_file_missing(self, tmp_path):
        result = read_file(str(tmp_path / "nonexistent.txt"))
        assert result.startswith("ERROR:")

    def test_write_then_read(self, tmp_path):
        path = str(tmp_path / "sub" / "file.txt")
        result = write_file(path, "hello world")
        assert result.startswith("OK:")
        assert read_file(path) == "hello world"

    def test_list_files(self, tmp_path):
        (tmp_path / "a.py").write_text("x")
        (tmp_path / "b.py").write_text("y")
        result = list_files(str(tmp_path), "*.py")
        assert "a.py" in result
        assert "b.py" in result

    def test_run_command_allowlisted(self):
        result = run_command("echo hello")
        assert "hello" in result

    def test_run_command_blocked(self):
        result = run_command("rm -rf /tmp/something")
        assert result.startswith("BLOCKED:")

    def test_tool_dispatch_complete(self):
        for name in ["read_file", "write_file", "list_files", "search_in_files", "run_command"]:
            assert name in TOOL_DISPATCH


# ── base_agent.py ─────────────────────────────────────────────────────────────

class TestBaseAgent:
    def test_single_turn_text(self):
        """Agent completes in one turn with no tool calls."""
        client = MagicMock()
        client.messages.create.return_value = _make_text_response("All done.")

        result = run_agent(
            client=client,
            agent_name="TestAgent",
            system_prompt="You are helpful.",
            task="Say hi",
            tools=[],
            verbose=False,
        )

        assert isinstance(result, AgentResult)
        assert result.answer == "All done."
        assert result.turns == 1
        assert result.agent_name == "TestAgent"

    def test_tool_use_then_done(self):
        """Agent calls one tool then returns a final answer."""
        client = MagicMock()
        resp1, resp2 = _make_tool_then_text_response(
            tool_name="run_command",
            tool_input={"command": "echo hello"},
            tool_id="tu_1",
            text="Command output was: hello",
        )
        client.messages.create.side_effect = [resp1, resp2]

        result = run_agent(
            client=client,
            agent_name="TestAgent",
            system_prompt="You are helpful.",
            task="Run echo hello",
            tools=[],
            verbose=False,
        )

        assert result.turns == 2
        assert "hello" in result.answer
        # Verify tool was dispatched (run_command → echo hello → "hello")
        assert client.messages.create.call_count == 2

    def test_max_turns_guard(self):
        """Agent that never stops gets cut off at MAX_TURNS."""
        client = MagicMock()
        # Always return a tool_use block (infinite loop scenario)
        tool_block = MagicMock()
        tool_block.type = "tool_use"
        tool_block.id = "tu_x"
        tool_block.name = "run_command"
        tool_block.input = {"command": "echo loop"}

        resp = MagicMock()
        resp.content = [tool_block]
        resp.stop_reason = "tool_use"
        client.messages.create.return_value = resp

        from agents.base_agent import MAX_TURNS
        result = run_agent(
            client=client,
            agent_name="TestAgent",
            system_prompt="",
            task="Loop forever",
            tools=[],
            verbose=False,
        )
        assert result.turns == MAX_TURNS
        assert "MAX_TURNS" in result.answer


# ── orchestrator.py ───────────────────────────────────────────────────────────

class TestOrchestrator:
    def test_plan_parses_json(self):
        """_plan returns a list of SubTask objects from a JSON response."""
        client = MagicMock()
        plan_json = json.dumps([
            {"agent": "api", "task": "Add /health endpoint", "depends_on": []},
            {"agent": "test", "task": "Test /health endpoint", "depends_on": ["api"]},
        ])
        client.messages.create.return_value = _make_text_response(plan_json)

        subtasks = _plan(client, "Add a health endpoint with tests")

        assert len(subtasks) == 2
        assert subtasks[0].agent == "api"
        assert subtasks[1].depends_on == ["api"]

    def test_plan_strips_markdown_fences(self):
        client = MagicMock()
        fenced = '```json\n[{"agent": "ui", "task": "Add button", "depends_on": []}]\n```'
        client.messages.create.return_value = _make_text_response(fenced)

        subtasks = _plan(client, "Add a button")
        assert len(subtasks) == 1
        assert subtasks[0].agent == "ui"

    def test_sequential_respects_dependency_order(self):
        """API agent must complete before Test agent runs."""
        call_order = []

        def fake_api_run(client, task, verbose):
            call_order.append("api")
            return AgentResult("API", task, "endpoint added", 1)

        def fake_test_run(client, task, verbose):
            call_order.append("test")
            return AgentResult("Test", task, "tests passed", 1)

        subtasks = [
            SubTask(agent="api",  task="Add /health", depends_on=[]),
            SubTask(agent="test", task="Test /health", depends_on=["api"]),
        ]

        import agents.api_agent as api_mod
        import agents.test_agent as test_mod

        with patch.object(api_mod,  "run", fake_api_run), \
             patch.object(test_mod, "run", fake_test_run):
            results = run_sequential(MagicMock(), subtasks, verbose=False)

        assert call_order == ["api", "test"]
        assert "api"  in results
        assert "test" in results

    def test_circular_dependency_raises(self):
        subtasks = [
            SubTask(agent="api",  task="x", depends_on=["test"]),
            SubTask(agent="test", task="y", depends_on=["api"]),
        ]
        with pytest.raises(RuntimeError, match="Circular"):
            run_sequential(MagicMock(), subtasks, verbose=False)
