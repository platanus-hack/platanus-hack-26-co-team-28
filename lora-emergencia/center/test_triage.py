import unittest

from triage import cluster_by_proximity, coverage_alerts, kind_matches, triage_request, triage_requests


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
        # La señal de GRUA (vía bloqueada) no aplica a MEDICO: conserva su prioridad.
        medical = triage_request(request(category="MEDICO", detail="escombro en via"), [], NOW)
        # GRUA escala por "escombro en via". Ya NO responde a "atrapado" (eso es RESCATE).
        tow = triage_request(request(category="GRUA", priority=3, detail="escombro en via"), [], NOW)

        self.assertEqual(medical["priority"], 2)
        self.assertEqual(tow["priority"], 1)

    def test_grua_no_longer_triggers_on_trapped_person(self):
        # "atrapado" es de RESCATE. En GRUA no debe escalar: se elimina el solapamiento.
        tow = triage_request(request(category="GRUA", priority=3, detail="persona atrapada consciente"), [], NOW)
        rescue = triage_request(request(category="RESCATE", priority=3, detail="persona atrapada"), [], NOW)

        self.assertEqual(tow["priority"], 3)
        self.assertEqual(rescue["priority"], 0)

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


class KindMatchesTests(unittest.TestCase):
    def test_single_value_matches_only_that_category(self):
        self.assertTrue(kind_matches("GRUA", "GRUA"))
        self.assertFalse(kind_matches("GRUA", "RESCATE"))

    def test_comma_separated_value_matches_any_listed_category(self):
        self.assertTrue(kind_matches("GRUA,RESCATE", "GRUA"))
        self.assertTrue(kind_matches("GRUA,RESCATE", "RESCATE"))
        self.assertFalse(kind_matches("GRUA,RESCATE", "MEDICO"))

    def test_is_case_insensitive_and_ignores_stray_spaces(self):
        self.assertTrue(kind_matches("grua, rescate", "RESCATE"))
        self.assertTrue(kind_matches(" Grua ,Rescate ", "grua"))

    def test_empty_or_missing_kind_matches_nothing(self):
        self.assertFalse(kind_matches("", "GRUA"))
        self.assertFalse(kind_matches(None, "GRUA"))


class MultiKindResourceRecommendationTests(unittest.TestCase):
    def test_resource_with_multiple_kinds_is_a_candidate_for_each_of_its_categories(self):
        grua = resource("GRUA07", kind="GRUA,RESCATE")

        for category in ("GRUA", "RESCATE"):
            result = triage_request(request(category=category), [grua], NOW)
            self.assertEqual(result["recommended_resource"]["node"], "GRUA07")

        result = triage_request(request(category="MEDICO"), [grua], NOW)
        self.assertIsNone(result["recommended_resource"])


class ClusterByProximityTests(unittest.TestCase):
    # 1 grado de latitud son ~111 km, asi que 0.001 son ~111 m.
    NEAR = (4.6700, -74.0500)
    NEAR_TOO = (4.6702, -74.0500)      # ~22 m del anterior
    BRIDGE = (4.6704, -74.0500)        # ~22 m del anterior, ~44 m del primero
    FAR = (4.7400, -74.0900)           # ~9 km

    def test_groups_points_inside_the_radius_and_separates_the_rest(self):
        groups = cluster_by_proximity([self.NEAR, self.FAR, self.NEAR_TOO], 0.3)

        self.assertEqual(groups, [[0, 2], [1]])

    def test_links_distant_points_through_a_bridge_point(self):
        # NEAR y BRIDGE quedan a 44 m: dentro del radio de 30 m solo si un
        # tercero los enlaza. Un agrupado codicioso los separaria.
        groups = cluster_by_proximity([self.NEAR, self.BRIDGE, self.NEAR_TOO], 0.03)

        self.assertEqual(groups, [[0, 1, 2]])

    def test_result_does_not_depend_on_input_order(self):
        first = cluster_by_proximity([self.NEAR, self.FAR, self.NEAR_TOO], 0.3)
        second = cluster_by_proximity([self.NEAR_TOO, self.NEAR, self.FAR], 0.3)

        self.assertEqual([len(group) for group in first], [len(group) for group in second])

    def test_handles_empty_input(self):
        self.assertEqual(cluster_by_proximity([], 0.3), [])


