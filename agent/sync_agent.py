"""Agent-owned periodic capability sync. Schedule `python sync_agent.py` every five minutes."""
from __future__ import annotations

import os

from gateway_client import sync_agent
from env_loader import load_openx_env

load_openx_env()

def main() -> int:
    agent_id = os.environ.get("OPENX_AGENT_ID", "").strip()
    model = os.environ.get("OPENX_MODEL", "").strip()
    plan_id = os.environ.get("OPENX_PLAN_ID", "").strip()
    missing = [name for name, value in (("OPENX_AGENT_ID", agent_id), ("OPENX_AGENT_KEY", os.environ.get("OPENX_AGENT_KEY", "").strip()), ("OPENX_MODEL", model), ("OPENX_PLAN_ID", plan_id)) if not value]
    if missing:
        print(f"Agent sync not configured; missing {', '.join(missing)}")
        return 2

    result = sync_agent(
        agent_id=agent_id,
        model=model,
        tools=["google-workspace-cli.sheets.read"],
        skills=["nim-skill"],
        plan_id=plan_id,
    )
    if not result.get("ok"):
        print(result.get("message", "Agent sync failed"))
        return 1
    synchronized_at = result.get("synchronized_at", "unknown time")
    print(f"Synchronized agent at {synchronized_at}")

    # Optionally sync on-chain settlement proof if provided in environment
    settlement_tx = os.environ.get("OPENX_SETTLEMENT_TX_HASH", "").strip()
    if settlement_tx:
        from gateway_client import sync_settlement
        quote_id = os.environ.get("OPENX_SETTLEMENT_QUOTE_ID", f"quote-{agent_id[:8]}").strip()
        amount = os.environ.get("OPENX_SETTLEMENT_AMOUNT", "0.05").strip()
        merchant = os.environ.get("OPENX_SETTLEMENT_MERCHANT", "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV").strip()
        facilitator = os.environ.get("OPENX_SETTLEMENT_FACILITATOR", "openx-relay-01").strip()
        settle_res = sync_settlement(
            agent_id=agent_id,
            transaction_hash=settlement_tx,
            quote_id=quote_id,
            amount=amount,
            merchant_address=merchant,
            facilitator_node=facilitator,
        )
        if settle_res.get("ok"):
            print(f"Synchronized on-chain settlement {settlement_tx[:12]}… to facilitator {facilitator}")
        else:
            print(f"Settlement sync note: {settle_res.get('message', 'not recorded')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
