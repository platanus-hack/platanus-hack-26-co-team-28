# 04. Voz propia, emoción y prosodia en TTS para CAA

Fecha de la investigación: 21-nov-2026. Criterio: **[V]** = leí la fuente (página o PDF completo, o su resumen por WebFetch). **[S]** = solo vi el fragmento en un resultado de búsqueda, sin abrir la fuente. **[I]** = inferencia mía.

## 1. Banco de voz y clonación: comparación

| Opción | Audio que pide | Español | Emoción / control | Costo y acceso |
|---|---|---|---|---|
| **ElevenLabs** (clon instantáneo o profesional) | "Mínimo un minuto para hacer algo, idealmente unos 30 min". El clon de Joyce Esser salió de una entrevista de radio de 4,5 min. Tarda cerca de una semana. [V] https://www.technologyreview.com/2025/02/13/1111882/motor-neuron-diseases-took-their-voices-ai-bringing-them-back/amp/ | v3: 70+ idiomas incluido `es`. Flash v2.5: 32 idiomas, incluye español de España y México. [V] https://elevenlabs.io/docs/overview/models | **Etiquetas de audio** entre corchetes: `[laughs]`, `[whispers]`, `[sighs]`, `[sarcastic]`, `[curious]`, `[crying]`. Se pueden apilar. [V] https://elevenlabs.io/docs/best-practices/prompting/eleven-v3 y [S] https://elevenlabs.io/blog/v3-audiotags | Programa de impacto: licencia Pro gratis por 5 años, renovable, para personas con pérdida permanente de voz. Hay que verificar la voz de forma manual. Más de 11.000 personas atendidas. [S] https://elevenlabs.io/impact-program y https://elevenlabs.io/blog/impact-program-announcement |
| **Apple Personal Voice** | En iOS 26, 10 frases y 1 a 2 min de grabación. Antes eran 150 frases y unos 15 min. [V] https://9to5mac.com/2026/03/19/ios-26-made-one-of-iphones-wildest-most-unique-features-a-lot-better/ | Solo inglés (EE.UU.), **español (México)** y mandarín. No encontré español de Chile ni de Colombia. [V] mismo enlace | No hay control de emoción en la fuente que leí. Funciona con Live Speech, VoiceOver y apps de CAA de terceros. [V] mismo enlace | Gratis. Pide un iPhone con Apple Intelligence para el flujo nuevo. [V] mismo enlace |
| **Acapela My-Own-Voice** | Mínimo 50 grabaciones según la tabla de la MND Association. También acepta audio existente (banco de mensajes). [S] https://www.mndassociation.org/media/5114 y [V] https://speechtechmag.com/Articles/News/Speech-Technology-News/Team-Gleason-Adds-My-Own-Voice-by-the-Acapela-Group-to-Synthetic-Voice-Options-129876.aspx | No pude verificar español. | Dice conservar timbre, acento y entonación. Es una voz estática, sin etiquetas de emoción que yo haya visto. [V] speechtechmag | Cerca de £90 al año o £895 de pago único. Team Gleason lo financia a personas con ELA en EE.UU. [S] |
| **ModelTalker** | 400 recomendadas, hasta 3.155 oraciones, más hasta 1.500 de banco de mensajes. [S] MND Association | No verificado. | Voz estática [I]. | Cerca de US$100. [S] |
| **SpeakUnique** | 150 oraciones o entre 2 y 7 min de audio existente (los gráficos de la MND Association no coinciden). [S] | No verificado. | No verificado. | £175 por la voz. [S] |
| **VocaliD** | No lo pude verificar. No salió en ninguna búsqueda útil. | | | |

