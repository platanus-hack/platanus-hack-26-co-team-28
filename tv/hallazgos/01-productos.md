# 01 · Cómo resuelven la interfaz los productos reales de CAA con mirada

Fecha de la investigación: 21-nov-2026. Convención: **[V]** = verificado leyendo la fuente (cada una con su URL). **[I]** = inferido por mí. **[NV]** = no se pudo verificar. Cuando una cifra no está en la fuente, lo digo.

Limitación general: las páginas de soporte de Tobii Dynavox, Smartbox y Apple casi nunca publican el dwell por defecto ni los tamaños de botón. Donde no lo encontré, queda como [NV] y no lo invento.

---

## 1. Ficha por producto

### 1.1 Tobii Dynavox TD Snap (software) y TD Pilot / I-Series (hardware)

- **Qué es.** Software de CAA con "page sets": Core First, Motor Plan, Express, Text, Scanning, PODD (compra dentro de la app) y Aphasia. Acceso por mirada, tacto y switch. [V] https://www.tobiidynavox.com/pages/td-snap
- **Layout principal.** Core First crece desde una sola pantalla con una palabra hasta 80 palabras por pantalla. [V, vía resumen del buscador de páginas del fabricante] https://us.tobiidynavox.com/pages/td-snap-core-first y https://ca.tobiidynavox.com/pages/snapcorefirst-plus. El manual de TD Snap tiene una sección "Choose a Grid Size", pero no pude leer su contenido. [NV] (el PDF del manual v1.17 devolvió "Access Denied").
- **Selección.** Métodos: tacto (por defecto), Touch Enter, Touch Exit, Mouse Dwell, Gaze Interaction y scanning. [V] https://www.tobiidynavox.com/blogs/support-articles/how-to-set-eye-gaze-dwell-time-on-a-button-in-td-snap (la lista viene del buscador sobre https://www.tobiidynavox.com/blogs/support-articles/how-do-i-change-access-methods-in-td-snap).
- **Dwell.**
  - Se configura global (Edit > User > Access Method > Selection Type > Dwell Time) o **por botón** (desde v1.18). [V] https://www.tobiidynavox.com/blogs/support-articles/how-to-set-eye-gaze-dwell-time-on-a-button-in-td-snap
  - Valor por defecto de TD Snap: [NV].
  - En TD Pilot (iPad), la guía de inicio dice "1,5 segundos para empezar" y que se ajuste después. [V] https://download.mytobiidynavox.com/TD%20Pilot/Documents/TDPilot_TDSnap_GettingStartedGuide_en-US_13000584_WEB.pdf
  - Para I-Series, la guía recomienda dwell menor a 1 s y subirlo si hay selecciones accidentales. [V, vía resumen] https://download.mytobiidynavox.com/Resources/TDEyeGaze_Pathway_TDISeries_en-US.pdf
- **Anti-errores.** Opción "look away before reselecting": no se puede re-seleccionar el mismo objetivo sin mirar fuera de esa región. [V] https://ca.tobiidynavox.com/blogs/support-articles/how-to-prevent-accidental-selections-with-eye-gaze-in-td-snap
- **Feedback visual del dwell.** El manual de la I-Series lista tres estilos: **Clock** (un reloj que se llena durante el tiempo de dwell), **Dot** (un punto que se encoge para usuarios de mirada) e **Invisible**. El dwell se regula en 8 niveles. [V] https://download.mytobiidynavox.com/I-Series/documents/I-Series_User_manual/I-13%20and%20I-16/Tobii%20Dynavox%20I-Series%20I-13_I-16%20Users%20Manual_v1-0-1_en-US.pdf (secciones "Button Dwell Time" y visual feedback). Es ajuste del hardware I-Series, no de TD Snap.
- **Pausa / descanso.** En Windows Control hay un botón de pausa que aparece cuando la mirada sale de la pantalla (hay que activarlo en Settings > Eye Tracker > Advanced). [V] https://ca.tobiidynavox.com/blogs/support-articles/how-do-i-make-the-pause-button-available-when-looking-outside-the-screen-in-windows-control. En TD Pilot/iPad se usa "Pause Dwell" de AssistiveTouch "para leer o descansar". [V] https://download.mytobiidynavox.com/TD%20Pilot/Documents/Users%20Manuals/TobiiDynavox_TDPilot_UsersManual_v1-0-5_en-US_13000441.pdf
- **Emergencia / llamada de atención.** El manual del TD Pilot dice textualmente que no se confíe en el dispositivo para llamadas de emergencia y que se tengan varias vías de comunicación. [V] mismo manual del TD Pilot, sección 2.4. TD Snap tiene "QuickFires" y herramientas de apoyos visuales, pero no encontré un botón de alarma documentado. [NV]
- **Calibración.** Requiere hardware Tobii; no extraje el número de puntos. [NV]
- **Predicción y frases rápidas.** Es de TD Talk (ver 1.2). Para TD Snap, la página del producto no menciona predicción. [NV]
- **Voz.** "Cientos de voces sintéticas" y voice banking; incluye licencia Acapela My-Own-Voice gratis con equipos dedicados calificados. [V] https://www.tobiidynavox.com/pages/td-snap
- **Emociones / tono.** No mencionado. [NV]
- **Español.** Hay sitio regional "Spain & Latin America", pero la página de TD Snap solo dice "múltiples idiomas". [V] https://www.tobiidynavox.com/pages/td-snap
- **Precio.** No figura en la página; remite a "Buy now". [NV]
- **Imágenes.** Capturas de page sets (Core First, Motor Plan, Express, Text, Scanning...):
  - Core First: https://i.shgcdn.com/1640aba1-73d8-4460-a3af-bcf45a02e443/-/format/auto/-/preview/3000x3000/-/quality/lighter/
  - Motor Plan: https://i.shgcdn.com/7c19f9b7-f769-4aea-9909-54acd7536188/
  - Express: https://i.shgcdn.com/16a5b0bf-a42c-46f2-83df-1d7849cfdf75/-/format/auto/-/preview/3000x3000/-/quality/lighter/
  - Text: https://i.shgcdn.com/830a592e-84c8-4d4a-9a04-ad8f697171f7/-/format/auto/-/preview/3000x3000/-/quality/lighter/
  - Fuente: https://www.tobiidynavox.com/pages/td-snap

