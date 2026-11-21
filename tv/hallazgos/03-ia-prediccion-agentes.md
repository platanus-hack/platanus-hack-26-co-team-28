# 03. Predicción de texto con IA, sugerencias de LLM y agentes en CAA

Fecha de la investigación: 21-nov-2026. Tema: lo que sabemos sobre sugerencias de LLM, agentes que actúan y cursores que predicen, para WOKI (Marta, ELA media, mirada por webcam de 1,5 a 3,7 grados de error, clic EMG, pantalla grande).

Convención: **[V]** = leí la fuente (texto completo o resumen del artículo). **[P]** = solo vi snippet o resumen de buscador; no la leí entera. **[I]** = inferencia mía, no está en la fuente.

---

## 1. SpeakFaster (Google, Cai et al., Nature Communications, nov 2024)

Fuente principal del paper: https://www.nature.com/articles/s41467-024-53873-3 (no pude abrirla, pide cookie) y PMC https://pmc.ncbi.nlm.nih.gov/articles/PMC11530652 (verificación del navegador). Lo que sigue lo **verifiqué en el preprint arXiv** (misma línea de trabajo, v1): https://arxiv.org/html/2312.01532v1 [V]. Los números del Nature pueden diferir un poco.

**Interfaz [V]**
- Vía "solo iniciales": la persona teclea la primera letra de cada palabra (ejemplo del paper: "ishpitb" para "I saw him playing in the bedroom"). La interfaz muestra **5 frases candidatas**; el número salió de simulaciones que mostraban rendimientos decrecientes más allá de 5.
- Si ninguna sirve, vía **KeywordAE**: botón "Spell", la persona escribe completas (v1) o parcialmente (v2, ej. "bedr") algunas palabras clave, y el modelo vuelve a expandir. Este es exactamente el "plan B" que WOKI quiere (iniciales, luego expandir).
- Vía **FillMask**: si la frase casi sirve pero una palabra está mal, se selecciona esa palabra y el modelo ofrece alternativas que empiezan con la misma letra. Es el patrón "casi correcta, edítala" más concreto que encontré.
- Selección por mirada: clic de mirada en un botón de altavoz junto a la frase elegida, y eso dispara el texto a voz.
- El contexto (turnos previos de la conversación) entra a los LLM y mejora mucho la precisión.

**Resultados [V]**
- Simulación: tasa de ahorro de teclas (KSR) 0,657 con SpeakFaster vs 0,482 con Gboard, con contexto.
- Participante de laboratorio con ELA (LP1): 6,54 vs 4,05 palabras por minuto (wpm) en diálogos con guion (+61,3 %, p = 0,011). Sin guion: 6,38 vs 4,37 wpm (+46,4 %), **no significativo**.
- Participante de campo con ELA (FP1): 10,4 vs 8,1 wpm en su uso diario (+28,8 %, p = 0,003).
- Resumen del abstract: aumentos de 29 a 60 % con **solo 2 usuarios** con ELA. Piloto móvil con 19 personas sin discapacidad: sin diferencia significativa de velocidad (13 % más rápido con guion, 10 % más lento sin guion).
- LP1 practicó 4,1 horas en dos días.
- Límites que reconocen los autores: sin tolerancia a errores de tipeo en las iniciales, solo inglés, frases de hasta ~10 palabras, depende de contexto, latencia de nube, **sobrecarga cognitiva de revisar opciones**, brecha entre ahorro simulado y observado.
- No reportan satisfacción cualitativa formal en el preprint.

Lección [I]: la ganancia real fue ~30 a 60 % en wpm, no un salto de 5×. El ahorro de teclas simulado se come parte de su valor en leer y descartar opciones.

Blog de Google (cifras coinciden con las de arriba): https://research.google/blog/speakfaster-revolutionizing-communication-for-people-with-severe-motor-impairments/ [P]

## 2. Cai et al., NAACL 2022 (base técnica de SpeakFaster)

https://arxiv.org/abs/2205.03767 [P, abstract]
- Un LLM de 64B expandió exactamente más del 70 % de las frases con abreviaturas de hasta 10 caracteres, para primeras respuestas, con KSR de hasta ~77 % sobre esas expansiones exactas.
- Un solo turno de contexto **más que duplicó** la precisión frente a sin contexto; el efecto es mayor en frases largas.
- Afinar con datos ruidosos mejora la robustez a errores de tipeo.
- Insight [I]: lo que más sube la precisión es el contexto de la conversación. Para WOKI, lo que dice la otra persona (transcrito) es la entrada más valiosa.

