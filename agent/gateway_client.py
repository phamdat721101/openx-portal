"""
gateway_client.py — Python Client for OpenX Gateway Sidecar (PRD 001).

Provides:
 - get_agent_status: Read path for self-introspection (5 domains).
 - submit_telemetry: Write path for execution traces, latency, and tokens.
 - submit_memory_episode: Write path for cognitive insights and facts.
 - submit_candidate_skill: Write path for synthesized tool templates.
 - request_gated_feed: Phase 2 XRPL x402 micropayment retriever.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

GATEWAY_BASE_URL = os.environ.get("OPENX_GATEWAY_URL", "http://localhost:7411")


def register_agent(
    display_name: str,
    host_type: str,
    model: Optional[str] = None,
    capabilities: Optional[List[str]] = None,
    agent_id: Optional[str] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """Register a host once and return the one-time agent credential when created."""
    payload: Dict[str, Any] = {
        "display_name": display_name,
        "host_type": host_type,
        "capabilities": capabilities or [],
    }
    if model:
        payload["model"] = model
    if agent_id:
        payload["agent_id"] = agent_id

    req = urllib.request.Request(
        f"{GATEWAY_BASE_URL.rstrip('/')}/v1/agent/register",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "error": "registration_failed", "message": f"Gateway HTTP Error {e.code}"}
    except Exception as e:
        return {"ok": False, "error": "gateway_unreachable", "message": f"Failed to register with gateway: {str(e)[:200]}"}


def get_agent_status(
    agent_id: str,
    fields: Optional[List[str]] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """
    PRD 001 — Query agent operational status and introspection data.
    Calls GET /v1/agent/status?agentId=<id>&fields=...
    """
    query_params: Dict[str, str] = {"agentId": agent_id}
    if fields:
        query_params["fields"] = ",".join(fields)

    url = f"{GATEWAY_BASE_URL.rstrip('/')}/v1/agent/status?{urllib.parse.urlencode(query_params)}"

    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "OpenX-Agent-Python/1.0"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {
                "ok": False,
                "agent_id": agent_id,
                "error": "http_error",
                "message": f"Gateway HTTP Error {e.code}: {e.reason}",
            }
    except Exception as e:
        return {
            "ok": False,
            "agent_id": agent_id,
            "error": "gateway_unreachable",
            "message": f"Failed to connect to gateway at {url}: {str(e)[:200]}",
        }


def submit_telemetry(
    agent_id: str,
    task_id: str,
    model: str = "gemini-3.5",
    tokens_consumed: int = 0,
    tools_used: Optional[List[str]] = None,
    latency_ms: float = 0.0,
    status: str = "success",
    cost_usdc: Optional[str] = None,
    summary: Optional[str] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """
    Submits execution traces and token metrics to POST /v1/agent/telemetry.
    """
    url = f"{GATEWAY_BASE_URL.rstrip('/')}/v1/agent/telemetry"
    payload = {
        "agent_id": agent_id,
        "task_id": task_id,
        "model": model,
        "tokens_consumed": tokens_consumed,
        "tools_used": tools_used or [],
        "latency_ms": latency_ms,
        "status": status,
        "cost_usdc": cost_usdc,
        "summary": summary,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            **({"x-agent-key": os.environ["OPENX_AGENT_KEY"]} if os.environ.get("OPENX_AGENT_KEY") else {}),
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {
            "ok": False,
            "error": "submission_failed",
            "message": f"Failed to submit telemetry to {url}: {str(e)[:200]}",
        }


def submit_memory_episode(
    agent_id: str,
    summary: str,
    facts_count: int = 1,
    confidence: float = 0.95,
    episode_type: str = "protocol_research",
    entities: Optional[List[str]] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """
    Submits a synthesized research episode to POST /v1/agent/memory/episode.
    """
    url = f"{GATEWAY_BASE_URL.rstrip('/')}/v1/agent/memory/episode"
    payload = {
        "agent_id": agent_id,
        "episode_type": episode_type,
        "summary": summary,
        "facts_count": facts_count,
        "confidence": confidence,
        "entities": entities or [],
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {
            "ok": False,
            "error": "submission_failed",
            "message": f"Failed to submit memory episode to {url}: {str(e)[:200]}",
        }


def submit_candidate_skill(
    agent_id: str,
    skill_slug: str,
    display_name: str,
    capability_ids: List[str],
    code_template: Optional[str] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """
    Submits a newly synthesized reusable skill to POST /v1/agent/skills/candidate.
    """
    url = f"{GATEWAY_BASE_URL.rstrip('/')}/v1/agent/skills/candidate"
    payload = {
        "agent_id": agent_id,
        "skill_slug": skill_slug,
        "display_name": display_name,
        "capability_ids": capability_ids,
        "code_template": code_template,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {
            "ok": False,
            "error": "submission_failed",
            "message": f"Failed to submit skill to {url}: {str(e)[:200]}",
        }


def request_gated_feed(feed_id: str) -> dict:
    """
    PRD §4.1 capability `analytics.fetch_premium_feed` — Phase 2 target shape.
    """
    raise NotImplementedError(
        "Phase 2 x402 payment flow is being wired. See gateway/ for the Node-side sidecar "
        f"(target URL: {GATEWAY_BASE_URL}/v1/supplier/defi?feedId={feed_id})."
    )
