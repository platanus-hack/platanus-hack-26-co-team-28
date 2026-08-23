// RANGE MOVIL con OLED - prueba de alcance. TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz).
// Esta es la placa QUE CAMINAS (con powerbank). Cada ~900 ms manda un PING al CENTRO
// y espera el ACK. Muestra en la PANTALLA OLED el estado del enlace y el RSSI, para
// medir el alcance en campo SIN laptop.
//
//   OLED en pantalla:
//     LINK OK / SIN LINK           <- hay enlace o no
//     RSSI -87 dBm  SNR 8.5        <- calidad (mientras mas cerca de -120, mas lejos)
//     ping #123  ok 118/123        <- contador y tasa de exito
//
// Si tu placa NO trae OLED, el firmware sigue funcionando y todo sale por serial.
// La base (gateway_bidir + center.py) tambien muestra el RSSI en el feed en vivo.
//
// Parametros LoRa iguales a todo el repo: 915.0, BW125, SF7, CR4/5, sync 0x12, 20 dBm.
#include <RadioLib.h>
#include <Wire.h>
#include <U8g2lib.h>

#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 23
#define LORA_DIO0 26
#define LORA_DIO1 33

// OLED I2C del T3 V1.6.1: SDA 21, SCL 22, direccion 0x3C.
#define OLED_SDA 21
#define OLED_SCL 22
#define OLED_ADDR 0x3C
#define LED_PIN 25   // LED de campo (bonus). Si no parpadea, prueba 2 o 4.

#define MY_ID  "MOVIL"
#define CENTRO "CENTRO"

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, OLED_SCL, OLED_SDA);

bool tieneOled = false;
int seq = 0, okCount = 0;

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

// Detecta el OLED por I2C antes de usarlo (evita colgarse si la placa no lo trae).
bool detectarOled() {
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.beginTransmission(OLED_ADDR);
  return Wire.endTransmission() == 0;
}

void pantalla(bool link, float rssi, float snr) {
  if (!tieneOled) return;
  oled.clearBuffer();
  oled.setFont(u8g2_font_ncenB14_tr);
  oled.drawStr(0, 16, link ? "LINK OK" : "SIN LINK");
  oled.setFont(u8g2_font_6x12_tr);
  char l2[32], l3[32];
  if (link) snprintf(l2, sizeof(l2), "RSSI %d  SNR %d", (int)rssi, (int)snr);
  else      snprintf(l2, sizeof(l2), "fuera de rango");
  oled.drawStr(0, 36, l2);
  snprintf(l3, sizeof(l3), "ping #%d  ok %d/%d", seq, okCount, seq + 1);
  oled.drawStr(0, 52, l3);
  oled.sendBuffer();
}

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  tieneOled = detectarOled();
  Serial.println(tieneOled ? "[MOVIL] OLED detectado" : "[MOVIL] sin OLED (uso serial)");
  if (tieneOled) {
    oled.begin();
    oled.clearBuffer();
    oled.setFont(u8g2_font_6x12_tr);
    oled.drawStr(0, 20, "RANGE TEST");
    oled.drawStr(0, 36, "iniciando LoRa...");
    oled.sendBuffer();
  }

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  randomSeed(analogRead(0));
  Serial.print("[MOVIL] Iniciando LoRa... ");
  int estado = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (estado == RADIOLIB_ERR_NONE) {
    Serial.println("OK. Caminando... mira el RSSI en la pantalla o en el centro.");
  } else {
    Serial.print("FALLO, codigo "); Serial.println(estado);
    if (tieneOled) { oled.clearBuffer(); oled.drawStr(0, 20, "LoRa FALLO"); oled.sendBuffer(); }
    while (true) { delay(1000); }
  }
}

void loop() {
  String msg = String(MY_ID) + "|" CENTRO "|PING|" + String(seq) + "|rango";
  Serial.println("[MOVIL] PING #" + String(seq));
  enviarCAD(msg);

  bool acked = false;
  float rssi = 0, snr = 0;
  unsigned long t0 = millis();
  while (millis() - t0 < 1200 && !acked) {
    String in; int st = radio.receive(in);
    if (st == RADIOLIB_ERR_NONE &&
        field(in, 1) == MY_ID && field(in, 2) == "ACK" && field(in, 3) == String(seq)) {
      acked = true;
      rssi = radio.getRSSI(); snr = radio.getSNR();
    }
  }

  if (acked) {
    okCount++;
    digitalWrite(LED_PIN, HIGH); delay(50); digitalWrite(LED_PIN, LOW);
    Serial.println("[MOVIL] LINK OK #" + String(seq) + "  RSSI:" + String(rssi) + " SNR:" + String(snr));
  } else {
    Serial.println("[MOVIL] SIN LINK #" + String(seq) + " (fuera de rango u obstaculo)");
  }
  pantalla(acked, rssi, snr);

  seq++;
  delay(900);
}
