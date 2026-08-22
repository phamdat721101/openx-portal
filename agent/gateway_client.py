"""
gateway_client.py — Phase 2 stub (PRD §6 Days 5-8), NOT wired into main.py yet.

This module documents the intended seam between the Python ADK agent and the
Node-side gateway/ sidecar (which wraps HyperMove MCP + nim-skill + n-payment).
Left unimported by main.py deliberately — importing this without a running
gateway/ process would be misleading (a call that always fails), which is
worse than an honest "not built yet" absence. Wire this in when Phase 2 starts.
"""
from __future__ import annotations

import os

import requests

GATEWAY_BASE_URL = os.environ.get("OPENX_GATEWAY_URL", "http://localhost:7411")


def request_gated_feed(feed_id: str) -> dict:
    """
    PRD §4.1 capability `analytics.fetch_premium_feed` — Phase 2 target shape.

    Intended flow once wired: POST to the gateway/ sidecar, which forwards to
    the HyperMove MCP tool, receives the 402 challenge (PRD §4.3), negotiates
    the n-payment XRPL x402 settlement, and returns the verified feed data
    once nim-skill's workrule check passes it. NOT IMPLEMENTED — will raise
    NotImplementedError until gateway/ has a real /v1/supplier/defi route.
    """
    raise NotImplementedError(
        "Phase 2 not yet built. See gateway/ for the Node-side sidecar this "
        "function will call once the /v1/supplier/defi route exists "
        f"(target URL: {GATEWAY_BASE_URL}/v1/supplier/defi?feedId={feed_id})."
    )
