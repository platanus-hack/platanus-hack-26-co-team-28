#!/usr/bin/env python3
"""Offline command center: serial LoRa gateway, SQLite and local dashboard."""

import argparse
import json
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from command_core import CenterStore, RadioFrame, clean_field
from triage import triage_request, triage_requests


STORE = None
GATEWAY = None

# Feed de mensajes LoRa en vivo (rescatista -> centro -> recurso y de vuelta).
RADIO_LOG = deque(maxlen=60)
RADIO_LOCK = threading.Lock()

# Simulacion del nodo grua/operador (sin 3ra placa fisica). El operador usa la
# vista /grua; sus acciones inyectan frames como si vinieran por LoRa del recurso.
GRUA_MSGID = [5000]
SIM_RESOURCES = set()   # recursos simulados "conectados" (ej GRUA07)


def grua_inject(origin, kind, payload):
    """Inyecta un frame del recurso simulado en el store, como haria el gateway real."""
    mid = GRUA_MSGID[0]; GRUA_MSGID[0] += 1
    frame = RadioFrame(origin, "CENTRO", kind, mid, tuple(str(p) for p in payload))
    result = STORE.ingest(frame, "-60", "8.0")
    log_radio("RX", origin, "CENTRO", kind, mid, rssi="-60", snr="8.0")
    return result


def log_radio(direction, origin, destination, kind, message_id, note="", rssi=None, snr=None):
    """Registra un mensaje que cruza el centro. direction: RX (llega) o TX (sale)."""
    with RADIO_LOCK:
        RADIO_LOG.append({
            "dir": direction, "from": origin, "to": destination,
            "kind": kind, "id": str(message_id), "note": note,
            "rssi": rssi, "snr": snr, "t": time.time(),
        })
    arrow = "<-" if direction == "RX" else "->"
    extra = f" RSSI={rssi}" if rssi is not None else ""
    print(f"[RADIO {direction}] {origin} {arrow} {destination} {kind} id={message_id}{extra} {note}".rstrip())


class SerialGateway:
    """Owns the bidirectional serial seam and correlates directed ACKs."""

    emits_tx_sent = True   # el firmware imprime TX_SENT al transmitir

    def __init__(self, port, on_line, baud=115200):
        self.port = port
        self.baud = baud
        self.on_line = on_line
        self._serial = None
        self._write_lock = threading.Lock()
        self._pending_lock = threading.Lock()
        self._pending = {}
        self._connected = False

    @property
    def connected(self):
        return self._connected

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        try:
            import serial
        except ImportError:
            print("Falta pyserial. Instala: pip install pyserial")
            return
        while True:
            try:
                connection = serial.Serial(self.port, self.baud, timeout=0.2)
                with self._write_lock:
                    self._serial = connection
                    self._connected = True
                print(f"Gateway conectado en {self.port} @ {self.baud}")
                while True:
                    raw = connection.readline().decode(errors="ignore").strip()
                    if raw:
                        self.on_line(raw)
            except Exception as exc:
                print(f"Gateway no disponible: {exc}. Reintento en 2 s...")
                with self._write_lock:
                    self._connected = False
                    if self._serial:
                        try:
                            self._serial.close()
                        except Exception:
                            pass
                    self._serial = None
                time.sleep(2)

    def _write(self, frame):
        command = f"TX|{frame.encode()}\n".encode()
        with self._write_lock:
            if not self._serial or not self._connected:
                return False
            try:
                self._serial.write(command)
                self._serial.flush()
                return True
            except Exception:
                self._connected = False
                return False

    def notify_ack(self, origin, destination, message_id):
        if destination != "CENTRO":
            return
        with self._pending_lock:
            event = self._pending.get((origin, message_id))
        if event:
            event.set()

    def send_reliable(self, frame, attempts=3, timeout=1.6):
        key = (frame.destination, frame.message_id)
        event = threading.Event()
        with self._pending_lock:
            self._pending[key] = event
        try:
            for attempt in range(attempts):
                if not self._write(frame):
                    return False, "GATEWAY_OFFLINE"
                if event.wait(timeout):
                    return True, "DELIVERED"
                if attempt + 1 < attempts:
                    time.sleep(0.15 * (attempt + 1))
            return False, "UNCONFIRMED"
        finally:
            with self._pending_lock:
                self._pending.pop(key, None)

    def send_broadcast(self, frame, repeats=3):
        if not self.connected:
            return False
        for index in range(repeats):
            if not self._write(frame):
                return False
            if index + 1 < repeats:
                time.sleep(0.45)
        return True