Notas de calidad:
- ElevenLabs v3 es el modelo más expresivo pero tiene límite de 5.000 caracteres y la doc dice que los clones profesionales "no están totalmente optimizados" para v3. La doc recomienda v4 para ellos. [V] https://elevenlabs.io/docs/best-practices/prompting/eleven-v3
- Para tiempo real, la doc de modelos señala Flash v2.5 (~100 ms mediana, sin contar red) o la variante Conversational de v3 (~165 ms). No lista latencia de v3 base. [V] https://elevenlabs.io/docs/overview/models. Un benchmark independiente midió una mediana de 197 ms hasta el primer audio con Flash v2.5, en 50 pruebas. [S] https://humannessindex.vapi.ai/models/elevenlabs-flash-v2-5
- La guía de v3 recomienda estabilidad "Creative" o "Natural" para que respondan las etiquetas. "Robust" las ignora más. [S] https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-alpha
- Riesgo de dependencia: quien bancó su voz con una empresa puede quedar atado a ella. Solo ModelTalker y SpeakUnique guardan la voz en sus servidores tras la compra, así que hay que respaldar. [S] https://www.fastcompany.com/90896931/apple-iphone-personal-voice-als-voice-banking y https://csd.uiowa.edu/sites/csd.uiowa.edu/files/2025-08/Voice_Banking_Guide.pdf

## 2. Qué dicen los usuarios sobre la voz

Verificado (artículos leídos):
- **Jules Rodriguez (ELA)**: usa su clon para sets de comedia y dice "siento que la gente me entiende mejor comparado con mi voz bancada". Pero el clon suena emocionalmente plano y le cuesta transmitir ciertos sentimientos. Su esposa lo llamó "agridulce". [V] https://www.technologyreview.com/2025/02/13/1111882/motor-neuron-diseases-took-their-voices-ai-bringing-them-back/amp/
- **Joyce Esser (ELA bulbar)**: perder la voz fue "un asunto enorme porque es una parte muy grande de quien soy". Le parece bueno "para frases preparadas, pero no para conversación". Le sobra velocidad, le falta volumen y quiere una forma de marcar emoción, por ejemplo con emojis. La conversación es "un juego de ping-pong muy lento" (dicho por la esposa de Rodriguez). [V] mismo enlace
- **Richard Cave (logopeda)**: las voces tienen "la autenticidad de la voz" pero no "la autenticidad de la entrega". [V] mismo enlace
- **Colin Portnuff (ELA)**, en Pullin y Hennig: "Quiero poder sonar sensible o arrogante, asertivo o humilde". También dijo que cambiaría su voz por una más expresiva si la inteligibilidad se mantiene. [V] https://pmc.ncbi.nlm.nih.gov/articles/PMC4487598
- **Usuarios de CAA en CHI 2025**: "El tono que tengo en la cabeza no se traduce bien al dispositivo". Las voces de los dispositivos hacen que un chiste suene enojado o plano. Participantes con ELA no entraron en ese estudio (parálisis cerebral, TBI, autismo y otros). [V] https://arxiv.org/html/2410.16634
- **P1 de Voicesetting (ELA)**: poder usar su voz propia "por primera vez en cinco años". [V] PDF de Microsoft en https://microsoft.com/en-us/research/uploads/prod/2018/01/voicesetting.pdf

Con fuente solo parcial:
- **Steve Gleason** bancó su voz tras el diagnóstico en 2011. Un resultado de búsqueda dice que su voz sintética no le permite expresar las emociones que quiere con sus hijas, y que las soluciones disponibles "no toman acento, tono, inflexión ni cadencia". No pude abrir la fuente original. [S] https://www.fastcompany.com/90896931/apple-iphone-personal-voice-als-voice-banking (devolvió 403) y https://speechtechmag.com/... (no contiene esa cita).
- **Pat Quinn**: no bancó su voz. Lyrebird (Canadá) la clonó con entrevistas del Ice Bucket Challenge (una fuente habla de 2 a 3 horas de audio). La usa con eye tracking. [S] https://fortune.com/2018/04/12/als-ice-bucket-challenge-project-revoice/. No encontré una cita suya sobre emoción.
- **Brad Smith (Neuralink PRIME, ELA)**: voz clonada por ElevenLabs a partir de grabaciones previas. Grok le redacta respuestas y él dijo "soy responsable del contenido, pero usé IA para redactar". [S] https://www.ibtimes.com/first-non-verbal-als-patient-elon-musks-neuralink-brain-implant-creates-video-featuring-ai-cloned-3771626 y https://futurism.com/nonverbal-neuralink-patient-grok-answers. No encontré testimonio suyo sobre emoción o incomodidad.
- Reacción de familias: lágrimas de la esposa al oír el clon; una hija que nunca oyó la voz original preguntó "¿eres tú, papá?". [S] https://www.wbur.org/upnext/2026/08/13/artifical-intelligence-ai-voice-clone-cancer-als
- No encontré un testimonio de ELA que describa **incomodidad** con su propio clon, salvo lo "agridulce". Es un vacío. Hay una guía hospitalaria sobre consentimiento ("es su voz, su decisión"). [S] https://media.wbur.org/wp/2026/08/BCH-AI-voice-cloning-guiding-principles-statement.pdf

