// NODO PORTAL HTTPS - MVP con ubicacion del telefono - TTGO LoRa32 T3 V1.6.1
// Usa el servidor HTTPS nativo del ESP-IDF (esp_https_server), compatible con core 3.x.
// WiFi abierto "AYUDA". HTTP :80 redirige a Safari/Chrome. HTTPS :443 con cert
// valido de ayuda.homiapp.xyz -> navigator.geolocation entrega el GPS real.
// Respaldo manual: Plus Code o direccion. El reporte viaja por LoRa 915 con ACK.
//
// Requiere: credentials.h (cert + clave, NO se sube a git).
#include <WiFi.h>
#include <DNSServer.h>
#include <RadioLib.h>
#include <esp_http_server.h>
#include <esp_https_server.h>
#include <Wire.h>
#include <U8g2lib.h>
#include "credentials.h"

// OLED I2C del T3 V1.6.1 (SDA 21, SCL 22, 0x3C). Muestra el estado del punto de ayuda.
#define OLED_SDA 21
#define OLED_SCL 22
#define OLED_ADDR 0x3C
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, OLED_SCL, OLED_SDA);
bool tieneOled = false;
int enviados = 0;

bool detectarOled() {
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.beginTransmission(OLED_ADDR);
  return Wire.endTransmission() == 0;
}
// Muestra 3 lineas en la OLED del rescatista.
void oledMostrar(const String& l1, const String& l2, const String& l3) {
  if (!tieneOled) return;
  oled.clearBuffer();
  oled.setFont(u8g2_font_ncenB10_tr);
  oled.drawStr(0, 14, l1.c_str());
  oled.setFont(u8g2_font_6x12_tr);
  oled.drawStr(0, 34, l2.c_str());
  oled.drawStr(0, 52, l3.c_str());
  oled.sendBuffer();
}

// --- Pines LoRa (T3 V1.6.1) ---
#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 23
#define LORA_DIO0 26
#define LORA_DIO1 33
SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);

const char* AP_SSID = "AYUDA_AQUI_RESCATISTA_911";
const char* DOMAIN = "ayuda.homiapp.xyz";
IPAddress apIP(192, 168, 4, 1);
DNSServer dnsServer;

// Direccionamiento estandar (frame: ORIGEN|DESTINO|TIPO|MSGID|payload...)
#define DST_CENTRO "CENTRO"
String NODE_ID = "a3f21c";
String NODE_LAT = "4.6767";
String NODE_LON = "-74.0483";
int seq = 0;

// ---------- utilidades ----------
String urldecode(String s) {
  String o; char c; int i;
  for (int k = 0; k < (int)s.length(); k++) {
    c = s[k];
    if (c == '+') o += ' ';
    else if (c == '%' && k + 2 < (int)s.length()) {
      i = strtol(s.substring(k + 1, k + 3).c_str(), NULL, 16);
      o += (char)i; k += 2;
    } else o += c;
  }
  return o;
}
String field(String body, String key) {
  int a = body.indexOf(key + "=");
  if (a < 0) return "";
  a += key.length() + 1;
  int b = body.indexOf('&', a);
  if (b < 0) b = body.length();
  return urldecode(body.substring(a, b));
}

// ---------- LoRa ----------
// Extrae el campo idx (0-based) de un string separado por '|'
String tok(const String& s, int idx) {
  int start = 0, count = 0;
  for (int i = 0; i <= (int)s.length(); i++) {
    if (i == (int)s.length() || s[i] == '|') {
      if (count == idx) return s.substring(start, i);
      count++;
      start = i + 1;
    }
  }
  return "";
}

// Envio con CAD (listen-before-talk): escucha el canal antes de transmitir para
// reducir colisiones cuando hay muchos usuarios. Estandar de LoRa.
void enviarCAD(String msg) {
  for (int i = 0; i < 6; i++) {
    if (radio.scanChannel() == RADIOLIB_CHANNEL_FREE) break;
    delay(random(20, 90));
  }
  radio.transmit(msg);
}

