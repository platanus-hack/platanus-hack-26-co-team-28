// NODO BIDIRECCIONAL con ACK - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// Envia un reporte y espera el ACK del gateway. Reintenta 3 veces con backoff.
// Modo BLOQUEANTE (sin interrupciones).
#include <RadioLib.h>

#define LORA_SCK   5
#define LORA_MISO  19
#define LORA_MOSI  27
#define LORA_CS    18
#define LORA_RST   23
#define LORA_DIO0  26
#define LORA_DIO1  33

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);

String NODE_ID = "a3f21c";
int seq = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  randomSeed(analogRead(0));

  Serial.print("[NODO] Iniciando LoRa... ");
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK");
  } else {
    Serial.print("FALLO, codigo "); Serial.println(estado);
    while (true) { delay(1000); }
  }
}

void loop() {
  String msg = NODE_ID + "|atrapado|apto401|" + String(seq);
  bool acked = false;
  int intento = 0;

  while (!acked && intento < 3) {
    Serial.println("[NODO] TX (intento " + String(intento + 1) + "): " + msg);
    radio.transmit(msg);

    // Escucha el ACK con ventanas seguidas por hasta 1 s
    unsigned long t0 = millis();
    while (millis() - t0 < 1000 && !acked) {
      String ack;
      int st = radio.receive(ack);
      if (st == RADIOLIB_ERR_NONE && ack.startsWith("ACK|" + NODE_ID)) {
        acked = true;
      }
    }

    if (acked) {
      Serial.println("[NODO] ACK recibido. RSSI:" + String(radio.getRSSI()) +
                     " SNR:" + String(radio.getSNR()));
    } else {
      intento++;
      long espera = random(100, 500);
      Serial.println("[NODO] sin ACK, reintento en " + String(espera) + " ms...");
      delay(espera);
    }
  }

  if (!acked) Serial.println("[NODO] FALLO tras 3 intentos");
  seq++;
  delay(5000);
}
