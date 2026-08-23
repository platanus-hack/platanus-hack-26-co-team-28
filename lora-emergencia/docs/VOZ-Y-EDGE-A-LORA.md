# Voz y edge hacia LoRa · Dónde corre la transcripción y qué más cabe

Documento accionable para el equipo. Aterriza cada opción al hardware real (LILYGO
T3 V1.6.1, ESP32-PICO-D4, radio SX1276) y al demo actual (portal cautivo
`AYUDA_AQUI_RESCATISTA_911`, cert de `ayuda.homiapp.xyz`, GPS del celular, frame
`ORIGEN|DESTINO|TIPO|MSGID|payload`).

---

## 1. Resumen ejecutivo (5 líneas)

1. La transcripción de voz corre en el navegador del celular, nunca en el ESP32. El
   ESP32-PICO-D4 tiene ~520 KB de SRAM sin PSRAM; el modelo de dictado más pequeño
   (Whisper tiny) pesa ~75 MB. No cabe. Es un hecho físico.
2. En el celular hay dos caminos: Web Speech API on-device de Chrome 139+ en Android
   (usa el motor SODA del sistema, sin enviar audio a la nube) y Vosk-browser con
   `vosk-model-small-es-0.42` (~39 MB) como respaldo 100% offline.
3. El reto real no es correr el modelo. Es servir 40-75 MB sin internet por un SoftAP
   de ~1-2 Mbps. La solución es precargar el bundle en el celular antes del demo.
4. Para meter más texto en LoRa, usa el esquema híbrido: código de plantilla (1-2 B) +
   slots binarios (GPS, n, severidad) + texto libre opcional con Unishox2. Una frase de
   ~116 bytes baja a ~11 bytes.
5. La regla del sistema: procesa rico en el borde (voz, foto, formulario), manda un ID
   corto por LoRa. El audio nunca cruza el radio.

---

## 2. Transcripción de voz: navegador del celular vs ESP32

**Veredicto:** la transcripción corre en el navegador del celular. El ESP32 solo sirve
el HTML/JS del portal (pocos KB) y reenvía los bytes por LoRa. El ESP32 no sirve ningún
modelo de voz.

### Tabla de opciones

| Opción | Dónde corre | Offline | Español | Viabilidad 1-10 | Esfuerzo | Límite principal |
|---|---|---|---|---|---|---|
| Web Speech API on-device (Chrome 139+, Android) | navegador-celular | Parcial | Sí, motor SODA `es-ES`/`es-US` | 6 | Bajo | El paquete de voz offline del SO se descarga UNA vez con internet. iOS/Safari manda audio a Apple, no hay modo on-device. |
| Web Speech API por red (por defecto) | navegador-celular | No | Sí, alta calidad | 2 | Bajo | Manda audio a Google/Apple. Sin internet no transcribe. Solo sirve como fallback con datos. |
| Vosk-browser (`vosk-model-small-es-0.42`) | navegador-celular | Sí | Sí, offline real | 6 | Medio | Servir ~40-50 MB (wasm + modelo) sin internet. Corre bien para dictado corto. |
| Whisper.cpp a WASM | navegador-celular | Sí | Sí, multilingüe | 3 | Alto | tiny ~75 MB (~31 MB con Q5_1). El demo oficial pide desktop rápido. Lento en gama media. |
| transformers.js (Whisper-tiny ONNX) | navegador-celular | Sí | Sí (tiny). Moonshine solo inglés | 3 | Alto | WebGPU irregular en móvil; con WASM la latencia sube. Bundle ~50-120 MB. |

### La verdad sobre el reto offline

- **Web Speech API por defecto NO es offline.** Chrome manda audio a Google, Safari a
  Apple. Chrome 139 (2025) agregó `SpeechRecognition.available({langs, processLocally:true})`
  y `SpeechRecognition.installOnDevice(...)`, que usan el motor SODA del sistema. Ese
  modelo del SO se descarga UNA vez con internet o Google Play; después transcribe sin red.
  En el demo, si el celular nunca instaló el paquete de voz offline en español (el mismo
  del dictado sin internet de Gboard), no funciona sin internet.
