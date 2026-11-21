# WOKI × wapi en tu propio Mac (sin Crafter Station)

wapi es open source ([github.com/crafter-station/wapi](https://github.com/crafter-station/wapi)). Esta guía lo instala en el Mac del equipo, así no hace falta pedirle una cuenta a nadie. **Reemplaza la Parte 2 de `GUIA-WAPI-PASO-A-PASO.md` (conseguir acceso)** y simplifica la Parte 5: ya no hace falta túnel.

Todo lo que dice aquí sale del código del repositorio (commit `4ca20d8`, 6-oct-2026), en particular de cómo su propio CI levanta wapi para las pruebas (`.github/workflows/ci.yml`, job `sandbox`). **Probado en este Mac el 21-nov-2026 con el sandbox (ver sección 7).**

---

## 1. Qué cambia respecto a usar wapi.crafter.run

| | wapi.crafter.run (de Crafter Station) | wapi en tu Mac |
|---|---|---|
| Cuenta | Hay que conseguirla; no está documentado cómo | No hace falta: creas tu propia clave con un script |
| Quién ve los mensajes | Pasan por un servidor de terceros | No salen de tu Mac (solo hacia WhatsApp) |
| Recibir mensajes | Necesita túnel (`cloudflared`) | **Sin túnel:** wapi y el puente están en la misma máquina |
| Dashboard web | Sí | No (necesita Clerk, un servicio externo de cuentas). Todo se hace con scripts |
| Si el Mac se apaga o se duerme | Sigue funcionando | El WhatsApp se desconecta hasta que vuelva a encender. Reconecta solo, sin QR |
| Actualizaciones | Las hace Crafter Station | Las haces tú (`git pull`), sobre todo si WhatsApp cambia algo y wapi deja de conectar |
| Costo | No documentado | Gratis |

**Para la hackathon, la versión local es mejor:** cero dependencias de terceros, sin túnel (que era el punto más frágil con el Wi-Fi del evento) y los mensajes de Marta no pasan por servidores de otros.

## 2. Qué se instala y qué no

wapi tiene cuatro programas y tres servicios por debajo. Para WOKI basta con la mitad:

| Pieza | Para qué sirve | ¿La usamos? |
|---|---|---|
| **gateway** | Mantiene la conexión con WhatsApp (es el "dispositivo vinculado") | ✅ Sí |
| **api** | Recibe las órdenes HTTP (enviar, contactos, sesiones) | ✅ Sí |
| **webhook-worker** | Avisa a tu programa cuando llega un mensaje | ✅ Sí |
| **web** (dashboard) | Página para ver QR, sesiones y claves | ❌ No: exige Clerk. Lo reemplazan los scripts de esta guía |
| **Postgres** | Base de datos: sesiones, claves y la vinculación del celular | ✅ Sí (ya tienes Postgres 16 y 17 con Homebrew) |
| **Redis** | Comunicación interna entre las piezas y la cola de avisos | ✅ Sí (hay que instalarlo) |
| **UploadX / MinIO** | Guardar imágenes y archivos | ❌ No: UploadX es otro servicio de Crafter. WOKI solo manda texto |
| **backup** | Respaldo nocturno de Postgres | ❌ No para la demo |

No hace falta Docker. wapi está escrito para **Bun** (ya lo tienes, versión 1.4.2) y su CI lo corre así, sin contenedores.

---

## 3. Paso a paso

### Paso 1 · Instalar Redis (5 min)

```bash
brew install redis
brew services start redis
redis-cli ping            # tiene que responder: PONG
```

**Si falla:** si `redis-cli ping` no responde, mira `brew services list`. Redis tiene que aparecer como `started`.

### Paso 2 · Crear la base de datos (2 min)

Tu Postgres de Homebrew ya está corriendo en el puerto 5432.

```bash
createdb -h 127.0.0.1 wapi
psql -h 127.0.0.1 -d wapi -c "select 1"     # tiene que mostrar una fila con 1
```

> El CI de wapi usa Postgres 17 y producción usa 18; tú tienes 16 corriendo y 17 instalado. Las tablas son simples y deberían funcionar en 16. Si el Paso 5 falla con un error de SQL, usa el 17: `brew services stop postgresql@16 && brew services start postgresql@17`.

**Si falla:** `role … does not exist`: agrega `-U postgres`, o usa tu usuario del Mac (`whoami`).

### Paso 3 · Descargar wapi (5 min)

```bash
cd ~/Documents/Repositorios
git clone https://github.com/crafter-station/wapi.git
cd wapi
git checkout 4ca20d8         # la versión revisada para esta guía
bun install
```

**Qué deberías ver:** `bun install` termina sin errores. Puede tardar 1 o 2 minutos.

### Paso 4 · Configurar wapi (5 min)

Crea `wapi/.env.local`. **No uses `.env.example` tal cual:** trae valores de Crafter Station. Genera tus propias claves internas:

```bash
cd ~/Documents/Repositorios/wapi
cat > .env.local <<EOF
DATABASE_URL=postgres://$(whoami)@127.0.0.1:5432/wapi
REDIS_URL=redis://127.0.0.1:6379
ENCRYPTION_KEY=$(openssl rand -hex 32)
GATEWAY_TOKEN=$(openssl rand -hex 24)
GATEWAY_URL=http://127.0.0.1:3102
PUBLIC_URL=http://localhost:3101
AUDIT_BODIES=off
EOF
```

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Dónde está Postgres |
| `REDIS_URL` | Dónde está Redis |
| `ENCRYPTION_KEY` | Clave con la que wapi cifra las claves que guarda. **Si la pierdes o la cambias, hay que volver a vincular el celular** |
| `GATEWAY_TOKEN` | Contraseña interna entre `api` y `gateway` |
| `GATEWAY_URL` | Dónde escucha el gateway (puerto 3102) |
| `PUBLIC_URL` | La dirección de la api (puerto 3101) |
| `AUDIT_BODIES=off` | wapi no guarda en su registro el texto de los mensajes ni los números. Importante por privacidad |

Se usan los puertos 3101 y 3102, como en el CI de wapi, para no chocar con otros proyectos en el 3000.

### Paso 5 · Crear las tablas (1 min)

```bash
cd ~/Documents/Repositorios/wapi
set -a; source .env.local; set +a     # cargar la configuración en esta terminal
bun run --cwd packages/db migrate
```

**Qué deberías ver:** el avance de cada tabla (la primera es `baileys_creds`) y ningún error.

**Si falla:** `DATABASE_URL is not set`: no corriste la línea `set -a; source .env.local; set +a` en esa misma terminal. (`bun --env-file` no sirve aquí: no pasa las variables al script de migración. Probado.)

### Paso 6 · Encender wapi (3 terminales)

Las tres se quedan abiertas. En cada una, primero `cd ~/Documents/Repositorios/wapi && set -a && source .env.local && set +a`.

```bash
# Terminal A · gateway (la conexión con WhatsApp)
PORT=3102 bun run --cwd apps/gateway start

# Terminal B · api
PORT=3101 bun apps/api/src/index.ts

# Terminal C · webhook-worker (avisos de mensajes entrantes)
bun apps/webhook-worker/src/index.ts
```

Arráncalas en ese orden: la api llama al gateway.

**Qué deberías ver:** en la Terminal B, una línea `wapi-api listening on :3101 — … routes`.

Compruébalo desde otra terminal:

```bash
curl -s localhost:3101/api/status
```

Tiene que responder algo (aunque sea un error de autenticación). Si dice `Connection refused`, la api no está corriendo.

**Para no tener 3 terminales:** crea `wapi/start-local.sh` (es el que está instalado en este Mac):

```bash
#!/bin/zsh
# Enciende wapi en local: gateway (3102), api (3101) y webhook-worker. Logs en ./logs
cd "$(dirname "$0")"
set -a; source .env.local; set +a
mkdir -p logs
if pgrep -f "apps/gateway/src/server.ts" >/dev/null; then echo "Ya hay un gateway corriendo. Apágalo antes: pkill -f 'apps/(gateway|api|webhook-worker)'"; exit 1; fi
PORT=3102 bun run --cwd apps/gateway start > logs/gateway.log 2>&1 &
sleep 3
PORT=3101 bun apps/api/src/index.ts > logs/api.log 2>&1 &
bun apps/webhook-worker/src/index.ts > logs/worker.log 2>&1 &
echo "wapi corriendo · logs en wapi/logs · para apagar: pkill -f 'apps/(gateway|api|webhook-worker)'"
wait
```

```bash
chmod +x start-local.sh && ./start-local.sh
```

### Paso 7 · Crear tu clave de cuenta (PAT) sin dashboard (1 min)

wapi trae un script que crea una cuenta y un PAT directo en la base de datos. Su CI lo usa justamente porque no tiene Clerk:

```bash
cd ~/Documents/Repositorios/wapi
set -a; source .env.local; set +a
bun ops/seed-ci.ts
```

**Qué deberías ver:** una sola línea, el PAT. **Cópiala ahora:** wapi guarda solo un hash y no se puede volver a mostrar. Si la pierdes, corre el script de nuevo y te da otra.

### Paso 8 · Apuntar el puente a tu wapi

Sigue `GUIA-WAPI-PASO-A-PASO.md` desde la **Parte 3**, con estos cambios:

**En el Paso 1 de esa guía**, copia el SDK desde tu wapi y no desde wspbot. Así el SDK es de la misma versión que el servidor:

```bash
cp -R ../../wapi/sdk/typescript/src ./wapi-sdk
```

**En `woki-bridge/.env`:**

```bash
WAPI_BASE_URL=http://localhost:3101
WAPI_PAT=el_pat_del_paso_7
```

Todo lo demás de la Parte 3 y la Parte 4 (puente, sandbox, primer envío) funciona igual. El sandbox también existe en tu wapi: es parte del gateway.

### Paso 9 · Mensajes entrantes sin túnel

En el **Paso 7 de la otra guía**, sáltate `cloudflared` y registra directamente la dirección local:

```bash
npx tsx --env-file=.env --env-file=.env.sandbox setup-webhook.ts \
  http://localhost:8787 \
  $(grep SANDBOX_SESSION_ID .env.sandbox | cut -d= -f2)
```

Funciona porque el webhook-worker corre en el mismo Mac que el puente. Revisé el código del worker y no bloquea direcciones locales, pero **confírmalo** con el Paso 8 de la otra guía (simular que Sofía escribe): tiene que aparecer `[in] Sofía: …` en la terminal del puente. Si no aparece, mira `wapi/logs/worker.log`. Como plan B, el túnel sigue sirviendo igual.

### Paso 10 · Vincular el celular sin dashboard (10 min)

Sin dashboard, el QR se muestra en la terminal. En `woki-bridge`:

```bash
npm i -D qrcode-terminal@0.12.0 @types/qrcode-terminal@0.12.2 qrcode@1.5.4 @types/qrcode@1.5.5
```

Crea `vincular.ts`. Este script reemplaza los Pasos 12 y 13 de la otra guía: crea la sesión, muestra el QR, espera a que escanees y guarda las claves en `.env`:

```ts
// woki-bridge/vincular.ts   uso: npx tsx --env-file=.env vincular.ts +569XXXXXXXX
// Crea (o reutiliza) la sesión del celular, muestra el QR en la terminal y, al vincular,
// guarda su key, id y secreto en .env sin mostrarlos.
import { readFileSync, writeFileSync } from "node:fs";
import qrcode from "qrcode-terminal";
import QR from "qrcode";
import { execFile } from "node:child_process";
import { WapiClient } from "./wapi-sdk/index.ts";

const phone = process.argv[2];
if (!phone?.startsWith("+")) throw new Error("Pasa el número del celular con +, por ejemplo: vincular.ts +569XXXXXXXX");
const digits = (s: string) => s.replace(/\D/g, "");
const account = new WapiClient({ apiKey: process.env.WAPI_PAT!, baseUrl: process.env.WAPI_BASE_URL });

const existing = (await account.sessions.list()).find((s) => digits(s.phone_number) === digits(phone));
const session = existing ?? (await account.sessions.create({
  name: "woki-demo", phone_number: phone,
  account_protection: true,   // 1 envío cada 5 s
  log_messages: false,        // wapi no guarda el texto de los mensajes
  ignore_groups: true,
}));
console.log(`Sesión ${session.id} (${existing ? "ya existía" : "creada"})`);

// El QR también se dibuja en qr.html (se recarga sola cada 3 s), porque la terminal de
// Claude Code colapsa la salida larga y el QR queda ilegible.
const page = (body: string) => writeFileSync("qr.html",
  `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>Vincular WOKI</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;font:18px system-ui;color:#111;text-align:center">
<div>${body}</div></body>`);
page("<p>Pidiendo el QR a wapi…</p>");
execFile("open", ["qr.html"]);
let lastQr = "";
const show = async (qr?: string | null) => {
  if (!qr || qr === lastQr) return;
  lastQr = qr;
  const svg = await QR.toString(qr, { type: "svg", margin: 2, width: 420 });
  page(`<p><b>WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo</b></p>${svg}<p style="color:#666">Se actualiza sola. El QR cambia cada ~20 s.</p>`);
  console.clear();
  console.log("En el celular: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo\n");
  qrcode.generate(qr, { small: true });
  console.log("\nEl QR cambia cada ~20 s; esta pantalla se actualiza sola.");
};

const conn = await account.sessions.connection.connect(session.id);
await show(conn.qrCode);
let status = conn.status.toLowerCase();
const deadline = Date.now() + 180_000;
while (status !== "connected" && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 2_000));
  status = (await account.sessions.get(session.id)).status.toLowerCase();
  if (status !== "connected") await show((await account.sessions.connection.qrCode(session.id).catch(() => null))?.qrCode);
}
if (status !== "connected") { page("<p>No se vinculó a tiempo. Corre el script otra vez.</p>"); throw new Error(`La sesión sigue en "${status}" después de 3 min. Corre el script otra vez.`); }

const s = await account.sessions.get(session.id);
if (!s.api_key) throw new Error("La sesión no devolvió su key.");
const set = (env: string, k: string, v: string) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  return re.test(env) ? env.replace(re, () => `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`;
};
let env = readFileSync(".env", "utf8");
env = set(env, "WAPI_SESSION_ID", String(s.id));
env = set(env, "WAPI_API_KEY", s.api_key);
env = set(env, "WAPI_WEBHOOK_SECRET", s.webhook_secret ?? "");
writeFileSync(".env", env);
console.clear();
page("<h1>✓ Celular vinculado</h1><p>Ya puedes cerrar esta pestaña.</p>");
console.log(`✓ Celular vinculado · sesión ${s.id} · claves guardadas en .env`);
```

```bash
npx tsx --env-file=.env vincular.ts +569XXXXXXXX
```

**Qué deberías ver:** se abre en el navegador una pestaña "Vincular WOKI" con el QR en grande (se recarga sola cada 3 s). Dentro de Claude Code la terminal colapsa el QR y no se puede escanear: usa la pestaña. Lo escaneas desde el celular y, en unos segundos, aparece `✓ Celular vinculado · sesión N · claves guardadas en .env`.

**Si falla:**
- El QR se ve deformado: agranda la ventana de la terminal o achica la letra (Cmd + −).
- **El celular pide una passkey o rechaza el escaneo:** ver el riesgo 1 más abajo.
- `sigue en "need_scan"`: el QR caducó sin escanearse. Corre el script de nuevo; reutiliza la misma sesión.

Después sigue con el **Paso 14 de la otra guía** (contactos reales y webhook) usando `http://localhost:8787` en vez de la URL del túnel.

### Paso 11 · Que el Mac no se duerma durante la demo

El gateway es el "dispositivo vinculado". Si el Mac se duerme, WhatsApp lo ve desconectado:

```bash
caffeinate -dimsu      # déjalo corriendo en una terminal; Ctrl+C para soltarlo
```

Cuando el Mac vuelve, wapi reconecta solo con lo que guardó en Postgres, sin QR.

---

## 4. Lo que hay que saber antes de decidir

1. **Algunas cuentas de WhatsApp piden passkey al vincular, y wapi no lo soporta.** El propio código de wapi (`apps/gateway/src/pair.ts`) lo anota: desde el 30-jun-2026, WhatsApp exige una passkey (WebAuthn) para vincular dispositivos **en algunas cuentas**, y Baileys, la librería que usa wapi, no la implementa. Afecta igual a la versión de Crafter Station. **Prueba el Paso 10 con la SIM real lo antes posible:** si ese número pide passkey, hay que usar otro.
2. **Sigue yendo contra los términos de WhatsApp.** Correrlo en tu Mac no cambia el riesgo de bloqueo. Usa un número secundario, con `account_protection` activado.
3. **Una sola copia del gateway por número.** Si arrancas dos gateways con la misma base de datos, WhatsApp ve dos conexiones del mismo dispositivo y puede restringir la cuenta. Antes de arrancar, revisa que no quede uno viejo: `pgrep -fl apps/gateway`.
4. **Postgres es todo.** Ahí está la vinculación del celular. Si borras la base `wapi` o cambias `ENCRYPTION_KEY`, hay que volver a escanear el QR.
5. **El mantenimiento es tuyo.** Si WhatsApp cambia su protocolo y wapi deja de conectar, hay que actualizar (`git pull && bun install`) y volver a migrar.

## 5. Encendido el día de la demo

| Terminal | Comando | Para qué |
|---|---|---|
| 1 | `brew services list` → Redis y Postgres `started` | Base de wapi |
| 2 | `cd wapi && ./start-local.sh` | wapi (gateway, api, worker) |
| 3 | `cd woki-bridge && npm run dev` | El puente |
| 4 | Servidor del prototipo en el puerto 8000 (ya corre) | La TV |
| 5 | `caffeinate -dimsu` | Que el Mac no se duerma |

Comprobación final: `curl -s localhost:8787/api/wa/health` responde `"mode":"live","session":"connected"`.

## 6. Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Connection refused` en el puerto 3101 | La api no arrancó | Mira `wapi/logs/api.log` |
| La api responde pero los envíos fallan con error del gateway | `GATEWAY_TOKEN` o `GATEWAY_URL` distintos entre procesos | Todos leen el mismo `.env.local`; reinicia los tres |
| `ENCRYPTION_KEY must be 32 bytes of hex` | Clave mal generada | Repite el Paso 4 (antes de vincular el celular) |
| No llegan mensajes entrantes | El worker no corre, o el webhook apunta a otra dirección | `wapi/logs/worker.log` y repite el Paso 9 |
| Sesión `disconnected` después de dormir el Mac | Normal | Espera unos segundos; si no vuelve, reinicia el gateway |
| El celular no termina de vincular | Passkey (riesgo 1) o QR caducado | Corre `vincular.ts` otra vez; si pide passkey, cambia de número |

## Fuentes (en el repositorio de wapi)

- `README.md`: arquitectura, CLI y "Run it"
- `docker-compose.yaml` y `.env.example`: variables de cada pieza
- `.github/workflows/ci.yml`, job `sandbox`: cómo levantar wapi sin Docker ni dashboard
- `ops/seed-ci.ts`: crear un PAT sin Clerk
- `apps/gateway/src/pair.ts`: la nota sobre las passkeys
- `apps/webhook-worker/src/index.ts`: la entrega de webhooks (sin bloqueo de direcciones locales)

## 7. Prueba hecha en este Mac (21-nov-2026)

| Prueba | Resultado |
|---|---|
| Migración en Postgres 16 | ✅ 14 tablas |
| gateway, api y worker | ✅ arriba (puertos 3102 y 3101) |
| PAT con `ops/seed-ci.ts` | ✅ |
| Crear sandbox (`setup-sandbox.ts`, versión corregida: hay que llamar a `connect` antes de `scan`) | ✅ sesión `connected`, 5 contactos de prueba |
| Envío del puente a Sofía | ✅ `msgId 100000` |
| Mismo `idemKey` / contacto fuera de la lista | ✅ 409 / 403 |
| Webhook a `http://localhost:8788` **sin túnel** | ✅ llegó firmado y verificado |
| Formato del entrante | ✅ `data.message.conversation` y `data.key.remoteJid` (en el sandbox, sin `@…`) |
| Evento a la TV por SSE | ✅ `incoming` con nombre, tono y `key` |
| Reacción ❤️ al mensaje recibido | ✅ |

**Puerto:** en este Mac el 8787 lo usa `referentes-app`, así que el puente corre en el **8788** (`PORT=8788` en `woki-bridge/.env`). En la TV, `CFG.WA_URL` tiene que ser `http://localhost:8788`.
| Vincular celular real con `vincular.ts` (QR en el navegador) | ✅ sesión 5, `connected` |
| Envío real desde el puente (`WA_MODE=live`) al chat propio | ✅ `msgId 100001`, aceptado por WhatsApp (estado 1, pendiente de confirmación) |

**Ojo al vincular:** wapi guarda el número que le pasas como etiqueta, pero el que manda es el **celular que escanea**. En la primera prueba se escaneó desde otro WhatsApp y quedó vinculado un número distinto; se detectó en `wapi/logs/gateway.log` (`myPN`) y se re-vinculó. Antes de enviar, revisa ese valor.

**Seguridad del puente:** `server.ts` exige que los POST traigan `Origin: http://localhost:8000` y `Content-Type: application/json`, rechaza tráfico que llegue por túnel y acepta un token opcional `WOKI_API_TOKEN`. Para probar con curl agrega `-H 'Origin: http://localhost:8000'`.
