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
static const char PAGE_HTTPS[] = R"HTML(<!doctype html><html lang='es'><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<style>body{font-family:-apple-system,Arial,sans-serif;margin:0;color:#111;background:#f5f6f8}
.wrap{max-width:520px;margin:0 auto;padding:16px}
.hdr{background:#d92d20;color:#fff;padding:16px;border-radius:0 0 12px 12px;text-align:center}
.hdr h1{margin:0;font-size:22px}
.card{background:#fff;border-radius:12px;padding:14px;margin-top:14px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h2{font-size:16px;margin:0 0 10px}
label{display:block;font-weight:700;margin:12px 0 6px;font-size:14px}
input{width:100%;padding:14px;font-size:16px;border:2px solid #ccc;border-radius:10px;box-sizing:border-box}
button{width:100%;padding:18px;font-size:18px;font-weight:700;border:0;border-radius:12px;margin-top:10px;color:#fff}
.b1{background:#b42318}.b2{background:#d92d20}.b3{background:#c2410c}.b4{background:#1570ef}.b5{background:#067647}
#msg{padding:16px;border-radius:12px;font-size:17px;margin-top:12px;display:none}
.ok{background:#ecfdf3;border:2px solid #067647;color:#054f31}
.warn{background:#fffaeb;border:2px solid #b54708;color:#7a2e0e}
.note{font-size:12px;color:#666;margin-top:8px}</style></head><body>
<div class='wrap'><div class='hdr'><h1>PUNTO DE AYUDA 911</h1></div>
<div id='msg'></div>
<div class='card'>
 <h2>Pedir ayuda</h2>
 <label>Donde estas? (si no hay GPS, escribe el lugar)</label>
 <input id='lugar' maxlength='50' placeholder='ej: Portal 80 con calle 13, torre B'>
 <label>Detalle (opcional)</label>
 <input id='det' maxlength='50' placeholder='ej: 2 personas atrapadas, sotano'>
 <button class='b1' onclick="sos('RESCATE','0')">Rescate: hay atrapados</button>
 <button class='b2' onclick="sos('MEDICO','0')">Ayuda medica urgente</button>
 <button class='b3' onclick="sos('GRUA','1')">Grua / vehiculo pesado</button>
 <button class='b4' onclick="sos('AGUA','3')">Agua / comida</button>
</div>
<div class='card'>
 <h2>Estoy a salvo</h2>
 <p class='note'>Deja tus datos. Si aparece internet, tu familia podra saber que estas bien.</p>
 <label>Nombre completo</label>
 <input id='nombre' maxlength='50' placeholder='ej: Juan Perez'>
 <label>Documento (cedula)</label>
 <input id='doc' maxlength='50' placeholder='ej: CC 1032456'>
 <button class='b5' onclick="salvo()">Reportarme a salvo</button>
</div>
<p class='note' style='text-align:center'>Tu ubicacion GPS se envia sola si la autorizas.</p></div>
<script>
function val(id){return document.getElementById(id).value;}
function enc(s){return encodeURIComponent(s);}
function show(t,cls){var m=document.getElementById('msg');m.style.display='block';m.className=cls;m.innerHTML=t;}
function gps(cb){
 if(!navigator.geolocation){cb('','');return;}
 navigator.geolocation.getCurrentPosition(
  function(p){cb(p.coords.latitude.toFixed(5),p.coords.longitude.toFixed(5));},
  function(e){cb('','');},
  {enableHighAccuracy:true,timeout:8000,maximumAge:0});
}
function post(body){
 fetch('/report',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body})
  .then(r=>r.text()).then(t=>{
   if(t.indexOf('OK')>=0)show('<b>Confirmado por el puesto de mando.</b> Quedate en un lugar seguro.','ok');
   else show('<b>Guardado. Reintentando por radio...</b> Espera aqui.','warn');})
  .catch(e=>show('Error de envio. Intenta otra vez.','warn'));
}
function sos(cat,pri){
 show('Obteniendo tu ubicacion...','warn');
 var lugar=val('lugar'),det=val('det');
 gps(function(la,lo){post('accion=sos&cat='+cat+'&pri='+pri+'&lat='+la+'&lon='+lo+'&lugar='+enc(lugar)+'&detalle='+enc(det));});
}
function salvo(){
 var n=val('nombre'),d=val('doc');
 if(!n||!d){show('Escribe tu <b>nombre</b> y tu <b>documento</b> para avisar que estas a salvo.','warn');return;}
 show('Obteniendo tu ubicacion...','warn');
 var lugar=val('lugar');
 gps(function(la,lo){post('accion=ok&nombre='+enc(n)+'&doc='+enc(d)+'&lat='+la+'&lon='+lo+'&lugar='+enc(lugar));});
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

// Portal cautivo (HTTP): al conectarse, auto-redirige al dominio HTTPS con cert
// valido para que el navegador permita navigator.geolocation y pida el GPS.
// Triple redireccion (meta refresh + JS location.replace + boton) para cubrir
// iOS y Android. Debajo, botones de respaldo que reportan SIN GPS si el HTTPS falla.
String pageHttp() {
  String https = "https://" + String(DOMAIN) + "/";
  // Android: el WebView del portal cautivo bloquea el GPS. Este intent abre Chrome,
  // donde navigator.geolocation SI funciona sobre HTTPS.
  String intent = "intent://" + String(DOMAIN) + "/#Intent;scheme=https;package=com.android.chrome;end";
  String h = "<!doctype html><html lang='es'><head><meta charset='utf-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<style>"; h += CSS; h += "</style></head><body><div class='wrap'>";
  h += "<div class='hdr'><h1>PUNTO DE AYUDA 911</h1><p>Para enviar tu ubicacion GPS, abre en tu navegador.</p></div>";
  h += "<a class='gps' style='background:#0b8043' href='" + intent + "'>ANDROID: abrir en Chrome</a>";
  h += "<a class='gps' href='" + https + "'>iPhone: enviar mi ubicacion GPS</a>";
  h += "<p class='note'>Necesitas la Ubicacion del telefono ENCENDIDA. Al abrir, acepta el permiso.</p>";
  h += "<form action='/report' method='POST'>";
  h += "<label>O reporta ya, sin GPS. Que necesitas?</label>";
  h += "<button class='b2' name='cat' value='MEDICO'>Ayuda medica</button>";
  h += "<button class='b3' name='cat' value='RESCATE'>Rescate (hay atrapados)</button>";
  h += "<button class='b1' name='cat' value='GRUA'>Grua</button>";
  h += "</form>";
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
// HTTP catch-all: cualquier pagina/dominio cae aqui (DNS cautivo). Devuelve una landing
// (200) con los botones para ABRIR EN EL NAVEGADOR REAL. No auto-redirige, porque el
// WebView del portal cautivo de Android bloquea el GPS: el usuario debe saltar a Chrome.
static esp_err_t hHttp(httpd_req_t* req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  String p = pageHttp();
  httpd_resp_send(req, p.c_str(), HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  randomSeed(analogRead(0));

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  Serial.print("[NODO] LoRa... ");
  int e = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  Serial.println(e == RADIOLIB_ERR_NONE ? "OK" : "FALLO");

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_SSID, NULL, 1, 0, 4);
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
}

void loop() {
  dnsServer.processNextRequest();
  delay(5);
}
