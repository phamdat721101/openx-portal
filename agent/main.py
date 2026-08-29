"""
main.py — Google ADK + Gemini 3.5 Orchestration Loop Entrypoint.

Implements PRD 001 Agent Connection and Ingestion workflow:
1. Pre-flight self-introspection via GET /v1/agent/status.
2. Tool execution with Google Workspace CLI integration.
3. Post-execution telemetry & memory episode submission to Gateway sidecar (:7411).
"""
from __future__ import annotations

import os
import sys
import time

from env_loader import load_openx_env
from gateway_client import (
    get_agent_status,
    submit_usage_event,
    submit_memory_episode,
    sync_agent,
)
from tools.gws_tool import gws_read_sheet_stub
from task_reporter import TaskReporter

load_openx_env()

AGENT_ID = os.environ.get("OPENX_AGENT_ID", "").strip()
MODEL = os.environ.get("OPENX_MODEL", "").strip()


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
    """Run the local demo while reporting only observed operational metadata."""
    agent_id = os.environ.get("OPENX_AGENT_ID", "").strip()
    model = os.environ.get("OPENX_MODEL", "").strip()
    plan_id = os.environ.get("OPENX_PLAN_ID", "").strip()
    missing = [name for name, value in (("OPENX_AGENT_ID", agent_id), ("OPENX_AGENT_KEY", os.environ.get("OPENX_AGENT_KEY", "").strip()), ("OPENX_MODEL", model), ("OPENX_PLAN_ID", plan_id)) if not value]
    if missing:
        print(f"[openx-deep-research-analyst] Missing required configuration: {', '.join(missing)}")
        return 2

    print("[openx-deep-research-analyst] Running pre-flight operational check")
    status = get_agent_status(agent_id)
    if status.get("ok"):
        print(f"  - Model: {status.get('model', {}).get('configured_model', model)}")
        print(f"  - Reachable: {status.get('status', {}).get('reachable', False)}")
        print(f"  - Memory Episodes: {status.get('memory', {}).get('episodes', 0)}")
    else:
        print("[openx-deep-research-analyst] Pre-flight warning: Gateway status unavailable")

    sync_result = sync_agent(
        agent_id,
        model=model,
        tools=["google-workspace-cli.sheets.read"],
        skills=["nim-skill"],
        plan_id=plan_id,
    )
    if not sync_result.get("ok"):
        print("[openx-deep-research-analyst] Capability sync failed; task not started")
        return 1

    task_id = os.environ.get("OPENX_TASK_ID", "kiro-openx-portal-sync-20260826").strip()
    task_started_at = time.time()
    tool_id = "google-workspace-cli.sheets.read"
    with TaskReporter(agent_id, task_id, model, "OpenX Portal synchronization", "agent_operations", [tool_id]) as reporter:
        reporter.update("collecting_sources", 25)
        start_time = time.time()
        tool_result = gws_read_sheet_stub()
        latency_ms = round((time.time() - start_time) * 1000, 2)
        reporter.update("reporting_observed_usage", 75)

    # The tool result is intentionally not printed or transmitted: it may contain
    # customer/project data. Only the observed call and latency are safe to report.
    print(f"[openx-deep-research-analyst] Observed one tool call in {latency_ms}ms")
    usage_result = submit_usage_event(
        event_id=f"{task_id}:usage",
        agent_id=agent_id,
        occurred_at=time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(task_started_at)),
        tool_calls=[{"tool_id": tool_id, "calls": 1, "outcome": "success", "latency_ms": latency_ms}],
        plan_id=plan_id,
    )
    if not usage_result.get("ok"):
        print("[openx-deep-research-analyst] Usage synchronization failed")
        return 1

    # Keep the optional memory record generic; do not send tool output, targets,
    # prompts, arguments, or response bodies to the Gateway.
    episode_result = submit_memory_episode(
        agent_id=agent_id,
        summary="Completed one connected-agent operational synchronization task.",
        facts_count=1,
        confidence=1.0,
        episode_type="execution_trace",
        entities=[],
    )
    if not episode_result.get("ok"):
        print("[openx-deep-research-analyst] Memory synchronization note: Gateway rejected the episode")

    print("[openx-deep-research-analyst] Agent task completed")
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
