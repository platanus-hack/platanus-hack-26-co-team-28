(function (root, factory) {
  "use strict";
  const portal = factory();
  if (typeof module === "object" && module.exports) module.exports = portal;
  root.WokiResourcePortal = portal;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function text(value) {
    return String(value || "").trim();
  }

  function assignmentAnnouncement(state) {
    const urgency = text(state.priority) === "0" ? "crítica" : "nueva";
    const category = text(state.category) || "sin categoría";
    const detail = text(state.detail) || text(state.place) || "revisa los detalles en pantalla";
    return `Nueva misión ${urgency}. ${category}. ${detail}.`;
  }

  function broadcastAnnouncement(state) {
    const prefix = text(state.broadcastPriority) === "URGENT"
      ? "Mensaje urgente del centro"
      : "Mensaje del centro";
    return `${prefix}. ${text(state.broadcast)}.`;
  }

  function consumeState(previous, state) {
    const cursor = {
      assignmentId: text(state.assignmentId) || text(previous.assignmentId),
      broadcastId: text(state.broadcastId) || text(previous.broadcastId),
    };
    const alerts = [];
    const assignmentId = text(state.assignmentId);
    if (
      assignmentId &&
      assignmentId !== text(previous.assignmentId) &&
      state.assignmentState === "PENDIENTE_ACEPTAR"
    ) {
      alerts.push({
        kind: "assignment",
        id: assignmentId,
        announcement: assignmentAnnouncement(state),
      });
    }
    const broadcastId = text(state.broadcastId);
    if (
      broadcastId &&
      broadcastId !== text(previous.broadcastId) &&
      text(state.broadcast)
    ) {
      alerts.push({
        kind: "broadcast",
        id: broadcastId,
        announcement: broadcastAnnouncement(state),
      });
    }
    return { cursor, alerts };
  }

  return { assignmentAnnouncement, broadcastAnnouncement, consumeState };
});
