#!/usr/bin/env python3
"""
Lee el gateway LoRa por serial y parsea los reportes.
Pensado para correr en la Raspberry Pi conectada al gateway.

Requisitos:  pip install pyserial   (o: pip install pyserial --break-system-packages)
Uso:         python3 pi_reader.py [puerto]
Ejemplo:     python3 pi_reader.py /dev/ttyUSB0
"""
import sys
import time

try:
    import serial
except ImportError:
    print("Falta pyserial. Instala con: pip install pyserial")
    sys.exit(1)

PORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttyUSB0"
BAUD = 115200


def parse_recv(line):
    """RECV|nodeID|estado|detalle|ts|RSSI:x|SNR:y  ->  dict"""
    parts = line.split("|")
    if len(parts) < 7:
        return None
    rssi = parts[5].replace("RSSI:", "")
    snr = parts[6].replace("SNR:", "")
    return {
        "nodeID": parts[1],
        "estado": parts[2],
        "detalle": parts[3],
        "timestamp": parts[4],
        "rssi": rssi,
        "snr": snr,
    }


def main():
    print(f"Leyendo {PORT} @ {BAUD} ... (Ctrl+C para salir)")
    while True:
        try:
            ser = serial.Serial(PORT, BAUD, timeout=1)
            break
        except serial.SerialException as e:
            print(f"No pude abrir {PORT}: {e}. Reintentando en 2 s...")
            time.sleep(2)

    while True:
        try:
            raw = ser.readline().decode(errors="ignore").strip()
        except serial.SerialException:
            print("Puerto perdido. Reintentando...")
            time.sleep(2)
            continue
        if not raw:
            continue
        if raw.startswith("RECV|"):
            data = parse_recv(raw)
            if data:
                print(f"[REPORTE] nodo={data['nodeID']} estado={data['estado']} "
                      f"detalle={data['detalle']} RSSI={data['rssi']} SNR={data['snr']}")
                # TODO: aqui enviar 'data' al mapa / base de datos del centro
            else:
                print(raw)
        else:
            print(raw)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nFin.")