## 3. Investigación sobre CAA expresiva

**Voicesetting (CHI 2018, Microsoft Research)** [V] https://microsoft.com/en-us/research/uploads/prod/2018/01/voicesetting.pdf
- Dos interfaces: *Expressive Keyboard* (emojis y puntuación como operadores sobre la frase, más "Active Listening Mode" con reacciones vocales) y *Voicesetting Editor* (control fino por token).
- Pruebas con personas con ELA: sesión breve (7 personas, ~20 min) y sesión larga (4 personas, 1 h). Muestras pequeñas y con sesgo de positividad que los propios autores reconocen.
- Reacciones más útiles según los participantes (escala 1 a 5): risa 4,6, "argh" 4,0, "ugh" 4,0, "oh" 3,7, "hmm" 3,6. Las menos útiles: el "pfft" sarcástico y la inspiración brusca.
- Emojis más útiles: "gracioso" 4,0, "feliz" 3,9, "triste" 3,9, "irritado" 3,7, "sarcástico" 3,6, "enojado" 3,6, "sorprendido" 3,0.
- Frecuencia esperada de uso (1 a 6): ALM con reacciones en voz propia 4,7, ALM 4,6, teclado de emojis 4,0, editor 3,0.
- Tiempos: el editor tomó 182 s de media contra 73,6 s del teclado de emojis (2,81 veces más), sin contar el tipeo. Los usuarios lo veían para frases guardadas y cuidadas, no para habla en vivo.
- Calidad: la emoción prevista fue la respuesta más frecuente solo en el 50% de las preguntas. Ninguna condición se parecía a la grabación de un actor en preguntas con énfasis fuerte. Es una limitación del TTS de 2018, no un resultado válido para v3 de hoy [I].
- La cónyuge de un participante: las parejas íntimas aprenden a distinguir los tonos, "pero un interlocutor ocasional quizá no".

**Pullin y Hennig 2015 (PMC)** [V] https://pmc.ncbi.nlm.nih.gov/articles/PMC4487598
- 40 personas con experiencia en CAA dieron 257 descriptores de tono distintos. Los descriptores emocionales fueron menos de la mitad. El tono es también social, no solo emoción (por ejemplo "seguro", "humilde", "irónico").
- Prototipo "Speech Hedge": 16 tonos elementales combinables. Efectividad percibida más baja cuando no hay variación de tono.

**Why So Serious? (CHI 2025, Cornell Tech)** [V] https://arxiv.org/html/2410.16634
- 7 entrevistas y 5 usuarios en estudio con 4 interfaces. Los participantes sentían que siempre "se quedan atrás". Algunos cedían agencia a la IA por rapidez (la interfaz de selección automática les gustó por simple). Muchos usaban la sugerencia como inspiración y tipeaban su propia versión. Los prototipos no abordaron voz ni entonación.
- Velocidad CAA citada: 12 a 18 palabras por minuto contra 125 a 185 del habla.

**Speak Ease (arXiv 2025)** [V] https://arxiv.org/html/2503.17479v1
- Seis estados de ánimo (feliz, asustado, triste, enojado, neutral, asco) y destinatario. Para la voz, 5 frases grabadas por emoción. Evaluación con 4 logopedas, sin usuarios de CAA y sin medir latencia. Dijeron que la emoción casi no se notaba, sobre todo triste y enojado, y que los emojis cambiaban poco la voz. Les inquietó la autoría de la frase.

