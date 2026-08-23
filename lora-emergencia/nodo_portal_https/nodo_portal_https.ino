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
#include <Preferences.h>
#include <Wire.h>
#include <U8g2lib.h>
#include "credentials.h"

// OLED I2C del T3 V1.6.1 (SDA 21, SCL 22, 0x3C). Muestra el estado del punto de ayuda.
#define OLED_SDA 21
#define OLED_SCL 22
#define OLED_ADDR 0x3C
// Page-buffer (_1_): usa 128 bytes por pagina en vez de 1024 contiguos del full-buffer.
// Libera un bloque contiguo grande para que el handshake TLS no se quede sin RAM.
U8G2_SSD1306_128X64_NONAME_1_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, OLED_SCL, OLED_SDA);
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
  // Page-buffer: redibuja todo dentro del bucle firstPage/nextPage.
  oled.firstPage();
  do {
    oled.setFont(u8g2_font_ncenB10_tr);
    oled.drawStr(0, 14, l1.c_str());
    oled.setFont(u8g2_font_6x12_tr);
    oled.drawStr(0, 34, l2.c_str());
    oled.drawStr(0, 52, l3.c_str());
  } while (oled.nextPage());
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

const char* AP_SSID = "[AFECTADOS] RED DE AYUDA WOKI";  // 29 chars, limite softAP 32
const char* DOMAIN = "ayuda.homiapp.xyz";
IPAddress apIP(192, 168, 4, 1);
DNSServer dnsServer;
Preferences preferences;

// Direccionamiento estandar (frame: ORIGEN|DESTINO|TIPO|MSGID|payload...)
#define DST_CENTRO "CENTRO"
String NODE_ID = "a3f21c";
String NODE_LAT = "4.6767";
String NODE_LON = "-74.0483";
uint32_t seq = 0;
uint32_t activeSosSeq = 0;
bool hasActiveSos = false;

// ---- Loop bidireccional: recibir el estado que manda el centro ----
// El radio lo maneja SOLO loop() (un unico dueno) para no chocar con el envio.
// El task del servidor HTTPS ENCOLA el envio; loop() lo ejecuta y ademas escucha.
volatile bool rxFlag = false;             // la ISR marca que llego un paquete
void IRAM_ATTR onRx() { rxFlag = true; }
SemaphoreHandle_t txMtx = NULL;           // protege la cola de un solo envio
SemaphoreHandle_t reportMtx = NULL;       // serializa reportes HTTP/HTTPS completos
volatile bool txPend = false;             // hay un frame por enviar
volatile bool txDone = false;             // loop ya lo envio
volatile bool txOk = false;               // resultado del envio
String txMsg; uint32_t txId = 0;
char estadoBuf[24] = "-";                 // ultimo estado recibido del centro
unsigned long estadoAt = 0;               // millis del ultimo estado recibido

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

// Procesa el estado de la solicitud activa enviado por el centro:
// CENTRO|<NODE_ID>|ST|<id>|<request_seq>|<estado>.
void procesarEntrante(const String& msg) {
  if (tok(msg, 1) == NODE_ID && tok(msg, 2) == "ST") {
    String requestSeq = tok(msg, 4);
    if (!hasActiveSos || requestSeq != String(activeSosSeq)) return;
    String est = tok(msg, 5);
    if (est.length() == 0) return;
    est.toCharArray(estadoBuf, sizeof(estadoBuf));
    estadoAt = millis();
    Serial.println("[NODO] estado del centro: " + est);
    oledMostrar("ACTUALIZACION", est, "puesto de mando");
  }
}

// Limpia un texto para que no rompa el formato '|' y lo corta a n caracteres.
// Presupuesto LoRa: un frame SOS con detalle=100 + lugar=40 queda en ~180 bytes,
// dentro del maximo de ~255 bytes de un paquete SX1276. Mas largo = mas tiempo
// en el aire y mas riesgo de colision, por eso se limita.
String sanN(String s, int n) {
  s.replace("|", " "); s.replace("\n", " "); s.replace("\r", " ");
  if ((int)s.length() > n) s = s.substring(0, n);
  return s;
}
String san(String s) { return sanN(s, 50); }

uint32_t nextSequence() {
  uint32_t id = seq++;
  preferences.putUInt("next_seq", seq);
  return id;
}

// Prioridad por defecto segun la categoria (0 = vida en riesgo)
String priDefault(String cat) {
  if (cat == "MEDICO" || cat == "RESCATE" || cat == "FUEGO") return "0";
  if (cat == "GRUA") return "1";
  return "3";
}

