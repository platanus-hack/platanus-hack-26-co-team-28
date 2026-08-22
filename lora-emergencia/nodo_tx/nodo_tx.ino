// NODO TX - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// Envia un reporte corto cada 5 s. Formato: nodeID|estado|detalle|timestamp
#include <RadioLib.h>

// Pines LoRa de la TTGO LoRa32 T3 V1.6.1
#define LORA_SCK   5
#define LORA_MISO  19
#define LORA_MOSI  27
#define LORA_CS    18
#define LORA_RST   23
#define LORA_DIO0  26
#define LORA_DIO1  33

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);

int contador = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

  Serial.print("[NODO] Iniciando LoRa... ");
  // freq 915.0, BW 125 kHz, SF 7, CR 5, syncWord 0x12, potencia 20 dBm, preamble 8
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK");
  } else {
    Serial.print("FALLO, codigo ");
    Serial.println(estado);
    while (true) { delay(1000); }
  }
}

void loop() {
  String msg = "a3f21c|atrapado|apto401|" + String(millis());
  Serial.print("[NODO] Enviando: ");
  Serial.println(msg);

  int estado = radio.transmit(msg);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("[NODO] Enviado OK");
  } else {
    Serial.print("[NODO] Error TX: ");
    Serial.println(estado);
  }
  contador++;
  delay(5000);
}