- **En iPhone queda descartada para offline.** Safari no tiene modo on-device. Siempre
  manda audio a servidores de Apple. Requiere internet.
- **Los modelos WASM pesan 39-75 MB y no caben en el ESP32.** El ESP32-PICO-D4 tiene 4 MB
  de flash total, ~1-2 MB libres. Hay que servirlos desde la microSD del T3 o precargarlos
  en el cache del navegador antes de perder internet.
- **Aviso de hardware crítico:** en la T3 V1.6.1 la microSD y el radio SX1276 comparten el
  mismo bus SPI. Servir un archivo grande desde SD y transmitir LoRa a la vez chocan.
  Sepáralos en el tiempo: primero el celular baja el bundle, luego la placa opera LoRa.
- **El SoftAP da ~1-2 Mbps útiles y un solo cliente.** Bajar 40-50 MB tarda varios minutos
  y bloquea a otros usuarios.

### Camino recomendado para el demo

Estrategia de dos capas:

- **Capa principal:** Web Speech API on-device de Chrome (Android 139+). El ESP32 no sirve
  nada, la transcripción es en tiempo real, y no viaja audio por el WiFi. Requiere preparar
  el celular con una sola conexión a internet antes del demo.
- **Capa de respaldo 100% offline:** Vosk-browser con `vosk-model-small-es-0.42` (~39 MB),
  servido desde la microSD o precargado en el navegador con un service worker.

**Trade-off honesto:** la capa principal depende de que el celular ya tenga el paquete de
voz del SO. La capa de respaldo no depende del SO, pero exige mover ~40 MB al celular antes
del evento. Whisper WASM y transformers.js quedan descartados para móvil por peso y latencia.
Moonshine queda descartado por ser solo inglés.

Fuentes:
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- Chrome on-device: https://developer.chrome.com (Intent to Ship On-device Web Speech API, blink-dev)
- Vosk-browser: https://github.com/ccoreilly/vosk-browser
- whisper.cpp: https://github.com/ggml-org/whisper.cpp
- transformers.js: https://huggingface.co/docs/transformers.js

---

## 3. ESP32: por qué la transcripción libre NO corre, y qué SÍ

**Veredicto:** la transcripción libre de voz dentro del ESP32-PICO-D4 es imposible. Lo
único realista en la placa es keyword spotting de N comandos fijos con TensorFlow Lite
Micro, y eso pide un micrófono I2S extra que el T3 no trae.

### Por qué la transcripción libre no corre

- El PICO-D4 no tiene PSRAM útil. Sin PSRAM quedan ~520 KB de SRAM. El WiFi SoftAP + el
  portal HTTPS + LoRa ya ocupan buena parte de esa SRAM.
- Whisper tiny son ~39 M parámetros, ~75 MB en int8. No cabe en 520 KB ni de lejos.
- No existe ningún modelo de dictado abierto que corra en este SoC. Es un hecho físico,
  no una limitación de esfuerzo.

### Qué SÍ se puede

- **Keyword spotting con TensorFlow Lite Micro.** El ejemplo `micro_speech` usa un modelo
  de ~18 KB. Puedes entrenar un modelo propio con 4-10 comandos en español (AYUDA, ATRAPADO,
  HERIDO, AGUA, FUEGO), ~18-50 KB en int8. Entra audio del micrófono I2S por I2S, sale la
  clase detectada, la mapeas a un `TIPO` del frame LoRa.
- **Hardware que falta:** el T3 no tiene micrófono. Necesitas un INMP441 I2S (~2 USD), 3
  pines GPIO libres + 3.3V. Audio a 16 kHz, 16 bit, mono.
- **Precisión:** razonable solo con vocabulario cerrado y poco ruido. En ruido de terremoto
  real la precisión baja y hay riesgo alto de falsos positivos.

### Qué NO aplica

- **ESP-SR de Espressif (WakeNet / MultiNet):** descartado. Pide PSRAM, apunta al ESP32-S3
  con SIMD, y solo soporta chino e inglés. No hay modelo en español.

### Tabla ESP32

