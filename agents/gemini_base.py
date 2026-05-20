"""
Gemini-backed agentic loop using the new google-genai SDK (v2+).

Orchestrator  → gemini-2.5-pro   (plan + summarise)
Worker agents → gemini-2.5-flash  (UI / API / Test)
"""

from __future__ import annotations

from google import genai
from google.genai import types

from .tools import TOOL_DISPATCH

ORCHESTRATOR_MODEL = "gemini-2.5-flash"  # free tier: 500 req/day (pro has 0 free)
AGENT_MODEL        = "gemini-2.5-flash"  # free tier: 500 req/day
MAX_TURNS          = 20


class AgentResult:
    def __init__(self, agent_name: str, task: str, answer: str, turns: int):
        self.agent_name = agent_name
        self.task       = task
        self.answer     = answer
        self.turns      = turns

    def __str__(self):
        return f"[{self.agent_name}] ({self.turns} turns)\n{self.answer}"


# ── Tool schema conversion ────────────────────────────────────────────────────
# Anthropic: "input_schema" → Gemini: "parameters" (same JSON Schema structure)

def _to_gemini_tools(anthropic_schemas: list[dict]) -> list[types.Tool]:
    declarations = []
    for s in anthropic_schemas:
        params = s.get("input_schema", {})
        declarations.append(
            types.FunctionDeclaration(
                name=s["name"],
                description=s.get("description", ""),
                parameters=_convert_schema(params),
            )
        )
    return [types.Tool(function_declarations=declarations)]


def _convert_schema(schema: dict) -> dict:
    """Convert Anthropic JSON Schema to Gemini-compatible schema dict."""
    result = {"type": schema.get("type", "object").upper()}
    if "properties" in schema:
        result["properties"] = {
            k: _convert_schema(v) for k, v in schema["properties"].items()
        }
    if "required" in schema:
        result["required"] = schema["required"]
    if "description" in schema:
        result["description"] = schema["description"]
    if "items" in schema:
        result["items"] = _convert_schema(schema["items"])
    return result


# ── Agentic loop ──────────────────────────────────────────────────────────────

def run_agent(
    *,
    api_key: str,
    agent_name: str,
    system_prompt: str,
    task: str,
    tools: list[dict],
    model: str = AGENT_MODEL,
    verbose: bool = True,
) -> AgentResult:
    client = genai.Client(api_key=api_key)
    gemini_tools = _to_gemini_tools(tools) if tools else None

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=gemini_tools,
    )

    if verbose:
        _log(agent_name, f"Starting: {task[:120]}...")

    # Build conversation history manually
    contents: list[types.Content] = [
        types.Content(role="user", parts=[types.Part(text=task)])
    ]

    turn = 0
    while turn < MAX_TURNS:
        turn += 1
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )

        candidate = response.candidates[0]
        assistant_parts = list(candidate.content.parts)

        # Append assistant response to history
        contents.append(types.Content(role="model", parts=assistant_parts))

        # Collect function calls
        function_calls = [p.function_call for p in assistant_parts if p.function_call]

        if not function_calls:
            # Done — extract text
            final_text = "".join(
                p.text for p in assistant_parts if hasattr(p, "text") and p.text
            ).strip()
            if verbose:
                _log(agent_name, f"Done in {turn} turn(s).")
            return AgentResult(agent_name, task, final_text, turn)

        # Execute tools
        result_parts: list[types.Part] = []
        for fc in function_calls:
            fn = TOOL_DISPATCH.get(fc.name)
            if fn is None:
                result = f"ERROR: unknown tool '{fc.name}'"
            else:
                try:
                    result = fn(**dict(fc.args))
                except Exception as exc:
                    result = f"ERROR: {exc}"

            if verbose:
                _log(agent_name, f"  tool={fc.name} → {str(result)[:80]}...")

            result_parts.append(
                types.Part.from_function_response(
                    name=fc.name,
                    response={"result": str(result)},
                )
            )

        # Append tool results as user turn
        contents.append(types.Content(role="user", parts=result_parts))

    return AgentResult(agent_name, task, "(MAX_TURNS exceeded)", turn)


def _log(name: str, msg: str):
    print(f"  [{name}] {msg}")
