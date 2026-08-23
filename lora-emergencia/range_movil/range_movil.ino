// RANGE MOVIL - prueba de alcance. TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz).
// Esta es la placa QUE CAMINAS (con powerbank). Cada ~900 ms manda un PING al CENTRO
// y espera el ACK. Si llega ACK, hay enlace: parpadea el LED e imprime el RSSI.
// Si dejan de llegar ACKs, perdiste el enlace: ese es tu limite de alcance.
//
// La base (gateway_bidir + laptop con center.py) recibe cada PING y lo muestra en el
// feed "Red LoRa en vivo" con su RSSI. La lectura real del rango es ESE RSSI en la
// pantalla del centro. El LED es solo una ayuda visual en campo.
//
// Mismos parametros LoRa que todo el repo: 915.0, BW125, SF7, CR4/5, sync 0x12, 20 dBm.
#include <RadioLib.h>

#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 23
#define LORA_DIO0 26
#define LORA_DIO1 33

// LED de campo. En muchas T3 V1.6.1 es GPIO25. Si tu placa no parpadea, prueba 2 o 4.
#define LED_PIN 25

#define MY_ID  "MOVIL"
#define CENTRO "CENTRO"

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);
int seq = 0;

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

void enviarCAD(String msg) {
  for (int i = 0; i < 6; i++) {
    if (radio.scanChannel() == RADIOLIB_CHANNEL_FREE) break;
    delay(random(20, 90));
  }
  radio.transmit(msg);
}

void blink(int veces) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(LED_PIN, HIGH); delay(60);
    digitalWrite(LED_PIN, LOW);  delay(60);
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  randomSeed(analogRead(0));

  Serial.print("[MOVIL] Iniciando LoRa... ");
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK. Caminando... mira el RSSI en el centro.");
    blink(3);
  } else {
    Serial.print("FALLO, codigo "); Serial.println(estado);
    while (true) { digitalWrite(LED_PIN, HIGH); delay(120); digitalWrite(LED_PIN, LOW); delay(120); }
  }
}

void loop() {
  // Frame: MOVIL|CENTRO|PING|seq|rango
  String msg = String(MY_ID) + "|" CENTRO "|PING|" + String(seq) + "|rango";
  Serial.println("[MOVIL] PING #" + String(seq));
  enviarCAD(msg);

  // Espera el ACK dirigido (CENTRO|MOVIL|ACK|seq) por hasta 1.2 s
  bool acked = false;
  unsigned long t0 = millis();
  while (millis() - t0 < 1200 && !acked) {
    String in; int st = radio.receive(in);
    if (st == RADIOLIB_ERR_NONE &&
        field(in, 1) == MY_ID && field(in, 2) == "ACK" && field(in, 3) == String(seq)) {
      acked = true;
      float rssi = radio.getRSSI(), snr = radio.getSNR();
      Serial.println("[MOVIL] ENLACE OK #" + String(seq) +
                     "  ACK RSSI:" + String(rssi) + " SNR:" + String(snr));
      blink(1);
    }
  }
  if (!acked) {
    Serial.println("[MOVIL] SIN ENLACE #" + String(seq) + " (fuera de rango o obstaculo)");
    // LED apagado = sin enlace
  }

  seq++;
  delay(900);
}