// Limpia un texto para que no rompa el formato '|' y no sea muy largo
String san(String s) {
  s.replace("|", " "); s.replace("\n", " "); s.replace("\r", " ");
  if (s.length() > 50) s = s.substring(0, 50);
  return s;
}

// Prioridad por defecto segun la categoria (0 = vida en riesgo)
String priDefault(String cat) {
  if (cat == "MEDICO" || cat == "RESCATE" || cat == "FUEGO") return "0";
  if (cat == "GRUA") return "1";
  return "3";
}

// Envio confiable de un frame ya armado: CAD + 3 reintentos + espera de ACK dirigido.
bool enviarFrame(String msg, int id) {
  bool acked = false;
  int intento = 0;
  while (!acked && intento < 3) {
    Serial.println("[NODO] TX (intento " + String(intento + 1) + "): " + msg);
    enviarCAD(msg);
    unsigned long t0 = millis();
    while (millis() - t0 < 1000 && !acked) {
      String ack; int st = radio.receive(ack);
      // ACK dirigido: CENTRO|<mi_id>|ACK|<msgid>
      if (st == RADIOLIB_ERR_NONE &&
          tok(ack, 1) == NODE_ID && tok(ack, 2) == "ACK" && tok(ack, 3) == String(id)) {
        acked = true;
      }
    }
    if (!acked) { intento++; delay(random(100, 500)); }
  }
  Serial.println(acked ? "[NODO] ACK OK (id " + String(id) + ")" : "[NODO] sin ACK tras 3 intentos");
  if (acked) enviados++;
  oledMostrar(acked ? "ENVIADO OK" : "REENVIANDO...",
              "id " + String(id) + (acked ? "  confirmado" : "  sin ACK"),
              "reportes: " + String(enviados));
  return acked;
}

// SOS: pedir ayuda. Frame: ORIGEN|CENTRO|SOS|MSGID|cat|pri|lat|lon|lugar|detalle
bool enviarSOS(String cat, String pri, String lat, String lon, String lugar, String detalle) {
  lugar = san(lugar); detalle = san(detalle);
  if (pri.length() == 0) pri = priDefault(cat);
  if (lugar.length() == 0) lugar = "-";
  if (detalle.length() == 0) detalle = "-";
  int id = seq++;
  String msg = NODE_ID + "|" DST_CENTRO "|SOS|" + String(id) + "|" +
               cat + "|" + pri + "|" + lat + "|" + lon + "|" + lugar + "|" + detalle;
  return enviarFrame(msg, id);
}

// OK: reportarse a salvo con datos identificables.
// Frame: ORIGEN|CENTRO|OK|MSGID|nombre|doc|lat|lon|lugar
bool enviarOK(String nombre, String doc, String lat, String lon, String lugar) {
  nombre = san(nombre); doc = san(doc); lugar = san(lugar);
  if (lugar.length() == 0) lugar = "-";
  int id = seq++;
  String msg = NODE_ID + "|" DST_CENTRO "|OK|" + String(id) + "|" +
               nombre + "|" + doc + "|" + lat + "|" + lon + "|" + lugar;
  return enviarFrame(msg, id);
}

// ---------- pagina HTTPS ----------
#include "portal_page.h"

