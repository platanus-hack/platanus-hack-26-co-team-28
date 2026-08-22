// NODO PORTAL - MVP de emergencia - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// WiFi abierto "AYUDA" + portal cautivo (sin app, sin JS).
// El civil pide ayuda -> se envia por LoRa al gateway -> ACK real.
//
// Coexisten WiFi (SoftAP) y LoRa (SPI al SX1276) en la misma placa.
// Servidor HTTP sincrono (WebServer.h), max 4 clientes (limite realista del ESP32).
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <RadioLib.h>

// --- Pines LoRa (T3 V1.6.1) ---
#define LORA_SCK   5
#define LORA_MISO  19
#define LORA_MOSI  27
#define LORA_CS    18
#define LORA_RST   23
#define LORA_DIO0  26
#define LORA_DIO1  33
SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);

// --- WiFi / portal ---
const char* AP_SSID = "AYUDA";
const byte DNS_PORT = 53;
IPAddress apIP(192, 168, 4, 1);
DNSServer dnsServer;
WebServer server(80);

String NODE_ID = "a3f21c";
// Ubicacion FIJA de este nodo (se configura al desplegarlo).
// Cada nodo lleva sus coordenadas; el reporte usa la ubicacion del nodo,
// no el GPS del telefono (bloqueado en HTTP). Ejemplo: Parque de la 93, Bogota.
String NODE_LAT = "4.6767";
String NODE_LON = "-74.0483";
int seq = 0;

// ---------- HTML ----------
String htmlHead() {
  return "<!doctype html><html lang='es'><head><meta charset='utf-8'>"
         "<meta name='viewport' content='width=device-width,initial-scale=1'>"
         "<style>"
         "body{font-family:-apple-system,Arial,sans-serif;margin:0;background:#fff;color:#111}"
         ".wrap{max-width:520px;margin:0 auto;padding:18px}"
         ".hdr{background:#d92d20;color:#fff;padding:16px;border-radius:0 0 12px 12px;text-align:center}"
         ".hdr h1{margin:0;font-size:22px}.hdr p{margin:4px 0 0;font-size:13px;opacity:.95}"
         "label{display:block;font-weight:700;margin:16px 0 6px;font-size:15px}"
         "input[type=text]{width:100%;padding:14px;font-size:16px;border:2px solid #ccc;border-radius:10px;box-sizing:border-box}"
         "button{width:100%;padding:18px;font-size:19px;font-weight:700;border:0;border-radius:12px;margin-top:10px;color:#fff}"
         ".b1{background:#1570ef}.b2{background:#d92d20}.b3{background:#b42318}.b4{background:#067647}"
         ".ok{background:#ecfdf3;border:2px solid #067647;color:#054f31;padding:16px;border-radius:12px;font-size:17px}"
         ".warn{background:#fffaeb;border:2px solid #b54708;color:#7a2e0e;padding:16px;border-radius:12px;font-size:17px}"
         ".note{font-size:12px;color:#666;margin-top:18px;text-align:center}"
         "</style></head><body><div class='wrap'>";
}

String pageForm() {
  String h = htmlHead();
  h += "<div class='hdr'><h1>PUNTO DE AYUDA</h1><p>Red oficial sin clave. Pide ayuda sin instalar nada.</p></div>";
  h += "<form action='/report' method='POST'>";
  h += "<label>Que necesitas? Toca un boton.</label>";
  h += "<button class='b1' name='tipo' value='agua'>Agua / comida</button>";
  h += "<button class='b2' name='tipo' value='medico'>Ayuda medica</button>";
  h += "<button class='b3' name='tipo' value='rescate'>Rescate (hay atrapados)</button>";
  h += "<button class='b4' name='tipo' value='asalvo'>Estoy a salvo</button>";
  h += "<label>Donde estas? (opcional)</label>";
  h += "<input type='text' name='detalle' maxlength='60' placeholder='ej: apto 401, 2do piso, junto al tanque'>";
  h += "</form>";
  h += "<p class='note'>Si no se abre solo, entra a http://192.168.4.1</p>";
  h += "</div></body></html>";
  return h;
}

