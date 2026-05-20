"""
Base agentic loop: sends messages to Claude, handles tool-use turns,
and continues until Claude emits a final text response (no more tool calls).
"""

import json
import time
from typing import Any

import anthropic

from .tools import TOOL_DISPATCH

# Default model for all agents — swap to claude-opus-4-7 for highest capability
MODEL = "claude-sonnet-4-6"
MAX_TURNS = 20  # hard cap to prevent runaway loops


class AgentResult:
    def __init__(self, agent_name: str, task: str, answer: str, turns: int):
        self.agent_name = agent_name
        self.task = task
        self.answer = answer
        self.turns = turns

    def __str__(self):
        return f"[{self.agent_name}] ({self.turns} turns)\n{self.answer}"


def run_agent(
    *,
    client: anthropic.Anthropic,
    agent_name: str,
    system_prompt: str,
    task: str,
    tools: list[dict],
    verbose: bool = True,
) -> AgentResult:
    """
    Run a single agent to completion.

    The agent loop:
      1. Send messages → Claude may respond with tool_use blocks
      2. Execute every requested tool
      3. Append tool_result blocks and loop
      4. When Claude responds with stop_reason='end_turn' (no tool calls), return
    """
    messages: list[dict[str, Any]] = [{"role": "user", "content": task}]
    turn = 0

    if verbose:
        _log(agent_name, f"Starting task: {task[:120]}...")

    while turn < MAX_TURNS:
        turn += 1

        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            tools=tools,
            messages=messages,
        )

        # Collect all content blocks from this response
        assistant_content: list[dict] = []
        tool_calls: list[dict] = []
        final_text: str = ""

        for block in response.content:
            if block.type == "text":
                final_text = block.text
                assistant_content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                tool_calls.append(block)
                assistant_content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })

        # Always append the assistant turn before tool results
        messages.append({"role": "assistant", "content": assistant_content})

        if response.stop_reason == "end_turn" or not tool_calls:
            # Claude is done — return final text
            if verbose:
                _log(agent_name, f"Done in {turn} turn(s).")
            return AgentResult(agent_name, task, final_text, turn)

        # Execute tools and build the tool_result message
        tool_results: list[dict] = []
        for tc in tool_calls:
            fn = TOOL_DISPATCH.get(tc.name)
            if fn is None:
                result_content = f"ERROR: unknown tool '{tc.name}'"
            else:
                try:
                    result_content = fn(**tc.input)
                except Exception as exc:
                    result_content = f"ERROR: {exc}"

            if verbose:
                _log(agent_name, f"  tool={tc.name} → {str(result_content)[:80]}...")

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tc.id,
                "content": str(result_content),
            })

        messages.append({"role": "user", "content": tool_results})

    # Exceeded MAX_TURNS
    return AgentResult(agent_name, task, "(MAX_TURNS exceeded — partial result)", turn)


def _log(agent_name: str, msg: str):
    print(f"  [{agent_name}] {msg}")
