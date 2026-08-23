// GATEWAY CENTRO no bloqueante - TTGO LoRa32 T3 V1.6.1 (SX1276, 915 MHz)
// Radio: ORIGEN|DESTINO|TIPO|MSGID|payload...
// USB IN: TX|<frame>\n
// USB OUT: RX|<frame>|RSSI:x|SNR:y, ACK|..., TX_SENT|..., TX_ERROR|...
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
#define MY_ID "CENTRO"
#define BROADCAST "BCAST"
#define MAX_PEERS 16

// OLED I2C del T3 V1.6.1 (SDA 21, SCL 22, 0x3C). Solo muestra estado; no altera el radio.
#define OLED_SDA 21
#define OLED_SCL 22
#define OLED_ADDR 0x3C

SX1276 radio = new Module(LORA_CS, LORA_DIO0, LORA_RST, LORA_DIO1);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, OLED_SCL, OLED_SDA);
bool tieneOled = false;
long msgCount = 0;
volatile bool packetReceived = false;
volatile bool receiveInterruptEnabled = true;
String serialBuffer;
String peerId[MAX_PEERS];
long peerLastMsg[MAX_PEERS];
int nPeers = 0;

void onPacketReceived() {
  if (receiveInterruptEnabled) packetReceived = true;
}

// Detecta el OLED por I2C antes de usarlo (si la placa no lo trae, no se cuelga).
bool detectarOled() {
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.beginTransmission(OLED_ADDR);
  return Wire.endTransmission() == 0;
}

// Muestra en la OLED el estado del centro y el ultimo mensaje recibido.
void mostrarOled(const String& linea1, const String& origin, const String& kind, float rssi) {
  if (!tieneOled) return;
  oled.clearBuffer();
  oled.setFont(u8g2_font_ncenB10_tr);
  oled.drawStr(0, 14, "CENTRO");
  oled.setFont(u8g2_font_6x12_tr);
  oled.drawStr(0, 30, linea1.c_str());
  char l3[26], l4[26];
  if (origin.length()) {
    snprintf(l3, sizeof(l3), "%s %s", origin.c_str(), kind.c_str());
    snprintf(l4, sizeof(l4), "RSSI %d  msgs %ld", (int)rssi, msgCount);
  } else {
    l3[0] = 0; snprintf(l4, sizeof(l4), "msgs %ld", msgCount);
  }
  oled.drawStr(0, 46, l3);
  oled.drawStr(0, 62, l4);
  oled.sendBuffer();
}

String field(const String& value, int index) {
  int start = 0, count = 0;
  for (int i = 0; i <= (int)value.length(); i++) {
    if (i == (int)value.length() || value[i] == '|') {
      if (count == index) return value.substring(start, i);
      count++;
      start = i + 1;
    }
  }
  return "";
}

bool isDuplicate(const String& origin, long messageId) {
  for (int i = 0; i < nPeers; i++) {
    if (peerId[i] == origin) {
      if (peerLastMsg[i] == messageId) return true;
      peerLastMsg[i] = messageId;
      return false;
    }
  }
  if (nPeers < MAX_PEERS) {
    peerId[nPeers] = origin;
    peerLastMsg[nPeers] = messageId;
    nPeers++;
  }
  return false;
}

void startListening() {
  packetReceived = false;
  receiveInterruptEnabled = true;
  radio.setPacketReceivedAction(onPacketReceived);
  int state = radio.startReceive();
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("RADIO_ERROR|RX_START|");
    Serial.println(state);
  }
}

int transmitFrame(String frame) {
  receiveInterruptEnabled = false;
  radio.clearPacketReceivedAction();
  packetReceived = false;
  radio.standby();
  for (int attempt = 0; attempt < 6; attempt++) {
    if (radio.scanChannel() == RADIOLIB_CHANNEL_FREE) break;
    delay(random(20, 90));
  }
  int state = radio.transmit(frame);
  startListening();
  return state;
}

void handleSerialCommand(String command) {
  command.trim();
  if (!command.startsWith("TX|")) return;
  String frame = command.substring(3);
  String origin = field(frame, 0), destination = field(frame, 1);
  String kind = field(frame, 2), messageId = field(frame, 3);
  if (!origin.length() || !destination.length() || !kind.length() || !messageId.length()) {
    Serial.println("TX_ERROR|-1|INVALID_FRAME");
    return;
  }
  int state = transmitFrame(frame);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("TX_SENT|" + origin + "|" + destination + "|" + kind + "|" + messageId);
  } else {
    Serial.println("TX_ERROR|" + messageId + "|" + String(state));
  }
}

void pollSerial() {
  while (Serial.available()) {
    char value = (char)Serial.read();
    if (value == '\n') {
      handleSerialCommand(serialBuffer);
      serialBuffer = "";
    } else if (value != '\r' && serialBuffer.length() < 240) {
      serialBuffer += value;
    }
  }
}

void handleRadioPacket() {
  if (!packetReceived) return;
  receiveInterruptEnabled = false;
  packetReceived = false;
  String frame;
  int state = radio.readData(frame);
  float rssi = radio.getRSSI(), snr = radio.getSNR();
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("RADIO_ERROR|RX_READ|"); Serial.println(state);
    startListening();
    return;
  }

  String origin = field(frame, 0), destination = field(frame, 1);
  String kind = field(frame, 2), messageId = field(frame, 3);
  if (!origin.length() || !destination.length() || !kind.length() || !messageId.length()) {
    Serial.println("RADIO_ERROR|INVALID_FRAME|" + frame);
    startListening();
    return;
  }

  if (kind == "ACK") {
    Serial.print("ACK|"); Serial.print(origin); Serial.print("|");
    Serial.print(destination); Serial.print("|"); Serial.print(messageId);
    Serial.print("|RSSI:"); Serial.print(rssi);
    Serial.print("|SNR:"); Serial.println(snr);
    startListening();
    return;
  }
  if (destination != MY_ID && destination != BROADCAST) {
    startListening();
    return;
  }

  bool duplicate = isDuplicate(origin, messageId.toInt());
  // Nunca se responde de forma grupal a BCAST: evita tormentas de ACK.
  if (destination == MY_ID) {
    transmitFrame(String(MY_ID) + "|" + origin + "|ACK|" + messageId);
  } else {
    startListening();
  }
  if (duplicate) {
    Serial.println("RX_DUPLICATE|" + origin + "|" + messageId);
    return;
  }

  Serial.print("RX|"); Serial.print(frame);
  Serial.print("|RSSI:"); Serial.print(rssi);
  Serial.print("|SNR:"); Serial.println(snr);

  msgCount++;
  mostrarOled("recibiendo", origin, kind, rssi);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  tieneOled = detectarOled();
  Serial.println(tieneOled ? "[GATEWAY] OLED detectado" : "[GATEWAY] sin OLED");
  if (tieneOled) {
    oled.begin();
    mostrarOled("iniciando...", "", "", 0);
  }
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  randomSeed(analogRead(0));
  Serial.print("[GATEWAY] Iniciando LoRa... ");
  int state = radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("FALLO, codigo "); Serial.println(state);
    while (true) delay(1000);
  }
  Serial.println("OK. ID=" MY_ID);
  startListening();
  Serial.println("GATEWAY_READY|CENTRO|1");
  mostrarOled("esperando...", "", "", 0);
}

void loop() {
  pollSerial();
  handleRadioPacket();
  delay(2);
}
