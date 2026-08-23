"""Best-effort replication worker; local SQLite remains authoritative."""

from __future__ import annotations

import json
import ssl
import threading
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import certifi


def _iso_utc(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")


def post_json(url: str, token: str, payload: dict, timeout: float) -> dict:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "User-Agent": "WOKI-Center/1",
        },
    )
    tls_context = ssl.create_default_context(cafile=certifi.where())
    with urlopen(request, timeout=timeout, context=tls_context) as response:
        raw = response.read(65537)
        if len(raw) > 65536:
            raise ValueError("sync response too large")
        value = json.loads(raw.decode("utf-8"))
    if not isinstance(value, dict):
        raise ValueError("invalid sync response")
    return value


class SyncWorker:
    """Uploads ready outbox events and only acknowledges explicit remote IDs."""

    def __init__(
        self, store, endpoint: str, token: str, interval: float = 2,
        batch_size: int = 20, timeout: float = 10, transport=post_json,
    ):
        if not endpoint.startswith("https://"):
            raise ValueError("sync endpoint must use https")
        if not token:
            raise ValueError("sync token is required")
        self.store = store
        self.endpoint = endpoint
        self.token = token
        self.interval = max(0.2, float(interval))
        self.batch_size = max(1, min(int(batch_size), 100))
        self.timeout = max(1, float(timeout))
        self.transport = transport
        self._stop = threading.Event()
        self._thread = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, name="woki-sync", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(self.timeout + 1)

    def _wire_event(self, event: dict) -> dict:
        return {
            "event_id": event["event_id"],
            "operation_id": event["operation_id"],
            "origin_id": event["origin_id"],
            "sequence": event["sequence"],
            "kind": event["kind"],
            "occurred_at": _iso_utc(event["occurred_at"]),
            "payload": event["payload"],
            "schema_version": event["schema_version"],
        }

    @staticmethod
    def _retry_at(event: dict) -> float:
        attempt = min(int(event.get("attempt_count", 0)) + 1, 8)
        return time.time() + min(300, 2 ** attempt)

    def send_once(self) -> int:
        events = self.store.list_pending_sync_events(self.batch_size)
        if not events:
            return 0
        requested_ids = {event["event_id"] for event in events}
        try:
            response = self.transport(
                self.endpoint, self.token,
                {"events": [self._wire_event(event) for event in events]},
                self.timeout,
            )
            accepted = response.get("accepted_event_ids")
            if not isinstance(accepted, list) or any(not isinstance(item, str) for item in accepted):
                raise ValueError("invalid sync acknowledgement")
            accepted_ids = requested_ids.intersection(accepted)
            if accepted_ids:
                self.store.mark_sync_events_synced(sorted(accepted_ids))
            for event in events:
                if event["event_id"] not in accepted_ids:
                    self.store.mark_sync_event_failed(
                        event["event_id"], "remote did not acknowledge event", self._retry_at(event)
                    )
            return len(accepted_ids)
        except (HTTPError, URLError, OSError, ValueError, json.JSONDecodeError) as exc:
            for event in events:
                self.store.mark_sync_event_failed(
                    event["event_id"], str(exc) or exc.__class__.__name__, self._retry_at(event)
                )
            return 0

    def _run(self):
        while not self._stop.is_set():
            self.send_once()
            self._stop.wait(self.interval)
