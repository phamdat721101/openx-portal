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
    build_microstructure_telemetry,
    build_oneinch_telemetry,
    calculate_health_factor,
    calculate_ltv,
    canonical_json_bytes,
    compare_with_previous_statement,
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
        with patch.dict("os.environ", {"OPENX_GRAPH_AAVE_URL": "", "OPENX_GRAPH_MORPHO_URL": ""}):
            audit = audit_lending_position("Aave v3 (Arbitrum)", 10000, 3000, "0x2222222222222222222222222222222222222222")
            report = create_statement_report(audit, report_id="11111111-1111-4111-8111-111111111111", source_block="123")
            self.assertEqual(report["schema_version"], "apsd-l/2.1")
            self.assertEqual(report["content_hash"], generate_content_hash(report["canonical_envelope"]))
            self.assertLessEqual(len(report["decision_context_card"].split()), 110)
            self.assertEqual(report["the_graph_telemetry"]["status"], "degraded")

    def test_morpho_fallback_uses_arbitrum_one_and_never_claims_graph_success(self):
        market = fetch_or_simulate_market_telemetry("Morpho Blue (Arbitrum)")
        with patch.dict("os.environ", {"GRAPH_NODE_URL": ""}, clear=False):
            telemetry = build_microstructure_telemetry(market)
        self.assertEqual(telemetry["status"], "degraded")
        self.assertEqual(telemetry["chain_id"], "eip155:42161")
        self.assertEqual(telemetry["reason"], "not_configured")

    def test_aave_graph_adapter_normalizes_a_configured_response(self):
        market = fetch_or_simulate_market_telemetry("Aave v3 (Arbitrum)")
        payload = {"data": {"market": {"id": "market-1", "totalDepositBalanceUSD": "100", "totalBorrowBalanceUSD": "75", "rates": [{"side": "BORROWER", "type": "VARIABLE", "rate": "5.2"}, {"side": "LENDER", "type": "VARIABLE", "rate": "3.1"}]}, "marketHourlySnapshots": [{"timestamp": "1767225600", "totalDepositBalanceUSD": "100", "totalBorrowBalanceUSD": "74"}, {"timestamp": "1767229200", "totalDepositBalanceUSD": "100", "totalBorrowBalanceUSD": "75"}]}}
        response = MagicMock()
        response.status = 200
        response.read.return_value = json.dumps(payload).encode("utf-8")
        manager = MagicMock()
        manager.__enter__.return_value = response
        env = {"OPENX_GRAPH_AAVE_URL": "https://graph.example", "OPENX_GRAPH_AAVE_API_KEY": "test-graph-key", "OPENX_GRAPH_AAVE_MARKET_ID": "market-1"}
        with patch.dict("os.environ", env, clear=False):
            with patch("urllib.request.urlopen", return_value=manager) as urlopen:
                telemetry = build_microstructure_telemetry(market)
        self.assertEqual(telemetry["status"], "ok")
        self.assertEqual(telemetry["protocol"], "aave_v3")
        self.assertEqual(telemetry["chain_id"], "eip155:42161")
        self.assertEqual(telemetry["current_utilization_bps"], 7500)
        self.assertEqual(telemetry["borrow_rate_bps"], 520)
        self.assertEqual(telemetry["supply_rate_bps"], 310)
        self.assertEqual(urlopen.call_args.args[0].get_header("Authorization"), "Bearer test-graph-key")

    def test_aqua_is_explicitly_unsupported_on_arbitrum_sepolia(self):
        audit = audit_lending_position("Aave v3 (Arbitrum)", 10000, 3000, "0x2222222222222222222222222222222222222222")
        with patch.dict("os.environ", {"OPENX_AQUA_ENABLED": "true", "OPENX_AQUA_CHAIN_ID": "421614"}, clear=False):
            telemetry = build_oneinch_telemetry(audit)
        self.assertEqual(telemetry["status"], "unsupported_chain")
        self.assertFalse(telemetry["execution_allowed"])
        self.assertEqual(telemetry["strategies"], [])

    def test_aqua_uses_graph_history_and_finalized_rpc_balances(self):
        audit = audit_lending_position("Aave v3 (Arbitrum)", 10000, 3000, "0x2222222222222222222222222222222222222222")
        strategy_hash = "0x" + "ab" * 32
        graph = {"data": {"strategies": [{"id": "strategy", "maker": audit.wallet_address, "app": "0x3333333333333333333333333333333333333333", "strategyHash": strategy_hash, "lifecycle": "open", "activityCount": "3", "tokens": [{"token": "0x4444444444444444444444444444444444444444"}]}], "_meta": {"block": {"number": "123"}, "hasIndexingErrors": False}}}
        rpc_results = [
            {"jsonrpc": "2.0", "id": 1, "result": {"number": "0x7b"}},
            {"jsonrpc": "2.0", "id": 1, "result": "0x" + hex(42)[2:].rjust(64, "0") + "00" * 32},
        ]
        def response(payload):
            mocked = MagicMock()
            mocked.__enter__.return_value.status = 200
            mocked.__enter__.return_value.read.return_value = json.dumps(payload).encode("utf-8")
            return mocked
        with patch.dict("os.environ", {"OPENX_AQUA_ENABLED": "true", "OPENX_AQUA_CHAIN_ID": "42161", "OPENX_AQUA_GRAPH_URL": "https://graph.example", "OPENX_ARBITRUM_ONE_RPC_URL": "https://rpc.example"}, clear=False):
            with patch("urllib.request.urlopen", side_effect=[response(rpc_results[0]), response(graph), response(rpc_results[1])]) as urlopen:
                telemetry = build_oneinch_telemetry(audit)
        self.assertEqual(telemetry["status"], "ok")
        self.assertEqual(telemetry["source_block"], "123")
        self.assertEqual(telemetry["strategies"][0]["tokens"][0]["balance_raw"], "42")
        self.assertIn("6d58b4cc", urlopen.call_args_list[-1].args[0].data.decode("utf-8"))

    def test_statement_uses_successful_aqua_finalized_block(self):
        audit = audit_lending_position("Aave v3 (Arbitrum)", 10000, 3000, "0x2222222222222222222222222222222222222222")
        aqua = {"status": "ok", "source_block": "123", "strategies": [], "execution_allowed": False}
        with patch("defi_lending_researcher.build_oneinch_telemetry", return_value=aqua):
            report = create_statement_report(audit, report_id="11111111-1111-4111-8111-111111111111", source_block="1")
        self.assertEqual(report["source_block"], "123")
        self.assertEqual(report["canonical_envelope"]["source"]["block"], "123")

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

    def test_compare_with_previous_statement(self):
        audit = audit_lending_position("Aave v3 (Arbitrum)", 15000.0, 4200.0)
        # First observation
        comp_first = compare_with_previous_statement(audit, None)
        self.assertEqual(comp_first["status"], "first_observation")

        # Compared with previous
        prev_report = {
            "report_id": "prev-123",
            "content_hash": "a" * 64,
            "ltv": 0.25,
            "collateral_usd": 12000.0,
            "debt_usd": 3000.0,
            "source_block": "500000000",
            "risk_engine_audit": {"risk_level": "CONSERVATIVE_SAFE", "ltv_bps": 2500},
        }
        comp = compare_with_previous_statement(audit, prev_report)
        self.assertEqual(comp["status"], "compared")
        self.assertEqual(comp["previous_report_id"], "prev-123")
        self.assertTrue(any("LTV delta" in c for c in comp["changes"]))
        self.assertTrue(any("Collateral delta" in c for c in comp["changes"]))


if __name__ == "__main__":
    unittest.main()