## 3. Valencia et al., CHI 2023: "The less I type, the better"

Título real: **"The less I type, the better": How AI Language Models can Enhance or Impede Communication for AAC Users** (no se llama "Less is more"). Autores: Valencia, Cave, Kallarackal, Seaver, Terry, Kane. https://research.google/pubs/the-less-i-type-the-better-how-ai-language-models-can-enhance-or-impede-communication-for-aac-users/ . Texto completo que leí: https://discovery.ucl.ac.uk/10185220/1/3544548.3581560.pdf [V]

**Diseño [V]:** 12 usuarios de CAA, 3 "speech macros" (prompts de LLM): extender una respuesta corta, responder preguntas biográficas, pedir ayuda ("Turn words into requests"). El prototipo mostraba **las primeras 4 respuestas** del modelo "para que quepan en pantalla sin scroll" y como número manejable, comparable al de los sistemas CAA actuales. Variabilidad (temperature) 0,6: a veces repetía frases.

**Qué valoraron [V]**
- La mayoría dijo que las macros eran "muy" o "extremadamente" útiles. La más valorada: convertir palabras sueltas en pedidos (rutina, autocuidado, accesibilidad, médico). P11: en situaciones de estrés médico le ayudaría a dar detalles a los médicos "cuando todo va tan rápido que no puedo seguir".
- Usarían la sugerencia como **punto de partida**. P11: "uso una frase predicha, borro la última palabra y escribo la mía".
- Compartir información de fondo (contexto personal) a la IA fue "extremadamente útil" para la mayoría.

**Problemas [V]**
- **Tono y estilo:** la crítica más común fue que las frases no reflejaban su estilo ni la imagen que querían proyectar. Las frases eran "demasiado simples" e impersonales ("witty" P2, "positive" P8). Si faltaba su personalidad o valores, **no las usarían**. P9 temía sonar "robótico". P12: "¿Van a hablar todos los usuarios de CAA de la misma manera?"
- **Tono implícito inventado:** el modelo insertaba hechos no dados ("I worked from 8am to 6pm") o un tono negativo que la persona no quería (P10, entrada "work" para "¿quieres pizza?"). P3: dijo "it's going" para algo neutro y le devolvió "it's going pretty good". Usuarios inventaron convenciones (añadir "+" para pedir respuestas positivas).
- **Posición social:** 5 de los participantes (P6, P8, P9, P10, P12) encontraron respuestas demasiado abruptas ("I'm already at work") frente a otras socialmente correctas ("Lo siento, no puedo salir esta tarde").
- **Autonomía y autoría:** seleccionar una frase automática hace que otros crean que "el sistema lo hizo todo". P8: "Alguien dijo 'oh, el dispositivo hizo eso por ti'. Fue insultante." P10: solo deja que pocas personas íntimas lo vean teclear; si ve que elige una frase generada, "cambia el significado" de esa comunicación íntima; P8 no usaría macros con familia y amigos. El **esfuerzo visible** funciona como señal de cariño.
- **Editar es contraproducente:** si hay que editar o reescribir, se pierde el ahorro de teclas.
- **Privacidad:** querían saber si los datos están cifrados, cómo apagar la escucha continua; sin transparencia "no lo usarían".
- Recomendación del paper: mostrar predicciones mientras escribe ayuda a decidir cuándo usarlas o teclear.

**Implicación fuerte para WOKI [I]:** Marta usa la IA con la familia, justo el caso donde P8 y P10 dijeron que no la querían. Hay que dejar elegir cuándo se muestran sugerencias y no marcar a la persona como "el aparato lo hizo".

## 4. Autoetnografía "I, Robot?" (arXiv 2509.13671, Weinberg, Gonzalez Penuela, Valencia, Roumen)