def working(request_id, resource, lat, lon, state="ACEPTADA"):
    return {"id": request_id, "resource_node": resource, "state": state,
            "lat": str(lat), "lon": str(lon), "category": "RESCATE", "created_at": NOW - 60}


def waiting(request_id, lat="4.6700", lon="-74.0500", state="PENDIENTE", created_at=NOW - 300):
    return {"id": request_id, "resource_node": None, "state": state, "lat": lat, "lon": lon,
            "category": "MEDICO", "priority": 1, "place": "Colegio central", "created_at": created_at}


class CoverageOverlapTests(unittest.TestCase):
    def test_flags_two_different_resources_working_in_the_same_sector(self):
        requests = [working(1, "GRUA07", 4.6700, -74.0500), working(2, "RESCATE01", 4.6702, -74.0500)]

        result = coverage_alerts(requests, NOW)

        self.assertEqual(len(result["overlaps"]), 1)
        self.assertEqual(result["overlaps"][0]["resources"], ["GRUA07", "RESCATE01"])
        self.assertEqual(result["overlaps"][0]["request_ids"], [1, 2])

    def test_one_resource_with_two_nearby_requests_is_not_an_overlap(self):
        # Un mismo equipo atendiendo 2 casos vecinos es lo correcto, no
        # esfuerzo duplicado.
        requests = [working(1, "GRUA07", 4.6700, -74.0500), working(2, "GRUA07", 4.6702, -74.0500)]

        self.assertEqual(coverage_alerts(requests, NOW)["overlaps"], [])

    def test_two_resources_far_apart_are_not_an_overlap(self):
        requests = [working(1, "GRUA07", 4.6700, -74.0500), working(2, "RESCATE01", 4.7400, -74.0900)]

        self.assertEqual(coverage_alerts(requests, NOW)["overlaps"], [])

    def test_ignores_resolved_and_cancelled_work(self):
        requests = [
            working(1, "GRUA07", 4.6700, -74.0500, state="RESUELTA"),
            working(2, "RESCATE01", 4.6702, -74.0500, state="CANCELADA"),
        ]

        self.assertEqual(coverage_alerts(requests, NOW)["overlaps"], [])

    def test_ignores_assigned_work_without_coordinates(self):
        requests = [
            {"id": 1, "resource_node": "GRUA07", "state": "ACEPTADA", "lat": "", "lon": "", "created_at": NOW},
            {"id": 2, "resource_node": "RESCATE01", "state": "ACEPTADA", "lat": "", "lon": "", "created_at": NOW},
        ]

        self.assertEqual(coverage_alerts(requests, NOW)["overlaps"], [])


class CoverageGapTests(unittest.TestCase):
    def test_flags_open_requests_without_an_assigned_resource(self):
        result = coverage_alerts([waiting(5)], NOW)

        self.assertEqual(len(result["gaps"]), 1)
        self.assertEqual(result["gaps"][0]["request_id"], 5)
        self.assertEqual(result["gaps"][0]["waiting_seconds"], 300)
        self.assertEqual(result["gaps"][0]["place"], "Colegio central")

    def test_does_not_flag_a_request_that_already_has_a_resource(self):
        self.assertEqual(coverage_alerts([working(1, "GRUA07", 4.6700, -74.0500)], NOW)["gaps"], [])

    def test_orders_gaps_by_waiting_time_oldest_first(self):
        requests = [waiting(1, created_at=NOW - 60), waiting(2, created_at=NOW - 900), waiting(3, created_at=NOW - 300)]

        gaps = coverage_alerts(requests, NOW)["gaps"]

        self.assertEqual([gap["request_id"] for gap in gaps], [2, 3, 1])

    def test_a_request_can_be_a_gap_without_coordinates(self):
        # El lugar escrito a mano es el camino por defecto del portal: una
        # solicitud sin GPS sigue siendo una solicitud sin nadie asignado.
        gaps = coverage_alerts([waiting(7, lat="", lon="")], NOW)["gaps"]

        self.assertEqual([gap["request_id"] for gap in gaps], [7])

    def test_reports_no_alerts_when_everything_is_covered(self):
        result = coverage_alerts([working(1, "GRUA07", 4.6700, -74.0500)], NOW)

        self.assertEqual(result, {"overlaps": [], "gaps": []})


if __name__ == "__main__":
    unittest.main()
