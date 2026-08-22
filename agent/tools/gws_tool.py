"""
tools/gws_tool.py — Google Workspace CLI (gws) integration, Phase 1 scope.

Implements the PRD §6 Phase 1 line item: "Integrate the Google Workspace CLI
(gws) as a basic local tool." Per PRD §5 step 1, the real flow reads a target
list of DeFi protocols from Google Sheets — this stub returns a hardcoded
placeholder list matching PRD §6 Phase 3's own plan ("Hardcode the DeFi
protocol target list") pulled forward as the Phase-1 stub's return shape, so
Phase 3 has a real seam to fill in rather than inventing a new shape later.
"""
from __future__ import annotations

# TODO (Phase 3, PRD §6 Days 9-11): replace this hardcoded list with a real
# `gws sheets read` subprocess call once the gws CLI is installed/configured.
_HARDCODED_DEFI_TARGET_LIST = [
    "aave_v3_ethereum",
    "compound_v3",
    "uniswap_v4",
]


def gws_read_sheet_stub() -> list[str]:
    """
    Phase 1 stub for the `gws` Google Sheets read tool.

    Returns the hardcoded DeFi protocol target list (see PRD §6 Phase 3) as a
    stand-in for a real Google Sheets read via the `gws` CLI. Named
    explicitly `_stub` in the public function name so no caller can mistake
    this for the real Phase-3 implementation.
    """
    return list(_HARDCODED_DEFI_TARGET_LIST)
