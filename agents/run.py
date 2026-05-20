"""
CLI entry point for the multi-agent orchestrator.

Usage:
  python -m agents.run "Add a /health endpoint to the API and show a green banner in the UI"
  python -m agents.run --mode parallel "Add dark-mode toggle"
  python -m agents.run --agents api,test "Add POST /feedback endpoint with tests"
  python -m agents.run --dry-run "Refactor the scan endpoint"

Environment:
  ANTHROPIC_API_KEY  — required (or pass --api-key)
"""

import argparse
import os
import sys
from pathlib import Path

# Allow `python -m agents.run` from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.orchestrator import orchestrate


def main():
    parser = argparse.ArgumentParser(
        description="VerifyMe multi-agent orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("task", nargs="?", help="Natural-language task to perform")
    parser.add_argument(
        "--mode", choices=["sequential", "parallel"], default="sequential",
        help="Execution mode (default: sequential)",
    )
    parser.add_argument(
        "--agents", default=None,
        help="Comma-separated agent override, e.g. 'api,test' (skips planning)",
    )
    parser.add_argument(
        "--no-summary", action="store_true", help="Skip final summary generation",
    )
    parser.add_argument(
        "--quiet", action="store_true", help="Suppress verbose turn-by-turn output",
    )
    parser.add_argument(
        "--api-key", default=None, help="Anthropic API key (overrides env var)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print the plan only, don't execute agents",
    )
    args = parser.parse_args()

    # Interactive mode if no task given
    if not args.task:
        print("VerifyMe Multi-Agent Orchestrator")
        print("──────────────────────────────────")
        print("Examples:")
        print('  "Add a GET /health endpoint that returns {status: ok}"')
        print('  "Add a loading spinner to the video upload button"')
        print('  "Add tests for the /scan endpoint covering 400 errors"')
        print('  "Add dark mode toggle to settings and a /theme API endpoint"\n')
        args.task = input("Task: ").strip()
        if not args.task:
            print("No task provided. Exiting.")
            sys.exit(0)

    api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable or pass --api-key")
        sys.exit(1)

    if args.dry_run:
        # Plan only, don't execute
        import anthropic
        from agents.orchestrator import _plan
        client = anthropic.Anthropic(api_key=api_key)
        subtasks = _plan(client, args.task)
        print("\nDRY RUN — Plan only:\n")
        for i, st in enumerate(subtasks, 1):
            deps = f"  → depends on: {st.depends_on}" if st.depends_on else ""
            print(f"  {i}. [{st.agent.upper()}] {st.task}{deps}")
        return

    orchestrate(
        task=args.task,
        api_key=api_key,
        mode=args.mode,
        verbose=not args.quiet,
        summarise=not args.no_summary,
    )


if __name__ == "__main__":
    main()
