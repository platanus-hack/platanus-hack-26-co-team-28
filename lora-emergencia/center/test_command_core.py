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
        self.db_path = str(Path(self.tempdir.name) / "center.db")
        self.store = CenterStore(self.db_path)

    def tearDown(self):
        self.store.close()
        self.tempdir.cleanup()

    def add_sos(self):
        frame = RadioFrame.parse("CIVIL1|CENTRO|SOS|7|MEDICO|0|4.1|-74.1|-|herido")
        return self.store.ingest(frame, "-70", "8")

    def add_resource(self, node="GRUA07", kind="MEDICO"):
        frame = RadioFrame.parse(f"{node}|CENTRO|HB|1|{kind}|NORTE")
        return self.store.ingest(frame, "-60", "9")

    def test_sos_is_idempotent_by_origin_and_message_id(self):
        self.assertEqual(self.add_sos(), "CREATED")
        self.assertEqual(self.add_sos(), "DUPLICATE")
        self.assertEqual(len(self.store.state()["requests"]), 1)

    def test_radio_event_records_domain_result(self):
        self.assertEqual(self.add_sos(), "CREATED")
        self.assertEqual(self.add_sos(), "DUPLICATE")

        events = self.store.list_radio_events(limit=2)

        self.assertEqual([event["result"] for event in events], ["DUPLICATE", "CREATED"])

    def test_request_ids_do_not_collide_between_nodes(self):
        self.add_sos()
        other = RadioFrame.parse("CIVIL2|CENTRO|SOS|7|RESCATE|0|4.2|-74.2|-|atrapado")
        self.assertEqual(self.store.ingest(other), "CREATED")
        self.assertEqual(len(self.store.state()["requests"]), 2)

    def test_dispatch_accept_and_resolve_follow_state_machine(self):
        self.add_sos()
        self.add_resource()
        request_id = self.store.state()["requests"][0]["id"]
        dispatch, _ = self.store.reserve_dispatch(request_id, "GRUA07")
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
        self.assertEqual(self.store.state()["resources"][0]["state"], "disponible")

    def test_cannot_dispatch_request_twice(self):
        self.add_sos()
        self.add_resource()
        request_id = self.store.state()["requests"][0]["id"]
        dispatch, _ = self.store.reserve_dispatch(request_id, "GRUA07")
        self.store.mark_dispatched(request_id, "GRUA07", dispatch)
        with self.assertRaisesRegex(ValueError, "not pending"):
            self.store.reserve_dispatch(request_id, "GRUA08")

    def test_dispatch_validates_resource_and_uses_effective_priority(self):
        self.add_sos()
        self.add_resource()
        request_id = self.store.state()["requests"][0]["id"]

        with self.assertRaisesRegex(ValueError, "resource not found"):
            self.store.reserve_dispatch(request_id, "UNKNOWN", 0)
        dispatch, _request = self.store.reserve_dispatch(request_id, "GRUA07", 0)

        self.assertEqual(dispatch.payload[6], "0")

    def test_dispatch_rejects_incompatible_or_unavailable_resource(self):
        self.add_sos()
        self.add_resource("GRUA07", "GRUA")
        self.add_resource("MEDICO01", "MEDICO")
        self.store.ingest(RadioFrame.parse("MEDICO01|CENTRO|POS|2|4.1|-74.1|10|0|enruta"))
        request_id = self.store.state()["requests"][0]["id"]

        with self.assertRaisesRegex(ValueError, "not compatible"):
            self.store.reserve_dispatch(request_id, "GRUA07")
        with self.assertRaisesRegex(ValueError, "not available"):
            self.store.reserve_dispatch(request_id, "MEDICO01")

    def test_dispatch_rejects_resource_with_stale_communication(self):
        self.add_sos()
        self.add_resource("MEDICO01", "MEDICO")
        with self.store._db:
            self.store._db.execute(
                "UPDATE resources SET last_seen=? WHERE node='MEDICO01'",
                (time.time() - 601,),
            )
        request_id = self.store.state()["requests"][0]["id"]

        with self.assertRaisesRegex(ValueError, "stale communication"):
            self.store.reserve_dispatch(request_id, "MEDICO01")

    def test_dispatch_reservation_prevents_double_assignment_and_can_be_released(self):
        self.add_sos()
        self.store.ingest(RadioFrame.parse("CIVIL2|CENTRO|SOS|8|MEDICO|1|4.2|-74.2|-|herido"))
        self.add_resource("MEDICO01", "MEDICO")
        requests = self.store.state()["requests"]

        self.store.reserve_dispatch(requests[0]["id"], "MEDICO01")
        with self.assertRaisesRegex(ValueError, "not available"):
            self.store.reserve_dispatch(requests[1]["id"], "MEDICO01")

        self.store.release_dispatch(requests[0]["id"], "MEDICO01")
        dispatch, _request = self.store.reserve_dispatch(requests[1]["id"], "MEDICO01")
        self.assertEqual(dispatch.destination, "MEDICO01")

    def test_position_cannot_make_reserved_resource_available(self):
        self.add_sos()
        self.store.ingest(RadioFrame.parse("CIVIL2|CENTRO|SOS|8|MEDICO|1|4.2|-74.2|-|herido"))
        self.add_resource("MEDICO01", "MEDICO")
        requests = self.store.state()["requests"]
        self.store.reserve_dispatch(requests[0]["id"], "MEDICO01")

        self.store.ingest(RadioFrame.parse("MEDICO01|CENTRO|POS|2|4.1|-74.1|10|0|disponible"))

        self.assertEqual(self.store.state()["resources"][0]["state"], "reservado")
        with self.assertRaisesRegex(ValueError, "not available"):
            self.store.reserve_dispatch(requests[1]["id"], "MEDICO01")

    def test_restart_marks_incomplete_dispatch_for_human_review(self):
        self.add_sos()
        self.add_resource("MEDICO01", "MEDICO")
        request_id = self.store.state()["requests"][0]["id"]
        self.store.reserve_dispatch(request_id, "MEDICO01")
        self.store.close()

        self.store = CenterStore(self.db_path)

        self.assertEqual(self.store.state()["requests"][0]["state"], "ENVIO_INDETERMINADO")
        self.assertEqual(self.store.state()["resources"][0]["state"], "asignado")

    def test_restart_release_then_redispatch_preserves_exclusivity(self):
        self.add_sos()
        self.add_resource("MEDICO01", "MEDICO")
        request_id = self.store.state()["requests"][0]["id"]
        self.store.reserve_dispatch(request_id, "MEDICO01")
        self.store.close()
        self.store = CenterStore(self.db_path)

        with self.assertRaisesRegex(ValueError, "not pending"):
            self.store.reserve_dispatch(request_id, "MEDICO01")
        released = self.store.request_action(request_id, "release", "Ana", "Radio verificada sin recepción")
        self.assertEqual(released["state"], "EN_REVISION")
        self.assertIsNone(released["resource_node"])
        self.assertEqual(self.store.get_resource("MEDICO01")["state"], "disponible")
        frame, _request = self.store.reserve_dispatch(request_id, "MEDICO01")
        self.assertEqual(frame.destination, "MEDICO01")
        self.assertEqual(self.store.request_timeline(request_id)[-1]["event_type"], "HUMAN_RELEASE")

    def test_human_cancel_rejects_active_remote_assignments(self):
        self.add_sos()
        self.add_resource("MEDICO01", "MEDICO")
        request_id = self.store.state()["requests"][0]["id"]
        frame, _request = self.store.reserve_dispatch(request_id, "MEDICO01")
        self.store.mark_dispatched(request_id, "MEDICO01", frame)

        with self.assertRaisesRegex(ValueError, "invalid state transition"):
            self.store.request_action(request_id, "cancel", "Ana", "Cancelar desde centro")

        self.assertEqual(self.store.get_request(request_id)["state"], "DESPACHADA")
        self.assertEqual(self.store.get_resource("MEDICO01")["state"], "asignado")

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