| Opción | Dónde | Offline | Español | Viabilidad | Esfuerzo | Nota |
|---|---|---|---|---|---|---|
| Botones de comandos en el portal (sin STT) | navegador-celular | Sí | Perfecto | 10 | Bajo | Cero mic, cero RAM en el ESP32. Ya es el patrón del demo. |
| TFLM keyword spotting (N comandos) | esp32 | Sí | Sí, entrenando muestras propias | 5 | Alto | ~18-50 KB. Pide INMP441. Compite por SRAM con WiFi+HTTPS+LoRa. |
| ESP-SR WakeNet (wake word) | esp32 | Sí | No | 2 | Alto | Pide PSRAM. Solo chino/inglés. Descartado. |
| ESP-SR MultiNet (comandos) | esp32 | Sí | No | 1 | Alto | Pide PSRAM y ESP32-S3. Descartado. |
| Whisper libre en el ESP32 | esp32 | Sí | Irrelevante | 1 | Alto | Físicamente imposible. No lo intentes. |

Fuentes:
- esp-tflite-micro: https://github.com/espressif/esp-tflite-micro
- esp-sr: https://github.com/espressif/esp-sr

**Recomendación para el ESP32:** NO pongas STT en la placa. Usa los botones de comandos que
el portal ya sirve. Respeta el frame `ORIGEN|DESTINO|TIPO|MSGID|payload` con cero riesgo.

---

## 4. Enviar texto por LoRa: esquema recomendado

**Esquema recomendado:** híbrido = código de plantilla (1-2 B) + slots binarios
(n=1B, GPS=8B, severidad=1B) + texto libre opcional comprimido con Unishox2.

### Ejemplo literal con una frase española

Frase `S`:

```
Hay dos personas atrapadas bajo una losa de concreto en la calle Bolivar numero 45,
una sangra mucho, envien grua
```

~112 caracteres, 4 tildes (Bolívar, número, envíen, grúa).

| Codificación | Bytes | Reducción vs crudo |
|---|---|---|
| Crudo UTF-8 | ~116 | 0% |
| Transliteración (quitar tildes) + Unishox2 | ~54 | ~53% |
| Unishox2 | ~58 | ~50% |
| Plantilla + slots | ~11 | ~90% |

### Cómo se arman los 11 bytes

```
0x07  n=2   [GPS lat/lon: 2x int32 escalado 1e7]   sev=hemorragia
1 B   1 B   8 B                                     1 B
```

- `0x07` = código de la plantilla "Hay {n} personas atrapadas bajo losa de concreto,
  {sev}, envien grua".
- Si usas texto de calle en vez de GPS, "Bolivar 45" agrega ~10 bytes.

### Por qué así

- **Un código de 1 byte reconstruye una frase canónica de 40-80 caracteres** en el centro.
  256 códigos con 1 byte, 65536 con 2 bytes. El diccionario es el mismo array compilado en
  el firmware y en el centro, indexado por el código.
- **Unishox2** comprime frases latinas a ~40-55% del original. Corre en ESP32 (repo
  `siara-cc/Unishox2`, un solo `.c/.h`, ~20 KB de flash) y en el navegador (port JS/WASM).
  El celular comprime, el ESP32 reenvía los bytes, el centro descomprime.
- **Transliteración antes de comprimir:** `String.normalize('NFD')` quita diacríticos. Pasa
  cada tilde de 2 bytes a 1 byte, mejora Unishox2, y ayuda al match con plantillas ASCII.
- **Smaz, gzip y brotli son peores aquí.** Smaz usa codebook en inglés y a veces expande el
  español. gzip tiene ~18 bytes de cabecera fija. Brotli deja ~100-110 bytes en 120 bytes
  de entrada y su encoder pesa mucho en ESP32.

### Airtime a SF7 (BW 125 kHz, CR 4/5)

| Mensaje | Bytes | Airtime |
|---|---|---|
| Plantilla + slots | ~15 | ~43 ms |
| Unishox2 | ~62 | ~113 ms |
| Paquete lleno | 200 | ~318 ms |

Mensajes cortos bajan airtime y colisiones entre las 2 placas. El multi-paquete (fragmentar
con `MSGID + frag_index + frag_total`) queda solo como último recurso: 2-3 paquetes de 200
bytes cuestan ~640-950 ms y suman reintentos.

