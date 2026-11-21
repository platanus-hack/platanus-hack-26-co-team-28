# Hardware, distancia a TV (2-2.5 m) y enfoque híbrido cabeza + iris para webcam eye tracking (ELA etapa media)

Nota: "Cálculo propio" = aritmética mía (modelo pinhole, iris 11.7 mm, ojo r~12 mm); no es una cifra publicada. Fecha de investigación: 2026-11-21.

## 1. Cámara: resolución, fps y píxeles de iris a 2-2.5 m

### Takeaway
Ningún fabricante webcam documenta una distancia soportada de 2-2.5 m: los productos asumen ~30-70 cm (Apple ~30-45 cm; Tobii ~45-85 cm). A 2-2.5 m, con una webcam 1080p de FOV normal, el iris mide solo ~5-8 px (cálculo propio) y un grado de rotación ocular mueve el iris menos de 0.2 px, así que no hay fundamento para esperar 1.5-4° con la cámara en la TV; lo realista es acercar la cámara a la persona o usar tele/4K con recorte.

### Cited Findings
- MediaPipe Iris asume diámetro horizontal del iris ~11.7±0.5 mm, y estima distancia con error medio relativo 4.3% (SD 2.4%); con gafas 4.8% (SD 3.1%); >200 participantes, sin personas con enfermedades oculares; modelo pinhole con distancia focal — [Google Research](https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/)
- El rango de iris adulto en una patente es 10.5-13.5 mm, es decir, la constante de 11.7 mm tiene variación individual — [patente USPTO 10861180 (resultado de búsqueda)](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10861180)
- Beam Eye Tracker (Eyeware) recomienda "una webcam 720p estándar, integrada o externa" a 30 FPS; la página no da distancia, iluminación ni cifra de precisión; soporta Windows/Linux/macOS; también acepta un teléfono como webcam — [Beam FAQ](https://beam.eyeware.tech/?p=4928)
- La guía OpenTrack de Beam lista 480p+ como mínimo y el desarrollador afirma que la iluminación IR adicional no ayuda mucho porque Beam usa RGB (según resumen de búsqueda; fuente secundaria, no verificada en página primaria) — [Beam OpenTrack](https://beam.eyeware.tech/support/opentrack/), [Beam webcams](https://beam.eyeware.tech/webcams/)
- Apple Eye Tracking (iOS 18+, iPhone 12 y posteriores): la guía popular dice teléfono en superficie estable a ~1 pie (~30 cm) o ~1.5 pies (~45 cm); fuentes discrepan en la cifra y no pude abrir la página primaria de Apple — [Cult of Mac](https://www.cultofmac.com/news/eye-tracking), [9to5Mac](https://9to5mac.com/2024/09/19/turn-on-iphone-eye-tracking-ios-18/), [iDownloadBlog 1-2 pies](https://www.idownloadblog.com/2024/07/10/how-to-use-eye-tracking-iphone-ipad/)
- Look to Speak (Google): Android 9+, cámara frontal, teléfono ligeramente por debajo del nivel de los ojos y fijo; no se publica una distancia/iluminación específica; hay ajustes de cuánto debe salir la mirada de la pantalla (cerca/medio/lejos) y de tiempo de mantenimiento — [9to5Google](https://9to5google.com/2020/12/08/google-look-to-speak/), [Google blog](https://blog.google/outreach-initiatives/accessibility/look-to-speak/)
- Tobii Dynavox EyeMobile Plus (hoja de 2019): distancia óptima ~45-85 cm, paralelo a los ojos; se ajusta con la ventana Track Status — [Tobii Dynavox](https://us.tobiidynavox.com/blogs/support-articles/what-is-the-recommended-distance-when-positioning-the-user-for-an-eyemobile-plus)
- Precisión típica de modelos de gaze con imagen de ojo de baja resolución desde RGB: 2-4° — [arXiv 1806.10890](https://arxiv.org/pdf/1806.10890.pdf)
- Webcam en pantalla de ordenador (condiciones de escritorio, ~50-70 cm): precisión media 3.65° (SD 0.77°) en una tesis de la UU; un preprint reporta mediana 3.72° en webcam frente a 0.76° en laboratorio (no verificado) — [tesis UU](https://studenttheses.uu.nl/bitstream/handle/20.500.12932/40709/Eindwerkstuk_Bachelor_KI_Mark_Wessel_6008283_final.pdf?sequence=1), [arXiv 2608.10181](https://arxiv.org/pdf/2608.10181)
- Frame rate: la mayoría de cámaras adaptables a trackers de código abierto captura como máximo 30 fps — [búsqueda sobre LibreTracker/ITU](https://github.com/afkrause/libretracker)
- Frontiers 2024 estima la distancia usuario-pantalla con webcam 2D y recomienda reportar error en grados de ángulo visual para comparar entre distancias — [Frontiers](https://www.frontiersin.org/articles/10.3389/frobt.2024.1369566)

### Inferences
- Cálculo propio, píxeles de iris (f = 960/tan(HFOV/2) para ancho 1920; iris px = f·0.0117/d):
  - 1080p, HFOV 70°: f≈1371 px; 0.6 m → ~27 px; 2.0 m → ~8.0 px; 2.5 m → ~6.4 px.
  - 1080p, HFOV 90° (gran angular): 2.0 m → ~5.6 px; 2.5 m → ~4.5 px.
  - 4K (3840 px), HFOV 70°: 2.0 m → ~16 px; 2.5 m → ~12.8 px (recorte digital, sin ganar óptica real si el sensor/lente son malos).
  - 1080p con lente tele HFOV 30°: f≈3583 px; 2.0 m → ~21 px; 2.5 m → ~17 px.
  - Con la cámara a ~0.8-1 m de la cara (montaje en cama) y FOV 70°: ~16-20 px.
- Cálculo propio, sensibilidad: 1° de rotación ocular desplaza el centro del iris ~0.2 mm (r≈12 mm). A 2 m con f≈1371 px eso son ~0.14 px/°; 3° ≈ 0.4 px. Con tele 30° a 2 m ~0.38 px/°. Es decir, a 2-2.5 m con 1080p estándar la señal está por debajo de un píxel y el ruido de landmarks la domina; el error será probablemente peor que 4° y dominado por la pose de cabeza, no por el iris.
- Como los productos validados trabajan a 30-85 cm, extrapolar su precisión (≈2-4°) a 2-2.5 m no está respaldado por fuentes; solo cabe esperar degradación.
- 720p/30 fps basta a distancia corta según Beam; 60 fps no tiene evidencia citada de mejora para iris webcam. Lo que sí importa es resolución efectiva sobre el ojo, exposición corta (sin desenfoque) y foco fijo/manual (LibreTracker aconseja desactivar autofoco).
- Opciones ordenadas por viabilidad (juicio propio): (1) cámara cerca de la persona (cama/brazo articulado, 0.6-1 m) con el puntero resultante mapeado a la TV; (2) 4K + tele moderada/zoom óptico y recorte al rostro con seguimiento; (3) cámara en la TV a 2-2.5 m con 1080p estándar: solo gaze en zonas muy gruesas.

### Gaps
- No encontré ninguna curva publicada de error de gaze vs. distancia cámara-rostro para webcams RGB; todo lo anterior sobre degradación a 2-2.5 m es cálculo propio.
- No pude leer la página primaria de Apple Support ni la de Look to Speak con distancias; las cifras de Apple vienen de prensa.
- No hallé precisión numérica publicada de Beam Eye Tracker.
- No verifiqué el preprint arXiv 2608.10181 más allá del resumen de búsqueda.

## 2. Iluminación, gafas, párpados y ojo seco (incluye IR)

### Takeaway
La guía común es luz frontal difusa, sin contraluz, y calibrar con las gafas puestas; ptosis y gafas están documentados como causas de pérdida de datos. IR ayuda en trackers con iluminador dedicado, pero Eyeware dice que no aporta a Beam (RGB).

### Cited Findings
- Tobii Dynavox: calibrar con las gafas puestas y lentes limpias (la calibración difiere con/sin gafas); evitar monturas brillantes o con destellos — [Tobii Dynavox](https://us.tobiidynavox.com/blogs/support-articles/how-can-i-position-the-device-to-get-a-better-calibration)
- Tobii Dynavox: párpados caídos pueden interferir si el dispositivo está bajo; subirlo o inclinarlo; cambios de iluminación, posición, medicación o ánimo afectan la calibración; para usuarios reclinados o en cama, montarlo más alto con soporte — [Tobii Dynavox](https://us.tobiidynavox.com/blogs/support-articles/how-can-i-position-the-device-to-get-a-better-calibration)
- Estudio Utrecht (Behavior Research Methods): las precisiones de marketing se logran en condiciones ideales con chinrest; las pruebas de Tobii excluyeron sujetos con gafas/lentes o párpados caídos — [Springer](https://link.springer.com/10.3758/s13428-017-0863-0)
- Reflejos de gafas y lentes pueden confundir al tracker; párpados caídos u ojos estrechos pueden ocultar glint o pupila — [PMC5809535](https://pmc.ncbi.nlm.nih.gov/articles/PMC5809535)
- Beam: la mayoría con gafas no tiene problema; prescripciones fuertes o brillo reducen algo la precisión; monturas gruesas pueden tapar los ojos; sugiere cámara debajo del monitor — [Beam FAQ](https://beam.eyeware.tech/?p=4928)
- Beam: usuario reportó funcionar a 5 lux (anecdótico); guía de simulación aconseja mejorar luz facial, reducir contraluz y recalibrar desde la posición habitual — [AVSIM](https://www.avsim.com/forums/topic/643768-new-eye-tracker/page/3/)
- ALS: menor frecuencia de parpadeo y sequedad; ojo seco aumenta el parpadeo y degrada tracking; en fases tardías la cabeza cae y rota y solo un ojo puede usarse; usuarios reportan recalibrar hasta ~50 veces al día (fuentes divulgativas) — [Review of Optometry](https://reviewofoptometry.com/article/als-beyond-the-bucket)
- Trackers abiertos con IR: ITU Gaze Tracker, LibreTracker (LED IR + filtro) y OpenIris usan iluminador IR y cámara IR; no encontré proyecto con Raspberry Pi NoIR específico — [LibreTracker](https://github.com/afkrause/libretracker), [PMC10925248](https://pmc.ncbi.nlm.nih.gov/articles/PMC10925248)
- Autocalibración (EyeO) investiga reducir recalibraciones manuales — [arXiv 2307.15039](https://arxiv.org/pdf/2307.15039)

### Inferences
- Con ptosis, Tobii recomienda elevar o inclinar el dispositivo para despejar los párpados; por analogía, la cámara debería quedar a la altura de los ojos o algo por encima y no por debajo (juicio propio; Beam sugiere lo contrario, cámara debajo, para monturas gruesas, así que hay que probar ambas).
- Luz: fuente suave frontal (difusor) al lado de la cámara, cortinas cerradas para evitar contraluz de ventana; evitar luz que refleje en lentes directamente (juicio propio basado en las fuentes de glare).
- Un modelo RGB entrenado en luz visible (MediaPipe) no se beneficia de IR; la mejora IR solo aplica con un pipeline pupila/glint propio (no existe en las fuentes como opción webcam lista).
- Mitigaciones para ojo seco/parpadeo: filtrar parpadeos y mantener último valor válido, y recalibración corta (1-2 puntos) integrada en el uso (juicio propio, apoyado en el reporte de recalibraciones frecuentes).

### Gaps
- No hallé estudios cuantitativos de ptosis y gaze por webcam, ni sobre pérdida de precisión por glare de gafas medida en grados.
- No hay datos de luz recomendada en lux para MediaPipe/Beam (solo un anecdótico 5 lux).

## 3. Posición de cabeza, reposacabezas y caja de tolerancia

### Takeaway
Los fabricantes dedicados dan una "track box" y piden reposicionar con la ventana de estado; para ELA recomiendan montaje ajustable. Para webcam a 2-2.5 m no hay caja de tolerancia publicada; hay que definirla empíricamente.

### Cited Findings
- Tobii: la track box es el volumen 3D donde se capturan los ojos; el usuario se mueve libre dentro, y el fabricante dice que la cabeza puede moverse sin pérdida significativa de precisión, sobre todo útil para ELA — [Tobii Dynavox](https://ca.tobiidynavox.com/pages/what-is-eye-tracking)
- Tobii reconoce que para usuarios inclinados o acostados hay que inclinar el dispositivo para mantener los ojos paralelos y a distancia óptima (45-85 cm en EyeMobile Plus) — [Tobii Dynavox](https://us.tobiidynavox.com/blogs/support-articles/what-is-the-recommended-distance-when-positioning-the-user-for-an-eyemobile-plus)
- Independiente: las cifras de precisión se obtienen con chinrest y pierden en uso libre — [Springer](https://link.springer.com/10.3758/s13428-017-0863-0)
- Beam soporta tracking de cabeza 6DoF (yaw, pitch, roll y desplazamientos) — [Beam FAQ](https://beam.eyeware.tech/?p=4928)

### Inferences
- Un reposacabezas/almohada de cuello que fije la pose reduce la varianza que el gaze webcam no compensa bien; es recomendación de ingeniería propia (el estudio Utrecht muestra la ventaja del chinrest).
- Plano de la cámara perpendicular al eje de la mirada de la persona (Tobii pide "paralelo"), sobre todo en cama inclinada.
- Si la cámara está en la TV, la persona debe estar centrada (±15 cm lateral, ±10° de yaw como punto de partida a validar; cifras propias, no citadas).

### Gaps
- No encontré valores publicados de caja de tolerancia para webcam RGB ni recomendaciones clínicas de reposacabezas para tracking en ELA con webcam.

## 4. Geometría de pantalla/objetivos (TV 55"/65" a 2-2.5 m)

### Takeaway
(Todo cálculo propio.) A 2.5 m una TV 55" subtiende ~27°x16°; con error de 3° caben unos 8 objetivos, con 1.5° ~45. A 2 m una 65" subtiende ~40°x23° y da más margen.

### Cited Findings
- Reportar error en grados de ángulo visual permite comparar entre distancias; el error en cm depende de la distancia — [Frontiers](https://www.frontiersin.org/articles/10.3389/frobt.2024.1369566)
- Precisión típica de webcam 3.65° y de modelos RGB de baja resolución 2-4° — [tesis UU](https://studenttheses.uu.nl/bitstream/handle/20.500.12932/40709/Eindwerkstuk_Bachelor_KI_Mark_Wessel_6008283_final.pdf?sequence=1), [arXiv 1806.10890](https://arxiv.org/pdf/1806.10890.pdf)

### Inferences
- Cálculo propio, 16:9: 55" = 121.7x68.5 cm; 65" = 143.9x80.9 cm. 1° equivale a 3.5 cm a 2 m y 4.4 cm a 2.5 m.
- Ángulo subtendido (ancho x alto): 55" a 2 m 33.8°x19.4°; 55" a 2.5 m 27.4°x15.6°; 65" a 2 m 39.6°x22.9°; 65" a 2.5 m 32.1°x18.4°.
- Regla propia: celda ≥ 2x el error (≈ 95% de aciertos si error ~ un sigma; sin respaldo bibliográfico). Cuadrícula resultante:

| Error | Celda | 55" a 2.5 m | 55" a 2 m | 65" a 2.5 m | 65" a 2 m |
|---|---|---|---|---|---|
| 1.5° | 3° | 9x5=45 | 11x6=66 | 10x6=60 | 13x7=91 |
| 2° | 4° | 6x3=18 | 8x4=32 | 8x4=32 | 9x5=45 |
| 3° | 6° | 4x2=8 | 5x3=15 | 5x3=15 | 6x3=18 |
| 4° | 8° | 3x1=3 | 4x2=8 | 4x2=8 | 4x2=8 |

- Un error de 3° a 2.5 m son ~13 cm en pantalla: botones de ~25-30 cm de lado, es decir, UI tipo 2x2 a 3x2 en TV 55", con dwell largo.
- Más grande es mejor: el ángulo visual crece con TV más grande o más cercana, pero a 2 m la cámara pierde más resolución de iris que lo que se gana en tamaño de pantalla si la cámara sigue en la TV.

### Gaps
- No hay fuente que fije la regla "celda = 2x error"; es heurística.

## 5. Enfoque híbrido: cabeza (nariz) + iris; sistemas existentes y fatiga

### Takeaway
La evidencia disponible favorece mezclar: la cabeza (nariz) da precisión y estabilidad, la mirada reduce movimiento y fatiga de cuello; en pruebas VR/AR, head-only es más preciso que gaze-only, y gaze+head recupera precisión sin perder tiempo. No encontré estudios de fatiga prolongada en población con ELA.

### Cited Findings
- Qian y Teather (SUI 2017): head-only tuvo mejor desempeño que eye-only y eye+head; gaze más rápido pero con más errores; head pointing causó más fatiga de cuello — [Carleton PDF](https://www.csit.carleton.ca/~rteather/pdfs/sui17b.pdf)
- Spakov et al. (ETRA 2014): head-assisted eye pointing mejora significativamente la precisión sin perjudicar el tiempo; se espera menos esfuerzo de cuello — [Spakov](https://homepages.tuni.fi/oleg.spakov/publications/Spakov_ETRA_14a.pdf)
- MAGIC original (Zhai, Morimoto, Ihde, CHI 1999): la mirada mueve el cursor a la zona y la mano refina; piloto de 12 sujetos sugirió menos esfuerzo y fatiga — [MAGIC PDF](https://latin.ime.usp.br/media/papers/pdf/MAGIC.pdf), [IBM](https://researcher.ibm.com/publications/manual-and-gaze-input-cascaded-magic-pointing)
- MAGIC con cabeza en eyewear: eye+head más rápido que head pointing para blancos lejanos y más preciso que eye pointing; reduce amplitud de movimiento de cabeza — [core.ac.uk 50528473](https://core.ac.uk/download/50528473.pdf)
- Réplica UniKN: MAGIC no mejoró frente a ratón, en parte porque los usuarios apartan la mirada antes de terminar la acción — [UniKN](https://hci.uni-konstanz.de/securedl/sdl-eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3MTk5Nzc5NDQsImV4cCI6MTcyMDY2OTE0NCwidXNlciI6MCwiZ3JvdXBzIjpbMCwtMV0sImZpbGUiOiJmaWxlYWRtaW4vaW5mb3JtYXRpay9hZy1yZWl0ZXJlci9JbWFnZXMvUHJvamVjdHMvU3F1aWR5L0dhemVBdWdtZW50ZWRNYW51YWxJbnRlcmFjdGlvbi1VbmlLTi5wZGYiLCJwYWdlIjo5MjM3M30.y_eQp5ku5vYvtliQWUqQEe-Y2amGYwdR17per7Rht2Y/GazeAugmentedManualInteraction-UniKN.pdf)
- BimodalGaze (ETRA 2020): la cabeza solo refina tras la mirada; reportó más errores de selección inicial — [Lancaster](https://eprints.lancs.ac.uk/142666/1/Head_Gaze_pointing_ETRA20.pdf)
- Eye&Head (Sidenmark): la cabeza como embrague que actualiza el puntero solo cuando un cambio de mirada se acompaña de movimiento de cabeza — [Lancaster GEMINI 2025](https://eprints.lancs.ac.uk/229330/1/GEMINI_-_2025_fina-without-changes_3_1_.pdf)
- Project Gameface (Google): cursor por cabeza y gestos faciales con webcam común vía MediaPipe (478 landmarks, 52 blendshapes), punto por defecto la frente; no hay requisitos mínimos publicados de resolución/luz — [Google Developers Blog](https://developers.googleblog.com/en/project-gameface-makes-gaming-accessible-to-everyone/)
- Beam puede usar head tracking 6DoF solo o con eye tracking — [Beam FAQ](https://beam.eyeware.tech/?p=4928)
- VR TMT: eye tracking tuvo el menor error medio, pero la ventaja sobre head-gaze fue pequeña y no estadísticamente fiable — [arXiv 2506.19519](https://arxiv.org/pdf/2506.19519)

### Inferences
- Para una persona con ELA con cuello debilitado, "mirada para zona + cabeza (nariz) para refinar + confirmación por dwell o conmutador/EMG" es el diseño mejor apoyado: la cabeza compensa la baja precisión del iris a distancia y la mirada reduce rango de cuello. Es síntesis propia, no una prueba en ELA.
- A 2-2.5 m la señal de cabeza (pose del rostro, ya de decenas de píxeles) es mucho más robusta que el iris (cálculo sección 1): conviene que la cabeza sea el canal primario y el iris solo desambigüe zonas gruesas.
- Fatiga: la evidencia (Qian y Teather) apunta a fatiga cervical en head-only; en ELA con debilidad cervical esto pesa más. Rango de giro de cabeza pequeño con ganancia alta (control tipo Gameface) mitiga, pero aumenta el ruido.

### Gaps
- Sin estudios de fatiga en sesiones largas (>30 min) ni con ELA para gaze+cabeza; la mayoría es VR/AR con sujetos sanos.
- No pude verificar resultados cuantitativos de Eye&Head ni del estudio GI 2026 (Vila y Teather); solo resúmenes.
- No hallé documentación primaria de que Apple Eye Tracking o Tobii combinen explícitamente cabeza + ojos con cifras (Tobii solo afirma tolerancia a movimiento de cabeza).
