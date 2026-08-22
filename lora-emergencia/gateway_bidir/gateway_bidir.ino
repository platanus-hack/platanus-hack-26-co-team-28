// GATEWAY BIDIRECCIONAL con FILTRO por DESTINO, ACK dirigido y anti-duplicados
// TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz).
// Protocolo estandar (patron RadioHead RHReliableDatagram sobre RadioLib):
//   Frame en el aire: ORIGEN|DESTINO|TIPO|MSGID|payload...
// Este nodo es el CENTRO. Reglas:
//   1. FILTRO: si DESTINO no es "CENTRO" ni "BCAST", ignora el frame (no es para mi).
//   2. ACK dirigido: responde "CENTRO|<origen>|ACK|<msgid>" solo a lo que si es para mi.
//   3. Anti-duplicados: descarta reproceso si (ORIGEN,MSGID) ya se vio, pero re-ACK
//      por si el ACK anterior se perdio.
//   4. Traduce el SOS al formato que espera center.py por USB:
//      RECV|node|tipo|detalle|lat|lon|seq|RSSI:x|SNR:y
#include <RadioLib.h>

#define LORA_SCK   5
#define LORA_MISO  19
#define LORA_MOSI  27
#define LORA_CS    18
#define LORA_RST   23
#define LORA_DIO0  26
#define LORA_DIO1  33

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);

#define MY_ID     "CENTRO"     // identidad de este nodo
#define BROADCAST "BCAST"

// Tabla anti-duplicados: ultimo MSGID visto por cada ORIGEN
#define MAX_PEERS 8
String peerId[MAX_PEERS];
long   peerLastMsg[MAX_PEERS];
int    nPeers = 0;

// Extrae el campo idx (0-based) de un string separado por '|'
String field(const String& s, int idx) {
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

// true si (from,id) es un duplicado del ultimo visto. Registra el id si es nuevo.
bool esDuplicado(const String& from, long id) {
  for (int i = 0; i < nPeers; i++) {
    if (peerId[i] == from) {
      if (peerLastMsg[i] == id) return true;
      peerLastMsg[i] = id;
      return false;
    }
  }
  if (nPeers < MAX_PEERS) {
    peerId[nPeers] = from;
    peerLastMsg[nPeers] = id;
    nPeers++;
  }
  return false;
}

// Envio con CAD (listen-before-talk): escucha el canal antes de transmitir para
// reducir colisiones cuando hay muchos nodos. Estandar de LoRa.
void enviarCAD(String msg) {
  for (int i = 0; i < 6; i++) {
    if (radio.scanChannel() == RADIOLIB_CHANNEL_FREE) break;
    delay(random(20, 90));
  }
  radio.transmit(msg);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  randomSeed(analogRead(0));

  Serial.print("[GATEWAY] Iniciando LoRa... ");
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK. ID=" MY_ID ". Esperando paquetes...");
  } else {
    Serial.print("FALLO, codigo "); Serial.println(estado);
    while (true) { delay(1000); }
  }
}

void loop() {
  String datos;
  int st = radio.receive(datos);   // bloqueante; en timeout devuelve y repetimos
  if (st != RADIOLIB_ERR_NONE) return;

  String tipo = field(datos, 2);
  if (tipo == "ACK") return;       // no procesar ACKs (seguridad extra)

  String from = field(datos, 0);
  String to   = field(datos, 1);

  // 1. FILTRO por destino
  if (to != MY_ID && to != BROADCAST) {
    Serial.println("[FILTRO] descarto: dst=" + to + " (no soy " + MY_ID + "). from=" + from);
    return;
  }

  // Captura RSSI/SNR ANTES de transmitir (transmit los cambia)
  float rssi = radio.getRSSI();
  float snr  = radio.getSNR();
  long  id   = field(datos, 3).toInt();

  bool dup = esDuplicado(from, id);

  // 2. ACK dirigido, SIEMPRE (aun en duplicado: el ACK anterior pudo perderse)
  enviarCAD(String(MY_ID) + "|" + from + "|ACK|" + String(id));

  if (dup) {
    Serial.println("[GATEWAY] duplicado from=" + from + " id=" + String(id) + ", re-ACK, no reproceso");
    return;
  }

  // 3. Decodifica segun el TIPO y lo imprime para center.py
  if (tipo == "SOS") {
    // ORIGEN|CENTRO|SOS|MSGID|cat|pri|lat|lon|lugar|detalle
    String cat = field(datos, 4), pri = field(datos, 5), lat = field(datos, 6),
           lon = field(datos, 7), lugar = field(datos, 8), detalle = field(datos, 9);
    Serial.print("SOS|");
    Serial.print(from);    Serial.print("|");
    Serial.print(cat);     Serial.print("|");
    Serial.print(pri);     Serial.print("|");
    Serial.print(lat);     Serial.print("|");
    Serial.print(lon);     Serial.print("|");
    Serial.print(lugar);   Serial.print("|");
    Serial.print(detalle); Serial.print("|");
    Serial.print(id);      Serial.print("|RSSI:");
    Serial.print(rssi);    Serial.print("|SNR:");
    Serial.println(snr);
    Serial.println("[GATEWAY] SOS de " + from + " cat=" + cat + " pri=" + pri + " -> ACK id " + String(id));
  } else if (tipo == "OK") {
    // ORIGEN|CENTRO|OK|MSGID|nombre|doc|lat|lon|lugar
    String nombre = field(datos, 4), doc = field(datos, 5), lat = field(datos, 6),
           lon = field(datos, 7), lugar = field(datos, 8);
    Serial.print("SALVO|");
    Serial.print(from);   Serial.print("|");
    Serial.print(nombre); Serial.print("|");
    Serial.print(doc);    Serial.print("|");
    Serial.print(lat);    Serial.print("|");
    Serial.print(lon);    Serial.print("|");
    Serial.print(lugar);  Serial.print("|");
    Serial.print(id);     Serial.print("|RSSI:");
    Serial.print(rssi);   Serial.print("|SNR:");
    Serial.println(snr);
    Serial.println("[GATEWAY] A SALVO: " + nombre + " (" + doc + ") -> ACK id " + String(id));
  } else {
    // DISP/ACC/ST/POS u otros: por ahora solo se registran
    Serial.println("[GATEWAY] tipo " + tipo + " de " + from + " -> ACK id " + String(id));
  }
}