Fuente: https://github.com/siara-cc/Unishox2

---

## 5. Qué más bajo el mismo principio (edge -> texto corto -> LoRa)

El cuello de botella del sistema es el canal LoRa, no el CPU del celular. Meshtastic frena
sobre 25% de utilización = ~15 s de aire por minuto para TODA la malla. Por eso las ideas
que REDUCEN mensajes o meten más info por byte valen más que la ML vistosa. Lista priorizada:

### Nivel 1 · Alto valor, esfuerzo bajo, 100% offline

1. **Triage por reglas + plantillas + texto predictivo.** Valor: colapsa la entrada rica a
   `plantilla_id` + categoría + severidad, sin modelo de ML. Offline: total, léxico JS de
   ~2-5 KB en español. LoRa: cabe en 30-40 bytes. Ataca el dolor medido (Haití: solo 4.5%
   de 80.000 SMS fue accionable).
2. **De-duplicación en el borde.** Valor: el celular hashea (categoría, GPS redondeado ~50 m,
   ventana de tiempo). Si ya hay un evento igual reciente, suprime el envío o lo marca
   "+1 confirma". Offline: sí, lógica interna. LoRa: elimina paquetes, protege el techo de 25%.
3. **Fusión de prioridad a 1 byte.** Valor: combina categoría + severidad + espera + flags
   (niño/herido/atrapado) en UN score de triage. El centro ordena la cola por ese byte.
   Offline: sí, cálculo numérico. LoRa: 1 byte lleva la decisión completa.

### Nivel 2 · Alto valor, esfuerzo bajo-medio

4. **Phrasebook por ID (traducción offline).** Valor: catálogo cerrado de ~200 frases; LoRa
   manda solo `frase_id` (1-2 B); cada receptor la muestra en SU idioma (español, inglés,
   wayuu, embera). La traducción es un lookup local, no un modelo. Offline: sí. LoRa: 1-2 B.
5. **Plus code / QR + geocodificación inversa local.** Valor: `BarcodeDetector` nativo (o
   jsQR ~50 KB) lee un QR pre-impreso en albergues; `open-location-code` (~15 KB) decodifica
   un plus code offline; una tabla de barrios convierte GPS a "Barrio X". Offline: sí. LoRa:
   cabe en los 8 bytes de lat/lon que ya se mandan.
6. **Codificación inteligente de GPS (geohash/delta).** Valor: posición como delta desde un
   punto base de sesión o geohash truncado. Baja de 8 a 3-5 bytes con ~10-30 m de precisión.
   Offline: sí. LoRa: libera espacio y reduce airtime.

### Nivel 3 · ML que cabe en el edge

7. **Voz -> keyword spotting offline (speech-commands TFJS).** Valor: reconoce palabras
   sueltas para usuarios que no escriben o tienen las manos ocupadas. Offline: sí, ~1-4 MB,
   cabe en flash del ESP32 sin microSD. LoRa: mapea la palabra a un enum de 1 byte. Requiere
   re-entrenar el set en español (el base viene en inglés).
8. **Compresión con diccionario de dominio.** Valor: para el campo de texto libre corto,
   diccionario estático de términos de desastre + Huffman en JS puro. Offline: sí. LoRa: mete
   más caracteres útiles en ~15-20 bytes. Ganancia modesta si el texto ya es corto.

### Nivel 4 · Trabajo futuro (no para 72h)

9. **Foto -> etiqueta "persona" (coco-ssd/mobilenet).** COCO no tiene clases "fuego" ni
   "derrumbe": solo "persona/carro/camión". Los modelos (16-28 MB) exigen microSD y tardan
   20-60 s en bajar por SoftAP. El humano tocando la categoría es más fiable.
10. **OCR de nota/cédula (Tesseract.js).** Útil para reunificación, pero OCR de manuscrito es
    poco fiable y el paquete `spa` pesa ~10 MB + ~2 MB de runtime, requiere microSD.
11. **pHash de foto de desaparecido.** Hash de ~8-16 bytes; da muchos falsos positivos con
    caras. Valor de concepto, no operativo en 72h.