**Backchanneling en CAA (arXiv 2025, Cornell Tech)** [V] https://arxiv.org/html/2506.17890v1
- El timing es el obstáculo principal según las 4 logopedas. Escribir "mm-hmm" es difícil y llega tarde. El backchannel ronda 19% del diálogo hablado (cita de Jurafsky 1997 dentro del paper).
- Soluciones propuestas por los participantes: frases rápidas ("sí", "no", "espera", "te escucho"), sonidos pregrabados (un logopeda grabó la risa de un familiar porque la sintética sonaba falsa), señales no vocales en paralelo (ceja, vibración, sensores fisiológicos), atajos con tono ("¡guau!" de apoyo contra "¿en serio?" escéptico).

**Lo que no encontré**: ningún paper de ASSETS que mida controles de emoción por mirada o EMG, ni uno que mida cuánto tarda una persona en elegir emoción en un gaze keyboard. Tampoco ensayos con español chileno o colombiano. [V como ausencia en mis búsquedas]

## 4. Patrones de interfaz para elegir emoción

Lo que mostró la evidencia:
- **Selector previo de ánimo**, estilo Speak Ease: simple, pero la emoción se aplica a todo y no se percibió fuerte. [V]
- **Etiqueta por frase con emoji**, estilo Voicesetting: rápido (73,6 s en una sesión exploratoria que incluía probar todo) y valorado, pero el efecto sutil. [V]
- **Reacciones vocales** (risa, "argh", "hmm") como botones propios: las más usadas y mejor valoradas. [V]
- **Control fino por token**: demasiado lento para vivo, útil para frases guardadas. [V]
- **Deslizadores**: no encontré evidencia de uso en CAA. Con 1,5 a 3,7 grados de error de mirada no son viables como control principal [I].

Modelo mixto en TV [I, sin evidencia directa]:
1. Claude devuelve, junto con las 4 frases, una emoción por frase (por ejemplo `[cariñoso]`, `[bromista]`, `[firme]`) y un emoji grande al lado.
2. El estado por defecto es **la emoción propuesta ya aceptada**. Un clic EMG confirma y habla. No pide un paso extra para el caso feliz.
3. Para cambiarla: mantener mirada en el emoji 0,8 a 1 s (o un gesto de cabeza) abre un anillo de 5 a 6 emociones en zonas grandes. Un clic EMG elige. Esto replica el patrón "agencia por eficiencia" de CHI 2025 [V], con corrección rápida.
4. La emoción se traduce a etiquetas de v3 o a una etiqueta de estilo. El respaldo es pitch y velocidad si falla.
5. La familia ve el emoji en la TV. Esto cubre el problema de que los tonos sutiles los distinguen solo los interlocutores íntimos [V Voicesetting] y da una señal visual donde el TTS es débil.

## 5. Problemas prácticos

- **Latencia**: ElevenLabs Flash v2.5 ~100 ms nominal, ~197 ms medido por terceros en primer audio. Para v3 solo hay cifras de la variante Conversational (~165 ms). [V/S enlaces arriba]. Para la demo hay que **medir en el sitio** con la red del evento. No hay medición mía.
- **Cuello de botella real**: es la selección, no el TTS. En CHI 2025 los usuarios sufrían más el retraso de la interfaz que el de la API. [V] https://arxiv.org/html/2410.16634
- **Silencio tolerado**: no hay umbral validado. Guía clínica: esperar al menos 10 s; en un estudio con pausas de 2, 10 y 45 s las pausas largas dieron más respuesta. [S] https://support.ablenetinc.com/aac-education-and-resources/wait-time/. Un silencio largo puede percibirse como menos competencia comunicativa. [S]
- **Reacciones cortas**: pregrabar ("jaja", "¡no!", "mmm", "¿en serio?", "te quiero") evita la latencia y el problema de que el TTS suene falso. [V backchanneling + Voicesetting]. Generarlas una vez con la voz clonada y guardarlas como audio local es lo más viable [I].
- **Superposición**: el backchannel es corto y se solapa con el otro hablante por diseño. No encontré estudio sobre interrumpir con voz sintética. Hay que permitir que un audio corto pregrabado suene sin esperar turno [I]. Un aviso visual de "te quiere interrumpir" (luz o pantalla) ayuda [I; los autores del paper de backchanneling lo proponen como "gesto de espera"].
- **Voz que "se cansa"** en textos largos (Rodriguez) y límite de 5.000 caracteres en v3. Frases cortas lo evitan. [V]

