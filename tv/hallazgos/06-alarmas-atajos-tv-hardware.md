# 06. Alarmas, atajos, diseño para TV e integración del hardware

Tema: alarmas y llamada de atención, atajos y combos de gestos, diseño a distancia (TV), feedback y estados, y uso del hardware de la mesa (Arduino, LCD, LEDs, relé, servo, RFID, sonido).

## Cómo leer los niveles de confianza

- **[Leído]**: abrí la página y leí el contenido.
- **[Buscador]**: dato que salió en el resumen de una búsqueda; no leí el documento completo. Verificar antes de citar en público.
- **[Memoria]**: lo sé de antes, no lo verifiqué en esta sesión.
- **[Inferido]**: cálculo o propuesta mía. No es un hallazgo de la literatura.

Fuentes que no se pudieron leer: el HIG de Apple solo entregó la introducción de tvOS (sin cifras), y el preprint de HALO devolvió 403. Los números de tvOS vienen de fuentes secundarias.

---

## 1. Alarmas y llamada de atención

### Lo que hay en CAA (huecos incluidos)

- Busqué botón de emergencia, llamada a cuidador e integración con llamado de enfermería en Tobii Dynavox y otros CAA. **No encontré documentación pública** de una función de alarma nativa ni de integración con nurse call. Lo único de Tobii sobre emergencias son recursos imprimibles bilingües para expresar necesidades en una urgencia. [Buscador] https://www.tobiidynavox.com/pages/access-methods-for-aac
- Tampoco encontré estudios de cuidadores de ELA centrados en alarmas nocturnas. Lo más cercano:
  - Una tabla de necesidades de usuarios reporta interés en "un sistema de llamado tipo Life Alert" para que las personas con ELA se muevan con seguridad, y en conectar el iPad con eye trackers Tobii. [Buscador] https://pmc.ncbi.nlm.nih.gov/articles/PMC3589077 (identificado por el buscador como la tabla de necesidades; confirmar).
  - Un relato en primera persona describe el problema nocturno: los cuidadores necesitan dormir y es difícil tener ojos puestos 24 horas. El autor improvisó una alarma con discos piezo en la frente. Es anecdótico. [Buscador] https://journals.ku.edu/rrnmf/article/download/17030/16198
- **Conclusión [Inferido]:** la alarma integrada a un comunicador es un hueco real del mercado y un argumento de diferenciación frente a Apple Eye Tracking, Switch Control y Look to Speak.

### Fatiga de alarmas (salud)

- Alerta Centinela n.º 50 de la Joint Commission (abril 2013): 98 eventos relacionados con alarmas entre enero 2009 y junio 2012 (80 muertes, 13 pérdidas permanentes de función, 5 con atención adicional). La fatiga de alarmas aparece como el factor contribuyente más común. Estima que entre 85 % y 99 % de las alarmas no requieren intervención clínica. Causas típicas: configuraciones por defecto sin ajustar y electrodos secos o mal puestos. [Buscador] https://digitalassets.jointcommission.org/api/public/content/f65e5c9df2b94000a99445e0a7877007 y https://www.beckershospitalreview.com/quality/joint-commission-alert-medical-device-alarm-safety/
- Lo que importa para WOKI: **los electrodos EMG que se secan o se despegan son la fuente de falsas alarmas más probable**, igual que en hospital.
- ECRI señala que no hay consenso amplio de mejores prácticas de gestión de alarmas. [Buscador] https://www.ecri.org/search-results/member-preview/hdjournal/pages/alarm-management-resource-list/
- Marco de 2025 para reducir alertas a enfermería: define alarmas "inalcanzables" (no llegan a tiempo al cuidador correcto) e "inalcanzables por ocupación" (llegan a alguien que no puede actuar). También propone enrutar por proximidad en vez de avisar a todos. [Buscador] https://pmc.ncbi.nlm.nih.gov/articles/PMC12608296
- Interrupciones fragmentan el trabajo del cuidador, suben el estrés y la carga cognitiva. [Buscador] mismo PMC12608296.
- Un patente de cama/silla observa que los mayores se levantan varias veces por la noche, lo que le quita descanso al cuidador. [Buscador] https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5963137

### Escalamiento sin respuesta (precedente de "pager")