// Estilos compartidos
static const char* CSS =
  "body{font-family:-apple-system,Arial,sans-serif;margin:0;color:#111}"
  ".wrap{max-width:520px;margin:0 auto;padding:16px}"
  ".hdr{background:#d92d20;color:#fff;padding:16px;border-radius:0 0 12px 12px;text-align:center}"
  ".hdr h1{margin:0;font-size:22px}.hdr p{margin:4px 0 0;font-size:13px;opacity:.95}"
  "label{display:block;font-weight:700;margin:14px 0 6px}"
  "input{width:100%;padding:14px;font-size:16px;border:2px solid #ccc;border-radius:10px;box-sizing:border-box}"
  "button{width:100%;padding:18px;font-size:19px;font-weight:700;border:0;border-radius:12px;margin-top:10px;color:#fff}"
  ".b1{background:#1570ef}.b2{background:#d92d20}.b3{background:#b42318}.b4{background:#067647}"
  "a.gps{display:block;background:#111;color:#fff;padding:16px;font-size:16px;font-weight:700;border-radius:12px;text-decoration:none;text-align:center;margin-top:18px}"
  ".ok{background:#ecfdf3;border:2px solid #067647;color:#054f31;padding:16px;border-radius:12px;font-size:17px}"
  ".warn{background:#fffaeb;border:2px solid #b54708;color:#7a2e0e;padding:16px;border-radius:12px;font-size:17px}"
  ".note{font-size:12px;color:#666;margin-top:14px;text-align:center}";

// Portal cautivo (HTTP): al conectarse, auto-redirige al dominio HTTPS con cert
// valido para que el navegador permita navigator.geolocation y pida el GPS.
// Triple redireccion (meta refresh + JS location.replace + boton) para cubrir
// iOS y Android. Debajo, botones de respaldo que reportan SIN GPS si el HTTPS falla.
String pageHttp() {
  String https = "https://" + String(DOMAIN) + "/";
  String intent = "intent://" + String(DOMAIN) + "/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" + https + ";end";
  // Landing (fase 2): el JS detecta el navegador por User-Agent y da la via correcta
  // al GPS por SO. Android: auto-redirige a HTTPS + boton intent a Chrome. iOS: guia
  // a Safari (el CNA bloquea el GPS). Desktop: auto-redirige a HTTPS.
  String h = "<!doctype html><html lang='es'><head><meta charset='utf-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<style>body{margin:0;background:#0C0C0D;color:#F1F3F4;font:16px system-ui,-apple-system,sans-serif}";
  h += ".w{max-width:440px;margin:0 auto;min-height:100vh;padding:22px 16px;display:flex;flex-direction:column}";
  h += ".hd{background:#FF4438;color:#fff;padding:16px;border-radius:14px;text-align:center;font-weight:800;font-size:20px}";
  h += ".sp{flex:1}.msg{color:#9AA0A6;text-align:center;margin:18px 0;font-size:15px}";
  h += ".step{background:#161719;border:1px solid #2E3033;border-radius:12px;padding:12px 14px;margin:8px 0;font-size:14px}";
  h += ".step b{color:#4C9AFF}";
  h += "a.go{display:block;background:#FF4438;color:#fff;padding:22px;border-radius:20px;text-decoration:none;text-align:center;font-weight:800;font-size:20px;box-shadow:0 14px 34px -12px rgba(255,68,56,.7)}";
  h += "a.go small{display:block;font-weight:500;font-size:13px;opacity:.95;margin-top:4px}</style></head><body>";
  h += "<div class='w'><div class='hd'>PUNTO DE AYUDA 911</div><div id='c'></div>";
  h += "<div class='sp'></div><div id='b'></div><div class='sp'></div></div>";
  h += "<script>";
  h += "var HTTPS='" + https + "';var INTENT=\"" + intent + "\";";
  h += "var ua=navigator.userAgent,isiOS=/iPhone|iPad|iPod/i.test(ua),isAnd=/Android/i.test(ua);";
  h += "var c=document.getElementById('c'),b=document.getElementById('b');";
  h += "if(isiOS){";
  h += " c.innerHTML=\"<div class='msg'>Para pedir ayuda con tu ubicacion GPS, abre <b>Safari</b>:</div>\"+";
  h += "  \"<div class='step'><b>1.</b> Toca <b>Cancelar</b> arriba a la derecha.</div>\"+";
  h += "  \"<div class='step'><b>2.</b> Elige <b>Usar sin conexion</b>.</div>\"+";
  h += "  \"<div class='step'><b>3.</b> Abre <b>Safari</b> y entra a <b>ayuda.homiapp.xyz</b></div>\";";
  h += " b.innerHTML=\"<a class='go' href='\"+HTTPS+\"'>Intentar abrir aqui<small>Si no pide ubicacion, usa los pasos de arriba</small></a>\";";
  h += "}else if(isAnd){";
  h += " c.innerHTML=\"<div class='msg'>Abriendo la pagina segura para tu ubicacion…</div>\";";
  h += " b.innerHTML=\"<a class='go' href='\"+INTENT+\"'>ABRIR EN CHROME<small>Envia tu ubicacion GPS</small></a>\";";
  h += " setTimeout(function(){location.replace(HTTPS);},400);";
  h += "}else{location.replace(HTTPS);}";
  h += "</script></body></html>";
  return h;
}