String pageConfirm(String tipo, bool acked) {
  String h = htmlHead();
  h += "<div class='hdr'><h1>REPORTE ENVIADO</h1></div>";
  if (acked) {
    h += "<div class='ok'><b>Confirmado por el puesto de mando.</b><br>Tu reporte de <b>" + tipo + "</b> llego por radio. Quedate cerca de este punto si es seguro.</div>";
  } else {
    h += "<div class='warn'><b>Guardado. Reintentando enviar...</b><br>Tu reporte de <b>" + tipo + "</b> se registro. Aun no confirma el puesto de mando. Espera cerca de este punto.</div>";
  }
  h += "<form action='/' method='GET'><button class='b1'>Hacer otro reporte</button></form>";
  h += "</div></body></html>";
  return h;
}

// ---------- LoRa ----------
bool enviarReporte(String tipo, String detalle) {
  detalle.replace("|", " ");
  detalle.replace("\n", " ");
  detalle.replace("\r", " ");
  if (detalle.length() > 60) detalle = detalle.substring(0, 60);
  if (detalle.length() == 0) detalle = "-";

  String msg = NODE_ID + "|" + tipo + "|" + detalle + "|" + NODE_LAT + "|" + NODE_LON + "|" + String(seq);
  seq++;
  Serial.println("[NODO] TX: " + msg);
  radio.transmit(msg);

  // esperar ACK hasta 1.2 s
  unsigned long t0 = millis();
  bool acked = false;
  while (millis() - t0 < 1200 && !acked) {
    String ack;
    int st = radio.receive(ack);
    if (st == RADIOLIB_ERR_NONE && ack.startsWith("ACK|" + NODE_ID)) acked = true;
  }
  Serial.println(acked ? "[NODO] ACK OK" : "[NODO] sin ACK");
  return acked;
}

// ---------- Handlers ----------
void handleRoot()    { server.send(200, "text/html", pageForm()); }

void handleReport() {
  String tipo = server.arg("tipo");
  if (tipo.length() == 0) { server.sendHeader("Location", "/"); server.send(302, "text/plain", ""); return; }
  String detalle = server.arg("detalle");
  bool ok = enviarReporte(tipo, detalle);
  server.send(200, "text/html", pageConfirm(tipo, ok));
}

// redirige los chequeos de conectividad del sistema operativo al portal
void handleCaptive() {
  server.sendHeader("Location", String("http://") + apIP.toString() + "/", true);
  server.send(302, "text/plain", "");
}

void setup() {
  Serial.begin(115200);
  delay(300);

  // LoRa
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  Serial.print("[NODO] Iniciando LoRa... ");
  int e = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  Serial.println(e == RADIOLIB_ERR_NONE ? "OK" : "FALLO");

  // WiFi SoftAP abierto
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_SSID, NULL, 1, 0, 4);   // canal 1, visible, max 4 clientes
  Serial.print("[NODO] SoftAP '"); Serial.print(AP_SSID);
  Serial.print("' en "); Serial.println(WiFi.softAPIP());

  // DNS: todo apunta al portal
  dnsServer.start(DNS_PORT, "*", apIP);

  // Rutas
  server.on("/", handleRoot);
  server.on("/report", HTTP_POST, handleReport);
  server.on("/generate_204", handleCaptive);   // Android
  server.on("/gen_204", handleCaptive);         // Android
  server.on("/ncsi.txt", handleCaptive);        // Windows
  server.on("/connecttest.txt", handleCaptive); // Windows
  server.on("/hotspot-detect.html", handleRoot);// Apple: sirve el portal
  server.onNotFound(handleRoot);                // cualquier otra ruta
  server.begin();
  Serial.println("[NODO] Portal listo.");
}

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
}
