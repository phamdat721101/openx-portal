import os
import tempfile
import unittest
from unittest.mock import patch

from task_reporter import TaskReporter, WorkingLogSpool


class TestTaskReporter(unittest.TestCase):
    # seam:agent-spool-replay
    def test_redacts_and_spools_failed_log_delivery(self):
        with tempfile.TemporaryDirectory() as directory, patch("task_reporter.submit_telemetry"), patch("task_reporter.submit_working_log", return_value={"ok": False}):
            reporter = TaskReporter("agent", "task", "model", "title", "research", [], heartbeat_seconds=999)
            reporter.spool = WorkingLogSpool(os.path.join(directory, "spool.jsonl"))
            reporter._log("phase", "token=secret-value Authorization: Bearer header-secret and safe progress")
            content = reporter.spool.path.read_text(encoding="utf-8")
            self.assertIn("[redacted]", content)
            self.assertNotIn("secret-value", content)
            self.assertNotIn("header-secret", content)

    def test_replay_removes_successful_events(self):
        with tempfile.TemporaryDirectory() as directory:
            spool = WorkingLogSpool(os.path.join(directory, "spool.jsonl"))
            spool.append({"agent_id": "a", "task_id": "t", "event_id": "550e8400-e29b-41d4-a716-446655440000", "sequence": 1, "phase": "start", "kind": "started", "markdown": "safe", "created_at": "2026-09-04T00:00:00.000Z"})
            with patch("task_reporter.submit_working_log", return_value={"ok": True}): spool.replay()
            self.assertEqual(spool.path.read_text(encoding="utf-8"), "")

    def test_malformed_spool_never_blocks_a_task(self):
        with tempfile.TemporaryDirectory() as directory:
            spool = WorkingLogSpool(os.path.join(directory, "spool.jsonl"))
            spool.path.write_text("not-json\n", encoding="utf-8")
            spool.replay()
            self.assertTrue(spool.path.exists())


if __name__ == "__main__":
    unittest.main()