### 1.2 Tobii Dynavox TD Talk (el más cercano a una necesidad de "ELA con texto")

- **Qué es.** App de texto a voz para adultos alfabetizados sin voz ni manos (ELA/MND, EM, distrofia, parálisis cerebral, locked-in). Gratis en App Store, requiere iPadOS 17.2+. Con **TD Pilot** se controla solo con los ojos; sin él, solo tacto. [V] https://apps.apple.com/us/app/td-talk/id1509210085
- **Layout.** La app escribe frases y las habla; las QuickMessages se organizan en "Topics" y se muestran en la **Partner Window** (pantalla trasera para el interlocutor). El número de botones o el tamaño: [NV]. Fuente: misma URL de App Store.
- **Teclado y predicción.** Predicción de palabras en todos los campos salvo contraseñas, "predicción de frases que aprende tu estilo personal" y "construcción predictiva de oraciones". Se pueden corregir errores con solo los ojos. [V] https://apps.apple.com/us/app/td-talk/id1509210085
- **Frases rápidas.** QuickMessages preprogramadas y personalizadas ("necesito ayuda", "espera, estoy escribiendo"). [V] misma URL.
- **Voz.** Voces sintéticas, Apple Personal Voice y voice banking con Acapela, ModelTalker, The Voice Keeper y **ElevenLabs**. [V] misma URL.
- **Idiomas.** Listados: inglés, danés, neerlandés, francés, alemán, italiano, noruego, esloveno, **español** y sueco. "35+ idiomas y voces" con TD Pilot. [V] misma URL.
- **Dwell.** El dwell de TD Talk/TD Snap afecta solo a esa app; el de iPadOS (AssistiveTouch) es independiente. [V] manual TD Pilot (URL arriba).
- **Emociones.** No mencionado. [NV]
- **Precio.** App gratis; el costo está en el hardware (TD Pilot). Precio del TD Pilot: [NV].

### 1.3 Smartbox Grid 3 y Grid for iPad

- **Layout.** Los "grid sets" son rejillas de celdas definibles por el usuario; el número exacto por pantalla depende de cada grid set. [NV el tamaño por defecto]
- **Selección.** Por defecto **Dwell to click**; alternativas **Blink to click** y **Switch to click**. [V] https://setbccdnstorage.blob.core.windows.net/data/Grid_3/Grid3_EyeGazeSet-up_Tutorial%20_2024.pdf y https://hub.smartboxaac.com/knowledgebase/eye-gaze-settings-in-grid-3/
- **Tiempos.** Ninguna fuente que leí da el valor por defecto en segundos. [NV] Sí hay comandos "Slower/Faster dwell" y el cambio temporal vuelve al valor de Settings al cerrar el grid set. [V, vía buscador] https://hub.thinksmartbox.com/knowledgebase/how-do-i-use-grid-3-commands-to-change-my-settings/
- **Feedback.** En Settings > Access > Eye gaze: barra de progreso, duración de activación, **punto de mirada** (opcional), resaltado de fondo, resaltado de borde, **magnificación**, y **feedback auditivo que lee la etiqueta de la celda mirada**. [V] https://hub.smartboxaac.com/knowledgebase/eye-gaze-settings-in-grid-3/ y el tutorial SET-BC de arriba.
- **Calibración.** Número de puntos, velocidad del objetivo, estilo e imagen personalizada; automática o guiada por un tercero. Un buscador cita que 9 puntos dan más precisión que 5. [V] https://hub.smartboxaac.com/knowledgebase/eye-gaze-settings-in-grid-3/
- **Pausa / descanso.** Comando "Rest" que se agrega por Grid Commands, con modo "Rest off", separado por método de acceso (puede descansar la mirada y dejar activo el switch o el tacto). [V, vía buscador] https://hub.thinksmartbox.com/knowledgebase/how-do-i-change-between-two-access-methods-in-grid-3/
- **Modo de control de PC.** Hay grid sets de "Computer Control" con sliders propios. [V] hub.smartboxaac.com (URL arriba).
- **Emergencia.** No encontré un grid set de alarma documentado. [NV]
- **Predicción / voz / español / emociones.** No verificado en las fuentes leídas. [NV]
- **Precio.** Grid 3: £550 sin IVA (£660 con IVA) licencia de un usuario en Inclusive (Reino Unido); AU$1.625 en Zyteq (Australia); prueba gratis de 60 días. Grid for iPad: £250 sin IVA, "probable pero ambiguo". Precio US: [NV]. [V, vía buscador; precios de minoristas, pueden estar desactualizados] https://www.inclusive.com/grid-3-from-smartbox.html y https://www.zyteq.com.au/products/software/grid-3 y https://www.inclusive.com/uk/software/eye-gaze-software.html
- **Grid for iPad con mirada:** no confirmado en las fuentes. [NV] Smartbox no respondió en la URL oficial (404).

