// NODO RECURSO - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// Recibe DISP y BC continuamente, los muestra en http://192.168.4.1 y permite
// aceptar/cambiar estado. Configure RESOURCE_ID/TYPE/ZONE antes de flashear.
#include <WiFi.h>
#include <WebServer.h>
#include <RadioLib.h>

#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 23
#define LORA_DIO0 26
#define LORA_DIO1 33

#define CENTER_ID "CENTRO"
#define BROADCAST "BCAST"

const char* RESOURCE_ID = "GRUA07";
const char* RESOURCE_TYPE = "GRUA";
String RESOURCE_ZONE = "NORTE";

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);
WebServer server(80);
volatile bool packetReceived = false;
volatile bool receiveInterruptEnabled = true;

long nextMessageId = 1;
unsigned long lastHeartbeat = 0;
String requestOrigin, requestSeq, requestCategory, requestPriority;
String requestLat, requestLon, requestPlace, requestDetail;
String assignmentState = "SIN_ASIGNACION";
String broadcastText, broadcastPriority, broadcastId;
unsigned long broadcastAckAt = 0;

void onPacketReceived() {
  if (receiveInterruptEnabled) packetReceived = true;
}

String field(const String& value, int index) {
  int start = 0, count = 0;
  for (int i = 0; i <= (int)value.length(); i++) {
    if (i == (int)value.length() || value[i] == '|') {
      if (count == index) return value.substring(start, i);
      count++;
      start = i + 1;
    }
  }
  return "";
}

String clean(String value) {
  value.replace("|", " "); value.replace("\n", " "); value.replace("\r", " ");
  if (value.length() > 80) value = value.substring(0, 80);
  return value;
}

void startListening() {
  packetReceived = false;
  receiveInterruptEnabled = true;
  radio.setPacketReceivedAction(onPacketReceived);
  radio.startReceive();
}

int transmitFrame(String frame) {
  receiveInterruptEnabled = false;
  radio.clearPacketReceivedAction();
  packetReceived = false;
  radio.standby();
  for (int attempt = 0; attempt < 6; attempt++) {
    if (radio.scanChannel() == RADIOLIB_CHANNEL_FREE) break;
    delay(random(20, 90));
  }
  int state = radio.transmit(frame);
  startListening();
  return state;
}

bool sendReliable(String kind, String payload) {
  long messageId = nextMessageId++;
  String frame = String(RESOURCE_ID) + "|" CENTER_ID "|" + kind + "|" + String(messageId);
  if (payload.length()) frame += "|" + payload;
  for (int attempt = 0; attempt < 3; attempt++) {
    if (transmitFrame(frame) != RADIOLIB_ERR_NONE) continue;
    unsigned long started = millis();
    while (millis() - started < 1200) {
      if (!packetReceived) { delay(2); continue; }
      receiveInterruptEnabled = false;
      packetReceived = false;
      String incoming;
      int state = radio.readData(incoming);
      if (state == RADIOLIB_ERR_NONE && field(incoming, 0) == CENTER_ID &&
          field(incoming, 1) == RESOURCE_ID && field(incoming, 2) == "ACK" &&
          field(incoming, 3) == String(messageId)) {
        startListening();
        return true;
      }
      startListening();
    }
    delay(random(100, 500));
  }
  return false;
}

void acknowledgeDownlink(const String& messageId) {
  transmitFrame(String(RESOURCE_ID) + "|" CENTER_ID "|ACK|" + messageId);
}

void handleRadioPacket() {
  if (!packetReceived) return;
  receiveInterruptEnabled = false;
  packetReceived = false;
  String frame;
  int state = radio.readData(frame);
  if (state != RADIOLIB_ERR_NONE) { startListening(); return; }

  String origin = field(frame, 0), destination = field(frame, 1);
  String kind = field(frame, 2), messageId = field(frame, 3);
  bool addressed = destination == RESOURCE_ID;
  bool broadcast = destination == BROADCAST;
  if (origin != CENTER_ID || (!addressed && !broadcast)) { startListening(); return; }

  if (kind == "DISP" && addressed) {
    // CENTRO|recurso|DISP|id|req_origin|req_seq|lat|lon|lugar|cat|pri|detalle
    requestOrigin = field(frame, 4); requestSeq = field(frame, 5);
    requestLat = field(frame, 6); requestLon = field(frame, 7);
    requestPlace = field(frame, 8); requestCategory = field(frame, 9);
    requestPriority = field(frame, 10); requestDetail = field(frame, 11);
    assignmentState = "PENDIENTE_ACEPTAR";
    acknowledgeDownlink(messageId);
    Serial.println("[RECURSO] despacho recibido " + requestOrigin + "/" + requestSeq);
    return;
  }

  if (kind == "BC" && broadcast) {
    // CENTRO|BCAST|BC|id|scope|priority|expiry|message
    String scope = field(frame, 4);
    if (scope == "ALL" || scope == "ZONE:" + RESOURCE_ZONE) {
      broadcastId = messageId;
      broadcastPriority = field(frame, 5);
      broadcastText = clean(field(frame, 7));
      // Confirmacion escalonada: evita que todos respondan al mismo tiempo.
      broadcastAckAt = millis() + random(300, 2500);
      Serial.println("[RECURSO] broadcast: " + broadcastText);
    }
  }
  startListening();
}

String jsonEscape(String value) {
  value.replace("\\", "\\\\"); value.replace("\"", "\\\"");
  value.replace("\n", " "); value.replace("\r", " ");
  return value;
}

