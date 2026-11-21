# WOKI · ElevenLabs (voz, elegir voz, llamada de emergencia)

Todo pasa por `woki-bridge`. La API key solo vive en `woki-bridge/.env` y nunca llega al navegador.

## Qué hace

| Momento | Qué pasa | Archivo |
|---|---|---|
| Marta elige una frase, una reacción o escribe | Suena con su voz (clonada o elegida). La emoción de la tarjeta cambia la expresividad. Si ElevenLabs falla, usa la voz del sistema: nunca queda muda | `prototipo/woki-voz.js` + `speak()` en `woki-os.html` |
| Aparecen las 4 tarjetas | Se pide el audio de las 4 por adelantado, así suena al instante cuando elige. Consume créditos: 4 frases por turno (`VOZ.PREFETCH=false` lo apaga) | `renderCards()` |
| Alarma de **emergencia** (ceja ×2 → mandíbula) | Pasada la ventana de 3 s para cancelar, un agente de ElevenLabs llama por teléfono al contacto de emergencia, explica qué pasó y pide que vaya. La pantalla de alarma muestra el estado de la llamada. La de **atención** no llama | `alarmTick()` → `POST /api/emergencia/llamar` |
| Onboarding de voz (familia, desde el celular) | `voz.html`: (1) clonar su voz subiendo notas de voz de WhatsApp o grabando 1 minuto; (2) escuchar y elegir voces; (3) dejar hasta 6 candidatas | `prototipo/voz.html` |
| Marta elige la que le acomoda | En la TV: **Ajustes → Voz**. Cada ceja pasa a la siguiente candidata y la dice en voz alta | `VOZ.siguiente()` |

## Configuración (`woki-bridge/.env`)

```
ELEVENLABS_API_KEY=...
# opcional: ELEVENLABS_TTS_MODEL=eleven_flash_v2_5   (por defecto, la de menor latencia)

# Llamada de emergencia
ELEVENLABS_AGENT_ID=...            # lo imprime setup-emergencia.ts
ELEVENLABS_PHONE_NUMBER_ID=...     # número de Twilio importado en ElevenLabs
EMERGENCY_NUMBER=+569XXXXXXXX      # celular de la cuidadora o familiar (NO 131/133/911: el bridge lo bloquea)
WOKI_NOMBRE=Marta
WOKI_DIRECCION=Av. Ejemplo 123, depto 4, Providencia
```

Crear el agente (una vez):

```bash
cd woki-bridge
npx tsx --env-file=.env setup-emergencia.ts
# con TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_PHONE_NUMBER en .env también importa el número
```

Después hay que **reiniciar el bridge** (`npm run dev`) y abrir `http://localhost:8000/voz.html`.

## Rutas nuevas del bridge (`woki-bridge/voz.ts`)

Tienen las mismas protecciones que `/api/wa/*`: solo local, Origin exacto y JSON.

| Ruta | Para qué |
|---|---|
| `GET /api/voz/estado` | ¿Hay key? ¿qué voz está activa? ¿la llamada está configurada? |
| `POST /api/voz/tts` `{text, emo, voiceId?}` | Devuelve audio/mpeg |
| `GET /api/voz/voces` | Voces de la cuenta (prediseñadas + clonadas) |
| `POST /api/voz/clonar` `{consentimiento:true, audios:[{b64,mime,nombre}]}` | Clonación instantánea. Sin consentimiento no clona |
| `POST /api/voz/opciones` `{opciones, actual}` | Guarda las candidatas (máx. 6) en `voz.json` |
| `POST /api/voz/elegir` `{id}` | Marta cambia de voz (solo entre las candidatas) |
| `POST /api/emergencia/llamar` `{alarmId}` | Una llamada por alarma, máximo una por minuto |
| `GET /api/emergencia/estado` | initiated · in-progress · done · failed |

## Decisiones

- **El agente no usa la voz de Marta** al llamar: se presenta como "WOKI, el asistente de Marta", para que nadie crea que ella está hablando.
- **No llama a servicios públicos.** Un robot llamando al SAMU es mala idea, y puede ser ilegal. Llama a una persona, y si esa persona no puede ir, el agente le pide que llame al 131.
- **Clonar con audio antiguo.** Con ELA, muchas veces la voz actual ya cambió. Las notas de voz de WhatsApp de antes sirven para recuperar su voz real.
- Los ajustes de emoción (estabilidad y estilo) son un primer cálculo: hay que afinarlos al oído.

## Pendiente o sin verificar

- Probado contra un **mock** de ElevenLabs. Falta probarlo con la key real: TTS, clonación y la llamada.
- Que ElevenLabs acepte `.opus` de WhatsApp tal cual. Si lo rechaza, hay que convertirlo a mp3.
- Que las variables `{{persona}}` y `{{direccion}}` funcionen en `first_message`. La página de la API no lo confirma.
- Las voces de la *Voice Library* pública (no las de la cuenta) no se listan todavía. Para usarlas, se agregan primero a la cuenta desde la web de ElevenLabs.