### 1.4 Google Look to Speak (Android)

- **Idea central.** No hay cursor ni botones pequeños. Se mira **a la izquierda, a la derecha o arriba**, fuera o al borde de la pantalla. [V] https://blog.google/outreach-initiatives/accessibility/look-to-speak/ y https://9to5google.com/2020/12/08/google-look-to-speak/
- **Layout.** Dos columnas de frases; mirar a un lado elige esa columna y las opciones se reparten otra vez en dos hasta quedar una (búsqueda binaria). Una nota de prensa describe cuadrantes con saludos arriba y preguntas abajo. [V] https://9to5google.com/2020/12/08/google-look-to-speak/ (columnas); [V, vía buscador] androidcentral.com para la reorganización en 8 opciones.
- **Selección.** Mirar a un lado con una duración configurable; no hay dwell sobre botones. Se ajustan la distancia de la mirada (cerca/media/lejos) y el tiempo de mantenimiento. [V] https://9to5google.com/2020/12/08/google-look-to-speak/ (los valores numéricos: [NV]).
- **Feedback.** Un "ping" sonoro confirma cada selección. [V] misma URL.
- **Pausa.** **Mirar arriba pausa ("snooze") la app**, para que deje de buscar mirada. [V] https://blog.google/outreach-initiatives/accessibility/look-to-speak/
- **Calibración.** Un "Setup Helper" y una "Practice Screen"; hay que alinear la cara con una zona resaltada; el teléfono debe estar fijo. No hay calibración por puntos. [V] https://9to5google.com/2020/12/08/google-look-to-speak/
- **Frases.** Prescritas y editables; en 2024 se añadieron **emojis y símbolos** con texto hablado personalizable. [V] https://gizmodo.com/google-accessibility-talk-stare-emojis-1851481611 (las fotos/modo sin texto vienen solo del changelog de APKMirror, [NV]).
- **Teclado y predicción.** No hay teclado en las fuentes leídas. [NV]
- **Voz / emociones.** La voz del teléfono; no se describe ni hay emociones. [V] blog.google (URL arriba).
- **Idiomas.** 17 idiomas más en nov-2021, incluidos **español de España y de Latinoamérica**. [V, vía buscador] https://9to5google.com/2021/11/24/googles-look-to-speak-accessibility-app-now-works-in-17-more-languages/
- **Limitación importante.** La configuración se hace con tacto, no con mirada. [V] https://9to5google.com/2020/12/08/google-look-to-speak/
- **Precio.** Gratis; Android 9+. [V] blog.google.
- **Imágenes.** Capturas dentro del post oficial (listas, selección "how are you?", pantalla en snooze, edición de frases): https://blog.google/outreach-initiatives/accessibility/look-to-speak/ . Guía y descarga: https://g.co/looktospeak

### 1.5 Apple Eye Tracking (iOS 18+) con Dwell Control

