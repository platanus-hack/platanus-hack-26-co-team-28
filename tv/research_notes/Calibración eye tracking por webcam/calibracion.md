# Calibración y post-procesado de eye tracking por webcam (RGB) para AAC en ELA (TV a 2–2.5 m, 4–8 objetivos)

Nota de alcance: el trabajo se hizo con ~17 llamadas. Varias fuentes primarias (WebGazer IJCAI, Salvucci & Goldberg, Casiez 2012, Semmelmann & Weigelt 2018, Saxena 2022/23) solo se pudieron leer parcialmente (PDF o certificado fallido) y lo no verificado va en Gaps. Fecha de hoy: 2026-11-21. Los resultados de WebGazer 2016 y Semmelmann 2018 son antiguos; los de 2025–2026 (WebEyeTrack, Chiasm, EMC-Gaze) son preprints de arXiv, no necesariamente revisados por pares.

## 1. Número y disposición de puntos de calibración (5, 9, 13, 16; esquinas vs. rejilla; smooth pursuit)

### Takeaway
Más puntos mejoran la precisión con rendimientos decrecientes (RealEye: el mayor salto va de 5 a 21 puntos; la mejora se aplana hacia 39). Los trabajos recientes usan 9 puntos como estándar (esquinas + puntos medios de borde + centro), y Labvanced usa ~120 puntos con pursuit en 5 min. Con solo 4–8 objetivos grandes, lo relevante es cubrir bien el área de objetivos, no el límite de precisión.

