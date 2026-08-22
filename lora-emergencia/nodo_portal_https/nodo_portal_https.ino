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
#include "credentials.h"

// --- Pines LoRa (T3 V1.6.1) ---
#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 23
#define LORA_DIO0 26
#define LORA_DIO1 33
SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);

const char* AP_SSID = "AYUDA";
const char* DOMAIN = "ayuda.homiapp.xyz";
IPAddress apIP(192, 168, 4, 1);
DNSServer dnsServer;

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
bool enviarReporte(String tipo, String detalle, String lat, String lon) {
  detalle.replace("|", " "); detalle.replace("\n", " "); detalle.replace("\r", " ");
  if (detalle.length() > 50) detalle = detalle.substring(0, 50);
  if (detalle.length() == 0) detalle = "-";
  if (lat.length() == 0) lat = NODE_LAT;
  if (lon.length() == 0) lon = NODE_LON;
  String msg = NODE_ID + "|" + tipo + "|" + detalle + "|" + lat + "|" + lon + "|" + String(seq);
  seq++;
  Serial.println("[NODO] TX: " + msg);
  radio.transmit(msg);
  unsigned long t0 = millis(); bool acked = false;
  while (millis() - t0 < 1200 && !acked) {
    String ack; int st = radio.receive(ack);
    if (st == RADIOLIB_ERR_NONE && ack.startsWith("ACK|" + NODE_ID)) acked = true;
  }
  Serial.println(acked ? "[NODO] ACK OK" : "[NODO] sin ACK");
  return acked;
}

