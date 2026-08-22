#!/usr/bin/env python3
"""
Centro de operaciones - tablero en vivo del OS de emergencias.
Lee el gateway LoRa por serial y muestra:
  - Cola de SOLICITUDES priorizada (pri 0 = vida en riesgo primero) con mapa y estado.
  - Lista de PERSONAS A SALVO con datos identificables, buscable por nombre o documento.

El estado de cada solicitud (despacho -> aceptacion -> resuelta) se opera desde el
tablero. Mientras no exista un nodo fisico de operador, el centro SIMULA al operador
con los botones Despachar / Aceptar / Resolver.

Lineas que emite el gateway:
  SOS|node|cat|pri|lat|lon|lugar|detalle|seq|RSSI:x|SNR:y
  SALVO|node|nombre|doc|lat|lon|lugar|seq|RSSI:x|SNR:y

Requisitos: pip install pyserial   (o: pip install pyserial --break-system-packages)
Uso:
    python3 center.py <puerto_serial> [--port 8080]
    python3 center.py --demo
"""
import sys
import json
import threading
import time
import argparse
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REQUESTS = []      # solicitudes de ayuda (SOS)
SAFE = []          # personas a salvo (OK)
LOCK = threading.Lock()
_next_id = [1]

ESTADOS = ["PENDIENTE", "DESPACHADA", "ACEPTADA", "EN_CURSO", "RESUELTA", "CANCELADA"]


def add_request(node, cat, pri, lat, lon, lugar, detalle, rssi, snr, seq):
    with LOCK:
        # idempotencia: mismo node+seq no se duplica
        for r in REQUESTS:
            if r["node"] == node and r["seq"] == seq:
                return
        rid = _next_id[0]; _next_id[0] += 1
        REQUESTS.append({
            "id": rid, "node": node, "cat": cat, "pri": int(pri) if str(pri).isdigit() else 2,
            "lat": lat, "lon": lon, "lugar": lugar, "detalle": detalle,
            "rssi": rssi, "snr": snr, "seq": seq, "estado": "PENDIENTE", "t": time.time(),
        })
        print(f"[SOS] #{rid} {cat} pri={pri} {node} @({lat},{lon}) '{detalle}'")


def add_safe(node, nombre, doc, lat, lon, lugar, rssi, snr, seq):
    with LOCK:
        for s in SAFE:
            if s["node"] == node and s["seq"] == seq:
                return
        SAFE.append({
            "node": node, "nombre": nombre, "doc": doc, "lat": lat, "lon": lon,
            "lugar": lugar, "rssi": rssi, "snr": snr, "seq": seq, "t": time.time(),
        })
        print(f"[A SALVO] {nombre} ({doc}) {node} @({lat},{lon})")


def set_estado(rid, estado):
    with LOCK:
        for r in REQUESTS:
            if r["id"] == rid:
                r["estado"] = estado
                print(f"[ESTADO] solicitud #{rid} -> {estado}")
                return True
    return False


def parse_line(line):
    p = line.split("|")
    if line.startswith("SOS|") and len(p) >= 11:
        # SOS|node|cat|pri|lat|lon|lugar|detalle|seq|RSSI:x|SNR:y
        add_request(p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8],
                    p[9].replace("RSSI:", "").strip(), p[10].replace("SNR:", "").strip())
    elif line.startswith("SALVO|") and len(p) >= 10:
        # SALVO|node|nombre|doc|lat|lon|lugar|seq|RSSI:x|SNR:y
        add_safe(p[1], p[2], p[3], p[4], p[5], p[6], p[7],
                 p[8].replace("RSSI:", "").strip(), p[9].replace("SNR:", "").strip())


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
    add_request("a3f21c", "RESCATE", "0", "4.6767", "-74.0483", "-", "2 atrapados sotano", "-45", "9.5", "1")
    add_request("b1c2d3", "MEDICO", "0", "4.6712", "-74.0530", "-", "herido inconsciente", "-70", "7.0", "1")
    add_request("a3f21c", "GRUA", "1", "", "", "Portal 80 con calle 13", "carro sobre persona", "-52", "8.0", "2")
    add_request("c4d5e6", "AGUA", "3", "4.6801", "-74.0455", "-", "familia 4 personas", "-88", "6.2", "1")
    add_safe("d7e8f9", "Juan Perez", "CC1032456", "4.6790", "-74.0470", "apto 402", "-40", "9.8", "1")


