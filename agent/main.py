"""
main.py — Google ADK + Gemini 3.5 Orchestration Loop Entrypoint.

Implements PRD 001 Agent Connection and Ingestion workflow:
1. Pre-flight self-introspection via GET /v1/agent/status.
2. Tool execution with Google Workspace CLI integration.
3. Post-execution telemetry & memory episode submission to Gateway sidecar (:7411).
"""
from __future__ import annotations

import json
import os
import sys
import time

from dotenv import load_dotenv

from gateway_client import (
    get_agent_status,
    submit_telemetry,
    submit_memory_episode,
)
from tools.gws_tool import gws_read_sheet_stub

load_dotenv()

AGENT_ID = os.environ.get("OPENX_AGENT_ID", "3fa85f64-5717-4562-b3fc-2c963f66afa6")
MODEL = os.environ.get("OPENX_MODEL", "gemini-3.5")


def build_orchestrator():
    """
    Instantiate the Gemini 3.5 ADK orchestration loop configuration.
    """
    return {
        "model": MODEL,
        "tools": [gws_read_sheet_stub],
        "system_prompt": (
            "You are the OpenX Deep Research Analyst. You perform long-horizon "
            "DeFi market research and publish telemetry to the OpenX gateway sidecar on :7411."
        ),
    }


def run_demo() -> int:
    """
    PRD 001 & Ingestion Loop:
    1. Pre-flight self-introspection.
    2. Tool execution (Google Workspace sheet read).
    3. Post-execution telemetry & episode submission.
    """
    print(f"[openx-deep-research-analyst] Initiating pre-flight self-introspection for agent: {AGENT_ID}")
    status = get_agent_status(AGENT_ID)

    if status.get("ok"):
        print("[openx-deep-research-analyst] Pre-flight introspection successful:")
        print(f"  - Model: {status.get('model', {}).get('configured_model', 'unknown')}")
        print(f"  - Reachable: {status.get('status', {}).get('reachable', False)}")
        print(f"  - Credits Balance: {status.get('credits', {}).get('balance_usdc', 'unauthenticated')}")
        print(f"  - Memory Episodes: {status.get('memory', {}).get('episodes', 0)}")
    else:
        print(f"[openx-deep-research-analyst] Pre-flight warning (offline mode): {status.get('message')}")

    orchestrator = build_orchestrator()
    print(f"[openx-deep-research-analyst] Orchestrator initialized: {orchestrator['model']}")

    # Execute Tool Loop & Measure Latency
    start_time = time.time()
    target_list = gws_read_sheet_stub()
    latency_ms = round((time.time() - start_time) * 1000, 2)
    print(f"[openx-deep-research-analyst] Tool executed in {latency_ms}ms. Targets: {target_list}")

    # Submit Telemetry Trace to Gateway
    task_id = f"research_scan_{int(time.time())}"
    tokens_consumed = 1420

    print(f"[openx-deep-research-analyst] Submitting execution trace ({task_id}) to Gateway sidecar...")
    tel_res = submit_telemetry(
        agent_id=AGENT_ID,
        task_id=task_id,
        model=MODEL,
        tokens_consumed=tokens_consumed,
        tools_used=["google-workspace-cli.sheets.read"],
        latency_ms=latency_ms,
        status="success",
        cost_usdc="0.014",
        summary=f"Scanned {len(target_list)} DeFi targets ({', '.join(target_list)}) from Google Sheet.",
    )

    if tel_res.get("ok"):
        print(f"[openx-deep-research-analyst] Trace ingested successfully (event ID: {tel_res.get('id')}).")
    else:
        print(f"[openx-deep-research-analyst] Trace submission note: {tel_res.get('message')}")

    # Submit Memory Episode to Gateway
    print(f"[openx-deep-research-analyst] Submitting research episode to Cognitive Brain...")
    ep_res = submit_memory_episode(
        agent_id=AGENT_ID,
        summary=f"Synthesized yield data for {len(target_list)} DeFi protocols via Google Workspace CLI.",
        facts_count=len(target_list),
        confidence=0.96,
        episode_type="protocol_research",
        entities=target_list,
    )

    if ep_res.get("ok"):
        print(f"[openx-deep-research-analyst] Episode ingested successfully (event ID: {ep_res.get('id')}).")
    else:
        print(f"[openx-deep-research-analyst] Episode submission note: {ep_res.get('message')}")

    print("[openx-deep-research-analyst] Deep Research loop execution complete.")
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
