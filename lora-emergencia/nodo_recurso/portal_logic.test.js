"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { consumeState } = require("./portal_logic.js");

test("una asignación pendiente nueva genera una sola llamada operativa", () => {
  const state = {
    assignmentId: "42",
    assignmentState: "PENDIENTE_ACEPTAR",
    category: "RESCATE",
    priority: "0",
    detail: "dos personas atrapadas",
    place: "",
    broadcastId: "",
    broadcast: "",
  };

  const first = consumeState({}, state);
  assert.equal(first.alerts.length, 1);
  assert.equal(first.alerts[0].kind, "assignment");
  assert.equal(first.alerts[0].id, "42");
  assert.match(first.alerts[0].announcement, /Nueva misión crítica/);
  assert.match(first.alerts[0].announcement, /dos personas atrapadas/);

  const second = consumeState(first.cursor, state);
  assert.deepEqual(second.alerts, []);
});

test("un broadcast nuevo genera una alerta hablada sin repetirla", () => {
  const state = {
    assignmentId: "",
    assignmentState: "SIN_ASIGNACION",
    broadcastId: "81",
    broadcastPriority: "URGENT",
    broadcast: "Evacuar la zona norte",
  };

  const first = consumeState({}, state);
  assert.deepEqual(first.alerts, [{
    kind: "broadcast",
    id: "81",
    announcement: "Mensaje urgente del centro. Evacuar la zona norte.",
  }]);

  assert.deepEqual(consumeState(first.cursor, state).alerts, []);
});
