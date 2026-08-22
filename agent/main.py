"""
main.py — Phase 1: Google ADK + Gemini 3.5 orchestration loop entrypoint.

Implements PRD §6 Phase 1 (Days 1-4): "Initialize openx-deep-research-analyst
repository. Configure Google ADK and instantiate the Gemini 3.5 orchestration
loop. Integrate the Google Workspace CLI (gws) as a basic local tool."

This is a runnable skeleton, not the full wrapper app — Phase 2 (payment/MCP
gateway wiring, PRD §6 Days 5-8) is explicitly NOT implemented here. See
tools/gws_tool.py for the one Phase-1 tool integration and gateway_client.py
for the (currently unused) Phase-2 stub.
"""
from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

from tools.gws_tool import gws_read_sheet_stub

load_dotenv()

MODEL = os.environ.get("OPENX_MODEL", "gemini-3.5")


def build_orchestrator():
    """
    Instantiate the Gemini 3.5 ADK orchestration loop.

    TODO (Phase 1, remaining): wire this against the real google-adk Agent/
    Runner API once the exact package surface is verified (see
    requirements.txt's version-pin TODO). This function currently returns a
    plain dict describing the intended orchestrator config rather than a real
    ADK object, so the scaffold stays honest about what's built vs. stubbed.
    """
    return {
        "model": MODEL,
        "tools": [gws_read_sheet_stub],
        "system_prompt": (
            "You are the OpenX Deep Research Analyst. You perform long-horizon "
            "DeFi market research and may request premium gated data via the "
            "OpenX gateway (Phase 2, not yet wired)."
        ),
    }


def run_demo() -> int:
    """
    PRD §5 step 1 — "The Trigger": user asks for a deep competitive market
    analysis on DeFi protocols via Google Workspace CLI integration.

    Phase 1 scope: prints the orchestrator config + calls the gws stub tool.
    Does NOT yet route through the OpenX MCP gateway (Phase 2) or settle any
    XRPL x402 payment (also Phase 2) — those are the next sprint's work.
    """
    orchestrator = build_orchestrator()
    print(f"[openx-deep-research-analyst] Phase 1 orchestrator config: {orchestrator}")

    target_list = gws_read_sheet_stub()
    print(f"[openx-deep-research-analyst] gws stub returned target list: {target_list}")

    print(
        "[openx-deep-research-analyst] Phase 1 complete. "
        "Phase 2 (gateway wiring) required before real research/payment flow runs."
    )
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