class DemoGateway:
    """Radio adapter for exercising operational flows without hardware."""

    connected = True
    emits_tx_sent = False   # sin firmware; el TX se registra desde el endpoint

    def send_reliable(self, _frame, attempts=3, timeout=1.6):
        return True, "DEMO_DELIVERED"

    def send_broadcast(self, _frame, repeats=3):
        return True


def split_gateway_rx(line):
    if not line.startswith("RX|") or "|RSSI:" not in line or "|SNR:" not in line:
        raise ValueError("not a structured RX line")
    frame_and_rssi, snr = line[3:].rsplit("|SNR:", 1)
    raw_frame, rssi = frame_and_rssi.rsplit("|RSSI:", 1)
    return RadioFrame.parse(raw_frame), rssi.strip(), snr.strip()


def handle_gateway_line(line):
    if line.startswith("ACK|"):
        parts = line.split("|")
        if len(parts) >= 4:
            log_radio("RX", parts[1], parts[2], "ACK", parts[3])
            try:
                GATEWAY.notify_ack(parts[1], parts[2], int(parts[3]))
            except ValueError:
                pass
        return
    if line.startswith("RX|"):
        try:
            frame, rssi, snr = split_gateway_rx(line)
        except ValueError as exc:
            print(f"[RX INVALIDO] {exc}: {line}")
            return
        # El feed muestra SIEMPRE el mensaje con su RSSI (sirve de prueba de rango).
        log_radio("RX", frame.origin, frame.destination, frame.kind, frame.message_id,
                  rssi=rssi, snr=snr)
        try:
            result = STORE.ingest(frame, rssi, snr)
            print(f"[RX] {frame.kind} {frame.origin} id={frame.message_id}: {result}")
        except Exception as exc:
            # Tipos que el store no maneja (ej PING de rango) igual salen en el feed.
            print(f"[RX no ingerido] {frame.kind}: {exc}")
        return
    if line.startswith("TX_SENT|"):
        # El gateway confirma que transmitio por radio: TX_SENT|origin|dest|kind|msgid
        parts = line.split("|")
        if len(parts) >= 5:
            log_radio("TX", parts[1], parts[2], parts[3], parts[4])
        return
    if line.startswith("RX_DUPLICATE|"):
        parts = line.split("|")
        if len(parts) >= 3:
            log_radio("RX", parts[1], "CENTRO", "DUP", parts[2], note="duplicado")
        return
    if line.startswith(("TX_ERROR|", "RADIO_ERROR|")):
        print(f"[GATEWAY] {line}")


def seed_demo(store):
    frames = [
        "CIVIL1|CENTRO|SOS|1|RESCATE|1|4.6767|-74.0483|-|2 atrapados sotano",
        "CIVIL2|CENTRO|SOS|1|MEDICO|2|4.6712|-74.0530|-|herido inconsciente",
        "CIVIL3|CENTRO|SOS|1|GRUA|2|||Portal 80 con calle 13|vehiculo bloqueando via",
        "CIVIL4|CENTRO|SOS|1|AGUA|3|||Colegio central|familia sin agua",
        "CIVIL5|CENTRO|OK|1|Juan Perez|CC1032456|4.6790|-74.0470|apto 402",
        "GRUA07|CENTRO|HB|1|GRUA|NORTE|-|1",
        "GRUA07|CENTRO|POS|2|4.6752|-74.0491|12|0|disponible",
        "MEDICO01|CENTRO|HB|1|MEDICO|NORTE|-|1",
        "MEDICO01|CENTRO|POS|2|4.6720|-74.0522|8|0|disponible",
        "RESCATE01|CENTRO|HB|1|RESCATE|NORTE|-|1",
        "RESCATE01|CENTRO|POS|2|4.6770|-74.0480|10|0|disponible",
        "AGUA01|CENTRO|HB|1|AGUA|CENTRO|-|1",
        "AGUA01|CENTRO|POS|2|4.6740|-74.0500|15|0|disponible",
    ]
    for raw in frames:
        frame = RadioFrame.parse(raw)
        store.ingest(frame, "-55", "8.5")
        log_radio("RX", frame.origin, frame.destination, frame.kind, frame.message_id)
    # eventos de vuelta para ilustrar el feed centro -> recurso -> centro
    log_radio("TX", "CENTRO", "GRUA07", "DISP", "1001")
    log_radio("RX", "GRUA07", "CENTRO", "ACK", "1001")
    log_radio("RX", "GRUA07", "CENTRO", "STATUS", "3")


