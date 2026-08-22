// NODO BIDIRECCIONAL con DIRECCIONAMIENTO y ACK - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// Protocolo estandar (patron RadioHead RHReliableDatagram sobre RadioLib):
//   Frame: ORIGEN|DESTINO|TIPO|MSGID|payload...
//   - ORIGEN  : quien manda (este nodo).
//   - DESTINO : para quien es. El receptor filtra por este campo.
//   - TIPO    : SOS, DISP, ACC, ST, ACK, POS.
//   - MSGID   : numero de secuencia. Sirve para casar el ACK y descartar duplicados.
// Envia un SOS con GPS de demo, espera el ACK dirigido, reintenta 3 veces con backoff.
// Alterna el DESTINO para demostrar el filtro: pares -> CENTRO (recibe ACK),
// impares -> GRUA07 (el gateway CENTRO lo ignora, no hay ACK: eso es correcto).
#include <RadioLib.h>

#define LORA_SCK   5
#define LORA_MISO  19
#define LORA_MOSI  27
#define LORA_CS    18
#define LORA_RST   23
#define LORA_DIO0  26
#define LORA_DIO1  33

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);

// Direcciones (best practice: una identidad por nodo, usada como ORIGEN y DESTINO)
#define MY_ID     "a3f21c"     // este nodo (rescatista)
#define CENTRO    "CENTRO"     // el gateway / centro de operaciones
#define GRUA      "GRUA07"     // otro destino, para probar el filtro
#define BROADCAST "BCAST"

// Payload de demo (el GPS real vendria del celular; aqui va fijo para probar en mesa)
#define DEMO_TIPO    "atrapado"
#define DEMO_DETALLE "apto401"
#define DEMO_LAT     "4.6767"
#define DEMO_LON     "-74.0483"
#define DEMO_SEV     "1"

int seq = 0;

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

// Envio con CAD (Channel Activity Detection = listen-before-talk).
// Antes de transmitir, escucha si el canal esta ocupado. Si lo esta, espera un
// tiempo aleatorio y reintenta la deteccion. Esto reduce las colisiones cuando
// hay muchos nodos/usuarios transmitiendo a la vez. Estandar de LoRa.
void enviarCAD(String msg) {
  for (int i = 0; i < 6; i++) {
    if (radio.scanChannel() == RADIOLIB_CHANNEL_FREE) break;   // canal libre
    delay(random(20, 90));                                     // ocupado: backoff y reintenta CAD
  }
  radio.transmit(msg);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  randomSeed(analogRead(0));

  Serial.print("[NODO] Iniciando LoRa... ");
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK. ID=" MY_ID);
  } else {
    Serial.print("FALLO, codigo "); Serial.println(estado);
    while (true) { delay(1000); }
  }
}

void loop() {
  // Alterna el destino para demostrar el filtro por DESTINO en el gateway
  String dst = (seq % 2 == 0) ? String(CENTRO) : String(GRUA);
  bool esperaAck = (dst == CENTRO);   // solo CENTRO responde a este nodo

  // Frame: ORIGEN|DESTINO|TIPO|MSGID|tipo|detalle|lat|lon|sev
  String msg = String(MY_ID) + "|" + dst + "|SOS|" + String(seq) + "|" +
               DEMO_TIPO + "|" + DEMO_DETALLE + "|" + DEMO_LAT + "|" + DEMO_LON + "|" + DEMO_SEV;

  if (!esperaAck) {
    // Prueba de filtro: mando a un destino que el gateway debe ignorar
    Serial.println("[NODO] TX dst=" + dst + " (prueba de filtro): " + msg);
    enviarCAD(msg);
    Serial.println("[NODO] enviado. El gateway CENTRO debe IGNORARLO (no es su dst). Sin ACK = correcto.");
    seq++;
    delay(4000);
    return;
  }

  // Envio confiable con ACK dirigido y reintentos
  bool acked = false;
  int intento = 0;
  while (!acked && intento < 3) {
    Serial.println("[NODO] TX (intento " + String(intento + 1) + ") dst=" + dst + ": " + msg);
    enviarCAD(msg);

    // Escucha el ACK dirigido a mi, con mi MSGID, por hasta 1 s
    unsigned long t0 = millis();
    while (millis() - t0 < 1000 && !acked) {
      String in;
      int st = radio.receive(in);
      if (st == RADIOLIB_ERR_NONE) {
        // Filtro de entrada: el ACK debe ser PARA MI, tipo ACK, con mi MSGID
        if (field(in, 1) == MY_ID && field(in, 2) == "ACK" && field(in, 3) == String(seq)) {
          acked = true;
          Serial.println("[NODO] ACK recibido de " + field(in, 0) +
                         " (id " + String(seq) + "). RSSI:" + String(radio.getRSSI()) +
                         " SNR:" + String(radio.getSNR()));
        }
      }
    }

    if (!acked) {
      intento++;
      long espera = random(100, 500);
      Serial.println("[NODO] sin ACK, reintento en " + String(espera) + " ms...");
      delay(espera);
    }
  }

  if (!acked) Serial.println("[NODO] FALLO tras 3 intentos (dst=" + dst + ")");
  seq++;
  delay(4000);
}