String pageConfirm(String tipo, bool ok) {
  String h = "<!doctype html><html lang='es'><head><meta charset='utf-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<style>"; h += CSS; h += "</style></head><body><div class='wrap'>";
  h += "<div class='hdr'><h1>REPORTE ENVIADO</h1></div>";
  if (ok) h += "<div class='ok'><b>Confirmado por el puesto de mando.</b><br>Tu reporte de <b>" + tipo + "</b> llego por radio. Quedate cerca si es seguro.</div>";
  else    h += "<div class='warn'><b>Guardado. Reintentando...</b><br>Tu reporte de <b>" + tipo + "</b> se registro. Aun no confirma el puesto de mando.</div>";
  h += "<form action='/' method='GET'><button class='b1'>Hacer otro reporte</button></form>";
  h += "</div></body></html>";
  return h;
}

// lee el cuerpo de un POST a un String
String readBody(httpd_req_t* req) {
  char buf[400];
  int len = req->content_len;
  if (len > (int)sizeof(buf) - 1) len = sizeof(buf) - 1;
  int total = 0, r;
  while (total < len) {
    r = httpd_req_recv(req, buf + total, len - total);
    if (r <= 0) { if (r == HTTPD_SOCK_ERR_TIMEOUT) continue; break; }
    total += r;
  }
  buf[total] = 0;
  return String(buf);
}