- **Calibración.** Se activa en Ajustes > Accesibilidad > Eye Tracking y se calibra **cada vez que se enciende**, siguiendo un punto por la pantalla; se recalibra automáticamente si cambia la posición. Se puede iniciar recalibración mirando la esquina superior izquierda. [V] https://support.apple.com/guide/iphone/control-iphone-with-the-movement-of-your-eyes-iph66057d0f6/ios
- **Selección y feedback.** Por defecto se dibuja un **contorno alrededor del elemento mirado** (Snap to Item). Si Snap to Item está apagado, aparece el "dwell pointer" y **su círculo se llena** mientras corre el temporizador; al terminar se hace "tap" por defecto. [V] misma URL.
- **Opciones.** Smoothing, Snap to Item, **Zoom on Keyboard Keys** (al mirar el teclado se amplía la zona; se vuelve a mirar una tecla para pulsarla), Auto-Hide del puntero, Show Face Guidance. [V] misma URL.
- **Dwell Control.** Fallback Action, **Movement Tolerance**, **Hot Corners** (acciones al mirar una esquina: captura, Centro de control, Siri, scroll, atajo), Key Dwell Time, Extended Predictions y Slide to Type en el teclado. [V] https://support.apple.com/guide/iphone/use-assistivetouch-iph96b21954/ios
- **Tiempo por defecto.** Apple no lo publica. Una guía de terceros dice 1,5 s por defecto, máximo 4 s, pasos de 0,05 s, pero es una sola fuente. [NV] https://9to5mac.com/2024/06/13/turn-on-iphone-eye-tracking-ios-18/ (vía buscador). El único 1,5 s verificado es el que Tobii recomienda como inicio en TD Pilot (ver 1.1).
- **Pausa.** "Pause Dwell" desde el menú AssistiveTouch (verificado para iPad en el manual de TD Pilot: "Pause the eye tracking to read or rest"). [V] manual TD Pilot (URL en 1.1).
- **Teclado.** Teclado de iOS con zoom por zonas y Extended Predictions. [V] URLs de Apple arriba.
- **Voz / emociones.** Fuera de alcance de la función; usa Personal Voice y Live Speech del sistema [I, sin fuente leída].
- **Español.** No se especifica en las páginas leídas. [NV]
- **macOS.** Una fuente de terceros dice que macOS 26 Tahoe añade soporte de dwell y switch al Eye Tracking, pero no hay documento de Apple leído. [NV] https://www.igeeksblog.com/ios-19-macos-16-accessibility-features/ (vía buscador)
- **Hardware.** iPhone y iPad con cámara frontal; certificada con Hiru y TD Pilot. [V, vía buscador] https://www.prnewswire.com/de/news-releases/apple-certifies-hiru-eye-tracking-device-as-a-made-for-ipad-accessory-and-is-now-compatible-with-ipados-in-addition-to-windows-839784167.html
- **Precio.** Incluido en el sistema operativo. [V, nota de prensa] https://www.macrumors.com/2024/05/15/ios-18-accessibility-features

### 1.6 Vocable (WillowTree) — gratis, código abierto, seguimiento de cabeza

- **Entrada.** **Seguimiento de cabeza** con ARKit (necesita TrueDepth/Face ID). La mirada no se usa; "mirar" es apuntar con la cabeza. Selección por "lingering" (mantener). Código abierto, licencia MIT. [V] https://github.com/willowtreeapps/vocable-ios
- **Dwell.** **1,0 s por defecto, mínimo 0,5 s y máximo 5,0 s** (los tests de UI del repo así lo comprueban). Hay también ajuste de sensibilidad (low/high). [V, desde el código de prueba en el repo] https://github.com/willowtreeapps/vocable-ios (archivo Tests/VocableUITests/Tests/TimingAndSensitivityTests.swift; el mínimo de 0,5 s es [I] a partir de que el botón "-" se deshabilita tras un toque).
- **Layout.** Texto sin imágenes; categorías de frases (predefinidas y propias), Recents, y un teclado QWERTY. Número de botones por pantalla: [NV]. La hoja de ruta lista "Photo upload / pictorial buttons" como pendiente. [V] https://apps.apple.com/us/app/vocable-aac/id1497040547 y https://raw.githubusercontent.com/willowtreeapps/vocable-ios/develop/ROADMAP.md
- **Teclado.** QWERTY o alfabético con cabeza; números (v1.7). Predicción de palabras mencionada por reseñas, no por el desarrollador. [V] App Store (URL arriba).
- **Listening Mode y Smart Assist.** El micrófono escucha a otra persona, transcribe y la app propone respuestas rápidas (sí/no, "cuántos", preguntas con "o"). **Smart Assist (v1.6) añade más respuestas, con un motor GPT en Azure, y dice no almacenar interacciones.** [V] App Store (URL arriba); el cliente API de Listen existe en el repo (`Vocable/APIClient/ListenAPIClient.swift`).
- **Emergencia / llamada de atención.** No encontré una función de alarma en el código ni en el listado. [NV]
- **Pausa.** No documentada. [NV]
- **Voz.** Voces de Apple y **Personal Voice** (v1.7). [V] App Store.
- **Emociones.** No. [NV]
- **Español.** Sí: lista 13 idiomas incluido español. [V] App Store.
- **Precio.** Gratis. [V] App Store.
- **Imágenes.** GIF en el repo: https://github.com/willowtreeapps/vocable-ios/blob/develop/marketing_assets/vocable_vimeo_still.gif (enlaza a una demo en Vimeo, URL no extraída). Sitio: https://www.vocable.app
- **Nota.** Vocable **no es de mirada**; no encontré soporte de eye tracking. Lo útil es su patrón de Listening Mode con IA y su dwell visible y editable.

### 1.7 Microsoft Eye Control (Windows 10/11)