- PagerDuty (sistema de guardias de TI): timeout de escalamiento por defecto de 30 minutos, mínimo 3 minutos si el nivel tiene varios destinatarios; si nadie actúa pasa al siguiente nivel; al acusar recibo se detiene el escalamiento; la política se puede repetir hasta 9 veces. [Buscador, es doc oficial] https://support.pagerduty.com/docs/escalation-policies
- **Esos tiempos son para incidentes de software.** Para una persona que no puede llamar sola hay que acortarlos mucho. [Inferido]
- Patente de alarma de caída: la alarma se limpia en el dispositivo solo cuando se despacha a un cuidador. Es el patrón "no se apaga hasta que alguien confirma". [Buscador] https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10667725
- Sobre confirmación (ack) por RFID/NFC: **no encontré** una fuente que describa confirmar una alerta con NFC. Lo que sí existe es NFC/RFID como prueba de presencia del cuidador en visitas de cuidado domiciliario (EVV) y patentes de residencias con RFID en personal y residentes. [Buscador] https://www3.hidglobal.com/solutions/electronic-visit-verification y https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12614439
- **Conclusión [Inferido]:** usar el llavero RFID como "estoy aquí, lo vi" es una extensión natural del patrón de prueba de presencia. No hay precedente directo documentado.

### Propuesta de alarma para WOKI (todo [Inferido], valores a calibrar el sábado)

Dos prioridades y no más (para no fabricar fatiga):

| Nivel | Cuándo | Qué pasa |
|---|---|---|
| Atención | "Necesito algo": un gesto simple o la tarjeta "Llamar a ..." | Campanita suave en el dispositivo de la mesa, LED ámbar, LCD "ATENCION". Repite cada 20 s hasta confirmación. |
| Emergencia | Combo (ver sección 2) o tarjeta roja con confirmación | Sonido fuerte, LED rojo, relé, mensaje al teléfono, escalamiento. |

Escalamiento de emergencia (el reloj parte en cuanto se confirma el gesto):

| Tiempo | Acción |
|---|---|
| 0 s | Alarma local (buzzer, LED rojo, LCD, TV) y push a cuidadora 1. |
| 30 s sin confirmar | Sube el volumen, enciende el relé (lámpara o timbre), push a cuidadora 1 y a familia. |
| 90 s sin confirmar | Llamada o WhatsApp al contacto 2. Repite cada 60 s hasta confirmar. |

Reglas de diseño:

1. **Nunca se apaga sola.** Solo se apaga con confirmación humana (RFID o botón en el teléfono). Es el patrón de la patente de caídas.
2. **Cerrar el lazo hacia Marta:** al confirmar, la TV muestra en letra grande "Camila viene". Marta tiene que saber que alguien recibió el aviso.
3. **Cancelación barata:** ventana de 3 s para cancelar el escalamiento remoto con un solo gesto fácil (mandíbula). La alarma local suena igual desde el segundo 0.
4. **Pérdida de sensor no es emergencia.** Es un aviso técnico en TV y LCD. Solo se avisa a la cuidadora si dura más de 60 s en modo vigilia (así no se repite el problema de electrodos secos de la Joint Commission).
5. **De noche:** pantalla en brillo mínimo, sin parpadeo, LED rojo fijo. La emergencia siempre al volumen máximo; la atención con volumen bajo configurable. Un solo tono por nivel, distintos entre sí.
6. **Destellos:** que ningún LED ni elemento de la TV parpadee a más de 3 veces por segundo (criterio WCAG 2.3.1, de memoria [Memoria]).

---

## 2. Atajos, combos y escaneo

### Escaneo en CAA (verificado vía buscador)