## Insights accionables para WOKI

1. **La voz propia no es el diferenciador contra Apple; la entrega sí.** Personal Voice y Apple Eye Tracking ya ofrecen voz propia y mirada gratis. Lo que los usuarios piden y no tienen es la "autenticidad de la entrega" (Cave) y poder marcar emoción (Esser, Rodriguez). WOKI debe mostrar eso en la demo.
2. **Español: Apple solo cubre México.** Para Chile o Colombia, un clon de ElevenLabs en `es` es la ruta más realista. Presentar a Apple Personal Voice (es-MX) como alternativa gratuita con acento distinto [I].
3. **Pre-generar el set de reacciones** ("jaja", "¡no!", "mmm", "¿en serio?", "te quiero", "espera", "¡qué rico!") con la voz clonada y guardarlo como audios locales de 0 ms. Es lo mejor respaldado por la investigación (risa es el efecto mejor valorado, 4,6/5).
4. **Emoción por defecto aceptada, cambio opcional**: la IA propone, un clic EMG confirma, un sostén de mirada abre el anillo. Así el 80% de los casos [I, sin dato] cuesta cero pasos adicionales.
5. **Mostrar la emoción en pantalla** (emoji + color en la TV), porque los tonos sutiles solo los distinguen los cercanos y porque Speak Ease encontró la emoción en voz poco perceptible. Es un puente cuando el TTS no alcanza.
6. **No dejar que Claude elija emoción sin posibilidad de corregirla**: hay un tema de autoría (Speak Ease, Brad Smith: "soy responsable del contenido") y la gente usa las sugerencias como inspiración. La confirmación es una decisión de diseño, no un obstáculo.
7. **Frases cortas y pregrabadas para lo urgente**, TTS en vivo para lo demás. Medir el primer audio en el lugar con Flash v2.5 o v3 Conversational antes del congelamiento de las 14:00.
8. **Emociones soportadas: pocas y distintas**. El Speak Ease ya mostró que "triste" y "enojado" casi no se notan; la risa y el tono sarcástico/cariñoso sí se aprecian. Empezar con 5 o 6 [I].
9. **Plan B de voz**: tener una voz de respaldo (Apple Personal Voice o voz del sistema es-CL/es-MX) para cuando la API falle o no haya red en el escenario [I].
10. **Consentimiento y propiedad en la demo**: usar la voz de un voluntario que dé su consentimiento claro, no la de una persona con ELA sin autorización. Hay guías hospitalarias sobre esto [S].

## Recomendaciones de diseño con números

Todos son propuestas [I], salvo los marcados.

- **Anillo de emociones**: 5 o 6 zonas, cada una de al menos 1/3 del ancho o alto de la pantalla en cada eje. Es coherente con el error de mirada de 1,5 a 3,7 grados del BRIEF.
- **Dwell para abrir el anillo**: 800 a 1.000 ms. Selección con EMG, sin dwell.
- **Reacciones pregrabadas**: 8 a 12 audios de 0,3 a 1,5 s, con un atajo EMG de 1 o 2 gestos para las 3 más usadas (risa, "no", "mmm").
- **Latencia objetivo** desde la confirmación hasta el primer audio: menos de 500 ms para frases generadas con Flash o Conversational. Basta con el dato de 100 a 200 ms de proveedores más red [V/S]; validar en sitio.
- **Frases generadas**: máximo 150 a 200 caracteres cada una (muy por debajo del límite de 5.000 de v3 [V]).
- **Emojis en TV**: al menos 120 px de alto en una pantalla de 1080p, mirada a 2 a 3 m.
- **Muestras de voz para el clon de la demo**: 1 min como mínimo, 30 min como ideal [V MIT Tech Review]. Prever una semana para el clon profesional [V]; para la hackathon, usar el clon instantáneo.