- **Layout.** Un **launchpad** flotante con botones: Reposition, clic izquierdo, clic derecho, ratón preciso, scroll, teclado, texto a voz, Start, Task view, calibración, ajustes y **Pause**. [V] https://support.microsoft.com/en-US/accessibility/windows/eye-control/eye-control-basics-in-windows
- **Selección.** Dwell. Hay dos tiempos configurables: dwell para letras/números/símbolos y dwell general para teclas de función, predicciones y controles del ratón. Valores por defecto: [NV]. [V] misma URL.
- **Teclado y predicción.** El teclado muestra sugerencias arriba; se mira una para seleccionarla. **Shape writing**: se mira la primera letra, se pasa por las del medio y se hace dwell en la última. [V] misma URL.
- **Frases rápidas.** La ventana de texto a voz guarda las frases escritas y tiene botones de "Quick phrases" ("Yes", "Hello") que suenan al instante y se pueden editar. [V] misma URL.
- **Pausa.** **Pause oculta el launchpad** para que mirar una película no dispare botones. [V] misma URL.
- **Calibración.** Calibración por puntos: "mira cada punto azul hasta que estalle"; se guarda un perfil por usuario. [V] https://support.microsoft.com/en-gb/windows/get-started-with-eye-control-in-windows-1a170a20-1083-2452-8f42-17a7d4fe89a9
- **Hardware.** Solo seguidores Tobii y EyeTech TM5 Mini listados. [V] misma URL.
- **Idioma.** **Solo teclado EN-US.** Es una barrera para español. [V] misma URL.
- **Voz / emociones.** TTS básico del sistema; sin emociones. [I]
- **Precio.** Incluido en Windows; el seguidor se compra aparte. [V] misma URL (hardware).

### 1.8 Irisbond (Hiru, Duo)

- **Qué es.** Hardware de seguimiento ocular español que funciona como puntero; **no es un comunicador propio**. Con Windows (Eye Control por protocolo HID) y con iPad (certificado Made for iPad, mayo 2022). Se integra con Grid 3, MindExpress 5 y TouchChat. [V, vía buscador] https://www.prnewswire.com/de/news-releases/apple-certifies-hiru-eye-tracking-device-as-a-made-for-ipad-accessory-and-is-now-compatible-with-ipados-in-addition-to-windows-839784167.html y https://www.irisbond.com/en/support-service/downloads/
- **Especificaciones.** Pantallas de 10 a 20 pulgadas, a 35–80 cm. Calibración de 0, 1, 5, 9 o 16 puntos. 60 Hz. Precisión 0,4°. Seguimiento monocular o binocular. [V] https://www.xataka.com/perifericos/sacar-dinero-llamar-al-ascensor-mirada-hiru-primer-dispositivo-eyetracking-multiplataforma-espanola-irisbond
- **Selección.** Fijación (dwell), parpadeo o pulsador externo. [V, vía buscador] https://www.irisbond.com/en/support-service/downloads/ y https://livingmadeeasy.org.uk/product/irisbond-duo-eye-tracker
- **Dwell recomendado.** La documentación de la app sugiere 0,5 s para primeros pasos, 1–1,5 s según el contexto y ~1 s para usuarios independientes. No da el valor por defecto. [V] https://knowledge.irisbond.com/en/ipad/hiruapp/settings-of-the-hiru-app
- **Feedback.** Puntero visible desactivable, LED de posicionamiento, color y tamaño de objetivos de calibración (alto contraste para baja visión). [V] misma URL.
- **Pausa.** Botón "pause" arriba a la derecha en la Hiru App. [V] misma URL.
- **Elegir ojo.** Se puede usar solo un ojo si el otro está parcialmente cerrado. [V] misma URL (relevante para ELA con ptosis).
- **Modo EasyClick "Principiante".** Existe en Windows. [V, vía buscador] manual Hiru.
- **Precio.** Duo: "precio bajo consulta" [V] https://livingmadeeasy.org.uk/product/irisbond-duo-eye-tracker. Hiru: se esperaba "menos de 2.000 euros" en una nota antigua de Xataka; precio vigente [NV].

### 1.9 Cognixion ONE / Axon-R

- **Qué es.** Casco de realidad aumentada con BCI (EEG) y seguimiento ocular. Axon-R es **solo de investigación**, sin aprobación FDA/Health Canada, con designación "Breakthrough Device" de la FDA. [V] https://cognixion.com/blog
- **Interfaz (versión de 2021).** El display del iPhone se refleja en un visor, y el usuario mantiene **contacto visual** porque no hay pantalla entre las caras. Diseño **radial** que prioriza respuestas rápidas: sí, no y gracias al alcance; frases preparadas en ranuras; teclado al lado con predicción de palabras y oraciones. Entrada: 6 canales EEG sobre la corteza visual, inclinación de cabeza o cursor. [V] https://techcrunch.com/2021/05/04/cognixions-brain-monitoring-headset-enables-fluid-communication-for-people-with-severe-disabilities
- **IA.** Agente conversacional "context-aware" personalizado, entrenado con ejemplos del habla o escritura de la persona. [V, vía buscador] https://spectrum.ieee.org/amp/als-2671299307
- **Estudio ALS.** Ensayo clínico con ELA tardía. IEEE: "near conversational speed" (afirmación de la empresa); no encontré resultados publicados. [V] https://alsnewstoday.com/news/cognixion-seeks-als-patients-clinical-trial-bci-headset/ (vía buscador)
- **Precio.** Axon-R desde US$25.000 como plataforma de investigación. [V, vía buscador] https://spectrum.ieee.org/als . Cognixion ONE consumidor: [NV].
- **Español, emociones, dwell, calibración.** [NV]

