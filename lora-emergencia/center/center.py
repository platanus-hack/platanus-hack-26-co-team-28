#!/usr/bin/env python3
"""
Centro de operaciones - MVP con mapa.
Lee el gateway LoRa por serial y muestra los reportes en un mapa + tablero en vivo.

La ubicacion es la del NODO (viene en el mensaje). El GPS del telefono no se usa:
navigator.geolocation esta bloqueado en HTTP y el portal cautivo es HTTP.

Requisitos:  pip install pyserial   (o: pip install pyserial --break-system-packages)
Uso:
    python3 center.py <puerto_serial> [--port 8080]
    python3 center.py --demo
El mapa usa tiles de OpenStreetMap: el centro necesita internet (su uplink) para verlos.
"""
import sys
import json
import threading
import time
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REPORTS = []
LOCK = threading.Lock()


def add_report(node, tipo, detalle, lat, lon, rssi, snr):
    with LOCK:
        REPORTS.append({
            "node": node, "tipo": tipo, "detalle": detalle,
            "lat": lat, "lon": lon, "rssi": rssi, "snr": snr, "t": time.time(),
        })


def parse_line(line):
    # RECV|node|tipo|detalle|lat|lon|seq|RSSI:x|SNR:y
    if not line.startswith("RECV|"):
        return
    p = line.split("|")
    if len(p) < 9:
        return
    node, tipo, detalle, lat, lon = p[1], p[2], p[3], p[4], p[5]
    rssi = p[7].replace("RSSI:", "").strip()
    snr = p[8].replace("SNR:", "").strip()
    add_report(node, tipo, detalle, lat, lon, rssi, snr)
    print(f"[REPORTE] {node} {tipo} '{detalle}' @({lat},{lon}) RSSI={rssi}")


def serial_reader(port, baud=115200):
    try:
        import serial
    except ImportError:
        print("Falta pyserial. Instala: pip install pyserial")
        return
    while True:
        try:
            ser = serial.Serial(port, baud, timeout=1)
            print(f"Leyendo gateway en {port} @ {baud}")
        except Exception as e:
            print(f"No pude abrir {port}: {e}. Reintento en 3 s...")
            time.sleep(3)
            continue
        while True:
            try:
                raw = ser.readline().decode(errors="ignore").strip()
                if raw:
                    parse_line(raw)
            except Exception:
                print("Puerto perdido. Reintento...")
                time.sleep(2)
                break


def demo_feeder():
    demo = [
        ("a3f21c", "rescate", "apto 401, 2do piso", "4.6767", "-74.0483", "-45", "9.5"),
        ("a3f21c", "medico", "senora mayor consciente", "4.6767", "-74.0483", "-52", "8.0"),
        ("b1c2d3", "agua", "familia 4 personas", "4.6712", "-74.0530", "-88", "6.2"),
        ("c4d5e6", "asalvo", "sali del edificio", "4.6801", "-74.0455", "-40", "9.8"),
    ]
    i = 0
    while True:
        n, t, d, la, lo, r, s = demo[i % len(demo)]
        add_report(n, t, d, la, lo, r, s)
        print(f"[DEMO] {n} {t} '{d}'")
        i += 1
        time.sleep(6)


PAGE = """<!doctype html><html lang='es'><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Puesto de mando</title>
<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>
<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>
<style>
body{font-family:-apple-system,Arial,sans-serif;margin:0;background:#0f1115;color:#e7e9ee}
.hdr{background:#d92d20;padding:12px 18px}.hdr h1{margin:0;font-size:19px;color:#fff}
.counts{display:flex;gap:8px;padding:10px 18px;flex-wrap:wrap}
.pill{background:#1a1d24;border:1px solid #2a2f3a;border-radius:10px;padding:8px 12px;min-width:80px}
.pill b{display:block;font-size:20px}.pill span{font-size:11px;color:#9aa2b1}
#map{height:46vh;margin:0 18px;border-radius:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;padding:12px 18px 24px}
.card{background:#1a1d24;border-left:6px solid #444;border-radius:10px;padding:10px 12px}
.tipo{font-weight:700;font-size:14px}.det{color:#c7ccd6;margin:5px 0;font-size:13px}
.meta{color:#8a93a3;font-size:11px}.fresh{outline:2px solid #f79009}
.empty{padding:30px;text-align:center;color:#8a93a3}
</style></head><body>
<div class='hdr'><h1>PUESTO DE MANDO - reportes en vivo</h1></div>
<div class='counts' id='counts'></div>
<div id='map'></div>
<div class='grid' id='grid'></div>
<script>
const TIPOS={agua:['Agua / comida','#1570ef'],medico:['Ayuda medica','#d92d20'],rescate:['Rescate','#b42318'],asalvo:['A salvo','#067647']};
let map=L.map('map').setView([4.6767,-74.0483],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'OSM'}).addTo(map);
let markers=[];
function ago(t){const s=Math.floor(Date.now()/1000-t);if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';return Math.floor(s/3600)+'h';}
async function tick(){
 let r=await fetch('/api/reports');let d=await r.json();d.sort((a,b)=>b.t-a.t);
 let c={agua:0,medico:0,rescate:0,asalvo:0};d.forEach(x=>c[x.tipo]=(c[x.tipo]||0)+1);
 document.getElementById('counts').innerHTML=
   `<div class='pill'><b>${d.length}</b><span>total</span></div>`+
   Object.keys(TIPOS).map(k=>`<div class='pill'><b>${c[k]||0}</b><span>${TIPOS[k][0]}</span></div>`).join('');
 markers.forEach(m=>map.removeLayer(m));markers=[];
 d.forEach(x=>{
   let la=parseFloat(x.lat),lo=parseFloat(x.lon);if(isNaN(la)||isNaN(lo))return;
   let ti=TIPOS[x.tipo]||[x.tipo,'#888'];
   let m=L.circleMarker([la,lo],{radius:10,color:ti[1],fillColor:ti[1],fillOpacity:.8})
     .bindPopup(`<b style='color:${ti[1]}'>${ti[0]}</b><br>${x.detalle||'-'}<br><small>nodo ${x.node} · hace ${ago(x.t)}</small>`);
   m.addTo(map);markers.push(m);
 });
 let g=document.getElementById('grid');
 if(!d.length){g.innerHTML="<div class='empty'>Sin reportes todavia. Esperando la red...</div>";return;}
 g.innerHTML=d.map(x=>{
   let ti=TIPOS[x.tipo]||[x.tipo,'#888'];let fresh=(Date.now()/1000-x.t)<20?'fresh':'';
   return `<div class='card ${fresh}' style='border-left-color:${ti[1]}'>
     <div class='tipo' style='color:${ti[1]}'>${ti[0]}</div>
     <div class='det'>${x.detalle||'-'}</div>
     <div class='meta'>nodo ${x.node} · ${x.lat},${x.lon} · hace ${ago(x.t)} · RSSI ${x.rssi}</div></div>`;
 }).join('');
}
tick();setInterval(tick,2000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/api/reports"):
            with LOCK:
                body = json.dumps(REPORTS).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(PAGE.encode())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("serial", nargs="?", default=None)
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    if args.demo:
        threading.Thread(target=demo_feeder, daemon=True).start()
    elif args.serial:
        threading.Thread(target=serial_reader, args=(args.serial,), daemon=True).start()
    else:
        print("Aviso: sin puerto serial ni --demo. El tablero abre vacio.")

    srv = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    print(f"Tablero en http://localhost:{args.port}  (Ctrl+C para salir)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nFin.")


if __name__ == "__main__":
    main()
