# 02 - Evidencia de HCI sobre interfaces controladas con la mirada

Fecha: 2026-11-21. Autor: agente de investigación (informe para WOKI, solo hackathon).

Convención: **[V]** = verificado, leí la fuente (PDF o página). **[I]** = inferido o calculado por mí. **[NV]** = no verificado: solo vi un resumen o un buscador, o no lo encontré.

Advertencia general: casi todos los estudios usan rastreadores infrarrojos comerciales (precisión de 0,5 grados o mejor) con voluntarios sin discapacidad, pantallas de escritorio a 50-70 cm. WOKI usa webcam (1,5 a 3,7 grados), TV a 2-3 m y una usuaria con ELA. Los números de dwell y de wpm son una **cota superior optimista** para Marta. Los números de tamaño de objetivo hay que reescalarlos.

---

## 1. Dwell (tiempo de permanencia)

**Valores reportados [V]**
- Los estudios clásicos con novatos usan dwell constante de 450 a 1000 ms y reportan 5 a 10 wpm. Fuente: Majaranta, Ahola y Špakov, CHI 2009. https://homepages.tuni.fi/oleg.spakov/publications/Majaranta_CHI_09.pdf
- Estudio longitudinal con dwell ajustable por el usuario (11 estudiantes, 10 sesiones de 15 min, empieza en 1000 ms, rango 150 a 2000 ms, 600 ms en el centro del medidor): la velocidad sube de 6,9 wpm (sesión 1) a 19,9 wpm (sesión 10); el dwell medio baja de 876 ms a 282 ms; el error baja de 1,28% a 0,36%. Todos terminaron por debajo de 400 ms (mínimo 180, máximo 380). En la sesión 4 (una hora de práctica) el dwell medio ya era 378 ms y la velocidad 16,2 wpm. Mismo PDF de arriba.
- El dwell fija un techo: con 1000 ms el máximo es 12 wpm, "no importa la habilidad". Majaranta et al., Univ Access Inf Soc 2006. https://www.yorku.ca/mack/UAIS2006.pdf
- Špakov y Miniotas, NordiCHI 2004 (dwell adaptativo): probaron 300 a 1100 ms. Con 300 ms hubo muchos errores y todos los participantes lo consideraron demasiado corto, por eso el algoritmo impide bajar de 400 ms y mantiene el dwell entre 400 y 700 ms (más de 700 ms es "demasiado lento"). Arranca en 600 ms, mide los primeros 40 selecciones, y después ajusta con el tiempo de salida de la mirada: 10 ms de cambio en el tiempo de salida equivale a 80 ms de dwell. Los novatos tienen mayor tiempo de salida que los expertos. Los autores admiten que el ajuste automático tenía retraso y variación involuntaria. https://homepages.tuni.fi/oleg.spakov/publications/Spakov_NordiCHI_04.pdf
- Majaranta 2009 retoma esa crítica: los participantes querían cambiar la velocidad más rápido, por eso dejaron el control al usuario (teclas + y - en pantalla, pasos de 160 ms en el extremo largo y 25 ms en el corto). Todos entendieron el ajuste como "claro y fácil". Mismo PDF Majaranta 2009.
- Dwell en cascada (Mott, Williams, Wobbrock, Morris, CHI 2017): baja el dwell de las teclas probables (según predicción de la siguiente letra) y sube el de las improbables; 17 participantes sin discapacidad, 8 sesiones: 12,39 wpm vs 10,62 wpm con dwell fijo. Con 5 personas con ELA: 9,51 wpm. Dwell inicial de 600 ms. https://faculty.washington.edu/wobbrock/pubs/chi-17.02.pdf
- Expertos y dwell cercano a la fijación natural: lo cita un artículo de JEMR de 2016 sobre Räihä y Ovaska 2012; no leí el original de CHI 2012. [NV] https://dblp.org/rec/conf/chi/RaihaO12.html

