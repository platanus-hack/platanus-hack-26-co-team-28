# WOKI · Guía de diseño (TV + mirada + EMG)

Son valores iniciales para la hackathon. Cada número trae su origen: **[F]** viene de una fuente y **[P]** es una propuesta a calibrar. El detalle está en `hallazgos/`.

## 1. Montaje

| Parámetro | Valor | Origen |
|---|---|---|
| Distancia de Marta a una TV de 55" | **2 a 2,5 m** | [P], cálculo con 3,7° de error *(02, 06)* |
| Si tiene que estar a 3 m | TV de 65" o más | [P] |
| Canvas | 1920 × 1080 px | [F] Android TV, tvOS |
| Margen seguro | 96 px a los lados, 54 px arriba y abajo | [F] Android TV, Fire TV |
| Tema | Oscuro: fondo #101010, texto #E6E6E6. Nunca #FFFFFF | [F] contraste ~15:1 |

## 2. Objetivos de mirada

| Parámetro | Valor | Origen |
|---|---|---|
| Tamaño mínimo | **2 × el error = 7,4° de ancho** (unos 26 cm a 2 m, unos 470 px en 55") | [P] *(02)* |
| Cantidad por pantalla | **4 frases en 2×2.** Nada más que se elija con la mirada | [F] Valencia 2023 + [P] |
| Separación | 1° como mínimo (unos 4 a 5 cm) | [P] |
| Área activa | 25 % más grande que el dibujo, en cada lado | [F] Majaranta 2009 (la idea) |
| Zonas críticas | Al centro y arriba. Nunca en los bordes derecho e inferior | [F] Feit 2017 |
| Foco | Escala 1,1×, borde de 6 px y anillo de progreso | [F] Android TV + [P] |

## 3. Selección

| Parámetro | Valor | Origen |
|---|---|---|
| Modelo | **La mirada elige la zona y el clic de ceja confirma** | [F] TAGSwipe, Mateo 2008 |
| Tiempo para que la mirada se asiente antes de aceptar el clic | 300 a 500 ms | [P] *(02)* |
| Dwell de respaldo si no hay EMG | **800 ms** (ajustable de 400 a 1.000 ms por Marta) | [F] rangos de Špakov y Majaranta |
| Feedback | Anillo que se cierra + clic sonoro corto. **Sin voz por cada selección** | [F] Majaranta 2006 |
| Respuesta visual al clic EMG | Menos de 100 ms | [P] |
| Repetir la misma zona | Bloqueada hasta que la mirada salga | [F] Tobii |

## 4. Gestos y combos (EMG)

| Gesto | Acción | Notas |
|---|---|---|
| **Ceja corta** | Confirmar lo que se está mirando | Clic principal |
| **Ceja doble** | "Ninguna sirve": abre las iniciales | |
| **Mandíbula corta** | Pedir la palabra: suena "a ver…" con su voz | Convierte en función un recurso que los usuarios ya usan *(05)* |
| **Mandíbula doble** | Abre las reacciones rápidas | |
| **Mandíbula sostenida (≥ 400 ms)** | Deshacer o volver | |
| **Ceja, ceja, mandíbula (en menos de 3 s)** | **EMERGENCIA** | Funciona sin pantalla, aunque esté en descanso. Usa dos canales distintos para reducir activaciones accidentales |
| Cualquier gesto dentro de 3 s después de la emergencia | Cancelar | |

Tiempos de partida [P] *(06)*: 250 ms entre clics, 1,2 s como máximo entre los gestos de un combo y clic largo desde 400 ms. **El veto al tragar** (tercer sensor) anula los gestos de mandíbula.

## 5. Pantallas

### 5.1 Conversación (pantalla principal)
- **Franja de estado** arriba, de 64 a 80 px: mirada, EMG y alarma, cada uno con ícono, texto y color, no solo color.
- **Línea del mensaje** de 72 a 96 px: lo que se va armando. La familia la ve desde lejos.
- **Indicador "Marta está escribiendo…"**, que aparece en menos de 1 s apenas empieza a elegir. Así nadie cambia de tema mientras compone *(05)*.
- **4 tarjetas en 2×2** con texto de 56 a 64 px y 2 líneas como máximo, de unas 10 palabras.
  - El tono varía entre las cuatro: una cariñosa, una neutra, una con humor y una breve *(03)*.
  - Cada tarjeta muestra la emoción propuesta con emoji y color.

### 5.2 Emoción (modelo mixto)
- La IA propone una emoción y **queda aceptada por defecto**: confirmar la frase con la ceja la dice con esa emoción.
- Si Marta sostiene la mirada 800 a 1.000 ms sobre el emoji, se abre un **anillo de 6 emociones**: alegre, cariñosa, irónica, seria, susurro y entusiasmada. Las elige con la mirada y las confirma con la ceja.
- Eviten "triste" y "enojada" como opciones principales, porque casi no se notan en la voz sintética *(04)*.
- La emoción también se ve en la TV, con un emoji de 120 px o más, para la familia.

### 5.3 Iniciales
- Se abre con la ceja doble. Muestra **letras agrupadas en 6 zonas grandes**, no un teclado QWERTY, con 3 o 4 letras por zona.
- Aquí sí se usa el **cursor que se imanta**: se activa solo si hay un objetivo claro, nunca entre dos *(03)*.
- Claude expande las iniciales a 4 frases y se vuelve a la pantalla de conversación.

### 5.4 Reacciones rápidas
- De 8 a 12 audios **pregrabados con su voz** que suenan sin espera: "jaja", "¡no!", "mmm", "¿en serio?", "te quiero", "espera", "¡qué rico!", "jajaja (fuerte)".
- Se muestran en 2×2 por página.

### 5.5 Plan del agente
- Una tarjeta con **1 a 3 pasos visibles**: a quién, qué texto y qué app.
- **Ceja = aprobar, mandíbula sostenida = cancelar.** Si no hay respuesta, se cancela: **nunca se ejecuta por inacción**.
- Las acciones irreversibles (enviar un mensaje, llamar) piden una **segunda ceja dentro de 3 s** *(03)*.

### 5.6 Alarma
- **Dos niveles como máximo:** *Atención* (una campanita cada 20 s) y *Emergencia*.
- **Escalamiento de la emergencia:**

| Tiempo | Qué pasa |
|---|---|
| 0 s | Alarma local, aviso al teléfono, LED rojo fijo, LCD y bandera del servo arriba |
| 30 s | Más volumen, relé y aviso a la familia |
| 90 s | Aviso al contacto 2 |
| Después | Se repite cada 60 s |

- **La alarma no se apaga sola:** solo con el llavero RFID o desde el teléfono. La TV le muestra a Marta *"Camila viene"*.
- Pantalla de alerta: 120 px o más, 4 palabras como máximo, **sin parpadeos de más de 3 Hz** (preferir luz fija).

## 6. Modos

| Modo | Cómo se entra | Qué responde |
|---|---|---|
| Activo | — | Todo |
| Descanso | Mirar fuera de la pantalla 2 s, más una ceja | Solo la ceja larga (para despertar) y la emergencia |
| Vigilia nocturna | Por horario o con un gesto | Solo la emergencia y "llamar". Pantalla casi apagada |
| Señal perdida | 1,5 s sin ver la cara | Mensaje tranquilo: *"No te veo. Usa la ceja"*. Pasa a EMG. Avisa a la cuidadora si dura más de 60 s de noche |
| Íntimo | Combo o ajuste | Sin sugerencias de IA visibles para los demás |

Al volver de una pérdida de señal, el sistema espera 1,5 s antes de aceptar clics.

## 7. Hardware de la cama

| Pieza | Función |
|---|---|
| LCD 16×2 | Busca de la cuidadora: estado + "falta confirmar" o "Camila viene" |
| LEDs | Verde: todo bien. Ámbar: atención o señal débil. Rojo fijo: emergencia |
| Servo | Bandera que se levanta con la emergencia y queda arriba hasta la confirmación |
| RFID | Primer toque = "voy". Segundo toque = "resuelto". Registra quién confirmó |
| Relé | Carga de baja tensión (lámpara o timbre de 5 a 12 V). Nada de 220 V en el escenario |
| Heartbeat entre el Mac y el Uno | Cada 2 s. Si no llega en 6 s, el LCD muestra "SIN CONEXIÓN" |

## 8. Voz

| Parámetro | Valor |
|---|---|
| Motor | ElevenLabs. Flash v2.5 para velocidad, v3 si las etiquetas de emoción valen la latencia. **Midan la latencia en la red del evento** |
| De la confirmación al primer audio | Menos de 500 ms como meta [P] |
| Largo de una frase | 150 a 200 caracteres como máximo |
| Respaldo | Voz del sistema o Personal Voice es-MX, si falla la API o la red |
| Ética | Voz de un integrante voluntario, con consentimiento escrito |
