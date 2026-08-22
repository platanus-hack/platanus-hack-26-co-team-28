// GATEWAY BIDIRECCIONAL con ACK - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// Recibe un reporte, responde con un ACK, e imprime por serial.
// Modo BLOQUEANTE (sin interrupciones) para evitar leer de vuelta el propio FIFO.
#include <RadioLib.h>

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
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK. Esperando paquetes...");
  } else {
    Serial.print("FALLO, codigo "); Serial.println(estado);
    while (true) { delay(1000); }
  }
}

void loop() {
  String datos;
  int st = radio.receive(datos);   // bloqueante; en timeout devuelve y repetimos

  if (st == RADIOLIB_ERR_NONE) {
    // Ignora ACKs (nunca deberia recibir uno, es seguridad extra)
    if (datos.startsWith("ACK|")) return;

    // Captura RSSI/SNR ANTES de transmitir (transmit los cambia)
    float rssi = radio.getRSSI();
    float snr  = radio.getSNR();

    // Extrae nodeID (primer campo antes del |) y responde rapido
    int p = datos.indexOf('|');
    String nodeid = (p > 0) ? datos.substring(0, p) : datos;
    radio.transmit("ACK|" + nodeid);   // ACK inmediato, antes de imprimir

    // Imprime para la Raspberry Pi
    Serial.print("RECV|");
    Serial.print(datos);
    Serial.print("|RSSI:");
    Serial.print(rssi);
    Serial.print("|SNR:");
    Serial.println(snr);
    Serial.println("[GATEWAY] ACK -> " + nodeid);
  }
}
