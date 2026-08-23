import unittest

from triage import triage_request, triage_requests


NOW = 1_000.0


def request(**overrides):
    value = {
        "id": 1,
        "category": "MEDICO",
        "priority": 2,
        "lat": "4.6712",
        "lon": "-74.0530",
        "place": "",
        "detail": "herido estable",
        "created_at": 100,
    }
    value.update(overrides)
    return value


def resource(node, **overrides):
    value = {
        "node": node,
        "kind": "MEDICO",
        "state": "disponible",
        "lat": "4.6720",
        "lon": "-74.0522",
        "last_seen": NOW - 10,
        "position_seen_at": NOW - 10,
    }
    value.update(overrides)
    return value


class TriagePriorityTests(unittest.TestCase):
    def test_escalates_critical_text_without_downgrading_reported_priority(self):
        result = triage_request(request(detail="Víctima inconsciente con hemorragia"), [], NOW)

        self.assertEqual(result["priority"], 0)
        self.assertEqual(result["reported_priority"], 2)
        self.assertEqual(result["reasons"], ["Escalada por señal crítica: persona inconsciente", "Escalada por señal crítica: sangrado crítico"])

    def test_preserves_noncritical_priority(self):
        result = triage_request(request(category="GRUA", priority=2, detail="vehículo bloqueando vía"), [], NOW)

        self.assertEqual(result["priority"], 2)
        self.assertEqual(result["reasons"], ["Se conserva la prioridad reportada"])

    def test_never_downgrades_priority_zero(self):
        result = triage_request(request(priority=0, detail="herido estable"), [], NOW)

        self.assertEqual(result["priority"], 0)
        self.assertEqual(result["reasons"], ["Prioridad crítica reportada por el nodo"])

    def test_applies_signals_only_to_their_category(self):
        medical = triage_request(request(category="MEDICO", detail="persona atrapada"), [], NOW)
        tow = triage_request(request(category="GRUA", priority=3, detail="persona atrapada consciente"), [], NOW)

        self.assertEqual(medical["priority"], 2)
        self.assertEqual(tow["priority"], 1)

    def test_orders_queue_by_effective_priority_then_arrival(self):
        requests = [
            request(id=1, priority=1, created_at=200),
            request(id=2, category="RESCATE", priority=3, detail="dos atrapados", created_at=300),
            request(id=3, priority=1, created_at=100),
        ]

        result = triage_requests(requests, [], NOW)

        self.assertEqual([item["id"] for item in result], [2, 3, 1])


class ResourceRecommendationTests(unittest.TestCase):
    def test_recommends_nearest_compatible_available_recent_resource(self):
        resources = [
            resource("MEDICO-FAR", lat="4.7000", lon="-74.0800"),
            resource("MEDICO-NEAR"),
            resource("MEDICO-BUSY", state="enruta", lat="4.6713", lon="-74.0531"),
            resource("MEDICO-STALE", last_seen=NOW - 601, lat="4.6713", lon="-74.0531"),
            resource("RESCATE01", kind="RESCATE", lat="4.6713", lon="-74.0531"),
        ]

        result = triage_request(request(), resources, NOW)

        self.assertEqual(result["recommended_resource"]["node"], "MEDICO-NEAR")
        self.assertEqual([item["node"] for item in result["candidates"]], ["MEDICO-NEAR", "MEDICO-FAR"])

    def test_reports_missing_location_and_resource(self):
        result = triage_request(request(lat="", lon="", place="", detail=""), [], NOW)

        self.assertIn("Sin coordenadas válidas", result["alerts"])
        self.assertIn("Sin lugar ni detalle", result["alerts"])
        self.assertIn("Sin recursos compatibles disponibles y recientes", result["alerts"])
        self.assertIsNone(result["recommended_resource"])

    def test_does_not_recommend_another_resource_after_dispatch(self):
        result = triage_request(request(state="DESPACHADA", resource_node="MEDICO01"), [resource("MEDICO02")], NOW)

        self.assertIsNone(result["recommended_resource"])
        self.assertNotIn("Sin recursos compatibles disponibles y recientes", result["alerts"])

    def test_does_not_use_stale_position_refreshed_only_by_heartbeat(self):
        resources = [
            resource("OLD-NEAR", position_seen_at=NOW - 601, lat="4.6713", lon="-74.0531"),
            resource("FRESH-FAR", lat="4.7000", lon="-74.0800"),
        ]

        result = triage_request(request(), resources, NOW)

        self.assertEqual(result["recommended_resource"]["node"], "FRESH-FAR")
        self.assertIsNone(result["candidates"][1]["distance_km"])


if __name__ == "__main__":
    unittest.main()