### 1.10 Otros (acotado)

- **Proloquo4Text (AssistiveWare).** Funciona con el Eye Tracking de iOS 18+ y con Hiru, TD Pilot y VersaEye. Recomienda "Snap to Item" en iOS 17+ y una opción de iconos grandes. [V, vía buscador] https://www.assistiveware.com/alternative-access-and-accessibility
- **Predictable.** Acceso por scanning, switch y cabeza; no vi mirada ni dwell mencionados. [V, vía buscador] https://apps.apple.com/us/app/predictable/id404445007
- **Talkitt.** La búsqueda no devolvió nada relevante. [NV]

---

## 2. Tabla comparativa

| Producto | Layout | Selección y dwell | Feedback | Teclado / predicción | Pausa | Voz propia | Emociones | Español | Precio |
|---|---|---|---|---|---|---|---|---|---|
| TD Snap | Core First hasta 80 palabras/pantalla [V] | Dwell global o por botón; defecto [NV]; Pilot arranca en 1,5 s | Reloj / punto que se encoge / invisible (I-Series) | Teclado y listas; predicción [NV] | Pause Dwell / botón fuera de pantalla | Sí, bancos de voz + Acapela | [NV] | Multi-idioma [NV detalle] | [NV] |
| TD Talk | Texto + QuickMessages por Topics | Con TD Pilot mirada | [NV] | Predicción de palabras y frases personal | Pause Dwell | Sí: Acapela, ModelTalker, Voice Keeper, ElevenLabs, Personal Voice | [NV] | Sí | App gratis; hardware aparte |
| Grid 3 | Rejillas de usuario | Dwell por defecto, blink, switch; segundos [NV] | Barra de progreso, punto, resaltado, magnificación, audio de etiqueta | [NV] | Comando Rest | [NV] | [NV] | [NV] | £550 (UK) |
| Look to Speak | 2 columnas, bisección | Mirar izq./der./arriba, tiempo configurable | Ping sonoro | Sin teclado [NV] | Mirar arriba | Voz del móvil | No | Sí (2021) | Gratis |
| Apple Eye Tracking | Toda la UI de iOS | Dwell; defecto no publicado | Contorno del ítem o círculo que se llena | Teclado iOS con zoom y predicciones | Pause Dwell | Personal Voice (sistema) | No | [NV] | Incluido |
| Vocable | Texto en categorías + teclado | Cabeza, 1,0 s (0,5–5,0 s) | [NV] | QWERTY + predicción | [NV] | Personal Voice | No | Sí | Gratis |
| Eye Control Win | Launchpad con ~12 botones | Dwell dos tiempos; defectos [NV] | [NV] | Teclado, predicciones, shape writing | Botón Pause | TTS básico | No | Teclado solo EN-US | Incluido + tracker |
| Irisbond Hiru | Solo puntero | Fijación/parpadeo/switch; 0,5–1,5 s sugeridos | Puntero visible, LED | Del software anfitrión | Botón pause (iPad) | n/a | n/a | n/a | <2.000 € (estimado antiguo) |
| Cognixion | Radial + teclado | EEG, cabeza, cursor | [NV] | Predicción de palabras y oraciones | [NV] | IA con estilo de la persona | [NV] | [NV] | US$25.000 (investigación) |

---

## 3. Patrones comunes

1. **Dwell con retroalimentación que avanza.** Todos los productos de mirada llenan un reloj/anillo o encogen un punto (Tobii, Apple, Grid, Eye Control). El objetivo se resalta antes del llenado (contorno de Apple). [V] fuentes 1.1, 1.3, 1.5.
2. **El tiempo de dwell es configurable por usuario, y en TD Snap incluso por botón.** Rango típico documentado: 0,5 s (arranque) a 1–1,5 s (uso habitual). Vocable: 1,0 s por defecto, 0,5–5,0 s. [V] fuentes 1.1, 1.6, 1.8.
3. **Todos tienen una forma explícita de descansar la mirada:** "snooze" arriba (Look to Speak), Pause (Eye Control, Hiru), Pause Dwell (Apple), Rest (Grid 3). El patrón de **mirar fuera de la pantalla para pausar** aparece en Look to Speak y en Tobii Windows Control. [V]
4. **Anti-errores por diseño:** "mirar fuera antes de re-seleccionar" (Tobii), tolerancia de movimiento (Apple), alta calibración (Grid, Hiru).
5. **Predicción ligada al texto escrito, nunca a la emoción.** TD Talk, Eye Control, Cognixion y Vocable predicen palabras/frases. **Ninguno** de los productos revisados documenta emociones o tono en la voz. [NV generalizado; cada ficha dice [NV]] Ese hueco es el diferenciador más claro para WOKI.
6. **Frases rápidas como atajo, separadas del teclado.** QuickMessages (TD Talk), Quick phrases (Eye Control), Saved Phrases/Recents (Vocable), frases prescritas (Look to Speak), ranuras (Cognixion).
7. **Voz propia vía voice banking en el ecosistema Tobii** (Acapela, ModelTalker, Voice Keeper, ElevenLabs, Personal Voice). Es el único donde lo vi documentado con proveedores. [V]
8. **La emergencia no es un botón nativo.** El manual del TD Pilot dice no depender del dispositivo para emergencias. No encontré un botón de alarma documentado en ningún producto. [V Tobii; NV en el resto] Es otro hueco.