PAGE = """<!doctype html><html lang='es'><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Puesto de mando</title>
<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>
<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>
<style>
body{font-family:-apple-system,Arial,sans-serif;margin:0;background:#0f1115;color:#e7e9ee}
.hdr{background:#d92d20;padding:12px 18px}.hdr h1{margin:0;font-size:19px;color:#fff}
.counts{display:flex;gap:8px;padding:10px 18px;flex-wrap:wrap}
.pill{background:#1a1d24;border:1px solid #2a2f3a;border-radius:10px;padding:8px 12px;min-width:74px}
.pill b{display:block;font-size:20px}.pill span{font-size:11px;color:#9aa2b1}
#map{height:40vh;margin:0 18px;border-radius:10px}
.cols{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;padding:12px 18px 24px}
@media(max-width:840px){.cols{grid-template-columns:1fr}}
h2{font-size:14px;color:#9aa2b1;margin:6px 0}
.card{background:#1a1d24;border-left:6px solid #444;border-radius:10px;padding:10px 12px;margin-bottom:10px}
.tipo{font-weight:700;font-size:14px}.det{color:#c7ccd6;margin:4px 0;font-size:13px}
.meta{color:#8a93a3;font-size:11px}.fresh{outline:2px solid #f79009}
.estado{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#2a2f3a;color:#e7e9ee}
.btn{border:0;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;color:#fff;margin:6px 6px 0 0;cursor:pointer}
.bd{background:#1570ef}.ba{background:#7a5af8}.br{background:#067647}.bx{background:#8a93a3}
.pri0{border-left-color:#d92d20}.pri1{border-left-color:#f79009}.pri2{border-left-color:#1570ef}.pri3{border-left-color:#067647}
.safe{background:#12241a;border-left:6px solid #067647;border-radius:10px;padding:9px 12px;margin-bottom:8px}
.safe b{font-size:14px}.safe .doc{color:#7fd3a3;font-size:12px}
input.q{width:100%;padding:9px;border-radius:8px;border:1px solid #2a2f3a;background:#0f1115;color:#e7e9ee;box-sizing:border-box}
.empty{padding:16px;text-align:center;color:#8a93a3}
</style></head><body>
<div class='hdr'><h1>PUESTO DE MANDO - OS de emergencias</h1></div>
<div class='counts' id='counts'></div>
<div id='map'></div>
<div class='cols'>
 <div><h2>SOLICITUDES (prioridad primero)</h2><div id='reqs'></div></div>
 <div><h2>PERSONAS A SALVO</h2><input class='q' id='q' placeholder='Buscar por nombre o documento...' oninput='render()'><div id='safe'></div></div>
</div>
<script>
const CATS={RESCATE:['Rescate','#d92d20'],MEDICO:['Medico','#f04438'],GRUA:['Grua','#f79009'],AGUA:['Agua/comida','#1570ef'],FUEGO:['Fuego','#b42318']};
const NEXT={PENDIENTE:['Despachar','DESPACHADA','bd'],DESPACHADA:['Aceptar','ACEPTADA','ba'],ACEPTADA:['En curso','EN_CURSO','ba'],EN_CURSO:['Resolver','RESUELTA','br']};
let DATA={requests:[],safe:[]};
let map=L.map('map').setView([4.6767,-74.0483],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'OSM'}).addTo(map);
let markers=[];
function ago(t){const s=Math.floor(Date.now()/1000-t);if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';return Math.floor(s/3600)+'h';}
async function act(id,estado){await fetch('/api/estado?id='+id+'&estado='+estado,{method:'POST'});tick();}
function render(){
 let d=DATA.requests.slice().sort((a,b)=>a.pri-b.pri||a.t-b.t);
 let c={};d.forEach(x=>c[x.cat]=(c[x.cat]||0)+1);
 let abiertas=d.filter(x=>x.estado!=='RESUELTA'&&x.estado!=='CANCELADA').length;
 document.getElementById('counts').innerHTML=
   `<div class='pill'><b>${d.length}</b><span>solicitudes</span></div>`+
   `<div class='pill'><b>${abiertas}</b><span>abiertas</span></div>`+
   `<div class='pill'><b>${DATA.safe.length}</b><span>a salvo</span></div>`+
   Object.keys(CATS).map(k=>`<div class='pill'><b>${c[k]||0}</b><span>${CATS[k][0]}</span></div>`).join('');
 markers.forEach(m=>map.removeLayer(m));markers=[];
 d.forEach(x=>{let la=parseFloat(x.lat),lo=parseFloat(x.lon);if(isNaN(la)||isNaN(lo))return;
   let ci=CATS[x.cat]||[x.cat,'#888'];
   let m=L.circleMarker([la,lo],{radius:10,color:ci[1],fillColor:ci[1],fillOpacity:.8})
     .bindPopup(`<b style='color:${ci[1]}'>${ci[0]} (pri ${x.pri})</b><br>${x.detalle||'-'}<br><small>${x.estado} · nodo ${x.node}</small>`);
   m.addTo(map);markers.push(m);});
 let g=document.getElementById('reqs');
 g.innerHTML=d.length?d.map(x=>{
   let ci=CATS[x.cat]||[x.cat,'#888'];let fresh=(Date.now()/1000-x.t)<20?'fresh':'';
   let n=NEXT[x.estado];
   let botones=n?`<button class='btn ${n[2]}' onclick="act(${x.id},'${n[1]}')">${n[0]}</button>`:'';
   if(x.estado!=='RESUELTA'&&x.estado!=='CANCELADA')botones+=`<button class='btn bx' onclick="act(${x.id},'CANCELADA')">Cancelar</button>`;
   let loc=(x.lat&&x.lon)?`${x.lat},${x.lon}`:(x.lugar||'sin ubicacion');
   return `<div class='card pri${x.pri} ${fresh}'>
     <div class='tipo' style='color:${ci[1]}'>#${x.id} ${ci[0]} · pri ${x.pri} <span class='estado'>${x.estado}</span></div>
     <div class='det'>${x.detalle||'-'}</div>
     <div class='meta'>${loc} · nodo ${x.node} · hace ${ago(x.t)} · RSSI ${x.rssi}</div>
     ${botones}</div>`;
 }).join(''):"<div class='empty'>Sin solicitudes. Esperando la red...</div>";
 let q=(document.getElementById('q').value||'').toLowerCase();
 let s=DATA.safe.filter(x=>!q||(x.nombre||'').toLowerCase().includes(q)||(x.doc||'').toLowerCase().includes(q));
 document.getElementById('safe').innerHTML=s.length?s.map(x=>{
   let loc=(x.lat&&x.lon)?`${x.lat},${x.lon}`:(x.lugar||'sin ubicacion');
   return `<div class='safe'><b>${x.nombre||'(sin nombre)'}</b> <span class='doc'>${x.doc||''}</span>
     <div class='meta'>${loc} · nodo ${x.node} · hace ${ago(x.t)}</div></div>`;
 }).join(''):"<div class='empty'>Nadie reportado a salvo aun.</div>";
}
async function tick(){let r=await fetch('/api/state');DATA=await r.json();render();}
tick();setInterval(tick,2000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/state"):
            with LOCK:
                self._json({"requests": list(REQUESTS), "safe": list(SAFE)})
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(PAGE.encode())

    def do_POST(self):
        if self.path.startswith("/api/estado"):
            q = parse_qs(urlparse(self.path).query)
            rid = int(q.get("id", [0])[0]); estado = q.get("estado", [""])[0]
            ok = estado in ESTADOS and set_estado(rid, estado)
            self._json({"ok": bool(ok)})
        else:
            self.send_response(404); self.end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("serial", nargs="?", default=None)
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    if args.demo:
        demo_feeder()
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
