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
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional





RETRYABLE_HTTP_STATUS = {408, 429, 500, 502, 503, 504}


def _gateway_url() -> str:
    return os.environ.get("OPENX_GATEWAY_URL", "http://localhost:7411").rstrip("/")


def _agent_headers(require_key: bool = False) -> Dict[str, str]:
    key = os.environ.get("OPENX_AGENT_KEY", "").strip()
    if require_key and not key:
        raise RuntimeError("OPENX_AGENT_KEY is required for authenticated agent writes")
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        **({"x-agent-key": key} if key else {}),
    }


def _retry_settings() -> tuple[int, float]:
    try:
        attempts = max(1, min(6, int(os.environ.get("OPENX_SYNC_MAX_ATTEMPTS", "4"))))
    except ValueError:
        attempts = 4
    try:
        backoff = max(0.0, min(30.0, float(os.environ.get("OPENX_SYNC_BACKOFF_SECONDS", "0.5"))))
    except ValueError:
        backoff = 0.5
    return attempts, backoff


def _response_body(response: Any) -> Dict[str, Any]:
    raw = response.read().decode("utf-8")
    if not raw:
        return {"ok": True}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"ok": False, "error": "invalid_gateway_response"}


def _post_json(
    path: str,
    payload: Dict[str, Any],
    *,
    error_code: str,
    timeout_seconds: float,
    require_key: bool = True,
) -> Dict[str, Any]:
    try:
        headers = _agent_headers(require_key=require_key)
    except RuntimeError as error:
        return {"ok": False, "error": "missing_openx_agent_key", "message": str(error)}

    attempts, backoff = _retry_settings()
    url = f"{_gateway_url()}{path}"
    last_message = "request failed"
    for attempt in range(attempts):
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
                return _response_body(response)
        except urllib.error.HTTPError as error:
            last_message = f"Gateway HTTP Error {error.code}: {error.reason}"
            if error.code not in RETRYABLE_HTTP_STATUS or attempt == attempts - 1:
                return {"ok": False, "error": error_code, "message": last_message, "status": error.code}
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_message = f"Gateway request failed: {str(error)[:200]}"
            if attempt == attempts - 1:
                return {"ok": False, "error": error_code, "message": last_message}
        time.sleep(backoff * (2 ** attempt))
    return {"ok": False, "error": error_code, "message": last_message}
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
        f"{_gateway_url()}/v1/agent/register",
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

    url = f"{_gateway_url()}/v1/agent/status?{urllib.parse.urlencode(query_params)}"

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
    model: str = "",
    tokens_consumed: Optional[int] = None,
    tools_used: Optional[List[str]] = None,
    latency_ms: Optional[float] = None,
    status: str = "success",
    summary: Optional[str] = None,
    task_state: Optional[str] = None,
    task_title: Optional[str] = None,
    task_category: Optional[str] = None,
    current_phase: Optional[str] = None,
    progress_pct: Optional[float] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """Submit safe task metadata; unknown provider token dimensions are omitted."""
    payload: Dict[str, Any] = {
        "agent_id": agent_id,
        "task_id": task_id,
        "model": model,
        "tools_used": tools_used or [],
        "status": status,
    }
    optional = {
        "tokens_consumed": tokens_consumed,
        "latency_ms": latency_ms,
        "summary": summary,
        "task_state": task_state,
        "task_title": task_title,
        "task_category": task_category,
        "current_phase": current_phase,
        "progress_pct": progress_pct,
    }
    payload.update({key: value for key, value in optional.items() if value is not None})
    return _post_json(
        "/v1/agent/telemetry",
        payload,
        error_code="submission_failed",
        timeout_seconds=timeout_seconds,
        require_key=True,
    )


def submit_usage_event(
    event_id: str,
    agent_id: str,
    occurred_at: str,
    model_usage: Optional[List[Dict[str, Any]]] = None,
    tool_calls: Optional[List[Dict[str, Any]]] = None,
    skill_invocations: Optional[List[Dict[str, Any]]] = None,
    nim_savings: Optional[List[Dict[str, Any]]] = None,
    plan_id: Optional[str] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """Submit idempotent, metadata-only usage; only caller-observed dimensions are sent."""
    payload: Dict[str, Any] = {
        "event_id": event_id,
        "agent_id": agent_id,
        "occurred_at": occurred_at,
        "model_usage": model_usage or [],
        "tool_calls": tool_calls or [],
        "skill_invocations": skill_invocations or [],
        "nim_savings": nim_savings or [],
    }
    if plan_id:
        payload["plan_id"] = plan_id
    return _post_json(
        "/v1/agent/usage-events",
        payload,
        error_code="usage_submission_failed",
        timeout_seconds=timeout_seconds,
        require_key=True,
    )


def sync_agent(
    agent_id: str,
    model: Optional[str] = None,
    tools: Optional[List[str]] = None,
    skills: Optional[List[str]] = None,
    plan_id: Optional[str] = None,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """Push a compact capability snapshot; credentials are required and the call is retryable."""
    payload: Dict[str, Any] = {"agent_id": agent_id, "tools": tools or [], "skills": skills or []}
    if model:
        payload["model"] = model
    if plan_id:
        payload["plan_id"] = plan_id
    return _post_json(
        "/v1/agent/sync",
        payload,
        error_code="sync_failed",
        timeout_seconds=timeout_seconds,
        require_key=True,
    )


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
    url = f"{_gateway_url()}/v1/agent/memory/episode"
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
    url = f"{_gateway_url()}/v1/agent/skills/candidate"
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
        f"(target URL: {_gateway_url()}/v1/supplier/defi?feedId={feed_id})."
    )