**Lectura para WOKI [I]**
- Novata: arrancar en 600 a 900 ms. Marta no es novata ni experta en WOKI; la demo será su primera vez, así que 700 ms por defecto.
- Con webcam ruidosa el dwell debe ser más largo que con rastreador IR, porque el cursor tiembla; bajar de 400 ms no está respaldado por nada de lo que leí para esta precisión.
- Ofrecer un control de velocidad visible (más rápido / más lento) en vez de adaptación automática.

---

## 2. Tamaño mínimo de objetivo y geometría (webcam, TV a 2 y 3 m)

**Evidencia [V]**
- Feit et al., CHI 2017 (80 personas, 2 rastreadores, 2 iluminaciones): precisión y exactitud varían **más de seis veces** entre usuarios y objetivos; la exactitud es peor en vertical; la precisión empeora hacia los bordes derecho e inferior; recalibrar entre 3 y 10 veces por día en usuarios expertos; fórmula de tamaño S = 2(O + 2σ) (O = desviación, σ = desviación estándar, 95% de los puntos); los objetivos deben ser algo más altos que anchos; con filtro (promedio ponderado con detección de sacadas) el tamaño baja 32 a 42%, con retraso de ~2 cuadros (~32 ms). Un objetivo de 1,9 × 2,35 cm sirve al 75% de los usuarios con filtro y 3,28 × 3,78 cm sin filtro. **Los grados y la distancia de esas cifras no los pude confirmar** [NV]. Datos tomados de la página de Microsoft Research y de las diapositivas, no del PDF. https://www.microsoft.com/en-us/research/publication/toward-everyday-gaze-input-accuracy-precision-eye-tracking-implications-design/ y https://www.slideshare.net/slideshow/toward-everyday-gaze-input-accuracy-and-precision-of-eye-tracking-and-implications-for-design/75976708
- WebGazer (webcam): error medio ~4,17 grados contra un rastreador comercial según el resumen que vi; otras réplicas reportan 3,65 grados (SD 0,77) y una mediana de 3,72 grados; con calibración cuidadosa y cabeza quieta se ve menos de 1 a 2 grados. Es consistente con el rango 1,5 a 3,7 del brief. [NV] (solo resúmenes de búsqueda). https://jeffhuang.com/papers/WebGazer_IJCAI16.pdf y https://studenttheses.uu.nl/handle/20.500.12932/40709
- El error de la webcam se degrada con movimiento de cabeza y con deriva en el tiempo. [NV] mismos enlaces.
- Ninja cursors con mirada (Räihä y Špakov, CHI 2009): con 9 cursores en una pantalla, para elegir uno **la precisión no necesita ser mejor que 5 grados**. https://homepages.tuni.fi/oleg.spakov/publications/Raiha_CHI_09.pdf
- Majaranta 2009 agrandó el área activa por encima de la tecla visible "para minimizar problemas de calibración". Mismo PDF Majaranta 2009.

**Fórmula [I]:** tamaño = 2 · distancia · tan(ángulo/2).

| Ángulo | A 0,6 m (monitor) | A 2 m | A 3 m |
|---|---|---|---|
| 1,5 grados (mejor caso webcam) | 1,6 cm | 5,2 cm | 7,9 cm |
| 3,0 grados (= 2 x 1,5) | 3,1 cm | 10,5 cm | 15,7 cm |
| 3,7 grados (peor caso webcam) | 3,9 cm | 12,9 cm | 19,4 cm |
| 7,4 grados (= 2 x 3,7) | 7,8 cm | 25,9 cm | 38,8 cm |
| 10 grados (con margen) | 10,5 cm | 35,0 cm | 52,5 cm |

Regla propuesta [I]: para que el punto reportado caiga dentro del objetivo aunque el error sea el máximo, el **ancho debe ser al menos 2 veces el error** (la mitad del ancho cubre el error). Con 3,7 grados de error eso es 7,4 grados; con margen por deriva y bordes (Feit: peor en bordes), **objetivo de 8 a 10 grados**. Es un cálculo mío, no un número de un paper.

**Tamaño angular de la pantalla [I]** (16:9):