- Escaneo fila-columna: un cursor resalta filas, el usuario activa el interruptor, luego resalta columnas. Los ítems arriba a la izquierda tardan menos. [Buscador] https://pmc.ncbi.nlm.nih.gov/articles/PMC5967995
- Tiempo de escaneo usado en un estudio: de 0,48 a 2,00 s por ítem; los usuarios podían agregar un retraso extra para la primera fila y columna. [Buscador] https://arxiv.org/pdf/2204.01619
- Subir el retraso reduce la sensibilidad al ruido en el momento del clic, a costa de velocidad. [Buscador] https://ar5iv.arxiv.org/html/1712.10073
- Valor por defecto de PRC-Saltillo: 1 s. Tienen "tiempo de aceptación" (cuánto hay que sostener el interruptor) y "tiempo de liberación" (bloquea un doble clic accidental). [Buscador] https://saltillo.com/support/article/Scan-Timing (la página dio error de certificado al abrirla; es dato del buscador).
- Apple Switch Control trae: "hold before perform" (segundos de sostén para registrar), "ignore switch repeats" (descarta pulsaciones repetidas en una ventana), "auto scanning time" y "move repeat". Es lo que WOKI tiene que superar o igualar. [Buscador] https://support.apple.com/guide/mac-help/mh43181/mac
- Muchas interfaces vuelven a filas tras N ciclos de columnas sin entrada; un estudio usó dos ciclos completos. Algunas dan una ventana de "deshacer" durante el escaneo. [Buscador] https://arxiv.org/pdf/2204.01619 y https://ar5iv.arxiv.org/html/1712.10073
- Un usuario de ELA en un foro dice que con NeuroNode hay que escanear opciones y que la mirada, si funciona, es mucho más rápida. [Buscador] https://www.alsforums.com/community/threads/emg-switch-by-control-bionics-is-tinkertron.39924/post-424163 (anecdótico). Esto respalda el modelo de WOKI: la mirada elige, el EMG confirma, sin escanear.

### Mirada y activación accidental (Midas touch)

- El problema: con dwell basta mirar para activar. Los diseños híbridos agregan un segundo canal para confirmar, lo que es la arquitectura de WOKI. [Buscador] https://faculty.washington.edu/wobbrock/pubs/chi-17.02.pdf y https://pmc.ncbi.nlm.nih.gov/articles/PMC7715037
- Dwell más corto da más velocidad y más activaciones falsas; el artículo CHI 2017 propone subir el dwell de teclas improbables y bajarlo en las probables. Esto es la lógica del "cursor que predice". [Buscador] https://faculty.washington.edu/wobbrock/pubs/chi-17.02.pdf
- Estudio de 2008 con pacientes de ELA fijó el dwell en 800 ms. Es el único valor concreto que encontré; no hay estudio que recomiende un dwell óptimo para ELA. [Buscador] https://www.researchgate.net/profile/Kristian-Torning/publication/220810980_Gaze_typing_compared_with_input_by_head_and_hand/links/0912f513092d1a2e8a000000/Gaze-typing-compared-with-input-by-head-and-hand.pdf
- Look to Speak (Google) usa gestos de mirada fuera de pantalla (izquierda, derecha, arriba), con distancia (cerca, media, lejos) y duración (rápida, media, larga) configurables por dirección. Advierte que menos distancia y menos duración suben las activaciones accidentales. [Buscador] https://g.co/looktospeak y https://storage.googleapis.com/experiments-uploads/LTS_GUIDE.pdf

### Clic de ceja y mandíbula

- **HALO (preprint medRxiv 2025):** un LLM propone respuestas completas y la persona elige con una sola contracción de ceja. Electrodos textiles en una diadema, red neuronal recurrente, 96 % de exactitud y F1 de 85 %. No pude leer el texto completo (403), así que no sé latencia ni cómo manejan falsos positivos. [Buscador] https://www.medrxiv.org/content/10.1101/2025.09.24.25336481.full.pdf
- **NeuroNode (Control Bionics):** interruptor EMG inalámbrico que se pega sobre un músculo; con la activación o una activación mínima genera el clic. La página no habla de ceja ni de HALO; no están relacionados según lo que vi. [Buscador] https://AskJAN.org/products/NeuroNode-System.cfm
- **Mandíbula (masetero):** proyecto de BU con interruptor sEMG de umbral por paciente, partes comerciales, software abierto, CAD de la carcasa. Es el punto de partida abierto más cercano. [Buscador] https://sites.bu.edu/stepplab/research/semg-based-switch-design
- Silla de ruedas por apretar mandíbula en ELA: apretón corto y largo, izquierda y derecha. El artículo avisa que la progresión de la ELA puede borrar la diferencia entre reposo y contracción. [Buscador] https://pmc.ncbi.nlm.nih.gov/articles/PMC9375912 (probable; confirmar)
- Instructables con MyoWare y BITalino que manda teclas a The Grid 3, con potenciómetro de sensibilidad. [Buscador] https://www.instructables.com/Muscle-EMG-Activated-Switch
- No encontré ningún proyecto que combine varios clics en secuencia como lenguaje de comandos. **El combo de gestos de WOKI no tiene precedente directo.** [Inferido]

### Diseño de combos (todo [Inferido], valores iniciales a calibrar con los sensores reales)