// Envio real del radio. SOLO se llama desde loop() (dueno unico del radio).
// CAD (listen-before-talk) + hasta 3 reintentos + espera de ACK dirigido. La
// espera del ACK usa la bandera de RX; si mientras tanto llega un estado del
// centro, lo procesa igual.
bool enviarConAck(String msg, uint32_t id) {
  bool acked = false;
  int intento = 0;
  while (!acked && intento < 3) {
    Serial.println("[NODO] TX (intento " + String(intento + 1) + "): " + msg);
    for (int i = 0; i < 6; i++) { if (radio.scanChannel() == RADIOLIB_CHANNEL_FREE) break; delay(random(20, 90)); }
    radio.standby();
    radio.transmit(msg);
    rxFlag = false;
    radio.startReceive();
    unsigned long t0 = millis();
    while (millis() - t0 < 1000 && !acked) {
      if (rxFlag) {
        rxFlag = false;
        String in;
        if (radio.readData(in) == RADIOLIB_ERR_NONE) {
          // ACK dirigido: CENTRO|<mi_id>|ACK|<msgid>
          if (tok(in, 1) == NODE_ID && tok(in, 2) == "ACK" && tok(in, 3) == String(id)) acked = true;
          else procesarEntrante(in);   // pudo llegar un estado mientras esperabamos el ACK
        }
        radio.startReceive();
      }
      delay(2);
    }
    if (!acked) { intento++; delay(random(100, 500)); }
  }
  Serial.println(acked ? "[NODO] ACK OK (id " + String(id) + ")" : "[NODO] sin ACK tras 3 intentos");
  if (acked) enviados++;
  oledMostrar(acked ? "ENVIADO OK" : "REENVIANDO...",
              "id " + String(id) + (acked ? "  confirmado" : "  sin ACK"),
              "reportes: " + String(enviados));
  radio.startReceive();                 // vuelve a escuchar al centro
  return acked;
}

// Llamado desde el task del servidor HTTPS. Encola el envio y espera a que
// loop() (dueno del radio) lo ejecute. Asi dos tasks nunca tocan el radio a la vez.
bool enviarFrame(String msg, uint32_t id) {
  xSemaphoreTake(txMtx, portMAX_DELAY);
  txMsg = msg; txId = id; txOk = false; txDone = false; txPend = true;
  xSemaphoreGive(txMtx);
  unsigned long t0 = millis();
  while (!txDone && millis() - t0 < 8000) delay(10);
  return txOk;
}

// SOS: pedir ayuda. Frame: ORIGEN|CENTRO|SOS|MSGID|cat|pri|lat|lon|lugar|detalle
bool enviarSOS(String cat, String pri, String lat, String lon, String lugar, String detalle) {
  xSemaphoreTake(reportMtx, portMAX_DELAY);
  lugar = sanN(lugar, 40); detalle = sanN(detalle, 100);
  if (pri.length() == 0) pri = priDefault(cat);
  if (lugar.length() == 0) lugar = "-";
  if (detalle.length() == 0) detalle = "-";
  uint32_t id = nextSequence();
  activeSosSeq = id;
  hasActiveSos = true;
  preferences.putUInt("active_sos", activeSosSeq);
  preferences.putBool("has_sos", true);
  strlcpy(estadoBuf, "-", sizeof(estadoBuf));
  estadoAt = 0;
  String msg = NODE_ID + "|" DST_CENTRO "|SOS|" + String(id) + "|" +
               cat + "|" + pri + "|" + lat + "|" + lon + "|" + lugar + "|" + detalle;
  bool sent = enviarFrame(msg, id);
  xSemaphoreGive(reportMtx);
  return sent;
}