| Pantalla | Distancia | Ancho x alto en grados |
|---|---|---|
| 55 pulgadas (122 x 69 cm) | 2 m | 33,9 x 19,4 |
| 55 pulgadas | 3 m | 22,9 x 13,0 |
| 65 pulgadas (144 x 81 cm) | 2 m | 39,6 x 22,9 |
| 65 pulgadas | 3 m | 27,0 x 15,4 |
| Monitor 32 pulgadas (71 x 40 cm) | 2 m | 20,1 x 11,4 |

Consecuencia [I]: con objetivos de 8 grados y un margen entre zonas, en una TV de 55 pulgadas a 2 m caben **unas 4 columnas x 2 filas (6 a 8 zonas)**; a 3 m caben **unas 2 a 3 columnas x 1 fila**. Una grilla 3 x 3 de zonas de 8 grados necesita ~24 x 24 grados, que no cabe en una TV 16:9 a 3 m. Hay que acercar la TV (2 m o menos), usar una pantalla de 65 pulgadas o más, o aceptar menos zonas. La altura es el factor limitante.

Nota: un ángulo se mantiene al cambiar la distancia, pero el error de la webcam en cm crece con la distancia, y la cara de Marta también se verá más pequeña para la cámara. [I]

---

## 3. "Toque de Midas" y sus soluciones

**Definición [V]:** el dwell dispara selecciones no intencionales, por ejemplo cuando la fijación se prolonga por fatiga o por procesamiento mental. Un dwell largo previene falsas selecciones pero cansa; bajarlo sube los errores. Fuentes: Majaranta 2009 y Kristensson y Vertanen 2012 (cita a Jacob y Karn 2003). https://www.keithv.com/pub/dwellfree/kristensson-dwell-free.pdf