// ---------- handlers (IDF) ----------
// HTTPS: pagina con geolocalizacion (JS)
static esp_err_t hGeo(httpd_req_t* req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  httpd_resp_send(req, PAGE_HTTPS, HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}
// HTTPS: recibe el fetch del JS. Distingue SOS (pedir ayuda) de OK (a salvo).
static esp_err_t hReportApi(httpd_req_t* req) {
  String body = readBody(req);
  String accion = field(body, "accion");
  bool ok = false;
  if (accion == "ok") {
    String nombre = field(body, "nombre"), doc = field(body, "doc");
    String lat = field(body, "lat"), lon = field(body, "lon"), lugar = field(body, "lugar");
    if (nombre.length() > 0 && doc.length() > 0) ok = enviarOK(nombre, doc, lat, lon, lugar);
  } else {
    String cat = field(body, "cat"), pri = field(body, "pri");
    String lat = field(body, "lat"), lon = field(body, "lon");
    String lugar = field(body, "lugar"), det = field(body, "detalle");
    if (cat.length() > 0) ok = enviarSOS(cat, pri, lat, lon, lugar, det);
  }
  httpd_resp_set_type(req, "text/plain; charset=utf-8");
  httpd_resp_sendstr(req, ok ? "OK" : "PENDING");
  return ESP_OK;
}
// HTTP (respaldo sin GPS): recibe el POST del formulario y manda un SOS por categoria
static esp_err_t hReportForm(httpd_req_t* req) {
  String body = readBody(req);
  String cat = field(body, "cat"), pri = field(body, "pri");
  String lugar = field(body, "lugar"), det = field(body, "detalle");
  bool ok = false;
  if (cat.length() > 0) ok = enviarSOS(cat, pri, "", "", lugar, det);  // sin GPS
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  String p = pageConfirm(cat, ok);
  httpd_resp_send(req, p.c_str(), HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}
// HTTP catch-all: UN SOLO handler que decide por el header Host / la URI del sondeo.
// Mejor practica (nodogsplash, openNDS): detectar el SO por Host, no por User-Agent,
// porque el Host del sondeo es estable y siempre presente.
//  - iOS (captive.apple.com / hotspot-detect.html): 200 con la landing. El CNA de
//    Apple la muestra sola. La landing detecta el navegador y guia al GPS.
//  - Android/Windows (generate_204, gen_204, ncsi.txt, connecttest.txt, etc.): 302
//    directo al portal HTTPS. Android abre el WebView mostrando el portal rediseñado.
//  - Cualquier otra ruta: la landing (200), que auto-redirige al portal HTTPS.
static esp_err_t hHttp(httpd_req_t* req) {
  String uri = String(req->uri);
  char host[64] = {0};
  size_t hl = httpd_req_get_hdr_value_len(req, "Host");
  if (hl > 0 && hl < sizeof(host)) httpd_req_get_hdr_value_str(req, "Host", host, sizeof(host));
  String h = String(host);

  bool ios = h.indexOf("captive.apple.com") >= 0 ||
             uri.indexOf("hotspot-detect") >= 0 || uri.indexOf("success.html") >= 0;
  bool androidWin =
      uri.indexOf("generate_204") >= 0 || uri.indexOf("gen_204") >= 0 ||
      uri.indexOf("ncsi.txt") >= 0 || uri.indexOf("connecttest.txt") >= 0 ||
      uri.indexOf("redirect") >= 0 || uri.indexOf("canonical.html") >= 0 ||
      h.indexOf("connectivitycheck") >= 0 || h.indexOf("gstatic") >= 0 ||
      h.indexOf("msftconnecttest") >= 0 || h.indexOf("msftncsi") >= 0;

  if (androidWin && !ios) {
    // Android/Windows: 302 directo al portal HTTPS (el WebView lo muestra).
    String loc = "https://" + String(DOMAIN) + "/";
    httpd_resp_set_status(req, "302 Found");
    httpd_resp_set_hdr(req, "Location", loc.c_str());
    httpd_resp_set_type(req, "text/plain");
    httpd_resp_send(req, "", 0);
    return ESP_OK;
  }
  // iOS y catch-all: la landing (200) con guia al GPS por navegador.
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  String p = pageHttp();
  httpd_resp_send(req, p.c_str(), HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  randomSeed(analogRead(0));

  tieneOled = detectarOled();
  Serial.println(tieneOled ? "[NODO] OLED detectado" : "[NODO] sin OLED");
  if (tieneOled) { oled.begin(); oledMostrar("PUNTO AYUDA", "iniciando...", ""); }

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  Serial.print("[NODO] LoRa... ");
  int e = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  Serial.println(e == RADIOLIB_ERR_NONE ? "OK" : "FALLO");

  // Eventos WiFi: confirman si el celular se asocia y si el DHCP le asigna IP.
  WiFi.onEvent([](WiFiEvent_t ev, WiFiEventInfo_t info) {
    if (ev == ARDUINO_EVENT_WIFI_AP_STACONNECTED)    Serial.println("[WIFI] cliente asociado");
    if (ev == ARDUINO_EVENT_WIFI_AP_STAIPASSIGNED)   Serial.println("[WIFI] IP asignada al cliente (DHCP OK)");
    if (ev == ARDUINO_EVENT_WIFI_AP_STADISCONNECTED) Serial.println("[WIFI] cliente desconectado");
  });
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  // max 8 clientes (evita que leases fantasma por MAC aleatoria bloqueen el DHCP)
  WiFi.softAP(AP_SSID, NULL, 1, 0, 8);
  Serial.print("[NODO] SoftAP '"); Serial.print(AP_SSID);
  Serial.print("' en "); Serial.println(WiFi.softAPIP());
  dnsServer.start(53, "*", apIP);

  // HTTPS :443
  httpd_ssl_config_t sconf = HTTPD_SSL_CONFIG_DEFAULT();
  sconf.servercert = (const uint8_t*)CERT_PEM;
  sconf.servercert_len = sizeof(CERT_PEM);
  sconf.prvtkey_pem = (const uint8_t*)KEY_PEM;
  sconf.prvtkey_len = sizeof(KEY_PEM);
  sconf.httpd.uri_match_fn = httpd_uri_match_wildcard;
  sconf.httpd.max_uri_handlers = 8;
  sconf.httpd.stack_size = 10240;
  sconf.httpd.ctrl_port = 32768;        // puerto de control del server HTTPS
  // RAM: el handshake TLS necesita ~40 KB contiguos. Chrome/Safari abren varias
  // conexiones a la vez y agotan el heap -> connection reset. Limitamos los sockets
  // y purgamos el mas viejo cuando se llena (en vez de rechazar la conexion).
  sconf.httpd.max_open_sockets = 2;
  sconf.httpd.lru_purge_enable = true;
  httpd_handle_t shandle = NULL;
  Serial.print("[NODO] HTTPS... ");
  esp_err_t se = httpd_ssl_start(&shandle, &sconf);
  if (se == ESP_OK) {
    httpd_uri_t u_report = {}; u_report.uri = "/report"; u_report.method = HTTP_POST; u_report.handler = hReportApi;
    httpd_register_uri_handler(shandle, &u_report);
    httpd_uri_t u_geo = {}; u_geo.uri = "/*"; u_geo.method = HTTP_GET; u_geo.handler = hGeo;
    httpd_register_uri_handler(shandle, &u_geo);
    Serial.println("OK");
  } else {
    Serial.print("FALLO "); Serial.println(se);
  }

  // HTTP :80 (portal cautivo -> boton a navegador)
  httpd_config_t hconf = HTTPD_DEFAULT_CONFIG();
  hconf.server_port = 80;
  hconf.ctrl_port = 32780;              // distinto al del HTTPS para no chocar
  hconf.uri_match_fn = httpd_uri_match_wildcard;
  httpd_handle_t hhandle = NULL;
  if (httpd_start(&hhandle, &hconf) == ESP_OK) {
    httpd_uri_t u_rep = {}; u_rep.uri = "/report"; u_rep.method = HTTP_POST; u_rep.handler = hReportForm;
    httpd_register_uri_handler(hhandle, &u_rep);
    httpd_uri_t u_http = {}; u_http.uri = "/*"; u_http.method = HTTP_GET; u_http.handler = hHttp;
    httpd_register_uri_handler(hhandle, &u_http);
  }

  Serial.println("[NODO] Portal listo. https://ayuda.homiapp.xyz");
  Serial.print("[DIAG] heap libre tras setup: "); Serial.print(ESP.getFreeHeap());
  Serial.print("  bloque max contiguo: "); Serial.println(ESP.getMaxAllocHeap());
  oledMostrar("PUNTO AYUDA", "red: AYUDA...911", "esperando pedidos");
}

unsigned long lastDiag = 0;
void loop() {
  dnsServer.processNextRequest();
  // Diagnostico de heap: si baja mucho, el handshake TLS resetea la conexion.
  if (millis() - lastDiag > 3000) {
    lastDiag = millis();
    Serial.print("[DIAG] heap="); Serial.print(ESP.getFreeHeap());
    Serial.print(" maxblock="); Serial.print(ESP.getMaxAllocHeap());
    Serial.print(" clientes="); Serial.println(WiFi.softAPgetStationNum());
  }
  delay(5);
}