12. **Shake-to-SOS por acelerómetro.** `DeviceMotion` (habilitado por el HTTPS del portal)
    dispara un SOS con el último GPS. Falsos disparos por movimiento normal. Valor bajo frente
    a un botón grande en pantalla.

Fuentes:
- speech-commands: https://github.com/tensorflow/tfjs-models/tree/master/speech-commands
- open-location-code: https://github.com/google/open-location-code
- coco-ssd: https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
- tesseract.js: https://github.com/naptha/tesseract.js

---

## 6. Recomendación para el demo

**Una feature de voz que suma wow sin romper el demo actual:** agrega un botón de dictado en
el portal cautivo que ya sirve la placa. El celular ya abre `AYUDA_AQUI_RESCATISTA_911`, ya
da GPS con `navigator.geolocation`, y el cert de `ayuda.homiapp.xyz` ya habilita el micrófono
por HTTPS (`getUserMedia`). El botón usa Web Speech API on-device de Chrome. El rescatista
dicta "hay dos atrapados en el sótano", el JS extrae categoría (RESCATE) y detalle, arma el
mismo payload `SOS` que ya usan los botones, y el ESP32 lo emite por LoRa sin cambios.

### Por qué esta y no otra

- Reutiliza el frame `SOS|cat|pri|lat|lon|lugar|detalle` que ya existe. Cero cambios en el
  firmware ni en el protocolo.
- La voz es solo otra forma de llenar el formulario. Si falla, los botones actuales siguen ahí.
- El audio nunca cruza el radio. Solo entra el texto corto al payload.

### Plan mínimo

1. Agrega un botón "Dictar" junto a los botones de categoría en el HTML del portal.
2. Al tocarlo, `SpeechRecognition` con `lang = 'es-ES'` y `processLocally: true`. Muestra el
   texto reconocido en un campo editable.
3. Un léxico JS de ~2-5 KB mapea palabras clave a `cat` (atrapado/rescate -> RESCATE,
   herido/sangra -> MEDICO, fuego -> FUEGO) y a `pri` (inconsciente/atrapado -> 0-1).
4. El texto reconocido va al slot `detalle`. El GPS ya viene de `navigator.geolocation`.
5. El POST del portal arma el mismo `SOS` de siempre. El ESP32 lo reenvía.

### Preparación previa (obligatoria)

- En el celular de prueba (Android, Chrome 139+), instala el paquete de voz offline en español
  con una conexión a internet ANTES del demo. Verifica el dictado sin internet de Gboard.
- Ten el respaldo Vosk precargado en el navegador por si el motor del SO no está.
- Regla del demo: durante el evento no debe viajar ningún MB por el SoftAP lento.

---

## 7. Riesgos y límites honestos

- **Web Speech on-device depende del SO.** Si el celular no instaló el paquete de voz offline
  en español, no transcribe sin internet. Prepáralo antes del demo con una conexión.
- **iPhone no sirve para voz offline.** Safari manda audio a Apple. Usa Android para la voz.
- **Servir el modelo sin internet es el cuello de botella.** El SoftAP da ~1-2 Mbps. Bajar
  40-50 MB tarda minutos y bloquea a otros. Precarga el bundle en el celular, no lo bajes en vivo.
- **microSD y LoRa comparten el bus SPI en la T3 V1.6.1.** Servir un archivo grande desde SD y
  transmitir LoRa a la vez chocan. Sepáralos en el tiempo.
- **En portal cautivo el celular suele ser un dispositivo nuevo sin cache.** No asumas cache
  previo. El respaldo Vosk necesita microSD o precarga explícita.
- **Ruido de terremoto baja la precisión de la voz.** El dictado de frases cortas rinde mejor
  que el de frases largas. Deja siempre los botones como respaldo.
- **STT en el ESP32 es frágil.** Keyword spotting solo cubre vocabulario cerrado, pide un
  INMP441 extra, compite por SRAM con WiFi+HTTPS+LoRa, y tiene riesgo alto de falsos positivos.
- **La ML de foto no distingue fuego ni derrumbe.** COCO solo da "persona" de forma fiable.
  No prometas detección de incendio o colapso.
- **El diccionario de plantillas debe estar sincronizado** en firmware y centro. Un código sin
  su frase en el centro produce un mensaje ilegible.
