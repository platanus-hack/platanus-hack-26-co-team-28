// GATEWAY RX - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// Recibe reportes por LoRa y los imprime por serial para que la Raspberry Pi los lea.
// Formato de salida: RECV|<datos>|RSSI:<x>|SNR:<y>
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

void setup() {
  Serial.begin(115200);
  delay(500);
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

  Serial.print("[GATEWAY] Iniciando LoRa... ");
  // MISMOS parametros que el nodo, si no, no se oyen
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK. Esperando paquetes...");
  } else {
    Serial.print("FALLO, codigo ");
    Serial.println(estado);
    while (true) { delay(1000); }
  }
}

void loop() {
  String datos;
  int estado = radio.receive(datos);

  if (estado == RADIOLIB_ERR_NONE) {
    Serial.print("RECV|");
    Serial.print(datos);
    Serial.print("|RSSI:");
    Serial.print(radio.getRSSI());
    Serial.print("|SNR:");
    Serial.println(radio.getSNR());
  } else if (estado == RADIOLIB_ERR_RX_TIMEOUT) {
    // sin paquete, normal
  } else {
    Serial.print("[GATEWAY] Error RX: ");
    Serial.println(estado);
  }
}