https://arxiv.org/abs/2509.13671 (abstract [V]), detalles: https://arxiv.org/html/2509.13671v2 (leí los primeros 100.000 de 130.000 caracteres [V]). Un solo autor, usuario de CAA e investigador: **no generalizable**.
- Entrenó un modelo con 7 meses de sus mensajes (19.764 mensajes, 247 hilos; GPT-4.1-mini afinado, ~120 USD de entrenamiento) y lo usó 3 meses.
- **Privacidad / integridad contextual:** el modelo sacó a la luz detalles privados (historia familiar, religión) en contextos donde no cabían (presentaciones académicas, charla casual).
- **Autocensura por el registro:** las 2 primeras semanas de registro dejó de decir groserías, chismes y humor negro; "No quiero que el LLM aprenda esto de mí". Curar los datos produjo un modelo que solo reflejaba lo "bien portado" de su identidad.
- **Pantalla visible:** en bares la gente leía la pantalla; un amigo: "desde que usas la app, siempre pienso si me habla él o la IA".
- **Uso real:** aceptó 153 sugerencias de 6.564 mensajes (2,3 %); longitud media 7,5 palabras; en 114 de las 153 aceptó todas las palabras ofrecidas. Ayuda 3,61/5, control de autoría 3,94/5. En el aeropuerto: 130 sugerencias, todas rechazadas.
- **UI:** texto fantasma (ghost text) tras el cursor al pulsar espacio; cualquier tecla lo cancela; **aceptación palabra por palabra** (fuente clave de agencia); interruptor arriba para activar/desactivar.
- **Cultura:** el modelo reprodujo su argot argentino y Spanglish; un día tecleó 8 de 25 palabras. Relevante para español chileno/colombiano [I].
- **Implicaciones del paper:** decidir cuándo mostrar sugerencias según quién ve la pantalla; identidad modular por contexto/relación; detectar si la persona está componiendo o explorando; control del usuario sobre cuánto sugiere y qué aprende; chequeos periódicos de "¿suena como tú?".
- Por qué importa: mucho historial personal da estilo, pero el costo es privacidad y autocensura [I].

## 5. Humor y autoría: "Why So Serious?" (CHI 2025)

https://arxiv.org/html/2410.16634 (leí 100.000 de 145.000 caracteres [V]). 7 entrevistas, estudio con 5 usuarios de CAA. Cuatro interfaces con distinto control:
- **Context Bubble Selection** (la persona toca burbujas de la conversación para fijar el contexto): la mejor en coincidir con la intención y en timing, aunque pedía más clics.
- **Keywords**, **Wizard** (3 comentarios tras elegir palabras y asociaciones; "demasiados pasos") y **Full-auto** (la IA elige; refrescar si no gusta).
- "Los usuarios de CAA están dispuestos a cambiar agencia por eficiencia" para chistes breves, donde el momento importa más que la redacción exacta. Aun así P1: "a veces sentí que no tenía el control".
- Varias personas usaron la sugerencia como inspiración y la **retocaron** (P2, P4) para hacerla más personal.
- Varias opciones dan elección pero tardan más en leerse en conversación rápida; algunos preferían 1 sola sugerencia por simplicidad.
- Con mirada hubo problemas de scroll y objetivos pequeños.
- Voz monótona: no transmite sarcasmo ni énfasis (conecta con las emociones de WOKI).
- El abstract de otro trabajo del mismo grupo advierte que depender del autocompletado puede limitar comentarios espontáneos e impredecibles [P, vía buscador].
- Insight [I]: para un "te quiero" o un chiste, 1 gesto rápido sobre una frase corta vale más que control fino.

## 6. KWickChat, Kristensson y otros