### Cited Findings
- RealEye (vendor, error en píxeles, no grados, distancia y pantalla no controladas): 5 pts = 137,1 px (n=47); 13 = 127,1 (n=46); 21 = 112,9 (n=53); 39 (por defecto) = 105,8 (n=102); 78 = 92,2 (n=48). Recomiendan 39 como equilibrio; 21 para tareas centradas; 13 solo si la precisión no es crítica; 5 no apto para precisión. — [RealEye blog](https://realeye.io/blog/post/optimizing-realeye-calibration-point-count-and-accuracy-on-computers)
- En RealEye, con 5 puntos las esquinas inferiores tuvieron los peores errores (223 y 168 px); con 21 puntos las esquinas superiores 77–82 px y las inferiores 135–151 px. Es decir, los bordes/esquinas son la zona más débil aun con más puntos. — [RealEye blog](https://realeye.io/blog/post/optimizing-realeye-calibration-point-count-and-accuracy-on-computers)
- Gudi et al.: un método puramente geométrico supera al de ML con pocos puntos (≲9); un método híbrido fue el mejor en un rango amplio de nº de puntos. — [arXiv 2009.01270](https://arxiv.org/pdf/2009.01270)
- Chiasm (2026, preprint): calibración de 9 puntos en rejilla (centro, 4 puntos medios de borde, 4 esquinas), puntos periféricos con inset del 10 % del ancho/alto y ≥40 px dentro del canvas; el centro va primero y los otros 8 en orden aleatorio. Cada punto era un disco rojo que se contraía a un objetivo tipo diana+cruz (reduce microsacadas), 3,1 s por punto, y las muestras se usan desde 800 ms después de aparecer el punto. — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946)
- Chiasm validación: 13 puntos (rejilla con 4 puntos interiores al 30 %/70 % del ancho/alto), 1,5 s por punto, orden aleatorio, objetivos estáticos. — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946)
- Labvanced (webcam, N=23): calibración por defecto de 5 min con siete poses de cabeza y ~12 objetivos por pose (~120 puntos), incluye rejilla de fijación, una breve tarea de smooth pursuit y una de movimiento de cabeza; opciones de 1 a 8 min. Precisión de 1,45° ± 0,76° (rejilla grande), 1,35° en objetivos interiores y 1,50° en exteriores, a 60 cm y 15". — [Saxena/Labvanced, PMC11289017](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017)
- EMC-Gaze (2026, preprint, landmarks): tras calibración de 9 puntos, 5,79 ± 1,81° RMSE en evaluación interactiva (33 sesiones, 100 cm); 2,92 ± 0,75° en consultas con cabeza quieta. — [arXiv 2603.12388](https://arxiv.org/abs/2603.12388)
- jsPsych webgazer-validate usa por defecto una rejilla de 9 puntos al 10/50/90 % de la pantalla; punto de 20 px; 1000 ms de `time_to_saccade`; 2000 ms de validación por punto. — [jsPsych docs](https://www.jspsych.org/v7/plugins/webgazer-validate/)
- Nada encontrado que compare directamente 5/9/13/16 puntos con smooth pursuit vs. puntos fijos en webcam, salvo que Labvanced mezcla ambos.

### Inferences
- Para 4–8 objetivos grandes, una rejilla de 9 puntos (o 5 + puntos colocados en el centro de cada objetivo real) es razonable; añadir puntos extra donde estén los objetivos (en vez de esquinas lejanas) concentra la precisión donde importa. Las esquinas son las peores zonas, así que conviene no poner objetivos pegados al borde.
- Para ELA, 9 puntos x ~2–3 s ≈ 20–30 s es el orden de magnitud de las implementaciones recientes; ~5 min (Labvanced) parece demasiado largo para un usuario fatigable (ver sección 7).

### Gaps
- No hay comparación cuantitativa en grados de 5 vs. 9 vs. 13 vs. 16 puntos; RealEye está en píxeles y es vendor.
- No hay datos controlados de smooth pursuit vs. puntos fijos en webcam.

## 2. Modelos de mapeo/regresión y muestras por punto

### Takeaway
WebGazer usa ridge regression lineal sobre un vector de 120 características de imagen de ojos; los trabajos nuevos usan ridge de forma cerrada sobre embeddings (EMC-Gaze) o personalización few-shot (FAZE, WebEyeTrack con k ≤ 9) con errores de 2–3 cm / ~3° en datasets de laboratorio, pero mucho peor en el "mundo real".

### Cited Findings
- WebGazer (2016): ridge regression que mapea un vector de 120 dimensiones de ojo a coordenadas de pantalla, λ = 10^-5 (mismo valor que TurkerGaze); w = (XᵀX + λI)⁻¹XᵀY. — [Papoutsaki et al., IJCAI 2016](https://jeffhuang.com/papers/WebGazer_IJCAI16.pdf)
- En WebGazer 2016, la ridge superó a la regresión lineal simple sobre la posición de la pupila: error medio 233,4 px vs. 256,9 px (n=76 participantes online, sin reposacabezas). — [IJCAI 2016](https://jeffhuang.com/papers/WebGazer_IJCAI16.pdf)
- Variante RR+C (muestras de movimiento de cursor con peso 0,5 que decae 0,05 cada 20 ms, es decir máx. 200 ms): menor error medio, 174,9 px; RR+F+C 210,6 px; RR+F (muestras extra en un buffer de fijación de 500 ms, hasta 72 px) empeoró a 251,5 px. — [IJCAI 2016](https://jeffhuang.com/papers/WebGazer_IJCAI16.pdf)
- WebGazer: >4° de precisión media reportada por trabajos posteriores; ~3–4° para el mejor modelo según la bibliografía citante. — [resumen de búsqueda sobre Semmelmann & Weigelt](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017)
- Chiasm vs. WebGazer (101 participantes cada uno, mismo protocolo): exactitud 2,18 cm vs. 4,51 cm; precisión espacial (SD) 1,01 vs. 1,55 cm; RMS-S2S 1,26 vs. 0,79 cm (WebGazer mejor, probablemente por sobre-suavizado). — [arXiv 2611.04946](https://arxiv.org/abs/2611.04946)
- FAZE (ICCV 2019): personaliza con ≤ 9 muestras; con 3 muestras de calibración logra 3,18° en GazeCapture (mejora del 19 % desde 3,91°). — [NVIDIA Research](https://research.nvidia.com/labs/amri/publication/park2019few/)
- WebEyeTrack (2025): BlazeGaze de ~0,16 M parámetros; 2,32 cm en GazeCapture, 4,56 cm en MPIIFaceGaze, 7,53 cm en EyeDiap; personalización con k ≤ 9 muestras de soporte vía MAML de primer orden (inner SGD α=1e-5; outer Adam η=1e-3; 9 muestras de soporte y 100 de consulta por tarea); 2,4 ms/inferencia en iPhone 14. — [arXiv 2508.19544 (HTML)](https://arxiv.org/html/2508.19544), [abstract](https://arxiv.org/abs/2508.19544)
- EMC-Gaze (2026): calibrador ridge de forma cerrada sobre un encoder de landmarks (944 423 parámetros, 4,76 MB ONNX), 12,6 ms por muestra en Chromium con ONNX Runtime Web; supera a Elastic Net desde 3-shot; 8,82° con 16-shot en MPIIFaceGaze. — [arXiv 2603.12388](https://arxiv.org/abs/2603.12388)
- Chiasm (2026): RBF calibration en un estudio previo de iMotions (N=255) citado por Belopolsky & Perdreau. — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946)
- No se encontraron en las fuentes leídas comparaciones directas de polinomio de 2º orden vs. ridge vs. proceso gaussiano. Un trabajo cita polinomio con 9 puntos con error medio de 3,46° en una condición (no verificado en detalle). — [arXiv 1907.04325](https://arxiv.org/pdf/1907.04325)
- Muestras por punto: Chiasm usa ventana de 3,1 s por punto con descarte de los primeros 800 ms (~2,3 s a 30 Hz ≈ ~70 muestras por punto, cálculo propio sobre los 30 Hz declarados). — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946)

### Inferences
- Para una app propia, un backbone preentrenado (landmarks/embedding) + ridge de forma cerrada sobre 9 puntos x ~2 s de muestras es el patrón más repetido y barato; few-shot de un modelo profundo (FAZE/WebEyeTrack) es más sofisticado pero sus cifras de laboratorio (2–3°) no se trasladan al uso real.
- Descartar la ventana de latencia sacádica inicial (~0,8–1 s) de cada punto es práctica común (Chiasm, jsPsych).

### Gaps
- Sin comparación publicada polinomial vs. ridge vs. GP en webcam; no se verificó número de muestras por punto en WebGazer.

## 3. Deriva (drift): causas y correcciones

### Takeaway
La deriva es sustancial: en WebGazer el error subió de 7,79 a 11,62 cm (+49 %) durante una sesión de escritura, mientras que un modelo con conciencia de pose subió +20 %. Las correcciones usadas son recalibración periódica corta, actualización continua con clics/selecciones y mezcla con un modelo base estable.

### Cited Findings
- Causas citadas (genéricas, no específicas de webcam): movimiento del usuario y cambios de luz ambiente hacen que el rendimiento se degrade con el tiempo. — [EyeO, arXiv 2307.15039](https://arxiv.org/pdf/2307.15039)
- WebGazer: error en Eye of the Typer subió 49 % (7,79 → 11,62 cm); WebEyeTrack 20 % (7,24 → 8,72 cm); los autores atribuyen la deriva de WebGazer a que su recalibración por clics falla en tareas continuas como escribir. WebGazer 2016 no tiene conciencia de pose. — [arXiv 2508.19544](https://arxiv.org/html/2508.19544)
- Chiasm: tras 3 min de una tarea que fomentaba el movimiento de cabeza, la exactitud empeoró 0,59 cm; el centro de la mirada por objetivo se desplazó solo 0,37 cm de media. Gafas reducen la exactitud; luminancia de cara y contraste no tuvieron relación fiable. — [arXiv 2611.04946](https://arxiv.org/abs/2611.04946)
- WebGazer asume que mirada y clic coinciden; mantiene un buffer de 500 ms y añade predicciones previas al clic si están a ≤72 px; Huang et al. 2012 midieron una distancia mirada-cursor media de 74 px al hacer clic. — [IJCAI 2016](https://jeffhuang.com/papers/WebGazer_IJCAI16.pdf)
- EMC-Gaze (2026): actualiza una cabeza ridge con clics por mínimos cuadrados recursivos con factor de olvido, retiene la cabeza de la calibración explícita como fallback estable y mezcla gradualmente hacia la actualizada online para limitar deriva por clics ruidosos. — [arXiv 2603.12388](https://arxiv.org/pdf/2603.12388)
- Labvanced: recalibración de ~15 s: siete puntos cada seis ensayos (rejilla grande), cada ensayo (pursuit), cada siete ensayos (free view); suma ~4 min; puede desactivarse. Recomiendan ajustar la frecuencia a la duración del estudio. — [PMC11289017](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017)
- EyeO (ELA, 20 participantes + entrevista con 6 miembros de la comunidad ELA): autocalibra en tiempo real durante la escritura por mirada aprovechando la diferencia entre mirar el teclado y leer el texto escrito; fijación dentro de un umbral τ del último carácter escrito; mejoró velocidad (EyeO M=25,91) y reducción de la necesidad de recalibrar manualmente (miscalibración inducida a propósito). Usa un tracker no webcam, pero el principio es transferible. — [arXiv 2307.15039](https://arxiv.org/pdf/2307.15039)
- Una revisión de ELA indica que usuarios recalibran hasta ~50 veces al día en trackers comerciales, lo cual frustra; incluso movimientos leves de cabeza degradan la precisión y las configuraciones con cámara requieren recalibraciones frecuentes. — [PMC12349285 (vía resumen de búsqueda)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12349285/)

### Inferences
- En una app AAC con selección por mirada, cada selección confirmada (dwell completado y no cancelado) es un ground truth implícito natural: se puede aplicar corrección de offset suave (p. ej. RLS con olvido) y limitarla (clip) para no aprender de selecciones erróneas, más un "ancla" a la calibración explícita.
- Un único punto de corrección de deriva (mirar un objetivo conocido, p. ej. el botón de "Inicio") es una opción de bajo esfuerzo; no hay cifras publicadas de su eficacia en webcam.
- Disparadores razonables: pérdida de cara, cambio grande de pose, series de selecciones canceladas/deshechas, tiempo transcurrido.

### Gaps
- No hay estudio que cuantifique la corrección de offset de un único punto en webcam; los umbrales y las tasas de olvido concretos de EMC-Gaze no se pudieron extraer del PDF.

## 4. Compensación de pose de cabeza

### Takeaway
Dos enfoques: normalizar la imagen (Zhang et al.) para cancelar pose/distancia y/o usar pose de cabeza como característica extra. WebGazer no es consciente de la pose, lo que explica parte de su deriva; WebEyeTrack incluye estimación de pose de cabeza basada en face mesh.

### Cited Findings
- Normalización de datos (Zhang, Sugano, Bulling, ETRA 2018): mapea imágenes y etiquetas de mirada a un espacio normalizado para cancelar la pose de cabeza y la distancia a la cámara; proponen eliminar el factor de escala de la formulación, con mejoras de 9,5 % a 32,7 % según la configuración. — [MPI-INF](https://www.mpi-inf.mpg.de/de/departments/computer-vision-and-machine-learning/research/gaze-based-human-computer-interaction/revisiting-data-normalization-for-appearance-based-gaze-estimation)
- ETH-XGaze (ECCV 2020): >1 millón de imágenes con poses extremas; el repo ofrece código de normalización (recorte sin rotación de roll), recomienda parches de cara 224×224. — [ETH-XGaze GitHub](https://github.com/xucong-zhang/ETH-XGaze)
- WebEyeTrack: face mesh de 468 puntos de MediaPipe reproyectados a 3D y normalizados por centro de la nariz y ancho de cara; escala métrica a partir de un diámetro de iris de 1,2 cm; traslación refinada con Procrustes radial iterativo desde z₀ = 60 cm (paso máx. 5 cm, parada <0,25 cm o 10 iteraciones). — [arXiv 2508.19544](https://arxiv.org/html/2508.19544)
- EMC-Gaze: encoder de landmarks equivariante E(3) con pérdida de consistencia de canonización para reducir fuga de pose; queries con cabeza quieta 2,92° vs. ~5,79° en uso interactivo con movimiento. — [arXiv 2603.12388](https://arxiv.org/abs/2603.12388)
- Labvanced: calibra en siete poses de cabeza y usa una "barbilla virtual" que pausa el ensayo si la cabeza sale del rango (sensibilidad de seis niveles, usaron "medio-estricto"). Pérdida de datos con cambios de roll 2,05 % (webcam). — [PMC11289017](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017)
- EyeO: para ELA, el movimiento de cabeza se asume pequeño porque los usuarios pierden progresivamente esa capacidad. — [arXiv 2307.15039](https://arxiv.org/pdf/2307.15039)

### Inferences
- Usuario ELA fase media (mueve cabeza y ojos): calibrar en 2–3 poses habituales (recostado/recto) y reutilizar la más cercana según la pose detectada es consistente con Labvanced.
- A 2–2.5 m el ojo en la imagen es muy pequeño; los modelos basados en landmarks/iris de cabeza completa pierden resolución (no hay fuente aquí; ver gaps).

### Gaps
- No se encontró validación de ningún tracker webcam a 2–2,5 m; todas las cifras son a ~50–100 cm. Es el gap más importante para este caso de uso.

## 5. Suavizado y detección de fijaciones

### Takeaway
La One Euro Filter es el estándar para cursor/mirada con baja latencia; se afina con beta=0 y mincutoff ~1 Hz y luego se sube beta. I-VT/I-DT (Salvucci & Goldberg) con mínimo de fijación ~100 ms; para AAC con 4–8 objetivos grandes la selección por dwell (cientos de ms) hace innecesario un detector fino.

### Cited Findings
- One Euro Filter (Casiez 2012): parámetros mincutoff y beta. Procedimiento recomendado: beta=0, mincutoff=1 Hz como punto de partida; con la entrada quieta o lenta, ajustar mincutoff para quitar jitter; con movimiento rápido, subir beta (explorar por órdenes de magnitud, p. ej. 0,001 o 0,0001 según unidades). Menor mincutoff = menos jitter pero más lag. — [Casiez, página 1€ Filter](https://gery.casiez.net/1euro/)
- Salvucci & Goldberg 2000 comparan I-VT, I-HMM, I-DT, I-MST, I-AOI; fijaciones rara vez < 100 ms y a menudo de 200–400 ms. Umbral de I-VT de 30°/s es un valor por defecto común en implementaciones (Olsen 2012), no fijado por el artículo original. — [Salvucci ETRA00](https://www.cs.drexel.edu/~dds26/publications/Salvucci-ETRA00.pdf), [resumen de búsqueda](https://arxiv.org/pdf/2512.23926v2)
- Blignaut & Beelders 2009: el umbral de dispersión de I-DT es crucial; no se confirmó el 1° típico. — [Springer s13428-010-0031-2](https://link.springer.com/content/pdf/10.3758/s13428-010-0031-2.pdf)
- A 30 Hz las webcams no sirven para sacadas rápidas ni microsacadas; Chiasm limita a 30 Hz. — [PMC11289017](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017), [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946)
- Compensación suavizado/precisión: WebGazer con RMS-S2S bajo (0,79 cm) frente a Chiasm (1,26 cm) probablemente refleja sobre-suavizado, no mayor estabilidad. — [arXiv 2611.04946](https://arxiv.org/abs/2611.04946)
- Semmelmann & Weigelt 2018: ~750 ms hasta asentarse la mirada en un estímulo con webcam (vs. ~200 ms en laboratorio), considerable variabilidad entre participantes (según trabajos citantes). — [PMC11289017 / búsqueda](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017)

### Inferences
- Con 30 Hz y error de 2–3°, I-DT con dispersión grande (en grados, del orden del error esperado) y dwell ≥ 400–800 ms es más realista que parámetros de tracker infrarrojo; el valor concreto debe calibrarse empíricamente.
- Propuesta de partida (no sourced, a validar): One Euro con mincutoff ~1 Hz, beta ~0,001–0,01, y mediana móvil de 5 muestras (~170 ms a 30 Hz) previa; el coste en latencia es ~100–200 ms.

### Gaps
- Valores publicados de One Euro específicos para mirada por webcam; valores exactos de I-DT/I-VT del artículo de Salvucci (no accesible por error de certificado); Kalman en WebGazer no verificado.

## 6. Validación: exactitud/precisión y umbrales de aceptación

### Takeaway
Medir exactitud (offset medio) y precisión (SD y RMS muestra a muestra) con puntos de validación independientes de los de calibración, preferiblemente en grados; criterios publicados varían: 3 cm (Chiasm), 7 % de pantalla (Labvanced), EyeLink <1°/1,5°.

### Cited Findings
- Chiasm: criterio de aceptación de calibración = error medio ≤ 3 cm tras la calibración de 9 puntos, hasta 3 intentos; 91 % cumplió; para ellos exactitud 2,15 cm (~2,05° a 60 cm); global 2,39 cm (~2,28°), precisión SD 1,05 cm (~1,00°), RMS-S2S 1,29 cm (~1,23°). — [arXiv 2611.04946](https://arxiv.org/abs/2611.04946), [PDF](https://arxiv.org/pdf/2611.04946)
- Labvanced: pasa la calibración si el error < 7 % del tamaño de pantalla; ~80 % de éxito en el primer intento; accuracy 1,4° y precisión 1,1° (RMS-S2S X 1,22°, Y 1,00°); EyeLink requería error medio <1,0° y máx <1,5°. — [PMC11289017](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017)
- jsPsych: valida con % de muestras dentro de un radio ROI (200 px por defecto) y offset medio (x,y) y distancia mediana r; no define umbral de aceptación. — [jsPsych docs](https://www.jspsych.org/v7/plugins/webgazer-validate/)
- Chiasm validación tras 3 min de movimiento de cabeza (Validation B) permite cuantificar la deriva. — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946)
- Saxena et al.: mejor exactitud 2,4° y precisión 0,47° con deep learning y calibración; muestra de 65 participantes (según resumen de búsqueda). — [Springer s13428-023-02190-6](https://link.springer.com/10.3758/s13428-023-02190-6)

### Inferences
- Conversión útil: 1° a 2,25 m ≈ 3,9 cm; un error de 2,3° ≈ 9 cm en el plano de la TV (cálculo propio). Con objetivos de ≥20–30 cm (≈ 5–7°) y márgenes, un error típico de webcam de 2–3° es compatible con 4–8 objetivos grandes; una regla de aceptación sensata sería error de validación < ~1/4–1/3 del ancho del objetivo, a confirmar por prueba.
- Validar con objetivos situados donde irán los botones reales y con un criterio por objetivo (porcentaje de muestras dentro del objetivo) en lugar de solo un promedio.

### Gaps
- No hay umbrales de aceptación en grados publicados para webcam en AAC.

## 7. UX de calibración para usuarios con discapacidad (duración, fatiga, auto-avance, cuidador)

### Takeaway
Hay poca evidencia específica en webcam para ELA. Lo disponible: las calibraciones largas (5 min) fatigan; los usuarios ELA ya recalibran decenas de veces/día con trackers comerciales, y la autocalibración implícita (EyeO) fue valorada positivamente por la comunidad ELA.

### Cited Findings
- Los autores de Labvanced indican que la calibración de 5 min requiere atención sostenida y debe acortarse para uso más amplio. — [PMC11289017](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289017)
- Revisión ELA: hasta ~50 recalibraciones al día generan frustración y pueden llevar al abandono del dispositivo. — [PMC12349285](https://pmc.ncbi.nlm.nih.gov/articles/PMC12349285/)
- EyeO: entrevista con 6 miembros de la comunidad ELA sobre la autocalibración; los participantes sin ELA prefirieron la autocalibración en general (p < 0,001 en velocidad/precisión, según el artículo). — [arXiv 2307.15039](https://arxiv.org/pdf/2307.15039)
- Chiasm da hasta 3 intentos de calibración y deja continuar aunque falle; ~14 min en total para su protocolo completo. — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946)
- Puntos con avance automático por tiempo (3,1 s Chiasm; 2 s jsPsych en modo view; avance por clic en modo click) — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946), [jsPsych](https://www.jspsych.org/v7/plugins/webgazer-validate/)
- Un sistema webcam de comunicación por parpadeo usó una calibración de usuario de 5 puntos con 97,66 % de acierto de parpadeo (no es mirada). — [Springer s12652-024-04760-8](https://link.springer.com/article/10.1007/s12652-024-04760-8)

### Inferences
- Diseño sugerido: calibración corta (<1 min) con avance automático y punto animado, repetible por el cuidador con un solo botón (teclado/ratón), con resultado visual (verde/ámbar/rojo) y opción de omitir puntos; recalibración micro (1–2 puntos) en lugar de completa; calibración en la pose real de uso.
- Con la pantalla a 2–2,5 m, el cuidador necesitará un control remoto o un segundo dispositivo.

### Gaps
- No se hallaron guías publicadas de duración máxima ni estudios de fatiga en calibración webcam con ELA; ni protocolos para calibración dirigida por cuidador.