PAGE = r"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Command Center LoRa</title>
<style>
:root{--canvas:#fff;--paper:#f5f5f5;--border:#e5e5e5;--text:#171717;--muted:#737373;--blue:#1e40af;--critical:#b42318;--warning:#b54708;--success:#067647}
*{box-sizing:border-box}body{margin:0;font:14px Inter,system-ui,sans-serif;background:var(--paper);color:var(--text)}button,input,select{font:inherit}.shell{display:grid;grid-template-columns:210px 1fr;min-height:100vh}.side{background:#fff;border-right:1px solid var(--border);padding:18px 12px}.brand{font-weight:700;font-size:16px;padding:4px 8px 20px}.nav{padding:10px 12px;border-radius:8px;margin:3px 0}.nav.on{background:#dbeafe;color:var(--blue);font-weight:600}.main{padding:16px;min-width:0}.top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.top h1{font-size:22px;margin:0 auto 0 0}.badge{border-radius:999px;padding:6px 10px;background:#fff;border:1px solid var(--border);font-size:12px}.ok{color:var(--success)}.bad{color:var(--critical)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}.card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px}.metric b{font-size:24px;display:block}.metric span,.muted{color:var(--muted);font-size:12px}.layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(320px,.8fr);gap:8px}.map{height:390px;position:relative;overflow:hidden;background-color:#fafafa;background-image:linear-gradient(#e5e5e5 1px,transparent 1px),linear-gradient(90deg,#e5e5e5 1px,transparent 1px);background-size:32px 32px}.map:after{content:'Esquema offline · cartografía local pendiente';position:absolute;left:12px;bottom:10px;color:var(--muted);font-size:11px}.dot{position:absolute;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px #aaa}.dot.req{background:var(--critical)}.dot.res{background:var(--success)}h2{font-size:15px;margin:0 0 10px}.queue{max-height:390px;overflow:auto}.row{border-top:1px solid var(--border);padding:10px 0}.row:first-child{border-top:0}.rowhead{display:flex;gap:6px;align-items:center}.pill{border-radius:999px;padding:3px 7px;background:#f5f5f5;font-size:11px}.p0{color:var(--critical);background:#fef3f2}.p1{color:var(--warning);background:#fffaeb}.actions{display:flex;gap:6px;margin-top:8px}.btn{border:1px solid var(--border);background:#fff;padding:7px 10px;border-radius:8px;cursor:pointer}.primary{background:var(--blue);border-color:var(--blue);color:#fff}.broadcast{margin-top:8px}.broadcast textarea{width:100%;min-height:62px;border:1px solid #aaa;border-radius:6px;padding:8px}.broadcast .controls{display:flex;gap:6px;margin-top:6px}.broadcast select{border:1px solid var(--border);border-radius:8px;padding:7px;background:#fff}.below{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.list{max-height:260px;overflow:auto}.evt{display:flex;align-items:center;gap:8px;border-top:1px solid var(--border);padding:8px 0;font-size:13px}.evt:first-child{border-top:0}.evt.fresh{background:#fffaeb}.evt .hora{color:var(--muted);font-size:11px;min-width:58px}.evt .who{font-weight:600}.evt .arw{color:var(--muted)}.evt .tag{margin-left:auto;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;background:#f5f5f5}.tag.SOS{color:var(--critical);background:#fef3f2}.tag.ACK{color:var(--blue);background:#dbeafe}.tag.DISP{color:#6d28d9;background:#ede9fe}.tag.BC{color:var(--warning);background:#fffaeb}.tag.STATUS,.tag.POS,.tag.HB{color:var(--success);background:#ecfdf3}.who.Rescatista{color:var(--critical)}.who.Centro{color:var(--blue)}.who.Recurso{color:#6d28d9}@media(max-width:900px){.shell{grid-template-columns:1fr}.side{display:none}.layout,.below{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}}
</style></head><body><div class="shell"><aside class="side"><div class="brand">Command Center</div><div class="nav on">Resumen</div><div class="nav">Mapa</div><div class="nav">Reportes</div><div class="nav">Recursos</div><div class="nav">Zonas</div><div class="nav">Broadcast</div><div class="nav">Red LoRa</div></aside><main class="main"><div class="top"><h1>Situación operacional</h1><span id="gateway" class="badge">Gateway</span><span class="badge">Modo offline</span><span id="clock" class="badge"></span></div><div id="metrics" class="metrics"></div><div class="layout"><div id="map" class="card map"></div><div class="card"><h2>Cola priorizada</h2><div id="requests" class="queue"></div></div></div><div class="card" style="margin-top:8px"><h2>Red LoRa · mensajes en vivo</h2><div id="radiofeed" class="list" style="max-height:240px"></div></div><div class="below"><div class="card"><h2>Recursos</h2><div id="resources" class="list"></div></div><div><div class="card broadcast"><h2>Broadcast</h2><textarea id="bcmsg" maxlength="80" placeholder="Mensaje corto para los recursos"></textarea><div class="controls"><select id="scope"><option value="ALL">Todos</option><option value="ZONE:NORTE">Zona Norte</option></select><select id="priority"><option>NORMAL</option><option>URGENT</option></select><button class="btn primary" onclick="broadcastMsg()">Revisar y enviar</button></div><div id="bcstatus" class="muted" style="margin-top:8px"></div></div><div class="card" style="margin-top:8px"><h2>Personas a salvo</h2><div id="safe" class="list"></div></div></div></div></main></div>
<script>
let DATA={requests:[],safe:[],resources:[],broadcasts:[],gateway:false};const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ago(t){let s=Math.max(0,Date.now()/1000-t);return s<60?Math.floor(s)+'s':s<3600?Math.floor(s/60)+'m':Math.floor(s/3600)+'h'}
function rol(id){id=String(id||'');if(id==='CENTRO')return'Centro';if(/GRUA|OPER|RES|BOMB|AMBU/i.test(id))return'Recurso';if(id==='BCAST')return'Todos';return'Rescatista'}
function hhmm(t){let d=new Date(t*1000),p=n=>('0'+n).slice(-2);return p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())}
function renderRadio(){let evs=DATA.radio||[],box=document.getElementById('radiofeed');if(!box)return;if(!evs.length){box.innerHTML='<p class="muted">Sin tráfico de radio todavía.</p>';return}box.innerHTML=evs.slice(-14).reverse().map(x=>{let a=rol(x.from),b=rol(x.to),fresh=(Date.now()/1000-x.t)<6?'fresh':'',note=x.note?` <span class="muted">(${e(x.note)})</span>`:'',rssi=(x.rssi!=null&&x.rssi!=='')?` <span class="muted">RSSI ${e(x.rssi)}</span>`:'';return `<div class="evt ${fresh}"><span class="hora">${hhmm(x.t)}</span><span class="who ${a}">${a}</span><span class="arw">&#8594;</span><span class="who ${b}">${b}</span>${note}${rssi}<span class="tag ${e(x.kind)}">${e(x.kind)} #${e(x.id)}</span></div>`}).join('')}
function plot(){let all=[...DATA.requests.filter(x=>x.lat&&x.lon).map(x=>({...x,k:'req'})),...DATA.resources.filter(x=>x.lat&&x.lon).map(x=>({...x,k:'res'}))];let map=document.getElementById('map');map.querySelectorAll('.dot').forEach(x=>x.remove());if(!all.length)return;let la=all.map(x=>+x.lat),lo=all.map(x=>+x.lon),minla=Math.min(...la)-.002,maxla=Math.max(...la)+.002,minlo=Math.min(...lo)-.002,maxlo=Math.max(...lo)+.002;all.forEach(x=>{let d=document.createElement('div');d.className='dot '+x.k;d.style.left=(8+84*((+x.lon-minlo)/(maxlo-minlo)))+'%';d.style.top=(8+78*(1-(+x.lat-minla)/(maxla-minla)))+'%';d.title=x.k==='req'?'Reporte '+x.id:x.node;map.appendChild(d)})}
function render(){let open=DATA.requests.filter(x=>!['RESUELTA','CANCELADA'].includes(x.estado)),critical=open.filter(x=>x.pri===0),unassigned=open.filter(x=>x.estado==='PENDIENTE');metrics.innerHTML=[[critical.length,'Críticos'],[unassigned.length,'Sin asignar'],[DATA.resources.length,'Recursos'],[DATA.requests.length,'Reportes']].map(x=>`<div class="card metric"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');gateway.textContent=DATA.gateway?'Gateway conectado':'Gateway desconectado';gateway.className='badge '+(DATA.gateway?'ok':'bad');requests.innerHTML=open.length?open.map(x=>`<div class="row"><div class="rowhead"><b>#${x.id} ${e(x.cat)}</b><span class="pill p${x.pri}">Prioridad ${x.pri}</span><span class="pill">${e(x.estado)}</span></div><div>${e(x.detalle||x.lugar||'Sin detalle')}</div><div class="muted">${e(x.node)} · hace ${ago(x.t)} · ${e(x.operador||'sin recurso')}</div>${x.estado==='PENDIENTE'?`<div class="actions"><button class="btn primary" onclick="dispatch(${x.id})">Asignar recurso</button></div>`:''}</div>`).join(''):'<p class="muted">Sin solicitudes abiertas.</p>';resources.innerHTML=DATA.resources.length?DATA.resources.map(x=>`<div class="row"><b>${e(x.node)}</b> · ${e(x.kind)} <span class="pill">${e(x.state)}</span><div class="muted">Zona ${e(x.zone)} · visto hace ${ago(x.last_seen)}</div></div>`).join(''):'<p class="muted">Sin recursos registrados.</p>';safe.innerHTML=DATA.safe.length?DATA.safe.map(x=>`<div class="row"><b>${e(x.nombre)}</b><div class="muted">${e(x.doc)} · hace ${ago(x.t)}</div></div>`).join(''):'<p class="muted">Sin registros.</p>';let b=DATA.broadcasts[0];bcstatus.textContent=b?`Último: ${b.message} · ${b.received_count} confirmaciones técnicas`:'Sin broadcasts enviados';renderRadio();plot()}
async function dispatch(id){let resource=prompt('ID del nodo recurso','GRUA07');if(!resource)return;if(!confirm('¿Asignar la solicitud #'+id+' a '+resource+'?'))return;let r=await fetch('/api/dispatch?id='+id+'&resource='+encodeURIComponent(resource),{method:'POST'}),d=await r.json();if(!r.ok)alert(d.error||'No se pudo entregar');tick()}
async function broadcastMsg(){let message=bcmsg.value.trim();if(!message)return alert('Escribe un mensaje');let s=scope.value,p=priority.value;if(!confirm(`Enviar a ${s}: ${message}`))return;let r=await fetch('/api/broadcast?scope='+encodeURIComponent(s)+'&priority='+p+'&message='+encodeURIComponent(message),{method:'POST'}),d=await r.json();if(!r.ok)alert(d.error||'No se pudo transmitir');else{alert('Broadcast transmitido; confirmaciones llegarán de forma escalonada');bcmsg.value=''}}
async function tick(){try{DATA=await(await fetch('/api/state')).json();render()}catch(e){gateway.textContent='Centro sin respuesta';gateway.className='badge bad'}}clock.textContent=new Date().toLocaleTimeString();setInterval(()=>clock.textContent=new Date().toLocaleTimeString(),1000);tick();setInterval(tick,3000);
</script></body></html>"""


GRUA_PAGE = r"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Grua GRUA07</title>
<style>
*{box-sizing:border-box}body{margin:0;font:16px system-ui,sans-serif;background:#0b0f14;color:#e7e9ee}
.hd{background:#1570ef;padding:16px;text-align:center}.hd h1{margin:0;font-size:20px}
.hd .st{font-size:13px;opacity:.9;margin-top:4px}
.wrap{max-width:520px;margin:0 auto;padding:14px}
.conn{width:100%;padding:14px;border:0;border-radius:12px;background:#067647;color:#fff;font-size:17px;font-weight:700;margin-bottom:12px}
.card{background:#141a22;border:1px solid #232c39;border-radius:14px;padding:16px;margin-bottom:12px}
.cat{font-size:18px;font-weight:800}.p0{color:#ff6b6b}.p1{color:#ffb454}
.meta{color:#8a93a3;font-size:13px;margin:6px 0}
.loc{font-size:14px;margin:6px 0}
.estado{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;background:#232c39}
.btn{width:100%;padding:15px;border:0;border-radius:12px;font-size:17px;font-weight:700;color:#fff;margin-top:10px}
.acc{background:#067647}.enr{background:#1570ef}.lug{background:#7c3aed}.res{background:#b45309}.can{background:#3a3f4a}
.empty{color:#8a93a3;text-align:center;padding:30px}
</style></head><body>
<div class="hd"><h1>App del operador · GRUA07</h1><div class="st" id="st">desconectado</div></div>
<div class="wrap">
<button class="conn" id="conn" onclick="conectar()">Conectar mi grua (entrar en servicio)</button>
<div id="list"></div>
</div>
<script>
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let connected=false;
async function conectar(){await fetch('/api/grua/connect?node=GRUA07&kind=GRUA&zone=NORTE',{method:'POST'});connected=true;document.getElementById('st').textContent='en servicio · esperando asignaciones';document.getElementById('conn').style.display='none';tick()}
async function accept(n,s){await fetch('/api/grua/accept?resource=GRUA07&node='+encodeURIComponent(n)+'&seq='+encodeURIComponent(s),{method:'POST'});tick()}
async function status(n,s,est){await fetch('/api/grua/status?resource=GRUA07&node='+encodeURIComponent(n)+'&seq='+encodeURIComponent(s)+'&estado='+est,{method:'POST'});tick()}
function acciones(x){
 let n=x.node,s=x.seq;
 if(x.estado==='DESPACHADA')return `<button class="btn acc" onclick="accept('${e(n)}','${e(s)}')">Aceptar el viaje</button>`;
 if(x.estado==='ACEPTADA')return `<button class="btn enr" onclick="status('${e(n)}','${e(s)}','enruta')">Voy en camino</button>`;
 if(x.estado==='EN_CURSO')return `<button class="btn lug" onclick="status('${e(n)}','${e(s)}','enlugar')">Llegue al lugar</button><button class="btn res" onclick="status('${e(n)}','${e(s)}','resuelta')">Rescate resuelto</button>`;
 return '';
}
async function tick(){
 let d;try{d=await(await fetch('/api/state')).json()}catch(_){return}
 let mine=(d.requests||[]).filter(x=>x.operador==='GRUA07'&&!['RESUELTA','CANCELADA'].includes(x.estado));
 let box=document.getElementById('list');
 if(!connected){box.innerHTML='<div class="empty">Toca el boton verde para entrar en servicio.</div>';return}
 if(!mine.length){box.innerHTML='<div class="empty">En servicio. Sin asignaciones por ahora.</div>';return}
 box.innerHTML=mine.map(x=>{let loc=(x.lat&&x.lon)?(x.lat+', '+x.lon):(x.lugar||'sin ubicacion');
  return `<div class="card"><div class="cat p${x.pri}">${e(x.cat)} · prioridad ${x.pri}</div>
   <div class="loc">📍 ${e(loc)}</div><div class="meta">${e(x.detalle||'-')} · de ${e(x.node)}</div>
   <span class="estado">${e(x.estado)}</span>${acciones(x)}</div>`}).join('')
}
tick();setInterval(tick,2000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def send_json(self, status, value):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/state"):
            state = STORE.state()
            state["requests"] = triage_requests(state["requests"], state["resources"])
            state["gateway"] = bool(GATEWAY and GATEWAY.connected)
            with RADIO_LOCK:
                state["radio"] = list(RADIO_LOG)
            self.send_json(200, state)
            return
        if self.path.startswith("/grua"):
            body = GRUA_PAGE.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = PAGE.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        query = parse_qs(urlparse(self.path).query)
        # --- Simulacion del operador de grua (nodo recurso sin 3ra placa) ---
        if self.path.startswith("/api/grua/connect"):
            node = clean_field(query.get("node", ["GRUA07"])[0], 24) or "GRUA07"
            kind = clean_field(query.get("kind", ["GRUA"])[0], 24) or "GRUA"
            zone = clean_field(query.get("zone", ["NORTE"])[0], 24) or "NORTE"
            SIM_RESOURCES.add(node)
            grua_inject(node, "HB", (kind, zone))
            self.send_json(200, {"ok": True, "node": node})
            return
        if self.path.startswith("/api/grua/accept"):
            node = clean_field(query.get("node", [""])[0], 24)          # nodo civil de la solicitud
            seq = clean_field(query.get("seq", [""])[0], 12)
            resource = clean_field(query.get("resource", ["GRUA07"])[0], 24) or "GRUA07"
            result = grua_inject(resource, "ACC", (node, seq))
            self.send_json(200 if result == "UPDATED" else 409, {"ok": result == "UPDATED", "result": result})
            return
        if self.path.startswith("/api/grua/status"):
            node = clean_field(query.get("node", [""])[0], 24)
            seq = clean_field(query.get("seq", [""])[0], 12)
            estado = clean_field(query.get("estado", [""])[0], 16)
            resource = clean_field(query.get("resource", ["GRUA07"])[0], 24) or "GRUA07"
            result = grua_inject(resource, "ST", (node, seq, estado))
            self.send_json(200 if result == "UPDATED" else 409, {"ok": result == "UPDATED", "result": result})
            return
        if self.path.startswith("/api/dispatch"):
            reserved = False
            try:
                request_id = int(query.get("id", ["0"])[0])
                resource = clean_field(query.get("resource", [""])[0], 24)
                state = STORE.state()
                request = next((item for item in state["requests"] if item["id"] == request_id), None)
                if not request:
                    raise ValueError("request not found")
                priority = triage_request(request, state["resources"])["priority"]
                frame, _request = STORE.reserve_dispatch(request_id, resource, priority)
                reserved = True
                delivered, result = GATEWAY.send_reliable(frame) if GATEWAY else (False, "GATEWAY_OFFLINE")
                # Grua simulada: sin 3ra placa no hay ACK de radio; si el recurso esta
                # "conectado" como simulado, damos por entregado el despacho.
                if not delivered and resource in SIM_RESOURCES:
                    delivered, result = True, "SIM_DELIVERED"
                if not delivered:
                    self.send_json(503, {"ok": False, "error": result})
                    return
                STORE.mark_dispatched(request_id, resource, frame)
                if GATEWAY and not getattr(GATEWAY, "emits_tx_sent", False):
                    log_radio("TX", frame.origin, frame.destination, frame.kind, frame.message_id)
                reserved = False
                self.send_json(200, {"ok": True, "messageId": frame.message_id})
            except (ValueError, TypeError) as exc:
                self.send_json(409, {"ok": False, "error": str(exc)})
            finally:
                if reserved:
                    STORE.release_dispatch(request_id, resource)
            return
        if self.path.startswith("/api/broadcast"):
            message = clean_field(query.get("message", [""])[0], 80)
            scope = clean_field(query.get("scope", ["ALL"])[0], 24)
            priority = clean_field(query.get("priority", ["NORMAL"])[0], 12)
            if not message or (scope != "ALL" and not scope.startswith("ZONE:")):
                self.send_json(400, {"ok": False, "error": "broadcast inválido"})
                return
            frame = RadioFrame(
                "CENTRO", "BCAST", "BC", STORE.next_message_id(),
                (scope, priority, str(int(time.time()) + 300), message),
            )
            sent = GATEWAY.send_broadcast(frame) if GATEWAY else False
            if sent:
                STORE.record_broadcast(frame)
                if GATEWAY and not getattr(GATEWAY, "emits_tx_sent", False):
                    log_radio("TX", frame.origin, frame.destination, frame.kind, frame.message_id)
                self.send_json(200, {"ok": True, "messageId": frame.message_id})
            else:
                self.send_json(503, {"ok": False, "error": "GATEWAY_OFFLINE"})
            return
        self.send_json(404, {"ok": False, "error": "not found"})


def main():
    global STORE, GATEWAY
    parser = argparse.ArgumentParser()
    parser.add_argument("serial", nargs="?", default=None)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--db", default="center.db")
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()

    STORE = CenterStore(":memory:" if args.demo else args.db)
    if args.demo:
        seed_demo(STORE)
        GATEWAY = DemoGateway()
    elif args.serial:
        GATEWAY = SerialGateway(args.serial, handle_gateway_line)
        GATEWAY.start()
    else:
        print("Aviso: sin puerto serial. El tablero opera sin radio.")

    server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    print(f"Command center en http://localhost:{args.port} (Ctrl+C para salir)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nFin.")
    finally:
        STORE.close()


if __name__ == "__main__":
    main()