- **KWickChat** (Shen, Yang, Dudley, Kristensson, IUI 2022): sistema de diálogo multi-turno; el usuario escribe palabras clave y un LLM expande a frases con datos del usuario y el diálogo del interlocutor. Reportan ahorro de teclas ~71 % con umbral de tasa de error de palabra 0,65. Paper: https://www.pokristensson.com/pubs/ShenEtAlIUI2022.pdf [P, snippet]. Kristensson cita ahorros teóricos del 50 al 96 % en predicción de oraciones con contexto [P].
- **LLM a nivel de carácter para CAA** (arXiv 2501.10582): https://arxiv.org/html/2501.10582v3 [P], reporta publicar código y modelos.
- **Predictive Anchoring** (arXiv 2408.11140): pulsación larga sobre un botón del grid abre un overlay radial con **4 sugerencias** de vocabulario relacionado. Es solo un póster de diseño, sin estudio con usuarios; deja "cuántas opciones" como pregunta abierta [V]. https://arxiv.org/html/2408.11140v1
- **Multi-System Cognitive Steering** (arXiv 2610.19177, BiAlign Workshop CHI 2026): contexto multimodal (objetos de la escena, emoción, motivo) sube la precisión top-5 de la expansión de abreviaturas hasta ~88 %, el doble que sin contexto, en benchmarks **simulados** [V, abstract]. Sugiere que la emoción se puede controlar mejor que el texto del prompt. https://arxiv.org/pdf/2610.19177 [I]: encaja con el modelo mixto de emociones de WOKI.
- **SPICA** (IUI 2026, Pal et al., Buffalo; Higginbotham como coautor): agente conversacional para CAA con perfil personal, memoria indexada, herramientas internas y módulo de plan. Informe técnico: https://cse.buffalo.edu/tech-reports/2026-27.pdf [V parcial]. Muestra **3 respuestas candidatas más una opción de "volver a empezar"** por turno. Latencia 10,2 ± 4,8 s. Los expertos calificaron 4,2-4,6/5 y el interlocutor 3,3-3,6/5. Problemas: **tono que se desvía** en temas emocionales (a veces groserías o formalidad que no eran del usuario), y **la selección multi-opción repetida causa fatiga cognitiva y física**. Evaluación con pocos participantes en vivo.

## 7. Productos con IA

| Producto | Qué hace con IA | Nº de sugerencias | Estado de verificación |
|---|---|---|---|
| Vocable (Ablenet / WillowTree) | "Smart Assist" en Listening Mode: GPT sobre Azure da más opciones de respuesta; uso por seguimiento de cabeza (ARKit) con dwell | no indicado | [P] App Store https://apps.apple.com/app/id1497040547 ; https://support.ablenetinc.com/speech-app/vocable/ . El listado dice © 2023: puede estar desactualizado |
| Voixa | Transcribe en vivo y sugiere respuestas; modo confirmación que repite lo oído; frases fijadas; modos por lugar (mostrador, médico); 16 idiomas con español de España y Latam; audio no sale del dispositivo salvo transcripción en la nube | la web dice 3, la App Store dice 5 (contradicción) | [V] https://getvoixa.pages.dev/ ; https://apps.apple.com/mx/app/voixa/id6761738528 [P] |
| Lingraphica "Conversations" | Transcribe, sugiere respuestas; la persona añade palabras clave, elige una intención (acordar, preguntar) o regenera. Backend propio, sin LLM público, datos anónimos y opt-in. Lanzado jun-jul 2026. Prueba con 13 personas: 4,8/5 experiencia, 4,9/5 utilidad (cifras de la empresa) | "varias", sin número | [V] https://lingraphica.com/resources/conversations-how-its-made/ |
| Cboard | IA solo para **generar tableros** (cboard-ai-builder, código abierto). Su blog afirma predicción que aprende; no pude verificarlo | n/a | [P] https://github.com/cboard-org ; https://www.cboard.io/en/blog/2023-10-30-artificial-intelligence-to-improve-phrases/ |
| Cognixion Axon-R | Casco AR con EEG + IA generativa para ELA tardía; ensayo NCT06810219 (hasta 10 participantes), sin resultados publicados; la velocidad "casi conversacional" es afirmación de la empresa; desde 25.000 USD | n/a | [P] https://www.cognixion.com/blog/2025/8/15/a-new-way-to-communicate-for-people-living-with-als ; https://www.biospace.com/press-releases/cognixion-launches-clinical-trial-for-late-stage-als-to-deliver-conversation-level-communication-with-adaptive-ai-driven-brain-computer-interface |

No encontré información verificable sobre "Talk by Cognixion" como producto separado. Voixa, Vocable y Lingraphica **se enfocan en responder a lo que dice el interlocutor** (modo escucha); ninguno que haya visto combina mirada por webcam, EMG, voz clonada y agente [I].

## 8. Agente que actúa

**Lo que encontré [P]:** no hallé ningún estudio revisado por pares que junte agentes de computer-use, discapacidad motora y mirada. Lo más cercano:
- A11y-CUA (arXiv 2602.09310, CHI 2026): los agentes de uso de computadora ignoran cómo trabajan usuarios ciegos y de baja visión; es por analogía. https://arxiv.org/abs/2602.09310
- Ensayo de Salesforce que pide diseñar agentes con usuarios de teclado y switch: opinión, no estudio. https://www.salesforce.com/blog/accessible-ai-experiences/
- SPICA (arriba) lista "agentes multimodales" como trabajo futuro; no ejecuta acciones externas [V].