void handleState() {
  String json = "{\"resource\":\"" + String(RESOURCE_ID) + "\",\"type\":\"" + RESOURCE_TYPE +
    "\",\"zone\":\"" + RESOURCE_ZONE + "\",\"assignmentState\":\"" + assignmentState +
    "\",\"requestOrigin\":\"" + jsonEscape(requestOrigin) + "\",\"requestSeq\":\"" + requestSeq +
    "\",\"category\":\"" + requestCategory + "\",\"priority\":\"" + requestPriority +
    "\",\"place\":\"" + jsonEscape(requestPlace) + "\",\"detail\":\"" + jsonEscape(requestDetail) +
    "\",\"broadcast\":\"" + jsonEscape(broadcastText) + "\",\"broadcastPriority\":\"" + broadcastPriority + "\"}";
  server.send(200, "application/json", json);
}

void handleAction() {
  String action = server.arg("state");
  if (!requestOrigin.length() || !requestSeq.length()) {
    server.send(409, "application/json", "{\"ok\":false,\"error\":\"sin asignacion\"}");
    return;
  }
  bool ok = false;
  if (action == "accept" && assignmentState == "PENDIENTE_ACEPTAR") {
    ok = sendReliable("ACC", requestOrigin + "|" + requestSeq);
    if (ok) assignmentState = "ACEPTADA";
  } else if (action == "enruta" && assignmentState == "ACEPTADA") {
    ok = sendReliable("ST", requestOrigin + "|" + requestSeq + "|enruta");
    if (ok) assignmentState = "EN_RUTA";
  } else if (action == "enlugar" && assignmentState == "EN_RUTA") {
    ok = sendReliable("ST", requestOrigin + "|" + requestSeq + "|enlugar");
    if (ok) assignmentState = "EN_LUGAR";
  } else if (action == "resuelta" && (assignmentState == "EN_RUTA" || assignmentState == "EN_LUGAR")) {
    ok = sendReliable("ST", requestOrigin + "|" + requestSeq + "|resuelta");
    if (ok) assignmentState = "RESUELTA";
  } else if (action == "cancelada" && assignmentState != "RESUELTA") {
    ok = sendReliable("ST", requestOrigin + "|" + requestSeq + "|" + action);
    if (ok) assignmentState = "CANCELADA";
  } else {
    server.send(409, "application/json", "{\"ok\":false,\"error\":\"transicion invalida\"}");
    return;
  }
  server.send(ok ? 200 : 504, "application/json", ok ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"sin ACK\"}");
}

const char PAGE[] = R"HTML(<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Recurso LoRa</title>
<style>body{font-family:Arial,sans-serif;background:#f5f5f5;color:#171717;margin:0}.w{max-width:520px;margin:auto;padding:16px}.h{background:#171717;color:#fff;padding:16px;border-radius:12px}.c{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;margin-top:12px}.bc{border-color:#b42318;background:#fef3f2}button{width:100%;padding:14px;margin-top:8px;border:0;border-radius:8px;background:#1e40af;color:#fff;font-weight:700}.muted{color:#737373;font-size:13px}</style></head><body><div class="w"><div class="h"><b id="resource">RECURSO</b><div id="meta"></div></div><div id="broadcast" class="c bc" hidden></div><div class="c"><h2>Asignación</h2><div id="assignment">Sin asignación</div><button onclick="act('accept')">Aceptar</button><button onclick="act('enruta')">En ruta</button><button onclick="act('enlugar')">En el lugar</button><button onclick="act('resuelta')">Resolver</button></div><p class="muted">Actualización local por WiFi. La confirmación viaja por LoRa.</p></div><script>
async function tick(){let d=await(await fetch('/api/state')).json();resource.textContent=d.resource+' · '+d.type;meta.textContent=d.zone+' · '+d.assignmentState;assignment.textContent=d.category?d.category+' — '+(d.detail||d.place||'sin detalle'):'Sin asignación';broadcast.hidden=!d.broadcast;broadcast.textContent=d.broadcast?'MENSAJE DEL CENTRO: '+d.broadcast:''}async function act(s){let r=await fetch('/api/action?state='+s,{method:'POST'});if(!r.ok)alert('No hubo confirmación del centro');tick()}tick();setInterval(tick,3000);
</script></body></html>)HTML";

void setup() {
  Serial.begin(115200);
  delay(300);
  randomSeed(analogRead(0));
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  int state = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (state != RADIOLIB_ERR_NONE) { Serial.println("[RECURSO] LoRa fallo " + String(state)); while (true) delay(1000); }
  startListening();

  WiFi.mode(WIFI_AP);
  String ssid = "RECURSO_" + String(RESOURCE_ID);
  WiFi.softAP(ssid.c_str());
  server.on("/", [](){ server.send(200, "text/html; charset=utf-8", PAGE); });
  server.on("/api/state", handleState);
  server.on("/api/action", HTTP_POST, handleAction);
  server.begin();
  Serial.println("[RECURSO] listo " + ssid + " http://192.168.4.1");
}

void loop() {
  server.handleClient();
  handleRadioPacket();

  if (broadcastAckAt && (long)(millis() - broadcastAckAt) >= 0) {
    String ackedBroadcast = broadcastId;
    broadcastAckAt = 0;
    sendReliable("BCA", ackedBroadcast);
  }

  if (millis() - lastHeartbeat >= 60000) {
    lastHeartbeat = millis();
    sendReliable("HB", String(RESOURCE_TYPE) + "|" + RESOURCE_ZONE + "|-|1");
  }
  delay(2);
}
