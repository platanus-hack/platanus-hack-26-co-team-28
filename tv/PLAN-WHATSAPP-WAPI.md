# WOKI · Plan de mensajes por WhatsApp con wapi

**Objetivo:** que la pantalla **Mensajes** de `prototipo/woki-os.html` deje de simular y envíe de verdad desde el WhatsApp del celular a una lista cerrada de contactos (Sofía, Camila). Y que los mensajes que llegan aparezcan en la TV como "Sofía dice…" para que Marta responda con las 4 frases.

**Base:** el mismo gateway que usa `Repositorios/wspbot` (kekito-crafter / Crafter Station): **wapi**, `https://api.wapi.crafter.run`. Es un WhatsApp por HTTP, open source ([crafter-station/wapi](https://github.com/crafter-station/wapi)), que vincula un número personal por QR. Reutilizamos su SDK oficial en TypeScript (`wspbot/lib/wapi-sdk/`) y su receptor de webhook (`wspbot/.agents/skills/wapi-nextjs/references/webhook-route.ts`).

---

## 1. Lo que ya sabemos de wapi (leído del código de wspbot)

| Tema | Dato | Dónde |
|---|---|---|
| Credenciales | **Dos, y no se intercambian.** *Session API key* para enviar, contactos y grupos. *PAT* para administrar la sesión (conectar, QR, configurar webhook). Usar la equivocada da **403**, no 401 | `lib/wapi-sdk/index.ts` |
| Enviar | `POST /api/send-message` `{ to: "+569XXXXXXXX", text }` → `{ msgId, status: "in_progress" }`. El envío es asíncrono | `resources/messages.ts` |
| Estado del mensaje | `GET /api/messages/{msgId}/info` → `status` numérico: 0 error, 1 pendiente, 2 enviado, 3 entregado, 4 leído | `api-notes.md` |
| Contactos | `GET /api/contacts` (la agenda real del celular) · `onWhatsApp(número)` · `lid-from-pn` / `pn-from-lid` | `resources/directory.ts` |
| Recibir | **Solo por webhook, no hay endpoint para leer mensajes.** Evento `messages.received`, firma en `x-webhook-signature` (secreto plano o HMAC-SHA256 del cuerpo crudo) | README "Architecture" |
| Configurar webhook | `PUT /api/whatsapp-sessions/{id}` con PAT: `webhook_url`, `webhook_enabled`, `webhook_events:["messages.received"]` | README "Pointing wapi at it" |
| Protección | `account_protection` en la sesión limita a **1 envío cada 5 s** desde el servidor | `api-notes.md` |
| Sandbox | Número falso en un WhatsApp falso, mismas rutas. Sirve para ensayar sin tocar chats reales | README "What wapi is" |
| Reacciones | `POST /api/messages/react` `{ key, emoji }`, con el `key` que trae el webhook | `api-notes.md` |

**Trampas que ya le costaron tiempo a wspbot (las heredamos resueltas):**
- **Un envío no se reintenta.** Un timeout no significa que no llegó. Se reconcilia con `/info`.
- **Responder 200 al webhook antes de procesar.** wapi reintenta ante cualquier error; si tardamos, un mensaje llega varias veces. Deduplicar por id del mensaje.
- **Identidades LID.** El remitente puede llegar como `…@lid` y el teléfono en `remoteJidAlt`. La lista blanca guarda teléfono **y** LID, resuelto al iniciar con `lid-from-pn`.
- **Verificar la firma sobre el cuerpo crudo**, antes de parsear el JSON.

**Pendiente:** en `wspbot` no hay `.env`. Hay que conseguir en el dashboard de wapi la session key, el PAT, el id de sesión y el secreto del webhook, o pedírselos a quien administra la cuenta.

---

## 2. Arquitectura

```
 TV · woki-os.html (navegador)
   │  POST /api/wa/send      ▲  GET /api/wa/events (SSE: entrantes + estados)
   ▼                         │
 woki-bridge · Node en el Mac (puerto 8787) · usa lib/wapi-sdk copiado de wspbot
   · session key, PAT y secreto en .env (nunca en el HTML)
   · lista blanca de contactos (profile.json)
   · anti doble envío, límite de ritmo, registro
   │  POST api.wapi.crafter.run/api/send-message   ▲  POST /webhook/wapi (firmado)
   ▼                                               │  vía túnel cloudflared
 wapi  ⇄  WhatsApp del celular (dispositivo vinculado)  ⇄  Sofía / Camila
```

**Por qué un backend:** la session key permite escribirle a toda la agenda. Si va en el HTML, cualquiera con la página la tiene. En el mismo backend vive `SUGGEST_URL` (Claude).

**Por qué túnel:** wapi solo empuja los mensajes entrantes a una URL pública. `cloudflared tunnel --url http://localhost:8787` da una al instante. Es lo mismo que recomienda el README de wspbot para desarrollar en local.

---

## 3. Flujos

### A. Marta envía (lo que hoy está simulado)

```
1. Intención      Marta elige "Mensajes" → contacto (Sofía) → frase (de las 4 o escrita)
2. Plan           Tarjeta de 3 pasos ya existente: destinatario + texto en grande
3. Confirmación   Ceja, y otra ceja en 3 s (ya existe). Nunca se envía por no responder
4. Envío          browser → POST /api/wa/send { contactId:"sofia", text, idemKey }
5. Backend valida contactId en lista blanca · texto ≤ 500 caracteres · idemKey no usado · ≤ 30 al día
6. wapi           wapi.messages.send({ to: "+569…", text }) → msgId
7. Feedback       "Enviando a Sofía…" → "✓ Enviado" → "✓✓ Leído" (consulta /info cada 3 s por 1 min)
8. Error          "No se envió: <razón>". El texto queda guardado. Nunca reintenta solo
```

### B. Llega un mensaje (lo que cierra el ciclo)

```
1. Sofía escribe "¿vienes el domingo?"
2. wapi → webhook firmado → backend: verifica la firma, responde 200 y procesa después
3. ¿remitente (teléfono o LID) en lista blanca? Si no, se descarta sin guardar ni mostrar
4. backend → SSE → TV: tarjeta "Sofía dice: ¿vienes el domingo?" + sonido suave
5. Marta mira la tarjeta → se abre Hablar con #ctxIn = ese texto y persona = Sofía
6. genSuggestions() con el tono de Sofía → 4 frases → Marta elige
7. "Responder por WhatsApp" → flujo A desde el paso 2, con la frase ya cargada
   Atajo: una reacción (❤️ 😂 👍) sobre el mensaje con wapi.messages.react(key, emoji)
```

Este es el momento de la demo: el jurado escribe desde el celular de "Sofía", la TV lo muestra, Marta responde con la mirada y el mensaje llega en segundos.

### C. Alarma (opcional, P2)

Escalamiento de 90 s ya definido en `hallazgos/06`: si Camila no confirma, el backend manda un WhatsApp al contacto 2 con una plantilla fija ("Marta pidió ayuda hace 90 s y nadie ha confirmado"). Misma lista blanca, sin IA.

### D. Onboarding de contactos (después de la hackathon)

`GET /api/contacts` trae la agenda real. En el formulario de la familia (capa A de `PLAN-ONBOARDING-MEMORIA.md`) se eligen de ahí las 3 a 6 personas de Marta, con relación y tono. Así nadie escribe números a mano.

---

## 4. Reglas de seguridad (no negociables)

1. **Lista cerrada.** Solo los contactos de `profile.json`. El agente elige un `contactId`, nunca un número.
2. **Siempre con confirmación doble.** Ningún envío sin las dos cejas, ni por timeout ni por la IA.
3. **Una vez por intención.** El `idemKey` se genera al mostrar el plan y el backend rechaza su segundo uso. Evita dobles envíos por un EMG ruidoso.
4. **Ritmo.** `account_protection` activado en la sesión (1 envío cada 5 s en el servidor) y tope de 30 al día en el backend.
5. **Interruptor.** `WA_MODE=off | dry | sandbox | live`. `dry` solo registra. `sandbox` usa el número falso de wapi. `live` envía de verdad.
6. **Entrantes filtrados.** Los mensajes de números fuera de la lista no llegan a la TV ni a Claude.
7. **Secretos fuera del repo.** `.env` en `.gitignore` y nunca impreso en logs.

---

## 5. Contrato del backend

| Método | Ruta | Entrada | Salida |
|---|---|---|---|
| POST | `/api/wa/send` | `{ contactId, text, idemKey }` | `{ ok, msgId }` o `{ ok:false, reason }` |
| GET | `/api/wa/events` | — (SSE) | `{type:"incoming", contactId, text, key}` · `{type:"status", msgId, status}` · `{type:"session", status}` |
| GET | `/api/wa/health` | — | `{ mode, session: wapi.status(), sentToday }` |
| POST | `/api/wa/react` | `{ key, emoji }` | `{ ok }` |
| POST | `/webhook/wapi` | evento firmado de wapi | 200 inmediato |
| POST | `/api/suggest` | `{ context, contactId }` | `{ suggestions:[{text,tone,emo}] }` (el `SUGGEST_URL` actual) |

`.env` (mismos nombres que `wspbot/.env.example`):

```
WAPI_BASE_URL=https://api.wapi.crafter.run
WAPI_API_KEY=          # session key: enviar y contactos
WAPI_WEBHOOK_SECRET=   # verificar entrantes
WAPI_PAT=              # solo para configurar el webhook
WAPI_SESSION_ID=
WA_MODE=dry
```

`profile.json` (mínimo):

```json
{ "contacts": [
  { "id": "sofia",  "name": "Sofía",  "relation": "hija",      "phone": "+569XXXXXXXX", "tone": "cariñosa y bromista" },
  { "id": "camila", "name": "Camila", "relation": "cuidadora", "phone": "+569XXXXXXXX", "tone": "cordial" }
]}
```

Al iniciar, el backend resuelve el LID de cada teléfono y lo guarda en memoria para reconocer entrantes.

---

## 6. Cambios en `woki-os.html`

| Dónde | Cambio |
|---|---|
| `CFG` (línea ~422) | `WA_URL: 'http://localhost:8787'` y `SUGGEST_URL` hacia el mismo backend |
| Pantalla `s-agent` (~347) | Destinatario y texto dinámicos (hoy fijos "Sofía" y "postre de la abuela"). Generar `idemKey` al abrir |
| `action('agentSend')` (~666) | En la segunda ceja, `fetch(WA_URL+'/api/wa/send')` en vez de "Enviado (simulado)". Estados: enviando, enviado, leído, error |
| Nuevo `EventSource(WA_URL+'/api/wa/events')` | Entrantes → tarjeta "X dice…" en home; estados → aviso en pantalla |
| Pantalla Hablar | Botón "Responder por WhatsApp" cuando el contexto viene de un mensaje |
| Pantalla de reacciones | Si hay un mensaje entrante activo, la reacción se envía a ese mensaje |
| Barra de estado | Punto verde o rojo según la sesión de WhatsApp (`/health`) |
| Fallback | Sin backend: aviso "Sin conexión a WhatsApp" y modo simulado, rotulado como tal |

---

## 7. Orden de trabajo (antes del domingo 14:00)

| # | Paso | Tiempo | Listo cuando |
|---|---|---|---|
| 1 | Credenciales de wapi en `.env`. Vincular el celular por QR si la sesión no existe. Activar `account_protection` | 20 min | `wapi.status()` dice `connected` |
| 2 | `woki-bridge`: copiar `lib/wapi-sdk/`, `/send` con lista blanca, `WA_MODE` y `idemKey`. Probar en `sandbox` | 45 min | Envío al sandbox OK; contacto fuera de lista da 403 |
| 3 | Conectar `agentSend` del prototipo al backend, con estados | 30 min | Doble ceja en la TV → llega al celular en `live` |
| 4 | Túnel + registrar webhook (PUT con PAT) + receptor firmado (adaptado de `webhook-route.ts`) + SSE | 60 min | Mensaje de Sofía aparece en la TV |
| 5 | Entrante → Hablar → 4 frases → responder, y reacción rápida | 45 min | Ciclo completo en menos de 20 s |
| 6 | Deduplicación del webhook, tope diario, punto de estado | 20 min | Dos cejas rápidas repetidas = un solo mensaje |
| 7 | Ensayo en `sandbox` y 2 ensayos en `live` | 30 min | Sin errores 3 veces seguidas |

Total ≈ 4 h. Si el tiempo no alcanza, cortar después del paso 3: el envío real ya demuestra el agente.

---

## 8. Riesgos y plan B

| Riesgo | Mitigación |
|---|---|
| La sesión se cae en plena demo | Revisar `/health` antes de subir. wapi guarda la sesión en Postgres y reconecta sin pedir QR. Plan B: modo simulado rotulado + video de 15 s del envío real grabado antes |
| Bloqueo del número por automatización | Volumen mínimo y `account_protection`. Idealmente un número secundario del equipo, no el personal |
| El Wi-Fi del evento bloquea el túnel | Hotspot del iPhone. El envío (paso 3) no necesita túnel, solo los entrantes |
| Mensaje duplicado por reintento del webhook | Responder 200 de inmediato y deduplicar por id |
| La IA propone algo que Marta no quería enviar | Imposible enviar sin las dos cejas; el texto se ve completo en la tarjeta |

---

## 9. Para el pitch

"El agente solo puede escribirle a las personas que Marta eligió, y nada sale sin su doble confirmación." Privacidad y control en una frase, en línea con `PLAN-ONBOARDING-MEMORIA.md`.