// ---------- pagina HTTPS ----------
static const char PAGE_HTTPS[] = R"HTML(<!doctype html><html lang='es'><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<style>body{font-family:-apple-system,Arial,sans-serif;margin:0;color:#111}
.wrap{max-width:520px;margin:0 auto;padding:16px}
.hdr{background:#d92d20;color:#fff;padding:16px;border-radius:0 0 12px 12px;text-align:center}
.hdr h1{margin:0;font-size:22px}
label{display:block;font-weight:700;margin:14px 0 6px}
input{width:100%;padding:14px;font-size:16px;border:2px solid #ccc;border-radius:10px;box-sizing:border-box}
button{width:100%;padding:18px;font-size:19px;font-weight:700;border:0;border-radius:12px;margin-top:10px;color:#fff}
.b1{background:#1570ef}.b2{background:#d92d20}.b3{background:#b42318}.b4{background:#067647}
#msg{padding:16px;border-radius:12px;font-size:17px;margin-top:12px;display:none}
.ok{background:#ecfdf3;border:2px solid #067647;color:#054f31}
.warn{background:#fffaeb;border:2px solid #b54708;color:#7a2e0e}
.note{font-size:12px;color:#666;margin-top:14px;text-align:center}</style></head><body>
<div class='wrap'><div class='hdr'><h1>PUNTO DE AYUDA</h1></div>
<label>Que necesitas? Toca un boton.</label>
<button class='b1' onclick="enviar('agua')">Agua / comida</button>
<button class='b2' onclick="enviar('medico')">Ayuda medica</button>
<button class='b3' onclick="enviar('rescate')">Rescate (hay atrapados)</button>
<button class='b4' onclick="enviar('asalvo')">Estoy a salvo</button>
<label>Donde estas? (opcional: Plus Code o direccion)</label>
<input id='det' maxlength='50' placeholder='ej: 6GCR+2X, apto 401'>
<div id='msg'></div>
<p class='note'>Tu ubicacion GPS se envia sola si la autorizas.</p></div>
<script>
function post(tipo,lat,lon){
 var det=document.getElementById('det').value;
 var b='tipo='+encodeURIComponent(tipo)+'&lat='+lat+'&lon='+lon+'&detalle='+encodeURIComponent(det);
 fetch('/report',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b})
  .then(r=>r.text()).then(t=>{var m=document.getElementById('msg');m.style.display='block';
   if(t.indexOf('OK')>=0){m.className='ok';m.innerHTML='<b>Confirmado por el puesto de mando.</b> Quedate cerca de este punto.';}
   else{m.className='warn';m.innerHTML='<b>Guardado. Reintentando...</b> Espera cerca de este punto.';}})
  .catch(e=>{var m=document.getElementById('msg');m.style.display='block';m.className='warn';m.innerHTML='Error de envio. Intenta otra vez.';});
}
function enviar(tipo){
 var m=document.getElementById('msg');m.style.display='block';m.className='warn';m.innerHTML='Obteniendo tu ubicacion...';
 if(!navigator.geolocation){post(tipo,'','');return;}
 navigator.geolocation.getCurrentPosition(
  function(p){post(tipo,p.coords.latitude.toFixed(6),p.coords.longitude.toFixed(6));},
  function(err){post(tipo,'','');},
  {enableHighAccuracy:true,timeout:8000,maximumAge:0});
}
</script></body></html>)HTML";

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

// Portal cautivo (HTTP, funciona dentro de la ventanita): reporte rapido + upgrade a GPS
String pageHttp() {
  String h = "<!doctype html><html lang='es'><head><meta charset='utf-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<style>"; h += CSS; h += "</style></head><body><div class='wrap'>";
  h += "<div class='hdr'><h1>PUNTO DE AYUDA</h1><p>Red oficial sin clave. Sin app.</p></div>";
  h += "<form action='/report' method='POST'>";
  h += "<label>Donde estas? (opcional)</label>";
  h += "<input name='detalle' maxlength='50' placeholder='ej: apto 401, 2do piso'>";
  h += "<label>Que necesitas? Toca un boton.</label>";
  h += "<button class='b1' name='tipo' value='agua'>Agua / comida</button>";
  h += "<button class='b2' name='tipo' value='medico'>Ayuda medica</button>";
  h += "<button class='b3' name='tipo' value='rescate'>Rescate (hay atrapados)</button>";
  h += "<button class='b4' name='tipo' value='asalvo'>Estoy a salvo</button>";
  h += "</form>";
  h += "<a class='gps' href='https://"; h += DOMAIN; h += "/'>Enviar mi ubicacion EXACTA por GPS</a>";
  h += "<p class='note'>El reporte con botones ya sirve. El GPS exacto abre tu navegador.</p>";
  h += "</div></body></html>";
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
// HTTPS: recibe el fetch del JS, responde OK/PENDING
static esp_err_t hReportApi(httpd_req_t* req) {
  String body = readBody(req);
  String tipo = field(body, "tipo"), lat = field(body, "lat"), lon = field(body, "lon"), det = field(body, "detalle");
  bool ok = false;
  if (tipo.length() > 0) ok = enviarReporte(tipo, det, lat, lon);
  httpd_resp_set_type(req, "text/plain; charset=utf-8");
  httpd_resp_sendstr(req, ok ? "OK" : "PENDING");
  return ESP_OK;
}
// HTTP: recibe el POST del formulario, responde pagina de confirmacion
static esp_err_t hReportForm(httpd_req_t* req) {
  String body = readBody(req);
  String tipo = field(body, "tipo"), det = field(body, "detalle");
  bool ok = false;
  if (tipo.length() > 0) ok = enviarReporte(tipo, det, "", "");  // sin GPS: usa ubicacion del nodo
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  String p = pageConfirm(tipo, ok);
  httpd_resp_send(req, p.c_str(), HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}
// HTTP: portal cautivo (formulario funcional + upgrade a GPS)
static esp_err_t hHttp(httpd_req_t* req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  String p = pageHttp();
  httpd_resp_send(req, p.c_str(), HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}

void setup() {
  Serial.begin(115200);
  delay(300);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  Serial.print("[NODO] LoRa... ");
  int e = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  Serial.println(e == RADIOLIB_ERR_NONE ? "OK" : "FALLO");

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_SSID, NULL, 1, 0, 4);
  Serial.print("[NODO] SoftAP AYUDA en "); Serial.println(WiFi.softAPIP());
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
  hconf.ctrl_port = 32769;
  hconf.uri_match_fn = httpd_uri_match_wildcard;
  httpd_handle_t hhandle = NULL;
  if (httpd_start(&hhandle, &hconf) == ESP_OK) {
    httpd_uri_t u_rep = {}; u_rep.uri = "/report"; u_rep.method = HTTP_POST; u_rep.handler = hReportForm;
    httpd_register_uri_handler(hhandle, &u_rep);
    httpd_uri_t u_http = {}; u_http.uri = "/*"; u_http.method = HTTP_GET; u_http.handler = hHttp;
    httpd_register_uri_handler(hhandle, &u_http);
  }

  Serial.println("[NODO] Portal listo. https://ayuda.homiapp.xyz");
}

void loop() {
  dnsServer.processNextRequest();
  delay(5);
}
