import tempfile
import threading
import time
import unittest
from pathlib import Path

from command_core import CenterStore, RadioFrame
from center import SerialGateway, split_gateway_rx


class RadioFrameTests(unittest.TestCase):
    def test_round_trip(self):
        raw = "NODE1|CENTRO|SOS|7|MEDICO|0|4.1|-74.1|-|herido"
        self.assertEqual(RadioFrame.parse(raw).encode(), raw)

    def test_rejects_non_numeric_message_id(self):
        with self.assertRaises(ValueError):
            RadioFrame.parse("NODE1|CENTRO|SOS|not-a-number")

    def test_parses_gateway_rx_metrics_without_putting_them_in_payload(self):
        line = "RX|GRUA07|CENTRO|ACC|5|CIVIL1|7|RSSI:-71.50|SNR:8.25"
        frame, rssi, snr = split_gateway_rx(line)
        self.assertEqual(frame.payload, ("CIVIL1", "7"))
        self.assertEqual((rssi, snr), ("-71.50", "8.25"))


class CenterStoreTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.store = CenterStore(str(Path(self.tempdir.name) / "center.db"))

    def tearDown(self):
        self.store.close()
        self.tempdir.cleanup()

    def add_sos(self):
        frame = RadioFrame.parse("CIVIL1|CENTRO|SOS|7|MEDICO|0|4.1|-74.1|-|herido")
        return self.store.ingest(frame, "-70", "8")

    def test_sos_is_idempotent_by_origin_and_message_id(self):
        self.assertEqual(self.add_sos(), "CREATED")
        self.assertEqual(self.add_sos(), "DUPLICATE")
        self.assertEqual(len(self.store.state()["requests"]), 1)

    def test_request_ids_do_not_collide_between_nodes(self):
        self.add_sos()
        other = RadioFrame.parse("CIVIL2|CENTRO|SOS|7|RESCATE|0|4.2|-74.2|-|atrapado")
        self.assertEqual(self.store.ingest(other), "CREATED")
        self.assertEqual(len(self.store.state()["requests"]), 2)

    def test_dispatch_accept_and_resolve_follow_state_machine(self):
        self.add_sos()
        request_id = self.store.state()["requests"][0]["id"]
        dispatch, _ = self.store.build_dispatch(request_id, "GRUA07")
        self.assertEqual(dispatch.payload[:2], ("CIVIL1", "7"))
        self.store.mark_dispatched(request_id, "GRUA07", dispatch)

        wrong = RadioFrame.parse("GRUA08|CENTRO|ACC|1|CIVIL1|7")
        self.assertEqual(self.store.ingest(wrong), "REJECTED")
        accept = RadioFrame.parse("GRUA07|CENTRO|ACC|2|CIVIL1|7")
        self.assertEqual(self.store.ingest(accept), "UPDATED")
        enroute = RadioFrame.parse("GRUA07|CENTRO|ST|3|CIVIL1|7|enruta")
        self.assertEqual(self.store.ingest(enroute), "UPDATED")
        resolved = RadioFrame.parse("GRUA07|CENTRO|ST|4|CIVIL1|7|resuelta")
        self.assertEqual(self.store.ingest(resolved), "UPDATED")
        self.assertEqual(self.store.state()["requests"][0]["estado"], "RESUELTA")

    def test_cannot_dispatch_request_twice(self):
        self.add_sos()
        request_id = self.store.state()["requests"][0]["id"]
        dispatch, _ = self.store.build_dispatch(request_id, "GRUA07")
        self.store.mark_dispatched(request_id, "GRUA07", dispatch)
        with self.assertRaisesRegex(ValueError, "not pending"):
            self.store.build_dispatch(request_id, "GRUA08")

    def test_broadcast_receipts_are_deduplicated_per_node(self):
        broadcast = RadioFrame("CENTRO", "BCAST", "BC", 30, ("ALL", "URGENT", "9999999999", "Evacuar"))
        self.store.record_broadcast(broadcast)
        receipt = RadioFrame.parse("GRUA07|CENTRO|BCA|8|30")
        self.assertEqual(self.store.ingest(receipt), "UPDATED")
        self.assertEqual(self.store.ingest(receipt), "UPDATED")
        self.assertEqual(self.store.state()["broadcasts"][0]["received_count"], 1)


class SerialGatewayTests(unittest.TestCase):
    def test_reliable_send_waits_for_matching_ack(self):
        class FakeSerial:
            def __init__(self):
                self.writes = []

            def write(self, value):
                self.writes.append(value)

            def flush(self):
                pass

        gateway = SerialGateway("unused", lambda _line: None)
        gateway._serial = FakeSerial()
        gateway._connected = True
        frame = RadioFrame("CENTRO", "GRUA07", "DISP", 12, ("CIVIL1", "7"))
        result = []
        worker = threading.Thread(target=lambda: result.append(gateway.send_reliable(frame, timeout=0.5)))
        worker.start()
        for _ in range(50):
            if gateway._serial.writes:
                break
            time.sleep(0.01)
        gateway.notify_ack("GRUA07", "CENTRO", 12)
        worker.join(1)
        self.assertEqual(result, [(True, "DELIVERED")])
        self.assertEqual(gateway._serial.writes, [b"TX|CENTRO|GRUA07|DISP|12|CIVIL1|7\n"])


if __name__ == "__main__":
    unittest.main()
