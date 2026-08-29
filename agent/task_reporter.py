"""Reliable metadata-only task lifecycle reporter for a connected agent worker."""
from __future__ import annotations

import threading
import time
from typing import Iterable

from gateway_client import submit_telemetry


class TaskReporter:
    def __init__(self, agent_id: str, task_id: str, model: str, title: str, category: str, tools: Iterable[str], heartbeat_seconds: int = 20):
        self.agent_id, self.task_id, self.model = agent_id, task_id, model
        self.title, self.category, self.tools = title, category, list(tools)
        self.heartbeat_seconds, self.phase, self.progress = heartbeat_seconds, "initializing", 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def __enter__(self):
        self._send("started")
        self._thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._thread.start()
        return self

    def update(self, phase: str, progress_pct: float) -> None:
        self.phase, self.progress = phase, max(0, min(100, progress_pct))
        self._send("heartbeat")

    def __exit__(self, exc_type, _exc, _traceback):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1)
        self.phase, self.progress = ("failed", self.progress) if exc_type else ("completed", 100)
        self._send("failed" if exc_type else "completed", status="failed" if exc_type else "success")
        return False

    def _heartbeat_loop(self) -> None:
        while not self._stop.wait(self.heartbeat_seconds):
            self._send("heartbeat")

    def _send(self, state: str, status: str = "success") -> None:
        submit_telemetry(agent_id=self.agent_id, task_id=self.task_id, model=self.model, tools_used=self.tools, status=status, task_state=state, task_title=self.title, task_category=self.category, current_phase=self.phase, progress_pct=self.progress)