**Patrones de confirmación (fuentes de industria, no académicas) [P]:**
- Puerta de aprobación **justo antes del paso con efecto externo o irreversible** (AWS, https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentsec04-bp02.html).
- Gravedad alta e irreversible: aprobación explícita; reversible: ventana corta de deshacer.
- Antipatrón: pedir aprobación para todo causa fatiga y aprobaciones automáticas (https://aws.amazon.com/blogs/machine-learning/implement-human-in-the-loop-confirmation-with-amazon-bedrock-agents/).
- Un blog de DEV citaba cifras que no pude verificar; las ignoro.

**Inferencias para WOKI [I]:**
- Mostrar el plan como **tarjeta de 1 a 3 pasos en lenguaje de Marta**, con destinatario y texto en grande ("Enviar a Camila por WhatsApp: llego a las 8"), y un único botón grande de aprobar con confirmación EMG; cancelar con otro gesto distinto o con mirar a otra zona.
- Clasificar acciones: reversibles (Spotify, luz) se ejecutan con un solo gesto y botón de deshacer; irreversibles (mensajes enviados, llamadas, pagos) piden doble confirmación; emergencia salta el plan y va por combo directo.
- Lista cerrada de herramientas hace posible mostrar siempre el mismo formato de tarjeta y reduce el riesgo.

## 9. Cursor que predice

- **Bubble cursor** (Grossman y Balakrishnan, CHI 2005): el área activa se redimensiona según el objetivo más cercano; supera al cursor puntual y a object pointing, y se modela con Fitts [P]. Solo supe de snippet; no encontré el porcentaje exacto de mejora. https://www.dgp.toronto.edu/papers/tgrossman_CHI2005.pdf
- **MAGIC pointing** (Zhai et al., CHI 1999): mueve el cursor hacia donde cae la mirada para compensar imprecisión; depende de identificar el objetivo cercano [P]. https://latin.ime.usp.br/media/papers/pdf/MAGIC.pdf
- **Ninja cursors** (Räihä y Špakov, CHI 2009): la mirada elige entre varios cursores [P]. https://homepages.tuni.fi/oleg.spakov/publications/Raiha_CHI_09.pdf
- **Predicción del destino de selección por mirada**: Wei et al. CHI 2023 (endpoint de ojo y cabeza en AR; mejora la precisión) [P]; Jo et al. arXiv 2411.06726, modelo bayesiano más ML, precisión 0,97 y F1 0,96 al inferir si hay intención de selección solo con mirada [V, abstract]. https://arxiv.org/abs/2411.06726 ; CasualGaze (arXiv 2408.12710): 96,47 % de precisión en simulación offline [P].
- **Ningún estudio que vi combina mirada + LLM que predice el objetivo con usuarios con ELA** [I: no lo encontré; la ausencia no prueba que no exista].
- Inferencia [I]: con 1,5 a 3,7° de error y distancia de TV, el "imán" a una de 4 frases es plausible porque las zonas ya son enormes; el valor del imán es mayor en teclados de iniciales (letras pequeñas), donde el contexto del LLM puede ponderar letras probables. El riesgo es que el imán empuje hacia lo "esperable" y refuerce la homogeneización que temía P12.

---

## Insights accionables para WOKI

1. **Muestra 4 frases, con un orden fijo y estable.** 4 caben sin scroll (Valencia 2023), 5 es lo que usó SpeakFaster, 3 más "otra" usa SPICA. Con mirada de baja precisión, 4 zonas grandes encajan; la fatiga de elegir entre varias es un hallazgo repetido (SPICA, SpeakFaster, Why So Serious).
2. **Una casilla fija "ninguna sirve" que abre iniciales.** Es el flujo de SpeakFaster (iniciales, luego Spell/KeywordAE). La persona lo usa como plan B sin salir de la pantalla.
3. **"Casi correcta" = cambiar una palabra, no reescribir.** Copiar FillMask de SpeakFaster: elegir la palabra rara y ver 3 a 4 alternativas. Valencia mostró que editar sin esto anula el ahorro.
4. **Sugerencias con variedad deliberada de tono**, por ejemplo 1 cariñosa, 1 neutra, 1 con humor, 1 breve. Valencia: lo abrupto sonó mal a 5 de 12; Marta quiere chiste y "te quiero".
5. **Contexto = lo que dijo la otra persona.** Cai 2022: un turno de contexto duplica la precisión. Transcribir al interlocutor es la mejor inversión.
6. **No marcar "hecho por IA" en la pantalla grande donde mira la familia, pero sí al elegir.** Valencia (P8, P10) y la autoetnografía muestran que la familia o amigos pueden sentirlo como "lo hizo el aparato". Dar un modo "familia/íntimo" con sugerencias apagadas o discretas, que se cambia con un gesto.
7. **Marca clara para Marta, no para el público:** icono pequeño solo en su vista/indicador de qué frase vino de IA y cuál escribió ella; que pueda ver el origen ("por qué esta frase") ya que P11 lo preguntó.
8. **Personalizar con historial, con permiso y por contexto.** Estilo propio (jerga chilena/colombiana, chistes) es lo que más pidieron, pero la autoetnografía advierte autocensura y filtración de privados. Perfil corto editable por Marta más ejemplos recientes aprobados por ella, con interruptor "no aprender esto".
9. **Aceptación parcial.** Poder aceptar la frase hasta la palabra N (patrón palabra por palabra, clave de agencia) y completar con iniciales o escribir.
10. **Agente: tarjeta de plan de 1 a 3 pasos, destinatario y texto visibles, un solo gesto para aprobar,** y confirmación reforzada solo para lo irreversible (mensajes, llamadas). Reversibles con "deshacer".
11. **Imán de cursor: solo como ayuda, nunca sin cancelar.** Con 4 zonas grandes quizá no haga falta; úsalo en el teclado de iniciales. Medir con Marta si el imán le molesta o la lleva a respuestas "esperables".
12. **Honestidad en la demo:** SpeakFaster logró +29 a 60 % de wpm con 2 usuarios, no 5×. Promete rapidez realista y calidad de voz propia.

## Recomendaciones de diseño con números

- **Frases candidatas:** 4 (Valencia 2023: 4 sin scroll; SpeakFaster: 5 por rendimientos decrecientes). Cada una como zona de al menos 1/4 del ancho de pantalla útil, con separación; con error de 3,7° a ~2 m (~13 cm de error) las zonas deberían tener **más de 26 cm de lado** (cálculo mío: error ×2 como margen, a 2 m de distancia) [I].
- **Más opciones:** una 5.ª casilla "otra / iniciales" y una 6.ª "regenerar" (SPICA ofrece "turnaround"; Lingraphica ofrece regenerar). Total ≤ 6 zonas.
- **Longitud de frase:** hasta ~10 palabras (límite de SpeakFaster y media de 7,5 palabras aceptadas en la autoetnografía).
- **Latencia objetivo:** SPICA midió 10,2 ± 4,8 s y lo llamó "dentro de umbrales prácticos", pero para chistes la demora importa; recomendación mía [I]: **menos de 2 s** para mostrar las 4 frases, con indicador de que está pensando; no hay fuente que dé el umbral.
- **Aprobación del agente:** 1 gesto para aprobar, 1 para cancelar; tiempo de espera sin respuesta = cancelar (nunca ejecutar por inacción) [I]. Para irreversibles, doble gesto en menos de unos 3 s [I, a calibrar].
- **Planes del agente:** máximo 3 pasos visibles a la vez.
- **Imán:** ofrecerlo sobre las zonas de las 4 frases; si hay dudas entre 2 objetivos, no imantar y dejar al usuario elegir [I]. Medir antes del domingo 14:00.
- **Sugerencias para el usuario "íntimo":** interruptor accesible con un combo de gestos, estado siempre visible.

## Lo que no pude verificar

- Texto completo del Nature Communications y de PMC (bloqueados); usé el preprint arXiv v1 para la interfaz y los números.
- Porcentaje de mejora del bubble cursor, resultados completos de MAGIC y ninja cursors, KWickChat (solo snippets).
- Texto completo de la autoetnografía (leí 100.000 de 130.000 caracteres), y de Why So Serious (100.000 de 145.000).
- Cuántas sugerencias muestra hoy Vocable Smart Assist; Voixa tiene datos contradictorios (3 vs 5).
- "Talk by Cognixion" como producto: no encontré fuente.
- Cualquier agente de IA para CAA que ejecute acciones externas con mirada: no hallé evidencia pública.