Principio: lo común y barato va en un gesto; lo raro y peligroso va en secuencia; **la emergencia es la excepción: debe ser fácil de hacer y fácil de cancelar**, porque un falso positivo cuesta un aviso a la cuidadora y un falso negativo puede costar mucho más.

| Parámetro | Valor inicial | Razón |
|---|---|---|
| Período refractario tras un clic | 250 ms | Descartar rebotes, equivale a "ignore repeats" de Apple. |
| Ventana entre gestos de un combo | máx. 1,2 s entre un clic y el siguiente | La fatiga hace los gestos más lentos con el día. |
| Duración total del combo de emergencia | máx. 3 s | Evita que dos clics sueltos formen un combo por casualidad. |
| Clic sostenido (mandíbula) | 400 ms para contar como "largo" | Distinguir corto/largo, ya que la ELA puede borrar el contraste reposo/contracción. |
| Combo de emergencia propuesto | ceja, ceja, mandíbula | Dos canales distintos reducen la coincidencia accidental. |
| Cancelar | mandíbula sostenida o cualquier clic durante los 3 s de aviso | Un solo gesto, sin menús. |
| Máximo de combos activos | 3 | Marta tiene que recordarlos y la fatiga cognitiva pesa. |
| Retroalimentación por gesto | marca en pantalla a los 100 ms | Que vea que el gesto fue leído. |

Diseño de confirmación durante el combo: mostrar tres puntos en la esquina inferior que se llenan a medida que se completan los gestos, con el color del canal de cada uno. Si pasa la ventana, los puntos se vacían suavemente (sin sonido de error).

Calibración: umbral por persona y por sesión (el proyecto de BU y Look to Speak lo hacen por paciente). Previsión de deriva: reajustar a mitad de día.

---

## 3. Diseño para TV a distancia ("10-foot UI")

### Guías de plataforma