## 4. Diferencias relevantes

- **Cursor vs. zonas grandes.** Apple, Tobii, Grid y Eye Control usan puntero fino; Look to Speak y Cognixion usan pocas zonas (2 columnas, radial). Esto importa mucho para una webcam con error de 1,5–3,7°.
- **Dónde se configura.** Look to Speak requiere tacto para configurar; Apple y Tobii exigen un ayudante. [V]
- **Calibración.** Apple, cada vez que se enciende; Look to Speak, solo alinear la cara; Hiru, 0 a 16 puntos. [V]
- **Hardware.** Apple, Look to Speak y Vocable usan la cámara del dispositivo; el resto, seguidores infrarrojos dedicados con precisión mucho mejor (Hiru 0,4°) que una webcam. [V]
- **Cabeza vs. ojos.** Vocable apunta con la cabeza, igual que Cognixion (inclinación). Es relevante porque Marta mueve ojos y cabeza.

---

## 5. Pensando en una TV a distancia para Marta (ELA media)

**Cálculos [I], propios, no de ninguna fuente:**
- A 2,5 m, 1° equivale a ~4,4 cm. El error de webcam de 1,5–3,7° son **6,5–16 cm de radio** de incertidumbre en la pantalla.
- Una TV de 55" mide ~121 × 68 cm. Si el error peor caso es 16 cm de radio, un botón fiable debería medir **≥ 32 cm** de lado. En el ancho caben **3 columnas** (~40 cm cada una) y en el alto **2 filas** (~34 cm). Es decir, **6 zonas** grandes, no 12 ni 80.
- Esos 6 slots deben llevar **4 frases + Otras + Pausa/Emergencia** o una variante parecida. Es un punto de partida a validar, no un dato.

---

## Insights accionables para WOKI

1. **El hueco más claro es el tono/emoción.** Ninguno de los 10 productos lo documenta; todos predicen texto. La propuesta "la IA sugiere emoción, el gesto confirma" no tiene competidor visible. Confianza media, dado que muchas páginas no listan todo. [NV generalizado]
2. **Copiar la búsqueda binaria de Look to Speak, pero en 3 columnas.** Reduce el error de precisión al preguntar "izquierda/centro/derecha" en vez de apuntar. Look to Speak ya lo demuestra con una cámara de teléfono. [V] 1.4
3. **Poner siempre el anillo de dwell visible, con borde resaltado previo.** Estándar de todos (Tobii clock/dot, Apple outline + círculo, Grid barra). En la TV el anillo debe ser grande (≥ 1/4 del botón). [V]+[I]
4. **El dwell por defecto debe ser corto y el clic EMG confirma.** Fuentes: 0,5 s para arrancar, 1–1,5 s en uso habitual, Vocable 1,0 s. Con EMG, el dwell solo "arma" el objetivo y el clic confirma. [V] 1.6, 1.8
5. **Pausa a primera vista y por mirada.** Un botón grande de "Descanso" y mirar fuera de la pantalla/arriba para pausar (Look to Speak, Tobii). Pausar también debe apagar el cursor para que la familia mire la TV sin disparar nada. [V]
6. **Anti-errores "mirar fuera antes de repetir".** Tobii lo documenta y es barato de implementar. [V] 1.1
7. **Emergencia no es un producto estándar, es un hueco.** El TD Pilot dice no depender de él; ninguno documenta alarma. Combo EMG "ceja-ceja-mandíbula" + escalamiento sería diferenciador. [V Tobii; NV resto] Lo que sí se puede copiar: hot corners de Apple (acción por esquina) para disparar emergencia con la mirada. [V] 1.5
8. **Frases rápidas separadas del teclado.** Todos lo hacen. Para el estilo propio de Marta, los atajos deben ser **tuyos** (chistes, "te quiero"), no solo "necesito agua". Recents de Vocable y predicción personal de TD Talk son el antecedente. [V]
9. **Listening Mode de Vocable es el antecedente directo de "Claude propone 4 frases".** Escucha la pregunta de otra persona, transcribe y propone respuestas; Smart Assist ya usa un GPT. Diferenciar: WOKI sugiere con el contexto de la conversación y con la voz de Marta, no solo sí/no/cuántos. [V] 1.6
10. **Justificar la superioridad frente a Apple/Look to Speak.** Apple Eye Tracking da control de todo el sistema, pero con puntero fino, calibración cada vez y sin emociones; Look to Speak no tiene teclado; Eye Control tiene teclado solo EN-US. Una TV con zonas grandes + EMG + voz clonada con emoción + agentes no está cubierta por ninguno. [V] 1.4, 1.5, 1.7
11. **Español es un diferenciador real.** Eye Control solo tiene teclado EN-US; Look to Speak sí tiene español (2021); TD Talk lista español; Vocable lista español. El teclado y la predicción en español chileno/colombiano deben ser demostrables en la demo. [V]

