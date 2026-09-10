"""Reliable metadata-only task lifecycle reporter for a connected agent worker."""
from __future__ import annotations

import threading
import time
import json
import os
import re
import uuid
from pathlib import Path
from typing import Iterable

from gateway_client import submit_telemetry, submit_working_log

SECRET_PATTERN = re.compile(
    r"(?i)(seed|private[_ -]?key|authorization|bearer|token|password)\s*(?::|=|\s)\s*(?:bearer\s+)?\S+"
)


class WorkingLogSpool:
    """Local, redacted best-effort spool. It never affects task execution."""
    def __init__(self, path: str | None = None):
        self.path = Path(path or os.environ.get("OPENX_TASK_LOG_SPOOL_PATH", ".openx/task-log-spool.jsonl"))

    def append(self, event: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as handle:
            os.chmod(self.path, 0o600)
            handle.write(json.dumps(event, separators=(",", ":")) + "\n")

    def replay(self) -> None:
        if not self.path.exists():
            return
        try:
            pending = [json.loads(line) for line in self.path.read_text(encoding="utf-8").splitlines() if line.strip()]
        except (OSError, json.JSONDecodeError):
            # A damaged local spool must never prevent an agent from doing its work.
            return
        remaining = []
        for event in pending:
            try:
                result = submit_working_log(**event)
            except (OSError, TypeError, ValueError):
                result = {"ok": False}
            if not result.get("ok"): remaining.append(event)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text("".join(json.dumps(event, separators=(",", ":")) + "\n" for event in remaining), encoding="utf-8")
        os.chmod(temporary, 0o600)
        temporary.replace(self.path)


class TaskReporter:
    def __init__(self, agent_id: str, task_id: str, model: str, title: str, category: str, tools: Iterable[str], heartbeat_seconds: int = 20):
        self.agent_id, self.task_id, self.model = agent_id, task_id, model
        self.title, self.category, self.tools = title, category, list(tools)
        self.heartbeat_seconds, self.phase, self.progress = heartbeat_seconds, "initializing", 0
        self.sequence, self.spool = 0, WorkingLogSpool()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def __enter__(self):
        self.spool.replay()
        self._send("started")
        self._log("started", "Task started. Gateway working-log sync is active.")
        self._thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._thread.start()
        return self

    def update(self, phase: str, progress_pct: float, note: str | None = None) -> None:
        self.phase, self.progress = phase, max(0, min(100, progress_pct))
        self._send("heartbeat")
        self._log("phase", note or f"Entered phase `{phase}`.")

    def __exit__(self, exc_type, _exc, _traceback):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1)
        self.phase, self.progress = ("failed", self.progress) if exc_type else ("completed", 100)
        self._send("failed" if exc_type else "completed", status="failed" if exc_type else "success")
        self._log("failed" if exc_type else "completed", "Task failed; inspect the safe task metadata for details." if exc_type else "Task completed successfully.")
        return False

    def _heartbeat_loop(self) -> None:
        while not self._stop.wait(self.heartbeat_seconds):
            self._send("heartbeat")

    def _send(self, state: str, status: str = "success") -> None:
        submit_telemetry(agent_id=self.agent_id, task_id=self.task_id, model=self.model, tools_used=self.tools, status=status, task_state=state, task_title=self.title, task_category=self.category, current_phase=self.phase, progress_pct=self.progress)

    def _log(self, kind: str, markdown: str) -> None:
        self.sequence += 1
        safe_markdown = SECRET_PATTERN.sub("[redacted]", markdown).replace("<", "&lt;").replace(">", "&gt;")[:64_000]
        event = {"agent_id": self.agent_id, "task_id": self.task_id, "event_id": str(uuid.uuid4()), "sequence": self.sequence, "phase": self.phase, "kind": kind, "markdown": safe_markdown, "progress_pct": self.progress, "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())}
        try:
            accepted = submit_working_log(**event).get("ok")
        except (OSError, TypeError, ValueError):
            accepted = False
        if not accepted:
            self.spool.append(event)
