import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from command_core import CenterStore, RadioFrame
from sync_worker import SyncWorker, post_json


class SyncWorkerTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.store = CenterStore(str(Path(self.tempdir.name) / "center.db"))
        self.store.ingest(
            RadioFrame.parse("CIVIL1|CENTRO|SOS|7|MEDICO|0|4.1|-74.1|-|herido")
        )

    def tearDown(self):
        self.store.close()
        self.tempdir.cleanup()

    def test_acknowledges_only_ids_confirmed_by_remote(self):
        captured = []

        def accept_all(url, token, payload, timeout):
            captured.append((url, token, payload, timeout))
            return {"accepted_event_ids": [event["event_id"] for event in payload["events"]]}

        worker = SyncWorker(
            self.store, "https://hub.example/api/sync", "secret", transport=accept_all
        )

        self.assertEqual(worker.send_once(), 1)
        self.assertEqual(self.store.sync_status()["pending"], 0)
        self.assertEqual(captured[0][0], "https://hub.example/api/sync")
        self.assertEqual(captured[0][1], "secret")
        self.assertTrue(captured[0][2]["events"][0]["occurred_at"].endswith("Z"))

    def test_bad_response_keeps_event_for_retry(self):
        worker = SyncWorker(
            self.store, "https://hub.example/api/sync", "secret",
            transport=lambda *_args: {"unexpected": True},
        )

        self.assertEqual(worker.send_once(), 0)
        status = self.store.sync_status()
        self.assertEqual(status["pending"], 1)
        self.assertEqual(status["retrying"], 1)

    def test_rejects_insecure_endpoint(self):
        with self.assertRaisesRegex(ValueError, "https"):
            SyncWorker(self.store, "http://hub.example/api/sync", "secret")

    def test_http_transport_uses_a_packaged_ca_bundle(self):
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self, _limit):
                return b'{"accepted_event_ids":[]}'

        with patch("sync_worker.urlopen", return_value=Response()) as mocked_urlopen:
            post_json("https://hub.example/api/sync", "secret", {"events": []}, 5)

        self.assertIn("context", mocked_urlopen.call_args.kwargs)
        self.assertTrue(mocked_urlopen.call_args.kwargs["context"].verify_mode)


if __name__ == "__main__":
    unittest.main()