## Recomendaciones de diseño con números

(Los números marcados [fuente] vienen de los productos; los marcados [I] son propuestas mías a validar con prueba.)

- **Zonas:** 6 a 8 zonas por pantalla como máximo; **≥ 30 cm de lado** a 2,5 m en una TV de 55". [I, derivado del error de 1,5–3,7°]
- **Grilla principal:** 3 columnas × 2 filas; 4 frases propuestas + "Otras" + "Descanso". [I]
- **Dwell por defecto:** 1,0 s [fuente: Vocable, Hiru, Tobii < 1 s]; rango ajustable 0,5–2,0 s. Con EMG, el dwell puede bajar a 0,5 s porque no dispara solo. [I]
- **Anillo de progreso:** que ocupe al menos el 25% del lado del botón; borde resaltado desde que la mirada entra. [I, sobre el patrón de Tobii/Apple]
- **Anti-repetición:** tras seleccionar, bloquear esa zona hasta que la mirada salga. [fuente: Tobii "look away before reselecting"]
- **Pausa:** mirar arriba o fuera de pantalla durante ~1 s. [I, patrón de Look to Speak/Tobii; el tiempo no está en la fuente]
- **Calibración:** una calibración rápida de 5 puntos, y recalibrar al detectar un cambio de postura. [I, a partir de Apple (recalibra automáticamente) y Hiru (5/9 puntos)]
- **Sonido de confirmación** en cada selección. [fuente: Look to Speak "ping"; Grid lee la etiqueta]
- **Esquinas como atajo de emergencia** con confirmación EMG. [I, a partir de Hot Corners de Apple]

## Fuentes principales (URLs)

- TD Snap: https://www.tobiidynavox.com/pages/td-snap · https://www.tobiidynavox.com/blogs/support-articles/how-to-set-eye-gaze-dwell-time-on-a-button-in-td-snap · https://ca.tobiidynavox.com/blogs/support-articles/how-to-prevent-accidental-selections-with-eye-gaze-in-td-snap
- TD Pilot: https://download.mytobiidynavox.com/TD%20Pilot/Documents/Users%20Manuals/TobiiDynavox_TDPilot_UsersManual_v1-0-5_en-US_13000441.pdf · https://download.mytobiidynavox.com/TD%20Pilot/Documents/TDPilot_TDSnap_GettingStartedGuide_en-US_13000584_WEB.pdf
- I-Series: https://download.mytobiidynavox.com/I-Series/documents/I-Series_User_manual/I-13%20and%20I-16/Tobii%20Dynavox%20I-Series%20I-13_I-16%20Users%20Manual_v1-0-1_en-US.pdf
- TD Talk: https://apps.apple.com/us/app/td-talk/id1509210085
- Grid 3: https://hub.smartboxaac.com/knowledgebase/eye-gaze-settings-in-grid-3/ · https://setbccdnstorage.blob.core.windows.net/data/Grid_3/Grid3_EyeGazeSet-up_Tutorial%20_2024.pdf
- Look to Speak: https://blog.google/outreach-initiatives/accessibility/look-to-speak/ · https://9to5google.com/2020/12/08/google-look-to-speak/ · https://9to5google.com/2021/11/24/googles-look-to-speak-accessibility-app-now-works-in-17-more-languages/ · https://gizmodo.com/google-accessibility-talk-stare-emojis-1851481611
- Apple: https://support.apple.com/guide/iphone/control-iphone-with-the-movement-of-your-eyes-iph66057d0f6/ios · https://support.apple.com/guide/iphone/use-assistivetouch-iph96b21954/ios
- Vocable: https://github.com/willowtreeapps/vocable-ios · https://apps.apple.com/us/app/vocable-aac/id1497040547
- Microsoft: https://support.microsoft.com/en-US/accessibility/windows/eye-control/eye-control-basics-in-windows · https://support.microsoft.com/en-gb/windows/get-started-with-eye-control-in-windows-1a170a20-1083-2452-8f42-17a7d4fe89a9
- Irisbond: https://www.xataka.com/perifericos/sacar-dinero-llamar-al-ascensor-mirada-hiru-primer-dispositivo-eyetracking-multiplataforma-espanola-irisbond · https://knowledge.irisbond.com/en/ipad/hiruapp/settings-of-the-hiru-app
- Cognixion: https://cognixion.com/blog · https://techcrunch.com/2021/05/04/cognixions-brain-monitoring-headset-enables-fluid-communication-for-people-with-severe-disabilities

## Pendientes (no pude verificar)

- Dwell por defecto de TD Snap, Grid 3, Apple y Eye Control.
- Contenido del manual de TD Snap (grid sizes).
- Si Grid for iPad soporta mirada.
- Video de demostración de Vocable (el enlace de Vimeo está dentro del README, no lo extraje).
- Precio del TD Pilot, de TD Snap, de Hiru vigente y de Cognixion ONE consumidor.