// OK: reportarse a salvo con datos identificables.
// Frame: ORIGEN|CENTRO|OK|MSGID|nombre|doc|lat|lon|lugar
bool enviarOK(String nombre, String doc, String lat, String lon, String lugar) {
  xSemaphoreTake(reportMtx, portMAX_DELAY);
  nombre = san(nombre); doc = san(doc); lugar = san(lugar);
  if (lugar.length() == 0) lugar = "-";
  uint32_t id = nextSequence();
  String msg = NODE_ID + "|" DST_CENTRO "|OK|" + String(id) + "|" +
               nombre + "|" + doc + "|" + lat + "|" + lon + "|" + lugar;
  bool sent = enviarFrame(msg, id);
  xSemaphoreGive(reportMtx);
  return sent;
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

// Portal cautivo (HTTP). Android y escritorio se van al dominio HTTPS, donde el
// GPS si funciona. iOS se queda aqui, y aqui PIDE AYUDA, sin GPS.
//
// Por que iOS no puede dar GPS en esta pantalla:
// WebKit bloquea navigator.geolocation en el motor cuando el origen no es
// seguro. Geolocation::shouldBlockGeolocationRequests() exige https/wss,
// loopback o file:; una IP privada como 192.168.4.1 no califica, y el CNA de
// Apple carga esta pagina por HTTP plano. Devuelve PERMISSION_DENIED sin
// mostrar ningun permiso. No hay rodeo.
// (WebKit r200686, bug 157423, 11-may-2016; W3C Geolocation, "request a position")
//
// Por eso el orden es: ACCION PRIMERO, instrucciones despues.
//  - El CNA se cierra al cambiar de app: decirle a alguien "abre Safari" le
//    borra la sesion. Si no pudo pedir ayuda antes, se queda sin pedir.
//  - NN/g (2018): el 42% del tiempo de vista cae en el 20% superior de la
//    pagina. Gastar esa franja en instrucciones es gastar la atencion escasa.
//  - El titulo va como texto, NO como barra roja. NN/g: "no hagas que
//    elementos no clicables parezcan botones; darle color de fondo a un
//    titulo lo hace parecer boton". El rojo queda como tinta y borde.
//  - El envio es un POST de formulario de verdad, con navegacion completa:
//    el CNA solo revisa la conectividad tras una navegacion real, nunca tras
//    un AJAX (Wireless Broadband Alliance).
// Limite duro del CNA: 128 KB en el HTML inicial y cero recursos externos.
// Esta pagina es de ~4 KB, todo inline.
String pageHttp() {
  String https = "https://" + String(DOMAIN) + "/";
  String intent = "intent://" + String(DOMAIN) + "/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" + https + ";end";
  String h = "<!doctype html><html lang='es'><head><meta charset='utf-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<title>Punto de ayuda 911</title><style>";
  h += "*{box-sizing:border-box}body{margin:0;background:#0C0C0D;color:#F1F3F4;font:16px/1.5 system-ui,-apple-system,sans-serif}";
  h += ".w{max-width:440px;margin:0 auto;min-height:100vh;padding:20px 16px 28px;display:flex;flex-direction:column}";
  // Titulo: tinta roja y borde a la izquierda. Sin relleno y sin esquinas
  // redondeadas, que son las 2 senales que lo hacian parecer boton.
  h += "h1{margin:0;font-size:21px;font-weight:800;letter-spacing:-.01em;color:#FF6B60;";
  h += "border-left:4px solid #FF4438;padding-left:12px;text-align:left;cursor:default;-webkit-tap-highlight-color:transparent}";
  h += ".sub{color:#9AA0A6;font-size:14px;margin:8px 0 0;padding-left:16px}";
  h += ".lead{font-size:17px;font-weight:700;margin:26px 0 12px}";
  h += ".cats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0;padding:0;border:0}";
  // Los 5 botones son la accion. Superficie neutra con borde, igual que el
  // portal HTTPS, para que la persona reconozca la misma pantalla despues.
  h += ".cat{-webkit-appearance:none;appearance:none;font:inherit;border:1.5px solid #2E3033;background:#161719;color:#F1F3F4;";
  h += "border-radius:16px;padding:15px 10px;min-height:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;";
  h += "text-align:center;font-weight:700;font-size:14.5px;cursor:pointer}";
  h += ".cat:active{transform:scale(.98);border-color:#4C9AFF}";
  h += ".cat:focus-visible{outline:3px solid #4C9AFF;outline-offset:3px}";
  h += ".cat svg{width:30px;height:30px}";
  h += ".cat.sel{border-color:#4C9AFF;background:#1B2432;box-shadow:0 0 0 1.5px #4C9AFF inset}";
  h += ".cat .fa{width:32px;height:32px;border-radius:7px;background:#2FBF71;display:grid;place-items:center}.cat .fa svg{width:20px;height:20px;color:#fff}";
  h += ".wide{grid-column:1/-1}";
  // Detalle opcional: subtipo, mensaje y lugar escrito. Alimentan el triage.
  h += ".lab{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#9AA0A6;margin:20px 0 8px}";
  h += ".chips{display:flex;flex-wrap:wrap;gap:8px}";
  h += ".chip{-webkit-appearance:none;appearance:none;font:inherit;background:#161719;border:1.5px solid #2E3033;color:#F1F3F4;";
  h += "border-radius:20px;padding:10px 14px;min-height:44px;font-size:14px;font-weight:600;cursor:pointer}";
  h += ".chip.sel{border-color:#4C9AFF;background:#1B2432;color:#fff}";
  h += ".chip:active{transform:scale(.98)}.chip:focus-visible{outline:3px solid #4C9AFF;outline-offset:3px}";
  // 16px es el minimo: por debajo, iOS hace auto-zoom y rompe el layout.
  h += ".txt{width:100%;background:#161719;border:1.5px solid #2E3033;color:#F1F3F4;border-radius:13px;";
  h += "padding:13px 14px;font:16px/1.45 inherit;margin-top:10px}";
  h += ".txt:focus{outline:none;border-color:#4C9AFF}";
  h += "textarea.txt{min-height:76px;resize:vertical}";
  // El GPS es una mejora opcional y va PLEGADO, debajo de la accion.
  h += "details{margin-top:22px;background:#161719;border:1.5px solid #2E3033;border-radius:13px;padding:2px 14px}";
  h += "summary{padding:13px 0;font-size:14.5px;font-weight:700;color:#4C9AFF;cursor:pointer;min-height:44px;display:flex;align-items:center}";
  h += ".step{border-top:1px solid #2E3033;padding:11px 0;font-size:13.5px;color:#C9CCCE}.step b{color:#4C9AFF}";
  h += ".sp{flex:1}";
  h += ".go{display:block;width:100%;-webkit-appearance:none;appearance:none;border:0;background:#FF4438;color:#fff;padding:20px;";
  h += "border-radius:18px;text-decoration:none;text-align:center;font-family:inherit;font-weight:800;font-size:19px;min-height:56px;margin-top:22px;cursor:pointer}";
  h += ".go small{display:block;font-weight:500;font-size:13px;opacity:.95;margin-top:4px}";
  h += ".go:active{transform:scale(.99)}.go:focus-visible{outline:3px solid #fff;outline-offset:3px}";
  h += ".msg{color:#9AA0A6;text-align:center;margin:18px 0;font-size:15px}";
  h += "@media (prefers-reduced-motion: reduce){.cat:active{transform:none}}";
  h += "</style></head><body><div class='w'>";
  h += "<h1>Punto de ayuda 911</h1>";
  h += "<div class='sub'>Estás conectado. No necesitas internet.</div>";

  // ---- iOS: pedir ayuda AQUI MISMO, sin GPS ----
  // Mismos 2 pasos que el portal HTTPS: situacion, y luego detalle opcional.
  // Un intento anterior mandaba el SOS con el primer toque, de un solo paso.
  // Salia mas rapido, pero perdia el subtipo y el mensaje, que son justo lo
  // que alimenta el triage del centro. Y aqui pesa mas todavia: sin GPS, el
  // texto del lugar es la unica pista de donde esta la persona.
  h += "<div id='ios' hidden>";
  h += "<div class='lead'>¿Qué está pasando?</div>";
  h += "<form method='POST' action='/report' id='f'>";
  h += "<input type='hidden' name='accion' value='sos'>";
  h += "<input type='hidden' name='cat' id='cat' value=''>";
  h += "<div class='cats' id='cats'>";
  h += "<button type='button' class='cat' data-cat='RESCATE'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7'><circle cx='12' cy='7' r='3'/><path d='M5.5 21c0-4 2.9-6.5 6.5-6.5s6.5 2.5 6.5 6.5'/></svg><span>Persona atrapada</span></button>";
  h += "<button type='button' class='cat' data-cat='MEDICO'><span class='fa'><svg viewBox='0 0 24 24' fill='currentColor'><path d='M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'/></svg></span><span>Persona herida</span></button>";
  h += "<button type='button' class='cat' data-cat='FUEGO'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7'><path d='M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c2 2 3 3.5 3 6a5 5 0 0 1-10 0c0-3 3-4 5-13z'/></svg><span>Incendio</span></button>";
  h += "<button type='button' class='cat' data-cat='AGUA'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><path d='M12 2s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9 12 2 12 2z'/></svg><span>Inundación</span></button>";
  h += "<button type='button' class='cat wide' data-cat='GRUA'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7'><path d='M3 17h13v-4l4 1v3h1M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM16 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM3 13V8h7l3 3'/></svg><span>Vía o vehículo bloqueado</span></button>";
  h += "</div>";
  h += "<div id='det' hidden>";
  h += "<div class='lab'>Detalle (opcional)</div>";
  h += "<div class='chips' id='chips'></div>";
  h += "<textarea class='txt' name='detalle' id='msg' maxlength='100' placeholder='Escribe un mensaje para el puesto de mando (opcional)'></textarea>";
  h += "<div class='lab'>¿Dónde estás? (opcional)</div>";
  h += "<input class='txt' name='lugar' id='lugar' maxlength='60' placeholder='Ej: Cra 12 # 4-30, o un punto conocido'>";
  h += "<button class='go' type='submit' id='send'>Pedir ayuda</button>";
  h += "</div></form>";
  h += "<details><summary>Mandar también mi ubicación GPS (opcional)</summary>";
  h += "<div class='step'>Esta pantalla de iPhone no puede leer el GPS. Pide ayuda arriba primero: llega igual.</div>";
  h += "<div class='step'><b>1.</b> Toca <b>Cancelar</b> arriba a la derecha.</div>";
  h += "<div class='step'><b>2.</b> Elige <b>Usar sin conexión</b>.</div>";
  h += "<div class='step'><b>3.</b> Abre <b>Safari</b> y entra a <b>" + String(DOMAIN) + "</b></div>";
  h += "</details></div>";

  // ---- Android: al portal HTTPS, donde el GPS si funciona ----
  h += "<div id='and' hidden><div class='msg'>Abriendo la página segura para tu ubicación…</div>";
  h += "<div class='sp'></div><a class='go' id='andlink' href='#'>ABRIR EN CHROME<small>Envía tu ubicación GPS</small></a><div class='sp'></div></div>";
  h += "</div><script>";
  h += "var HTTPS='" + https + "';var INTENT=\"" + intent + "\";";
  h += "var ua=navigator.userAgent,isiOS=/iPhone|iPad|iPod/i.test(ua),isAnd=/Android/i.test(ua);";
  h += "if(isiOS){document.getElementById('ios').hidden=false;armar();}";
  h += "else if(isAnd){var a=document.getElementById('and');a.hidden=false;";
  h += "document.getElementById('andlink').href=INTENT;setTimeout(function(){location.replace(HTTPS);},400);}";
  h += "else{location.replace(HTTPS);}";
  // Mismos subtipos y nombres que el portal HTTPS, para que la persona vea la
  // misma pantalla si despues salta a Safari.
  h += "function armar(){";
  h += "var SUB={RESCATE:['bajo escombros','consciente','varias personas'],";
  h += "MEDICO:['inconsciente','hemorragia','fractura'],";
  h += "FUEGO:['gente dentro','olor a gas'],";
  h += "AGUA:['atrapado por el agua','falta agua potable'],";
  h += "GRUA:['carro volcado','escombro en vía','árbol caído']};";
  h += "var NOM={RESCATE:'Persona atrapada',MEDICO:'Persona herida',FUEGO:'Incendio',AGUA:'Inundación',GRUA:'Vía o vehículo bloqueado'};";
  h += "var cats=document.getElementById('cats'),chips=document.getElementById('chips');";
  h += "var det=document.getElementById('det'),campo=document.getElementById('cat'),msg=document.getElementById('msg');";
  h += "cats.addEventListener('click',function(e){";
  h += "var b=e.target.closest('.cat');if(!b)return;var c=b.dataset.cat;campo.value=c;";
  h += "var todos=cats.querySelectorAll('.cat');for(var i=0;i<todos.length;i++)todos[i].classList.toggle('sel',todos[i]===b);";
  h += "var lista=SUB[c]||[],html='';";
  h += "for(var j=0;j<lista.length;j++)html+=\"<button type='button' class='chip' data-sub='\"+lista[j]+\"'>\"+lista[j]+'</button>';";
  h += "chips.innerHTML=html;msg.value='';det.hidden=false;";
  h += "document.getElementById('send').textContent='Pedir ayuda · '+NOM[c];";
  h += "det.scrollIntoView({block:'nearest'});});";
  // Tocar un subtipo lo escribe en el mensaje. Se puede editar o borrar.
  h += "chips.addEventListener('click',function(e){";
  h += "var b=e.target.closest('.chip');if(!b)return;";
  h += "var todos=chips.querySelectorAll('.chip');for(var i=0;i<todos.length;i++)todos[i].classList.toggle('sel',todos[i]===b);";
  h += "msg.value=b.dataset.sub;});";
  // Feedback al enviar: el POST recarga la pagina entera y puede tardar lo que
  // tarde la radio. Sin esto, la persona no sabe si su toque quedo registrado.
  h += "document.getElementById('f').addEventListener('submit',function(){";
  h += "var s=document.getElementById('send');s.setAttribute('aria-busy','true');s.textContent='Enviando…';";
  h += "setTimeout(function(){s.disabled=true;},0);});";
  h += "}";
  h += "</script></body></html>";
  return h;
}

// Pantalla de exito tras el POST del formulario (iOS, sin GPS).
//
// Lleva el MISMO seguimiento en vivo que el portal HTTPS: los 4 pasos
// (Recibida, En proceso, Ayuda en camino, Resuelto) que se actualizan solos
// consultando /status cada 4 s. La placa guarda ahi el ultimo estado que le
// llego del centro por radio (frame ST), y /status esta registrado tanto en
// el servidor HTTPS como en el HTTP, asi que funciona igual dentro del CNA.
// Antes esta pantalla era estatica: quien entraba por iPhone se quedaba sin
// saber si alguien habia tomado su caso. La unica diferencia con Android debe
// ser el arranque (el portal cautivo), no el seguimiento.
//
// Las instrucciones de ubicacion van aqui, y solo aqui: la mejora se ofrece
// DESPUES de que el pedido ya salio, nunca como requisito antes.
// (NHS: "empieza por las preguntas esenciales, las opcionales despues";
//  NENA-STA-020.1-2020 §2.2.8: se responde "con la mejor ubicacion disponible")
String pageConfirm(String tipo, bool ok) {
  String nombre = tipo;
  if (tipo == "RESCATE") nombre = "persona atrapada";
  else if (tipo == "MEDICO") nombre = "persona herida";
  else if (tipo == "FUEGO") nombre = "incendio";
  else if (tipo == "AGUA") nombre = "inundación";
  else if (tipo == "GRUA") nombre = "vía o vehículo bloqueado";

  String h = "<!doctype html><html lang='es'><head><meta charset='utf-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<title>Pedido enviado</title><style>";
  h += "*{box-sizing:border-box}body{margin:0;background:#0C0C0D;color:#F1F3F4;font:16px/1.5 system-ui,-apple-system,sans-serif}";
  h += ".w{max-width:440px;margin:0 auto;min-height:100vh;padding:24px 16px 28px;display:flex;flex-direction:column}";
  h += ".ill{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;margin:10px auto 16px;border:2.5px solid}";
  h += ".ill svg{width:42px;height:42px}";
  h += ".ok .ill{border-color:#2FBF71;background:rgba(47,191,113,.13)}.ok .ill svg{color:#2FBF71}";
  h += ".wait .ill{border-color:#FFC400;background:rgba(255,196,0,.13)}.wait .ill svg{color:#FFC400}";
  h += "h1{margin:0;font-size:23px;font-weight:800;text-align:center;letter-spacing:-.01em}";
  h += ".sub{color:#9AA0A6;font-size:15px;text-align:center;margin:8px auto 18px;max-width:30ch}";
  h += ".card{background:#161719;border:1.5px solid #2E3033;border-radius:14px;padding:14px 15px;font-size:14.5px}";
  // Timeline: mismos tokens y misma forma que el portal HTTPS.
  h += "#tl{margin-top:18px}";
  h += ".tl-step{display:grid;grid-template-columns:24px 1fr;gap:12px;padding-bottom:18px}";
  h += ".tl-step:last-child{padding-bottom:0}";
  h += ".tl-step .rail{display:flex;flex-direction:column;align-items:center}";
  h += ".tl-step .node{width:22px;height:22px;border-radius:50%;border:2.5px solid #2E3033;background:#161719;display:grid;place-items:center;flex:none}";
  h += ".tl-step .line{width:2.5px;flex:1;background:#2E3033;margin-top:2px;min-height:14px}";
  h += ".tl-step.done .node{background:#2FBF71;border-color:#2FBF71}.tl-step.done .line{background:#2FBF71}";
  h += ".tl-step.done .node svg{width:11px;height:11px;color:#05130b}";
  h += ".tl-step.now .node{border-color:#FF8A00;background:rgba(255,138,0,.22)}";
  h += ".tl-step.cancel .node{border-color:#FF4438;background:rgba(255,68,56,.22)}";
  h += ".tl-step.cancel .node svg{width:11px;height:11px;color:#FF4438}";
  h += ".tl-step .t{font-weight:700;font-size:14.5px}";
  h += ".tl-step.pending .t{color:#9AA0A6;opacity:.7}";
  h += ".tl-step.cancel .t{color:#FF4438}";
  h += ".tl-step .d{font-size:12.5px;color:#9AA0A6;margin-top:1px}";
  h += "details{margin-top:16px;background:#161719;border:1.5px solid #2E3033;border-radius:13px;padding:2px 14px}";
  h += "summary{padding:13px 0;font-size:14.5px;font-weight:700;color:#4C9AFF;cursor:pointer;min-height:44px;display:flex;align-items:center}";
  h += ".step{border-top:1px solid #2E3033;padding:11px 0;font-size:13.5px;color:#C9CCCE}.step b{color:#4C9AFF}";
  h += ".sp{flex:1}";
  h += "a.again{display:block;margin-top:18px;background:#161719;color:#F1F3F4;border:1.5px solid #2E3033;border-radius:14px;";
  h += "padding:16px;min-height:56px;text-align:center;text-decoration:none;font-weight:700;font-size:16px}";
  h += "a.again:active{transform:scale(.98)}";
  h += "@media (prefers-reduced-motion: reduce){a.again:active{transform:none}}";
  h += "</style></head><body><div class='w ";
  h += (ok ? "ok" : "wait");
  h += "'>";
  if (ok) {
    h += "<div class='ill'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4'><path d='M20 6 9 17l-5-5'/></svg></div>";
    h += "<h1>Pedimos ayuda por ti</h1>";
    h += "<div class='sub'>El puesto de mando recibió tu pedido de <b>" + nombre + "</b> por radio.</div>";
    h += "<div class='card'>Quédate cerca de este punto de ayuda si es seguro. Por aquí te ubican.</div>";
  } else {
    h += "<div class='ill'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4'><path d='M12 7v6M12 17h.01'/><circle cx='12' cy='12' r='9'/></svg></div>";
    h += "<h1>Guardado. Reintentando</h1>";
    h += "<div class='sub'>Tu pedido de <b>" + nombre + "</b> quedó registrado. El puesto de mando todavía no confirma.</div>";
    h += "<div class='card'>La radio sigue reintentando sola. No cierres esta pantalla todavía.</div>";
  }
  // Seguimiento en vivo, igual que en el portal HTTPS.
  h += "<div id='tl'></div>";
  // La mejora de ubicacion, solo aqui y plegada.
  h += "<details><summary>Mandar también mi ubicación GPS (opcional)</summary>";
  h += "<div class='step'>Tu pedido ya salió. Esto solo agrega tu punto exacto en el mapa del mando.</div>";
  h += "<div class='step'>Ojo: al salir de aquí pierdes esta pantalla de estado.</div>";
  h += "<div class='step'><b>1.</b> Toca <b>Cancelar</b> arriba a la derecha.</div>";
  h += "<div class='step'><b>2.</b> Elige <b>Usar sin conexión</b>.</div>";
  h += "<div class='step'><b>3.</b> Abre <b>Safari</b> y entra a <b>" + String(DOMAIN) + "</b></div>";
  h += "</details><div class='sp'></div>";
  h += "<a class='again' href='/'>Hacer otro pedido</a>";
  h += "</div><script>";
  // Mismos pasos, mismo mapeo de estados y misma regla del check final que
  // portal_preview.html. Si se tocan alli, hay que tocarlos aqui.
  // 5 pasos, uno por hito real. Cada entrada: titulo, texto cuando YA paso, y
  // texto mientras se espera.
  h += "var PASOS=[['Recibida','el puesto de mando recibió tu solicitud','esperando confirmación por radio'],";
  h += "['En proceso','un operador está gestionando tu caso','esperando que un operador lo tome'],";
  h += "['Unidad asignada','ya hay una unidad a cargo de tu caso','buscando la unidad más cercana'],";
  h += "['En camino','la unidad va hacia ti','la unidad todavía no sale'],";
  h += "['Resuelto','te atendieron','la unidad todavía no termina']];";
  // Cuantos pasos SE CUMPLIERON ya (0 a 5).
  h += "function nivelDe(e){e=(e||'').toUpperCase();";
  h += "if(e==='RESUELTA')return 5;";
  h += "if(e.indexOf('CAMINO')>=0||e==='EN_CURSO'||e==='ENLUGAR')return 4;";
  h += "if(e.indexOf('ASIGNADA')>=0||e==='DESPACHADA'||e==='ACEPTADA')return 3;";
  h += "if(e.indexOf('GESTION')>=0||e==='EN_REVISION')return 2;";
  h += "return 1;}";
  h += "function esCancelada(e){return (e||'').toUpperCase().indexOf('CANCEL')>=0;}";
  h += "var CHECK=\"<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3'><path d='M20 6 9 17l-5-5'/></svg>\";";
  // Todos los pasos cumplidos llevan check; el siguiente es el que se espera.
  // Misma regla que portal_preview.html: si se toca alli, tocar aqui.
  h += "function pintar(n){var s='';";
  h += "for(var i=0;i<PASOS.length;i++){";
  h += "var cls=i<n?'done':(i===n?'now':'pending');";
  h += "var linea=i<PASOS.length-1?\"<div class='line'></div>\":'';";
  h += "var d=cls==='pending'?'Aún no':(cls==='now'?PASOS[i][2]:PASOS[i][1]);";
  h += "s+=\"<div class='tl-step \"+cls+\"'><div class='rail'><div class='node'>\"+(cls==='done'?CHECK:'')+'</div>'+linea+";
  h += "\"</div><div><div class='t'>\"+PASOS[i][0]+\"</div><div class='d'>\"+d+'</div></div></div>';}";
  h += "document.getElementById('tl').innerHTML=s;}";
  // Cancelar no es "mas avance": reemplaza el timeline por un paso propio.
  h += "function pintarCancel(){document.getElementById('tl').innerHTML=";
  h += "\"<div class='tl-step cancel'><div class='rail'><div class='node'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round'><path d='M6 6l12 12M18 6L6 18'/></svg></div></div><div><div class='t'>Solicitud cancelada</div><div class='d'>El puesto de mando canceló este pedido. Si sigues necesitando ayuda, pide de nuevo.</div></div></div>\";}";
  h += "pintar(1);";
  h += "function mirar(){fetch('/status',{cache:'no-store'}).then(function(r){return r.json()})";
  h += ".then(function(s){if(esCancelada(s.estado))pintarCancel();else pintar(nivelDe(s.estado));}).catch(function(){});}";
  h += "mirar();setInterval(mirar,4000);";
  h += "</script></body></html>";
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
// HTTPS/HTTP: estado actual de la solicitud del rescatista. Lo actualiza el centro
// por LoRa (frame ST). El portal lo consulta para mostrar el timeline en vivo.
static esp_err_t hStatus(httpd_req_t* req) {
  unsigned long hace = estadoAt ? (millis() - estadoAt) / 1000UL : 0;
  char json[96];
  snprintf(json, sizeof(json), "{\"estado\":\"%s\",\"hace\":%lu}", estadoBuf, hace);
  httpd_resp_set_type(req, "application/json; charset=utf-8");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  httpd_resp_sendstr(req, json);
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
  preferences.begin("lora-portal", false);
  seq = preferences.getUInt("next_seq", 0);
  hasActiveSos = preferences.getBool("has_sos", false);
  activeSosSeq = preferences.getUInt("active_sos", 0);

  tieneOled = detectarOled();
  Serial.println(tieneOled ? "[NODO] OLED detectado" : "[NODO] sin OLED");
  if (tieneOled) { oled.begin(); oledMostrar("PUNTO AYUDA", "iniciando...", ""); }

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  Serial.print("[NODO] LoRa... ");
  int e = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  Serial.println(e == RADIOLIB_ERR_NONE ? "OK" : "FALLO");
  // El rescatista tambien ESCUCHA: el centro le manda el estado de su solicitud.
  txMtx = xSemaphoreCreateMutex();
  reportMtx = xSemaphoreCreateMutex();
  radio.setPacketReceivedAction(onRx);
  radio.startReceive();

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

  // HTTPS :443 se arranca PRIMERO (justo tras softAP) para tomar el bloque
  // contiguo de RAM antes de que el DNS y el HTTP fragmenten el heap.
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
    // /status ANTES del comodin /* para que no lo capture el handler de la pagina.
    httpd_uri_t u_status = {}; u_status.uri = "/status"; u_status.method = HTTP_GET; u_status.handler = hStatus;
    httpd_register_uri_handler(shandle, &u_status);
    httpd_uri_t u_geo = {}; u_geo.uri = "/*"; u_geo.method = HTTP_GET; u_geo.handler = hGeo;
    httpd_register_uri_handler(shandle, &u_geo);
    Serial.println("OK");
  } else {
    Serial.print("FALLO "); Serial.println(se);
  }

  // DNS cautivo: se arranca despues del HTTPS (es liviano, no compite por el bloque grande).
  dnsServer.start(53, "*", apIP);

  // HTTP :80 (portal cautivo -> boton a navegador)
  httpd_config_t hconf = HTTPD_DEFAULT_CONFIG();
  hconf.server_port = 80;
  hconf.ctrl_port = 32780;              // distinto al del HTTPS para no chocar
  hconf.uri_match_fn = httpd_uri_match_wildcard;
  httpd_handle_t hhandle = NULL;
  if (httpd_start(&hhandle, &hconf) == ESP_OK) {
    httpd_uri_t u_rep = {}; u_rep.uri = "/report"; u_rep.method = HTTP_POST; u_rep.handler = hReportForm;
    httpd_register_uri_handler(hhandle, &u_rep);
    httpd_uri_t u_hstatus = {}; u_hstatus.uri = "/status"; u_hstatus.method = HTTP_GET; u_hstatus.handler = hStatus;
    httpd_register_uri_handler(hhandle, &u_hstatus);
    httpd_uri_t u_http = {}; u_http.uri = "/*"; u_http.method = HTTP_GET; u_http.handler = hHttp;
    httpd_register_uri_handler(hhandle, &u_http);
  }

  Serial.println("[NODO] Portal listo. https://ayuda.homiapp.xyz");
  Serial.print("[DIAG] heap libre tras setup: "); Serial.print(ESP.getFreeHeap());
  Serial.print("  bloque max contiguo: "); Serial.println(ESP.getMaxAllocHeap());
  oledMostrar("PUNTO AYUDA", "red: AFECTADOS WOKI", "esperando pedidos");
}

// Disparador de SOS de PRUEBA por el puerto serial. Sirve para validar el loop
// completo sin el telefono, y como respaldo en el demo. En el monitor serial a
// 115200 escribe "SOS" (o "SOS|GRUA|carro volcado"). Corre en el contexto de
// loop() (dueno del radio), asi que envia directo con enviarConAck (no encola).
void enviarSosPrueba(String cat, String detalle) {
  if (cat.length() == 0) cat = "RESCATE";
  if (detalle.length() == 0) detalle = "prueba serial: persona bajo escombros";
  detalle = sanN(detalle, 100);
  String pri = priDefault(cat);
  uint32_t id = nextSequence();
  activeSosSeq = id; hasActiveSos = true;
  preferences.putUInt("active_sos", activeSosSeq);
  preferences.putBool("has_sos", true);
  strlcpy(estadoBuf, "-", sizeof(estadoBuf));
  estadoAt = 0;
  String msg = NODE_ID + "|" DST_CENTRO "|SOS|" + String(id) + "|" +
               cat + "|" + pri + "|" + NODE_LAT + "|" + NODE_LON + "|Prueba serial|" + detalle;
  Serial.println("[NODO] SOS de prueba (serial): " + msg);
  enviarConAck(msg, id);
}

unsigned long lastDiag = 0;
void loop() {
  dnsServer.processNextRequest();

  // Comando de prueba por serial: "SOS" o "SOS|GRUA|carro volcado".
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n'); cmd.trim();
    if (cmd.startsWith("SOS")) enviarSosPrueba(tok(cmd, 1), tok(cmd, 2));
  }

  // 1. Si el servidor HTTPS encolo un envio, loop() lo ejecuta (dueno del radio).
  if (txPend) {
    xSemaphoreTake(txMtx, portMAX_DELAY);
    String msg = txMsg; uint32_t id = txId; txPend = false;
    xSemaphoreGive(txMtx);
    txOk = enviarConAck(msg, id);
    txDone = true;
  }
  // 2. Llego un frame del centro con el estado de mi solicitud.
  if (rxFlag) {
    rxFlag = false;
    String in;
    if (radio.readData(in) == RADIOLIB_ERR_NONE) procesarEntrante(in);
    radio.startReceive();
  }

  // Diagnostico de heap: si baja mucho, el handshake TLS resetea la conexion.
  if (millis() - lastDiag > 3000) {
    lastDiag = millis();
    Serial.print("[DIAG] heap="); Serial.print(ESP.getFreeHeap());
    Serial.print(" maxblock="); Serial.print(ESP.getMaxAllocHeap());
    Serial.print(" clientes="); Serial.println(WiFi.softAPgetStationNum());
  }
  delay(5);
}