**Soluciones**
1. **Mirada para apuntar + clic físico o muscular.**
   - Mateo et al., CHI 2008 Extended Abstracts, "Gaze beats mouse": piloto de 5 participantes; apuntar con la mirada fue más rápido que con el mouse con error similar, y el EMG facial como interruptor rindió parecido al botón del mouse. El resumen que vi no da las cifras de throughput [NV]. https://pure.itu.dk/en/publications/gaze-beats-mouse-hands-free-selection-by-combining-gaze-and-emg/
   - Junker y Hansen, COGAIN 2006, "Gaze pointing and facial EMG clicking": solo vi el título en una cita. [NV]
   - Mateo et al. 2008 (IEEE, EMG + mirada para cursor): el sistema combinado fue más lento en general, pero controlaba el cursor sin límite por la precisión espacial y daba un clic confiable. [NV] (resumen en https://pubmed.ncbi.nlm.nih.gov/18566935).
   - Tuisku, Surakka y colegas ("mirar y sonreír", músculos faciales): 4,1 a 6,7 wpm en el estudio longitudinal, sin llegar a la meseta; un estudio relacionado con EMG facial reporta 20 caracteres por minuto (~4 wpm) contra 27 del mouse. [NV] (no pude abrir el PDF). https://trepo.tuni.fi/bitstream/10024/125387/1/Text_Entry_by_Gazing_and_Smiling.pdf
   - TAGSwipe (CHI 2020, mirada + toque, 12 participantes): 15,46 wpm contra 8,84 (EyeSwipe) y 8,48 (dwell de 600 ms). Los autores argumentan que separar "mirar" de "seleccionar" es menos cansador para los ojos. [V] https://www.yorku.ca/mack/chi2020a.pdf
   - No encontré un estudio específico de mirada + EMG de **mandíbula**. [NV, pedido del brief no cumplido]. Lo más cercano son los de ceja/cara y la analogía con TAGSwipe.
   - Mirada + pellizco en VR con ayudas "magnéticas" y "pegajosas" (Collins et al., CHI EA 2026, preprint, N=9): la ayuda magnética redujo errores y los usuarios cambiaron precisión por velocidad. VR, muestra muy pequeña. [V, preprint] https://arxiv.org/pdf/2603.26608
2. **Gestos de mirada** (Drewes y Schmidt, INTERACT 2007, 9 participantes, rastreador con ±0,5 grados): inmunes a errores de precisión y a la deriva de calibración. El gesto 3U1U tardó ~1,9 s (DE ~0,6 s) en promedio para cerrar un diálogo, similar a mouse con el traslado desde el teclado; el gesto no apareció **ninguna vez** en 28 minutos de navegar web de los 9 usuarios, mientras que RLRLRL (izquierda-derecha repetido) apareció 69 veces por ser el movimiento natural de lectura. Los gestos grandes fueron más fáciles que los pequeños; una sacada de más de 5 grados dura ~120 ms; usaron las esquinas de la pantalla como guía. [V] https://www.medien.ifi.lmu.de/pubdb/publications/pub/drewes2007interact/drewes2007interact.pdf
3. **Cruce de objetivos / sin dwell**: EyeSwipe (Kurauchi et al., CHI 2016, 10 participantes) usa "cruce inverso" para la primera y última letra: 11,7 wpm tras 30 minutos, contra ~9 wpm con dwell de 600 ms; los participantes con anteojos lo pasaron peor. [V] https://www.cs.bu.edu/fac/betke/papers/Kurauchi-etal-CHI-2016.pdf
4. **Pausa explícita**: Look to Speak (Google) se pausa mirando hacia arriba y exige mirar hasta el extremo izquierdo, derecho o arriba para que cuente como deliberado. [NV, solo notas de prensa y la página del experimento] https://experiments.withgoogle.com/looktospeak

**Lectura para WOKI [I]:** WOKI ya tiene la mejor solución documentada para Midas: separar apuntar (mirada) de confirmar (EMG). Con webcam hay que usar la mirada solo para elegir **zona** y el EMG para confirmar. Los gestos de mirada grandes hacia las esquinas son una alternativa sin EMG.

---

## 4. Escritura por mirada: velocidades

| Método | wpm | Fuente |
|---|---|---|
| Dwell fijo, novatos | 5 a 10 | Majaranta 2009 [V] |
| Dwell ajustable, 10 sesiones (2,5 horas), sin discapacidad | 6,9 a 19,9 (mejor participante ~23) | Majaranta 2009 [V]; la cifra de 23 viene de Kristensson y Vertanen [V] |
| Dasher, 10 sesiones | 2,5 (sesión 1) a 17,3 (sesión 10); sigue subiendo | Tuisku et al. ETRA 2008, citado en Majaranta 2009 [V la cifra final; la inicial vía búsqueda NV] |
| Dasher vs dwell (comparación) | 12,6 vs 6,0 y 14,2 vs 7,0 | citado en Kurauchi 2016 [V la cita] |
| Dwell en cascada con predicción de letra, sin discapacidad | 12,39 (vs 10,62 fijo) | Mott 2017 [V] |
| Dwell en cascada, **5 personas con ELA** | 9,51 | Mott 2017 [V] |
| EyeSwipe (dwell-free) | 11,7 tras 30 min | Kurauchi 2016 [V] |
| TAGSwipe (mirada + toque) | 15,46 (14 desde la sesión 1) | Kumar 2020 [V] |
| Dwell-free simulado con reconocedor perfecto | 36 (sesión 1) a 46 (sesión 5); mejor 54 | Kristensson y Vertanen, ETRA 2012 [V], ver aviso |
| Dwell con ELA (N=4, uno abandonó), dwell 800 ms | EyeGaze 17 caracteres/min (~3,4 wpm); GazeTalk 6,8 caracteres/min (~1,4 wpm) | Pannasch et al., JEMR 2008 [V] |
| Habla normal | más de 100 | Pannasch 2008 [V] |

Aviso sobre el 46 wpm: **no es un sistema real**. Es una simulación en la que el sistema ya sabe la frase y solo verifica que la mirada pase a 1,5 radios de cada tecla; 8 participantes, teclado de 15 x 6 cm, rastreador de 40 Hz y 0,5 grados. Nadie ha logrado un sistema real parecido. [V] https://www.keithv.com/pub/dwellfree/kristensson-dwell-free.pdf. En ese paper también dicen que los sistemas de mirada "parecen haber llegado a una meseta de ~20 wpm".

Las conversiones a wpm de Pannasch son mías (5 caracteres = 1 palabra). [I] Marta, con ELA, probablemente estará **entre 3 y 10 wpm** escribiendo letra a letra con dwell: es el rango observado con pacientes. Esa es la razón de ser de las frases propuestas por Claude: una frase de 8 palabras a 4 wpm son 2 minutos; elegir entre 4 frases con una zona grande son segundos. [I]

---

## 5. Layouts para mirada imprecisa

- Pocas zonas grandes, con área activa mayor que el dibujo visible (Majaranta 2009, [V]). Cálculo de cuántas caben en la sección 2 [I].
- Menús jerárquicos con botones grandes: GazeTalk es un diseño de este tipo. En el estudio con ELA rindió **menos** que EyeGaze (QWERTY), pero N=4, sistemas distintos y 800 ms de dwell. No sirve como prueba de que lo jerárquico sea malo. [V el dato, I la lectura] https://bop.unibe.ch/JEMR/article/download/2278/3474/8502
- Dwell en cascada baja el dwell de teclas probables pero sube el de las teclas vecinas de teclas probables, para evitar activaciones erróneas (los vecinos "probables" aislados toman el dwell mínimo; los rodeados de otros probables vuelven al dwell base). Dwell del espacio = 2/3 del base si la palabra actual existe en el diccionario. [V] Mott 2017.
- Para doble letra, Majaranta 2006 subió el dwell +120 ms (450 a 570 ms) para evitar entradas duplicadas ("aa"). [V] UAIS 2006. [I] Equivale en WOKI a: tras confirmar una zona, no permitir re-confirmar la misma al instante.
- Esquinas y bordes: Drewes y Schmidt usan las esquinas de la pantalla como puntos naturales para gestos [V]. Pero Feit recomienda **evitar** el borde inferior y derecho para objetivos de mirada (peor precisión) [V vía diapositivas]. [I] Para WOKI hay una tensión: gestos de mirada hacia esquinas sí (no necesitan precisión), objetivos de selección en bordes derecho e inferior no.
- Kristensson y Vertanen: los usuarios miran "una región amplia alrededor de las teclas" (solo el 51% de las activaciones fue con la mirada dentro de la tecla), consistente con un error de rastreo. [V]
- Dasher: dibuja letras más grandes cuanto más probables; no necesita dwell pero necesita mucho espacio y horas de práctica (Tuisku y Kumar 2020). [V la limitación en TAGSwipe]

---

## 6. Fatiga ocular, parpadeo y pausa

- Un dwell largo "cansa los ojos y dificulta concentrarse"; tras 4 sesiones **todos** dijeron que 900 ms era demasiado. [V] UAIS 2006.
- No es natural fijar un objetivo estático por mucho tiempo; la animación ayuda. [V] UAIS 2006.
- En Majaranta 2009 el cansancio ocular autoevaluado (escala 1 a 7, diferencia antes/después) fue 0,6 en la sesión 1 y 0,8 en la sesión 10, sin diferencia significativa, aun con dwell corto. Sesiones de 15 minutos. [V]
- Kristensson y Vertanen usaron descansos de **10 minutos entre sesiones de 10 minutos** porque descansos más cortos bajaron el rendimiento en las sesiones siguientes. [V]
- Mott 2017 señala que en usuarios con ELA la fatiga hace que se pausen y tarden más. [V a nivel de frase]
- Fatiga como causa de abandono en ELA ("8 sujetos"): vi la cifra en un resumen de búsqueda sin poder ubicar la fuente. [NV]
- Parpadeo: **no encontré** estudios concretos de parpadeo como selección o su efecto en dwell. [NV]. [I] Con webcam los parpadeos producen pérdidas de datos; un filtro que ignore huecos menores a ~150 a 300 ms es habitual en rastreadores, pero no verifiqué un número de fuente. No cuento ese número como hallazgo.
- Pausar el seguimiento: Look to Speak pausa mirando arriba [NV]. [I] WOKI necesita un "modo descanso" (mirada en zona dedicada o EMG largo) para que Marta no active cosas cuando mira a la familia.

---

## 7. Feedback durante el dwell

Majaranta, MacKenzie, Aula y Räihä, Univ Access Inf Soc 2006 [V], tres experimentos con voluntarios sin discapacidad, teclado QWERTY sin predicción: https://www.yorku.ca/mack/UAIS2006.pdf
- Exp. 1 (13 participantes, dwell 900 ms, 400 ms de foco + 500 ms animación): el mejor fue **visual + clic sonoro corto**: 7,55 wpm en el 4.º bloque contra 7,14 (voz + visual), 7,12 (solo visual), 7,00 (solo voz). Preferido por el 62%. Error: solo voz el más preciso (<0,8%); solo visual el peor (0,95%). Con solo visual, los participantes revisaban el texto escrito cada ~10 caracteres (RTE 0,110) contra ~0,05 con sonido: el sonido da sensación de "cierre".
- Exp. 2 (20 participantes, dwell largo): letra que se **encoge** durante el dwell 7,02 wpm vs sin encoger 6,65 wpm; los "re-enfoques" (mirar fuera antes de tiempo) 0,187 vs 0,297 por tecla (59% más sin animación). 50% prefirió encoger; 65% dijo que ayudaba a concentrarse; dos lo encontraron molesto. Mayoría: puede cansar a la larga.
- Exp. 3 (15 participantes experimentados, dwell 450 ms): solo voz fue **más lento y con más correcciones** (9,22 wpm; KSPC 1,28) que feedback visual de un nivel (10,17 wpm; KSPC 1,17) o de dos niveles (10,27). Los participantes se detenían a escuchar la voz y generaban doble entrada. 80% encontró 450 ms "justo". Error general 1,20%.
- Guías del paper: clic corto no vocal para confirmar; combinar voz con visual, no voz sola; con dwell corto usar feedback simple de un nivel; que foco y selección sean distinguibles; animación para dwell largo; parámetros ajustables.
- Majaranta 2009: 6 de 9 participantes consideraron el sonido más importante que lo visual y 3 igual; querían mantener el círculo que se cierra incluso con dwell muy corto (solo 2 de 5 que probaron sin él lo dejaron apagado al final). [V]

**Para WOKI [I]:** círculo que se cierra sobre la zona, clic corto al confirmar y **nada de voz sintética para cada selección** (la voz clonada de Marta solo para el mensaje final). Como la confirmación es por EMG, el círculo no es de dwell sino de "estoy sobre esta zona".

---

## 8. Cursores que predicen o asisten

- MAGIC pointing (Zhai et al.), mirada lleva el cursor a la zona y la mano afina: menos esfuerzo físico, más natural que mirada pura. Solo vi el resumen de IBM. [NV] https://researcher.ibm.com/publications/manual-and-gaze-input-cascaded-magic-pointing
- Mouse táctil que pone el puntero en la mirada (Drewes y Schmidt, INTERACT 2009): más rápido en fondos complejos, igual en fondos simples; en ~20% de las grabaciones la mirada no llegó cerca del objetivo antes del toque por errores de calibración, y en 6,7% de los clics clásicos la mirada se movió menos del 90% de la distancia. [V] https://www.medien.ifi.lmu.de/pubdb/publications/pub/drewes2009interact/drewes2009interact.pdf (la cifra "~20%" viene de mi grep; ver el contexto antes de citarla).
- Sticky / Magnetic (Collins et al. 2026, VR, N=9): la ayuda **magnética** (campo espacial alrededor del objetivo, el retículo salta al centro al tocarlo) y la **pegajosa** (buffer temporal) redujeron errores sin cambiar throughput ni tiempo; la magnética hizo que los usuarios "delegaran" precisión a la ayuda. [V, preprint] https://arxiv.org/pdf/2603.26608
- Dwell en cascada de Mott 2017 es una forma de "predicción de intención" aplicada al **tiempo** en vez de al espacio: 12,39 vs 10,62 wpm. [V]
- Bubble cursor aplicado a mirada: solo encontré un trabajo en VR (Cone&Bubble) con resumen, que dice que la técnica pierde efectividad cuando los objetivos están muy juntos. [NV] https://eprints.lancs.ac.uk/id/eprint/222892/1/Multimodal_Bubble_Selection_in_VR_1_.pdf
- Ninja cursors desambiguados con mirada: pocos cursores muy separados evitan el problema de precisión; los participantes sintieron más rápido 4 cursores por monitor pero prefirieron 1 para uso propio. [V] Räihä y Špakov 2009.

**Lectura para WOKI [I]:** el "cursor que predice" tiene respaldo indirecto (cascada, magnetismo, campos de captura) pero **ningún paper que encontré lo prueba con webcam de 1,5 a 3,7 grados ni con ELA**. Es un punto de diferenciación defendible, pero la demo debería medir sus propios números (aciertos con y sin imán).

---

## Números de diseño

| Parámetro | Valor recomendado | Tipo | Fuente |
|---|---|---|---|
| Dwell inicial / por defecto | 700 ms (rango de ajuste 400 a 1000 ms) | I, a partir de rangos [V] | Špakov y Miniotas 2004 (mantener 400-700); Majaranta 2009 (inicio 1000 ms, 600 ms medio) |
| Dwell mínimo | No bajar de 400 ms con webcam | I | Špakov 2004: 300 ms dio muchos errores |
| Dwell de experta tras práctica (referencia con IR) | 280 a 380 ms | V (condiciones ideales) | Majaranta 2009 |
| Quién ajusta el dwell | La usuaria, con botones más rápido / más lento | V | Majaranta 2009, Špakov 2004 |
| Re-selección de la misma zona | +120 ms sobre el dwell base o bloqueo breve | V | Majaranta 2006 |
| Objetivo mínimo (ancho) | 8 a 10 grados | I | Regla 2 x error (3,7 grados); Feit 2017 fórmula S = 2(O+2σ) |
| Objetivo mínimo con mejor caso | 3 grados | I | 2 x 1,5 grados |
| Equivalente a 2 m | 10,5 cm (3 grados) a 35 cm (10 grados) | I | Cálculo trigonométrico |
| Equivalente a 3 m | 15,7 cm (3 grados) a 52,5 cm (10 grados) | I | Cálculo trigonométrico |
| Número de zonas en TV 55 pulgadas a 2 m | 6 a 8 (4 x 2) | I | Cálculo con 33,9 x 19,4 grados |
| Número de zonas en TV 55 pulgadas a 3 m | 2 a 3 (una fila) | I | Cálculo con 22,9 x 13,0 grados |
| Área activa respecto del dibujo | Mayor que el botón visible (por ejemplo +25% por lado) | V la idea; el porcentaje es I | Majaranta 2009; Kristensson y Vertanen (1,5 radios de tecla) |
| Zonas en los bordes derecho e inferior | Evitar para selección | V | Feit 2017 (diapositivas) |
| Filtro de la mirada | Promedio ponderado con detección de sacadas; retraso ~32 ms | V | Feit 2017 (diapositivas) |
| Selección | Mirada elige zona, EMG confirma | V la idea | Mateo 2008 [resumen], Kumar 2020 |
| Feedback de dwell | Círculo que se cierra + clic corto al confirmar | V | Majaranta 2006 |
| Feedback de voz por selección | No usar | V | Majaranta 2006 exp. 3 |
| Largo de la sesión de uso continuo | Pausas sugeridas cada 10 a 15 minutos | I (los estudios usaron 10-15 min de sesión y 10 min de descanso) | Kristensson y Vertanen 2012; Majaranta 2009 |
| Gesto de mirada para comando especial | Patrón grande hacia esquinas, ~2 s; evitar izquierda-derecha repetido | V | Drewes y Schmidt 2007 |
| Velocidad esperable de Marta escribiendo letra a letra | 3 a 10 wpm | V el rango observado, I la aplicación | Pannasch 2008; Mott 2017 |
| Precisión necesaria si hay pocas zonas muy separadas | menos de 5 grados | V | Räihä y Špakov 2009 |

---

## Insights accionables para WOKI

1. **Diseñar para un error de 4 grados, no de 1,5.** Todos los números de la literatura son con rastreadores de 0,5 grados. Con webcam, una zona de selección de menos de 8 grados fallará.
2. **A 3 m una TV de 55 pulgadas no da para más de 2 o 3 zonas.** Hay que acercar la TV (2 m), subir a 65 pulgadas o más, o usar el movimiento de cabeza para elegir entre zonas. Decidir esto antes del domingo.
3. **Mirada para zona, EMG para confirmar.** Es la solución más documentada al toque de Midas y evita el dwell largo, que cansa. Aun así el clic de mandíbula o ceja no tiene estudio directo; lo presentamos como diseño propio, no como evidencia.
4. **No se debe prometer 46 wpm.** Ese número es una simulación. Con ELA se observaron 3 a 10 wpm con dwell. La ventaja de WOKI es que **no escribe letra a letra**: frases completas propuestas por Claude.
5. **Feedback: círculo que se cierra y clic corto.** Es lo que mejor funcionó y lo preferido por la mayoría. Sin voz sintética por selección.
6. **Dwell ajustable por Marta**, con un control visible; el dwell adaptativo automático tiene retardos y confunde.
7. **Pausas y modo descanso.** La fatiga ocular está documentada y los descansos largos recuperan el rendimiento. Un gesto o zona de "descanso" evita selecciones involuntarias cuando mira a la familia.
8. **El imán hacia el objetivo probable se defiende por analogía**, no por evidencia directa con webcam. Para la demo, mostrar una métrica propia: aciertos con y sin imán sobre el mismo recorrido.
9. **Gestos grandes para emergencia** son viables sin precisión (esquinas, ~2 s) pero no deben ser izquierda-derecha repetido. ceja-ceja-mandíbula como combo es más seguro porque no depende de la mirada.
10. **Zonas fuera de los bordes derecho e inferior**, porque la precisión de rastreo empeora ahí. Poner las zonas críticas (emergencia, descanso) en el centro y arriba, o en las esquinas superiores con gesto.

## Recomendaciones de diseño con números

- Zona de selección: 8 a 10 grados de ancho (26 a 35 cm a 2 m; 39 a 52 cm a 3 m), alto algo mayor que el ancho.
- Con TV 55 pulgadas a 2 m: grilla de 4 x 2 como máximo; a 3 m: 3 x 1. Con 65 pulgadas a 2 m: 4 x 2 con holgura.
- Dwell/permanencia de resaltado antes de habilitar el clic EMG: 300 a 500 ms (para que el cursor "asiente" en la zona); si se usa dwell puro, 700 ms con rango 400 a 1000 ms.
- Bloqueo de re-selección de la misma zona: 120 ms adicionales.
- Filtro suavizador de mirada (promedio ponderado con detección de sacadas): ~2 cuadros de retraso; recalibrar cuando la usuaria lo pida o tras cada cambio de postura (Feit: 3 a 10 recalibraciones al día en expertos).
- Pausa sugerida: aviso de descanso cada 10 a 15 minutos de uso continuo.
- Gesto de mirada de comando: trayectoria grande entre esquinas, duración ~2 s, nunca un barrido horizontal repetido.
- Predicción: 4 frases propuestas en 4 zonas grandes; es una decisión de 1 de 4 con el mismo número de zonas que cabe en la TV.

## Pendiente de verificar (no cumplido)

- Números en grados del paper de Feit (el PDF no se pudo descargar).
- Estudio de mirada + EMG de mandíbula: no encontrado.
- Cifras de Mateo CHI 2008 (throughput, errores).
- Parpadeo como entrada o como fuente de error: sin estudio.
- Usuarios con ELA y fatiga como causa de abandono: solo menciones de segunda mano.
- Räihä y Ovaska CHI 2012 (dwell y carga de trabajo), Hansen GazeTalk original, Look to Speak (detalles de diseño), EyePoint, bubble cursor con mirada en escritorio.
- Tuisku "mirar y sonreír": solo resumen de búsqueda.
