"""
test_defi_lending_researcher.py — Comprehensive unit tests for DeFi lending researcher.
"""
import io
import json
import unittest
from unittest.mock import MagicMock, patch

from defi_lending_researcher import (
    ALLOWLISTED_VENUES,
    MAX_ALLOWED_LTV,
    RECOMMENDED_LTV,
    PositionAudit,
    audit_lending_position,
    calculate_health_factor,
    calculate_ltv,
    canonical_json_bytes,
    create_statement_report,
    evaluate_risk_level,
    fetch_or_simulate_market_telemetry,
    generate_content_hash,
    run_defi_lending_research,
    scan_all_allowlisted_venues,
)


class TestDefiLendingResearcher(unittest.TestCase):
    def test_calculate_ltv(self):
        self.assertEqual(calculate_ltv(10000, 3000), 0.3)
        self.assertEqual(calculate_ltv(0, 0), 0.0)
        self.assertEqual(calculate_ltv(1000, 0), 0.0)
        self.assertEqual(calculate_ltv(0, 500), float("inf"))

    def test_calculate_health_factor(self):
        # 10,000 collateral, 80% liquidation threshold, 4,000 debt -> (10000 * 0.8) / 4000 = 2.0
        hf = calculate_health_factor(10000, 4000, 80.0)
        self.assertEqual(hf, 2.0)
        # Zero debt returns safe large number
        self.assertEqual(calculate_health_factor(10000, 0, 80.0), 999.0)
        # Zero collateral returns 0.0
        self.assertEqual(calculate_health_factor(0, 500, 80.0), 0.0)

    def test_evaluate_risk_level(self):
        # Conservative: LTV <= 0.32 and HF >= 1.5
        risk, safe = evaluate_risk_level(0.25, 2.5)
        self.assertEqual(risk, "CONSERVATIVE_SAFE")
        self.assertTrue(safe)

        # Elevated risk: 0.32 < LTV <= 0.40
        risk, safe = evaluate_risk_level(0.35, 2.0)
        self.assertEqual(risk, "ELEVATED_RISK")
        self.assertTrue(safe)

        # Moderate risk: HF < 1.5
        risk, safe = evaluate_risk_level(0.30, 1.4)
        self.assertEqual(risk, "MODERATE_RISK")
        self.assertTrue(safe)

        # Critical: LTV > 0.40
        risk, safe = evaluate_risk_level(0.45, 1.2)
        self.assertEqual(risk, "CRITICAL_EXCEEDS_CAP")
        self.assertFalse(safe)

    def test_generate_content_hash_is_deterministic(self):
        data1 = {"b": 2, "a": 1, "nested": {"y": "test", "x": [1, 2, 3]}}
        data2 = {"nested": {"x": [1, 2, 3], "y": "test"}, "a": 1, "b": 2}
        hash1 = generate_content_hash(data1)
        hash2 = generate_content_hash(data2)
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in hash1))

    def test_market_telemetry_allowlisted(self):
        telemetry = fetch_or_simulate_market_telemetry("Aave v3 (Arbitrum)")
        self.assertEqual(telemetry.venue, "Aave v3 (Arbitrum)")
        self.assertEqual(telemetry.chain, "arbitrum")
        self.assertGreater(telemetry.supply_apy_pct, 0)
        self.assertGreater(telemetry.borrow_apy_pct, 0)
        self.assertGreater(telemetry.total_supplied_usd, 0)

        with self.assertRaises(ValueError):
            fetch_or_simulate_market_telemetry("Unregistered Shadow DEX")

    def test_audit_lending_position(self):
        audit = audit_lending_position(
            venue="Morpho Blue (Arbitrum)",
            collateral_usd=20000.0,
            debt_usd=5600.0,
            wallet_address="0x1111111111111111111111111111111111111111",
        )
        self.assertEqual(audit.venue, "Morpho Blue (Arbitrum)")
        self.assertEqual(audit.collateral_usd, 20000.0)
        self.assertEqual(audit.debt_usd, 5600.0)
        self.assertEqual(audit.ltv, 0.28)
        self.assertEqual(audit.max_ltv, MAX_ALLOWED_LTV)
        self.assertEqual(audit.recommended_ltv, RECOMMENDED_LTV)
        self.assertTrue(audit.is_safe)
        self.assertEqual(audit.risk_level, "CONSERVATIVE_SAFE")
        self.assertIn("Morpho Blue", audit.summary)

    def test_create_statement_report_valid(self):
        audit = audit_lending_position(
            venue="Compound v3 (Arbitrum)",
            collateral_usd=10000.0,
            debt_usd=3000.0,
            wallet_address="0x2222222222222222222222222222222222222222",
        )
        report = create_statement_report(audit, visibility="public")
        self.assertIn("report_id", report)
        self.assertIn("content_hash", report)
        self.assertEqual(len(report["content_hash"]), 64)
        self.assertEqual(report["visibility"], "public")
        self.assertEqual(report["source_chain"], "arbitrum")
        self.assertEqual(report["finality"], "finalized")
        self.assertEqual(report["collateral_usd"], 10000.0)
        self.assertEqual(report["debt_usd"], 3000.0)
        self.assertEqual(report["status"], "received")
        self.assertEqual(report["attestation"]["status"], "pending")

    def test_v21_envelope_hash_and_context_are_deterministic(self):
        audit = audit_lending_position("Aave v3 (Arbitrum)", 10000, 3000, "0x2222222222222222222222222222222222222222")
        report = create_statement_report(audit, report_id="11111111-1111-4111-8111-111111111111", source_block="123")
        self.assertEqual(report["schema_version"], "apsd-l/2.1")
        self.assertEqual(report["content_hash"], generate_content_hash(report["canonical_envelope"]))
        self.assertLessEqual(len(report["decision_context_card"].split()), 110)
        self.assertEqual(report["the_graph_telemetry"]["status"], "degraded")

    def test_create_statement_report_rejects_exceeding_ltv(self):
        audit = PositionAudit(
            venue="Aave v3 (Arbitrum)",
            chain="arbitrum",
            wallet_address="0x1234567890123456789012345678901234567890",
            collateral_usd=1000.0,
            debt_usd=450.0,
            ltv=0.45,
            recommended_ltv=0.32,
            max_ltv=0.40,
            health_factor=1.8,
            is_safe=False,
            risk_level="CRITICAL_EXCEEDS_CAP",
            realized_pnl_usd=0.0,
            unrealized_pnl_usd=0.0,
            pnl_methodology="test",
            summary="test",
        )
        with self.assertRaises(ValueError) as ctx:
            create_statement_report(audit)
        self.assertIn("exceeds configured maximum allowed cap", str(ctx.exception))

    def test_run_defi_lending_research_dry_run(self):
        result = run_defi_lending_research(
            venue="Fluid (Arbitrum)",
            collateral_usd=15000.0,
            debt_usd=4200.0,
            dry_run=True,
        )
        self.assertTrue(result["ok"])
        self.assertTrue(result["dry_run"])
        self.assertEqual(result["audit"]["venue"], "Fluid (Arbitrum)")
        self.assertAlmostEqual(result["audit"]["ltv"], 0.28, places=2)
        self.assertEqual(len(result["report"]["content_hash"]), 64)

    def test_run_defi_lending_research_ltv_violation_returns_error(self):
        result = run_defi_lending_research(
            venue="Aave v3 (Arbitrum)",
            collateral_usd=1000.0,
            debt_usd=410.0,  # 41% > 40%
            dry_run=True,
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "ltv_cap_exceeded")

    def test_scan_all_allowlisted_venues(self):
        venues = scan_all_allowlisted_venues()
        self.assertEqual(len(venues), len(ALLOWLISTED_VENUES))
        venue_names = [v["venue"] for v in venues]
        for expected in ALLOWLISTED_VENUES:
            self.assertIn(expected, venue_names)

    def test_run_defi_lending_research_submits_to_gateway_mock(self):
        def mock_urlopen_handler(*args, **kwargs):
            return io.BytesIO(b'{"ok": true, "created": true}')

        with patch.dict(
            "os.environ",
            {
                "OPENX_AGENT_ID": "test-agent-uuid",
                "OPENX_AGENT_KEY": "oxag_mock_key",
                "OPENX_GATEWAY_URL": "http://localhost:7411",
                "OPENX_MODEL": "gemini-3.5",
            },
        ), patch("urllib.request.urlopen", side_effect=mock_urlopen_handler) as mock_urlopen:
            result = run_defi_lending_research(
                agent_id="test-agent-uuid",
                venue="Aave v3 (Arbitrum)",
                collateral_usd=10000.0,
                debt_usd=2800.0,
                dry_run=False,
            )

        self.assertTrue(result["ok"])
        self.assertIn("statement_report", result["gateway_submissions"])
        self.assertIn("memory_episode", result["gateway_submissions"])
        self.assertIn("candidate_skill", result["gateway_submissions"])
        # Multiple calls: TaskReporter start/heartbeats, statement report, memory episode, candidate skill, usage event
        self.assertGreaterEqual(mock_urlopen.call_count, 3)


if __name__ == "__main__":
    unittest.main()