| Dato | Valor | Fuente y nivel |
|---|---|---|
| Android TV: tamaño de diseño | 960 x 540 px (MDPI), activos para 1080p | https://developer.android.com/design/ui/tv/guides/styles/layouts [Leído] |
| Android TV: margen de overscan | 5 %: 48 dp a los lados y 27 dp arriba/abajo (la página también dice "58 dp y 28 dp" y que la mayoría de las TV modernas ya no tienen overscan; es internamente inconsistente) | mismo URL [Leído] |
| Android TV: grilla | 12 columnas de 52 dp con 20 dp de separación | mismo URL [Leído] |
| Android TV: tamaño de tarjeta 2 por fila | 412 dp (de 960) | mismo URL [Leído] |
| Android TV: plantilla de alerta | pantalla completa, exige acción para salir | mismo URL [Leído] |
| Android TV: escala de foco | 1,025, 1,05 y 1,1x | https://developer.android.com/design/ui/tv/guides/styles/focus-system [Leído] |
| Android TV: indicadores de foco | escala, borde/contorno, brillo, color; un solo elemento enfocable a la vez | mismo URL [Leído] |
| Android TV: tipografía | Roboto; escala de 15 estilos; evitar decorativas; "más personables solo a tamaños grandes" | https://developer.android.com/design/ui/tv/guides/styles/typography [Leído] (no da tamaños en sp en el texto que pude leer) |
| Fire TV: margen seguro | no poner UI en el 5 % exterior de cada borde; contenido dentro del 90 % central | https://developer.amazon.com/docs/fire-tv/design-and-user-experience-guidelines.html [Leído] |
| Fire TV: texto mínimo | cuerpo de al menos 14 sp, unos 28 px en 1080p | mismo URL [Leído] |
| Fire TV: color | colores menos saturados en TV; fríos (azul, gris) mejor que cálidos (rojo, naranja) | mismo URL [Leído] |
| tvOS: distancia | "a menudo 8 pies o más" (unos 2,4 m) | https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos [Leído] |
| tvOS: canvas 1920 x 1080 pt, margen 60 pt arriba/abajo y 80 pt a los lados | Smashing Magazine dice 80 pt; otras fuentes dicen 90 pt | https://smashingmagazine.com/2025/09/designing-tv-principles-patterns-practical-guidance/ [Leído, secundaria]; Apple no dio la cifra en lo que leí |
| tvOS: texto mínimo de cuerpo 29 pt | una guía secundaria; otras dan 24 pt | [Buscador] https://raw.githubusercontent.com/ehmo/platform-design-skills/HEAD/skills/tvos/SKILL.md; sin confirmar con Apple |
| TV genérica: cuerpo desde 24 px (web 16 a 18 px), 5 a 6 tamaños | Smashing | [Leído, secundaria] |
| Evitar blanco puro (#FFFFFF) en cuarto oscuro | Smashing | [Leído, secundaria] |
| Escribir "hey there" son unas 9 pulsaciones en móvil y 38 con control remoto | Smashing | [Leído, secundaria]; ilustra por qué el teclado en TV es el peor caso |
| Contraste de texto normal 4,5:1 y grande 3:1; grande = 18 pt (24 px) o 14 pt negrita | WCAG 1.4.3 | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html [Leído] |
| Contraste de elementos no textuales 3:1 | WCAG 1.4.11 | https://w3.org/WAI/WCAG22/Understanding/non-text-contrast [Buscador] |
| Tamaño mínimo de objetivo 24 x 24 px CSS | WCAG 2.5.8 (para puntero; no aplica a mirada) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html [Leído] |

Lectura de las guías: **ninguna está pensada para mirada.** Todas asumen control remoto con foco discreto. El foco único y la escala de 1,1x se pueden copiar; los tamaños de objetivo no.

### Mirada a distancia: el cálculo que manda sobre todo lo demás

Datos de error de webcam:
- WebGazer promedió cerca de 4,17° en una comparación con un tracker comercial. [Buscador] https://par.nsf.gov/servlets/purl/10024076
- Un sistema de aprendizaje profundo logró 2,4° como mejor caso. [Buscador] https://link.springer.com/10.3758/s13428-023-02190-6
- En una validación de iMotions, más de la mitad de los participantes llegó a 2° o menos, más del 70 % a 3° o menos, y más del 90 % a 5° o menos. [Buscador] https://imotions.com/wp-content/uploads/2025/03/iMotions-WebET-3.0-Validation-Study-june-2023.pdf
- La precisión empeora con el movimiento de cabeza, y la webcam no mide la distancia, así que las conversiones son aproximadas. [Buscador] mismos estudios.
- No encontré una guía publicada de tamaño de objetivo para interfaces de mirada con webcam.

**Cálculo propio [Inferido]:** el objetivo debe medir al menos 2 veces el error (el punto estimado cae dentro aunque se desvíe en cualquier dirección). Con la TV de 55 pulgadas (121,7 x 68,5 cm):

| Error de mirada | Objetivo mínimo (2 x error) | Tamaño a 2 m | Tamaño a 3 m | Columnas que caben (2 m / 3 m) | Filas que caben (2 m / 3 m) |
|---|---|---|---|---|---|
| 1,5° | 3° | 10,5 cm | 15,7 cm | 11 / 7 | 6 / 4 |
| 2,5° | 5° | 17,5 cm | 26,2 cm | 6 / 4 | 3 / 2 |
| 3,7° | 7,4° | 25,9 cm | 38,8 cm | 4 / 3 | 2 / 1 |

Campo visual de la TV de 55": 33,8° x 19,4° a 2 m; 22,9° x 13,0° a 3 m.

Consecuencias:
1. **A 3 m y error de 3,7° cabe una sola fila de objetivos.** La pantalla tiene que ir más cerca (2 a 2,5 m) o ser mayor (65 pulgadas o más), o el diseño tiene que depender de que el cursor predictivo y el EMG hagan el trabajo fino.
2. **Cuatro frases en una fila o en una grilla 2 x 2 es el máximo defendible** con error de 2,5°. Esto coincide con las 4 frases propuestas por Claude.
3. El diseño debe ser horizontal (más columnas que filas): la TV es más ancha que alta, por eso la lista de 4 frases va mejor en columnas o en una cuadrícula 2 x 2 de tarjetas grandes.
4. Con 3,7° de error, la selección real tiene que apoyarse en el imantado (cursor que predice) y en el clic EMG como confirmación. La mirada solo elige la zona.

### Tabla de números de diseño para TV (resumen)

Todos son valores iniciales. Los marcados "Fuente" salen de una guía; los demás son propuestas mías.

| Elemento | Valor | Origen |
|---|---|---|
| Canvas de diseño | 1920 x 1080 px | Apple, Android TV (escalable) |
| Margen seguro | 5 % por lado (96 px a los lados, 54 px arriba/abajo en 1080p) | Fire TV y Android TV |
| Margen para elementos críticos (emergencia, estado) | 5 % de margen más 24 px extra para esquina | Inferido |
| Texto mínimo absoluto (estado, etiquetas) | 32 px | Supera el 28 px de Fire TV, el 29 pt de la guía tvOS secundaria y el 24 px general |
| Texto de frase propuesta (tarjeta) | 56 a 64 px, 2 líneas máximo | Inferido; 48 px en 1080p de 55" a 3 m mide unos 3 cm de caja |
| Texto de la frase que se va armando (línea de mensaje) | 72 a 96 px | Inferido; es lo que la familia ve a lo lejos |
| Texto de alerta a pantalla completa | 120 px o más, 4 palabras máximo | Inferido; plantilla de alerta de Android TV |
| Objetivo de mirada, error 2,5° | 5° = 26 cm a 3 m = unos 410 px en 1080p de 55" | Inferido (ver cálculo) |
| Objetivo de mirada, error 3,7° | 7,4° = 39 cm a 3 m = unos 610 px | Inferido |
| Separación entre objetivos | 1° (5 cm a 3 m) mínimo | Inferido; evita que la zona de un objetivo se solape con la del vecino |
| Cantidad de objetivos por pantalla | 4 frases + 3 a 4 controles fijos (voz, emoción, borrar, descanso) | Inferido |
| Contraste de texto | 7:1 o más sobre el fondo (alrededor de 15:1 con #E6E6E6 sobre #101010, calculado) | WCAG AA pide 4,5:1; yo subo a 7:1 por distancia y baja visión (AAA es 7:1, [Memoria]) |
| Contraste de contorno de foco | 3:1 mínimo contra el fondo y contra la tarjeta (WCAG 1.4.11) y que se distinga por forma, no solo por color | WCAG |
| Blanco | evitar #FFFFFF; usar blanco apagado (por ejemplo #E6E6E6) | Smashing |
| Tope de contraste | no usar el máximo posible: WCAG fija mínimos, no máximos; un tema oscuro con contraste extremo puede cansar | https://buttondown.com/access-ability/archive/accessible-color-choices-are-about-so-much-more/ [Buscador] |
| Foco de mirada | escala 1,1x, borde de 6 px, anillo de progreso (dwell/imantado) | Escala de Android TV; el borde y el anillo son inferidos |
| Dwell (si se usa sin EMG) | 800 ms de referencia | Estudio 2008 con ELA [Buscador]; con clic EMG no hace falta |
| Retroalimentación al clic EMG | menos de 100 ms | Inferido |
| Pantalla de alerta | color de alto contraste, sin parpadeo mayor a 3 Hz | WCAG 2.3.1 [Memoria] |
| Colores | evitar rojo o naranja saturados para texto grande; que el estado no dependa solo del color (forma, ícono, texto) | Fire TV [Leído], WCAG 1.4.1 [Memoria] |

Modo oscuro: es lo adecuado para cuarto con poca luz y fotofobia. Personas con fotofobia por migraña, traumatismo, ojo seco o albinismo suelen preferirlo. [Buscador] https://buttondown.com/access-ability/archive/accessible-color-choices-are-about-so-much-more/ . Pero la fórmula de contraste de WCAG 2 no mide bien texto claro sobre oscuro (APCA lo critica). [Buscador] https://www.github.com/Myndex/SAPC-APCA/discussions/103 . Por eso: probar en la TV real, de noche, con la persona o con alguien de baja visión, antes de dar por buena la combinación. No encontré fuentes sobre halación o astigmatismo. Ofrecer además un modo claro por si Marta prefiere el día.

---

## 4. Feedback y estados

No encontré guías específicas para mostrar el canal activo o la pérdida de señal en CAA. Todo lo siguiente es propuesta [Inferido], salvo lo que cito.

Lo que sí hay como precedente: Switch Control de Apple oculta su panel tras un tiempo de inactividad ("fade panel"). [Buscador] https://support.apple.com/guide/mac-help/mh43181/mac . Look to Speak exige que el gesto de mirada se sostenga y se salga de pantalla, y avisa de falsos positivos. [Buscador] https://g.co/looktospeak

### Franja de estado permanente

Una franja de 64 a 80 px de alto en el borde superior, siempre visible, con tres indicadores. Cada uno con ícono + texto + color (no solo color):

| Indicador | Estados | Cómo se ve |
|---|---|---|
| Mirada (cámara) | Activo / buscando / perdida (más de 1,5 s sin cara) | Ojo lleno / ojo con pulso / ojo tachado en ámbar |
| EMG (ceja, mandíbula) | Listo / señal débil / desconectado | Un ícono por sensor; el que dispara se ilumina 150 ms |
| Alarma | Armada / en curso / confirmada | Campana; en curso en rojo con texto "AVISANDO" |

### Estados de modo

| Modo | Qué pasa |
|---|---|
| Activo | Todo normal. |
| Descanso (pausa) | La mirada no activa nada; solo un gesto largo despierta. Pantalla en brillo mínimo con reloj discreto. Emergencia siempre armada. |
| Vigilia nocturna | Pantalla casi apagada, LEDs en brillo bajo, solo el combo de emergencia y el de "llamar" responden. |
| Señal perdida | Mensaje a pantalla completa y calmo: "No te veo. Mírame a la cámara o usa [gesto]". Si persiste más de 60 s en vigilia, aviso a la cuidadora. |

Reglas:
1. El descanso no se activa solo por la mirada perdida; lo decide Marta (gesto largo) o un temporizador que se confirma. Así una mala pasada de la cámara no la deja "dormida" sin que lo sepa.
2. Al volver de una pérdida de señal, mostrar 1,5 s de "listo" antes de aceptar clics (evita activaciones al recalibrar).
3. El canal que acaba de disparar un clic se marca en pantalla: así Marta y la familia entienden qué leyó el sistema.
4. Un deshacer visible y permanente: "borrar la última palabra/frase" con un gesto fijo, siempre en el mismo lugar.

---

## 5. Hardware: cómo usar la mesa de trabajo

Supuesto [Inferido]: el Arduino Uno va conectado por USB al Mac y se comunica por serial. Un "heartbeat" cada 2 s desde el Mac: si el Arduino deja de recibirlo, pasa solo a "SIN CONEXION" en LCD y LED (así la pérdida de la app también se nota físicamente).

| Pieza | Uso propuesto | Detalle |
|---|---|---|
| LCD 16x2 I2C | Pantalla de bedside para la cuidadora, independiente de la TV | Línea 1: estado ("OK", "ATENCION", "EMERGENCIA"). Línea 2: tiempo desde el aviso y "Falta confirmar" o "Camila viene". En descanso muestra la hora y el estado de los sensores. |
| LEDs (verde, ámbar, rojo) | Semáforo visible desde el pasillo | Verde fijo = todo bien; ámbar = atención o señal débil; rojo fijo en emergencia (en vez de parpadeo rápido; si parpadea, 2 Hz máximo). Brillo bajo de noche. |
| Relé | Llevar la alarma al mundo físico | Prender una lámpara o un timbre de baja tensión en otra habitación. Para la demo usar carga de baja tensión (LED grande o buzzer de 12 V); evitar red de 220 V sin carcasa. El clic audible del relé también sirve de feedback. |
| Servo | Bandera o martillo | Levanta una bandera visible de la cama o golpea una campana. Efecto de demo fuerte para el jurado. En emergencia se levanta y se queda arriba hasta la confirmación RFID (es un indicador físico de "alarma pendiente" que no depende de pantallas). |
| Lector RFID + llavero | Confirmación de la cuidadora | Toque 1 del llavero = "voy" (apaga el sonido, la TV muestra "Camila viene", el servo baja a media altura). Toque 2 = "resuelto". Cada llavero identifica quién confirmó (registro). Un segundo llavero para familia. |
| Sensor de sonido | Ruido ambiente y respuesta | Medir el ruido de fondo para subir o bajar el volumen del buzzer (pero la emergencia siempre al máximo). Opcional: detectar un aplauso o golpe de la cuidadora como confirmación alternativa, aunque en módulos baratos es solo un umbral digital poco fiable; no depender de eso. |
| HC-SR04 | Presencia de la cuidadora | Si algo se acerca a menos de 1 m de la cama poco después de la alarma, mostrar "alguien llegó" como confirmación implícita (no reemplaza el RFID). |
| Matriz LED 8x8 | Íconos de canal y modo | Ojo, mandíbula y ceja como íconos pequeños, o un pulso al disparar un clic. Segundo indicador de estado para quien está junto a la cama. |
| DHT11 | No es necesario para alarmas | Opcional: mostrar temperatura en modo descanso en el LCD. |
| Mac, iPhone, AirPods | Notificación y voz | El iPhone recibe el aviso a la cuidadora; los AirPods pueden llevar el sonido al oído de la cuidadora de noche sin despertar a toda la casa (hay que probarlo, no lo verifiqué). |

Notas de seguridad para la demo: la demo es un prototipo y no un dispositivo médico. Decirlo explícitamente en pantalla y en la presentación, y no prometer que reemplaza un timbre de enfermería certificado. Probar la cadena completa (gesto, alarma, ack RFID) al menos 20 veces antes del domingo.

---

## Insights accionables para WOKI

1. **La alarma es un diferenciador real.** No encontré alarma nativa ni integración con nurse call en los CAA que revisé. Es un argumento frente a Apple y Look to Speak.
2. **Dos niveles y no más (atención y emergencia).** La Joint Commission estima que 85 a 99 % de las alarmas no requieren intervención; más niveles y más ruido fabrican fatiga.
3. **La alarma no se apaga sola.** Solo con confirmación humana (RFID o teléfono), y la TV le dice a Marta quién viene.
4. **Escalar en segundos, no en minutos.** PagerDuty usa 30 minutos por defecto y mínimo 3; eso no sirve acá. Propuesta: 0 s, 30 s, 90 s.
5. **El combo de emergencia es la excepción a "difícil de activar".** Debe ser fácil y cancelable en 3 s. Ceja, ceja, mandíbula con dos canales distintos reduce la coincidencia accidental.
6. **No existe precedente de combos de gestos como lenguaje de comandos.** Hay que decirlo con honestidad en la presentación y mostrar el resultado de pruebas propias.
7. **Con mirada de 3,7° de error a 3 m cabe una sola fila de objetivos.** O se sienta a Marta a 2 a 2,5 m, o se usa una TV de 65 pulgadas o más, o la mirada solo elige zona y el cursor predictivo con el EMG hace el resto.
8. **Máximo 4 frases en 2x2 o en fila, con tarjetas grandes.** Coincide con el diseño de las 4 frases de Claude.
9. **Franja de estado fija con tres indicadores (mirada, EMG, alarma), con ícono, texto y color**, y el canal que acaba de disparar se marca. Es útil también para la familia.
10. **El hardware físico hace la demo creíble:** LCD y LEDs como bedside, servo como bandera que queda arriba hasta la confirmación, RFID como "llegué", relé para llevar la alarma a otra habitación. Y el heartbeat Mac-Arduino hace visible la pérdida de la app.

## Recomendaciones de diseño con números

| Tema | Valor inicial |
|---|---|
| Canvas | 1920 x 1080; margen seguro 96 px laterales y 54 px vertical |
| Texto mínimo | 32 px; frases 56 a 64 px; mensaje armado 72 a 96 px; alerta 120 px o más |
| Contraste | texto 7:1 o más (alrededor de 15:1 con #E6E6E6 sobre #101010); foco 3:1 mínimo; evitar #FFFFFF |
| Objetivo de mirada | 2 x error: 5° (26 cm a 3 m) con error de 2,5°; 7,4° (39 cm a 3 m) con 3,7° |
| Distancia de sentarse | 2 a 2,5 m con TV de 55 pulgadas; 65 pulgadas o más si se llega a 3 m |
| Frases visibles | 4 (2x2 o fila) más 3 a 4 controles fijos |
| Foco | escala 1,1x, borde 6 px, anillo de progreso |
| Refractario de clic | 250 ms; ventana entre gestos 1,2 s; combo completo 3 s; clic largo 400 ms |
| Cancelación | 3 s, un solo gesto |
| Escalamiento de emergencia | 0 s alarma local y push; 30 s volumen más relé más familia; 90 s llamada al contacto 2; repetir cada 60 s |
| Atención (no emergencia) | campanita que repite cada 20 s hasta confirmar |
| Pérdida de mirada | aviso tras 1,5 s; aviso a cuidadora tras 60 s en vigilia |
| Parpadeo | 3 Hz máximo en cualquier elemento (WCAG 2.3.1 [Memoria]); preferir luz fija |
| Heartbeat Mac a Arduino | cada 2 s; sin latido por 6 s, "SIN CONEXION" |

Todos los tiempos son puntos de partida para calibrar con los sensores y con alguien que juegue el papel de Marta; ninguno sale de un estudio.
