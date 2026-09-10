"""
test_gateway_client.py — Unit tests for agent Python gateway client.
"""
import io
import json
import unittest
from unittest.mock import patch

from gateway_client import (
    get_agent_status,
    register_agent,
    submit_telemetry,
    submit_working_log,
    submit_usage_event,
    sync_agent,
    submit_memory_episode,
    submit_candidate_skill,
    request_gated_feed,
    sync_settlement,
)


class TestGatewayClient(unittest.TestCase):
    def test_register_agent_success(self):
        mock_response = io.BytesIO(json.dumps({"ok": True, "status": "registered", "agent": {"agent_id": "test-agent"}, "credential": {"agent_key": "oxag_secret", "shown_once": True}}).encode("utf-8"))
        with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
            result = register_agent("Test Agent", "adk-python", model="gemini-3.5")
            self.assertTrue(result["ok"])
            self.assertEqual(result["credential"]["agent_key"], "oxag_secret")
            self.assertEqual(json.loads(mock_urlopen.call_args.args[0].data.decode("utf-8"))["host_type"], "adk-python")

    def test_get_agent_status_success(self):
        mock_payload = {
            "ok": True,
            "agent_id": "test-agent-id",
            "requested_at": "2026-08-22T13:15:00Z",
            "status": {"reachable": True, "rate_limited": False},
            "model": {"configured_model": "gemini-3.5"},
        }

        mock_response = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))

        with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
            res = get_agent_status("test-agent-id", fields=["status", "model"])

            self.assertTrue(res["ok"])
            self.assertEqual(res["agent_id"], "test-agent-id")
            self.assertEqual(res["model"]["configured_model"], "gemini-3.5")
            mock_urlopen.assert_called_once()

    def test_get_agent_status_connection_error(self):
        with patch("urllib.request.urlopen", side_effect=Exception("Connection refused")):
            res = get_agent_status("test-agent-id")
            self.assertFalse(res["ok"])
            self.assertEqual(res["error"], "gateway_unreachable")

    def test_submit_telemetry_success(self):
        mock_payload = {
            "ok": True,
            "event_type": "telemetry",
            "id": "tel_12345",
            "agent_id": "test-agent-id",
        }
        mock_response = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))

        with patch.dict("os.environ", {"OPENX_AGENT_KEY": "test-key"}), patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
            res = submit_telemetry(
                agent_id="test-agent-id",
                task_id="task-001",
                tokens_consumed=1420,
                tools_used=["sheets.read"],
            )

            self.assertTrue(res["ok"])
            self.assertEqual(res["id"], "tel_12345")
            mock_urlopen.assert_called_once()

    def test_submit_working_log_is_agent_authenticated_and_ordered(self):
        with patch.dict("os.environ", {"OPENX_AGENT_KEY": "test-key"}), patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = b'{"ok": true, "accepted": true}'
            result = submit_working_log("agent-1", "task-1", "550e8400-e29b-41d4-a716-446655440000", 2, "collecting", "phase", "Collected safe sources.", 25, "2026-09-04T00:00:00.000Z")
        self.assertTrue(result["ok"])
        request = mock_urlopen.call_args.args[0]
        self.assertIn("/v1/agents/agent-1/tasks/task-1/working-log", request.full_url)
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["sequence"], 2)
        self.assertEqual(payload["kind"], "phase")

    def test_usage_and_sync_use_agent_key(self):
        with patch.dict("os.environ", {"OPENX_AGENT_KEY": "test-key"}), patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = b'{"ok": true}'
            self.assertTrue(submit_usage_event("event-1", "test-agent", "2026-08-26T12:00:00.000Z", tool_calls=[{"tool_id": "tool", "calls": 1, "outcome": "success"}])["ok"])
            self.assertTrue(sync_agent("test-agent", tools=["tool"], skills=["skill"])["ok"])
            self.assertEqual(mock_urlopen.call_count, 2)

    def test_submit_memory_episode_success(self):
        mock_payload = {
            "ok": True,
            "event_type": "memory_episode",
            "id": "ep_12345",
            "agent_id": "test-agent-id",
        }
        mock_response = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))

        with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
            res = submit_memory_episode(
                agent_id="test-agent-id",
                summary="Uniswap v3 liquidity analysis",
                facts_count=3,
            )

            self.assertTrue(res["ok"])
            self.assertEqual(res["id"], "ep_12345")
            mock_urlopen.assert_called_once()

    def test_submit_candidate_skill_success(self):
        mock_payload = {
            "ok": True,
            "event_type": "skill_candidate",
            "id": "sk_12345",
            "agent_id": "test-agent-id",
        }
        mock_response = io.BytesIO(json.dumps(mock_payload).encode("utf-8"))

        with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
            res = submit_candidate_skill(
                agent_id="test-agent-id",
                skill_slug="fee-estimator",
                display_name="Fee Estimator",
                capability_ids=["calc"],
            )

            self.assertTrue(res["ok"])
            self.assertEqual(res["id"], "sk_12345")
            mock_urlopen.assert_called_once()

    def test_request_gated_feed_raises_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            request_gated_feed("feed-123")


    def test_transient_http_error_retries_with_exponential_backoff(self):
        import urllib.error
        import time

        mock_response = io.BytesIO(b'{"ok": true}')
        error = urllib.error.HTTPError("http://gateway", 503, "busy", {}, io.BytesIO(b""))
        with patch.dict("os.environ", {"OPENX_AGENT_KEY": "test-key", "OPENX_SYNC_MAX_ATTEMPTS": "3", "OPENX_SYNC_BACKOFF_SECONDS": "0.25"}), \
             patch("urllib.request.urlopen", side_effect=[error, error, mock_response]) as mock_urlopen, \
             patch.object(time, "sleep") as mock_sleep:
            result = sync_agent("test-agent", tools=["tool"], skills=["skill"])

        self.assertTrue(result["ok"])
        self.assertEqual(mock_urlopen.call_count, 3)
        self.assertEqual([call.args[0] for call in mock_sleep.call_args_list], [0.25, 0.5])

    def test_client_error_does_not_retry(self):
        import urllib.error

        error = urllib.error.HTTPError("http://gateway", 401, "unauthorized", {}, io.BytesIO(b'{"error":"invalid_agent_key"}'))
        with patch.dict("os.environ", {"OPENX_AGENT_KEY": "test-key"}), patch("urllib.request.urlopen", side_effect=error) as mock_urlopen:
            result = sync_agent("test-agent")

        self.assertFalse(result["ok"])
        self.assertEqual(mock_urlopen.call_count, 1)
        self.assertEqual(result["error"], "sync_failed")

    def test_usage_payload_contains_no_financial_fields_or_estimated_tokens(self):
        with patch.dict("os.environ", {"OPENX_AGENT_KEY": "test-key"}), patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = b'{"ok": true}'
            result = submit_usage_event(
                "event-actual-only", "test-agent", "2026-08-26T12:00:00.000Z",
                tool_calls=[{"tool_id": "tool", "calls": 1, "outcome": "success"}],
            )

        self.assertTrue(result["ok"])
        payload = json.loads(mock_urlopen.call_args.args[0].data.decode("utf-8"))
        self.assertNotIn("cost_usdc", payload)
        self.assertEqual(payload["model_usage"], [])
        self.assertEqual(payload["nim_savings"], [])

    def test_sync_settlement_success(self):
        with patch.dict("os.environ", {"OPENX_AGENT_KEY": "test-key"}), patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = b'{"ok": true, "settlement": {"transaction_hash": "abc", "status": "settled"}}'
            result = sync_settlement(
                agent_id="test-agent",
                transaction_hash="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                quote_id="quote-123",
                amount="0.05",
                merchant_address="rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV",
                facilitator_node="hypermove-relay-01",
            )

        self.assertTrue(result["ok"])
        req = mock_urlopen.call_args.args[0]
        self.assertEqual(req.headers["X-agent-key"], "test-key")
        payload = json.loads(req.data.decode("utf-8"))
        self.assertEqual(payload["merchant_address"], "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV")
        self.assertEqual(payload["facilitator_node"], "hypermove-relay-01")
        self.assertEqual(payload["amount"], "0.05")


if __name__ == "__main__":
    unittest.main()
