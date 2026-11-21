# WOKI · Investigación UX/UI para una interfaz por mirada

Fecha: 21 de noviembre de 2026. Platanus Hack 26.
Usuaria de diseño: **Marta, ELA en etapa media**. Mueve ojos y cabeza, no tiene habla funcional ni manos útiles.
Pantalla: **TV o monitor grande**, mirado desde la cama o la silla. La familia también lo ve.

Este informe resume 6 investigaciones hechas en paralelo. El detalle y todas las URLs están en `hallazgos/01` a `06`. Ahí cada afirmación está marcada como verificada, sacada del buscador o inferida. Aquí solo uso lo que resiste esa revisión.

---

## 1. Resumen en 6 puntos

1. **Hay dos huecos claros en el mercado.** Ninguno de los 10 productos de CAA revisados documenta **emoción en la voz** ni una **alarma de emergencia** nativa. El manual del Tobii TD Pilot dice explícitamente que no se dependa del aparato para emergencias. *(01, 06)*
2. **La queja número uno de las personas con ELA es el ritmo de la conversación**, no el vocabulario. *"Speed is the number one factor. And the ability to express sarcasm is number two."* (Kane et al., 2016). *(05)*
3. **Apuntar con la mirada y confirmar con otro canal es lo mejor documentado.** TAGSwipe, con mirada más toque, logró 15,5 palabras por minuto contra 8,5 con dwell. No existe un estudio con EMG de ceja o mandíbula, así que es diseño propio. *(02)*
4. **El tamaño de la TV limita la interfaz.** Con 3,7° de error de la webcam, cada objetivo debe medir al menos 7,4°. En una TV de 55" eso permite unas **4×2 zonas a 2 m** y **solo 2 o 3 en fila a 3 m**. *(02, 06)*
5. **Mostrar 4 frases sugeridas funciona, pero con tono variado.** Valencia (CHI 2023) usó 4 opciones. Los usuarios las valoraron, pero criticaron el tono abrupto y sin personalidad (5 de 12 participantes). *(03)*
6. **Lo mejor respaldado sobre voz son las reacciones cortas pregrabadas** con la voz propia ("jaja", "¡no!", "mmm"). En Voicesetting (CHI 2018), la risa fue la reacción mejor valorada (4,6 de 5). *(04)*

---

## 2. Insights por tema

### 2.1 Mirada y selección *(01, 02)*
- **Todos los productos muestran un anillo o reloj que se llena** mientras la mirada se sostiene. El mejor feedback medido fue **un círculo que se cierra más un clic corto**. Leer en voz alta cada selección **empeoró** la velocidad y los errores (Majaranta, 2006).
- **El dwell por defecto va de 1,0 a 1,5 s** en los productos (Vocable usa 1,0 s y TD Pilot arranca en 1,5 s). En los papers, los novatos parten en ~880 ms. Con webcam no conviene bajar de 400 ms.
- **Todos tienen una forma de descansar la mirada:** mirar arriba o fuera de la pantalla (Look to Speak, Tobii) o un botón de pausa (Apple, Grid 3, Eye Control).
- **Look to Speak es el patrón que más tolera la imprecisión:** dos columnas y mirar a la izquierda, a la derecha o arriba, sin cursor fino. Es gratis y está en español desde 2021.
- **La precisión empeora en los bordes derecho e inferior** (Feit, 2017). Las zonas críticas van al centro y arriba.
- **Las emociones fuertes rompen el eye tracking:** *"tears confuse eyegaze technology and anger prevents focus"* (persona con ELA, Kane 2016). Hace falta una segunda vía de entrada, justo en el momento que más importa.

### 2.2 Predicción con IA *(03)*
- **4 frases sin scroll** (Valencia, 2023). SpeakFaster mostraba 5 y SPICA, 3 más "otra". Elegir entre muchas opciones cansa.
- **El contexto es lo que dijo la otra persona.** Un turno de contexto duplica la precisión (Cai, 2022).
- **Corregir una palabra, no reescribir la frase.** SpeakFaster tiene un modo FillMask para cambiar una sola palabra. Sin eso, editar anula el ahorro.
- **Autoría y privacidad.** El aparato puede parecer el autor del mensaje, y en una autoetnografía de 7 meses la IA filtró datos privados fuera de contexto. El autor solo aceptó el 2,3 % de las sugerencias, y aceptar palabra por palabra fue clave para su sensación de control.
- **SpeakFaster mejoró la velocidad entre 29 y 60 % con 2 usuarios con ELA.** No prometer más que eso.

### 2.3 Agentes y cursor que predice *(03)*
- **No hay estudios que combinen agentes, discapacidad motora y mirada.** Es un espacio abierto, pero sin evidencia de que funcione.
- **Patrón de confirmación de la industria:** aprobación justo antes de lo irreversible, y deshacer para lo reversible.
- **Los cursores que se imantan al objetivo existen** (bubble cursor, MAGIC, intención de mirada con 0,97 de precisión según Jo et al.), pero nadie los probó con webcam y ELA. Para la demo, mostrar una métrica propia: aciertos con y sin imán.

### 2.4 Voz y emoción *(04)*
- **Apple Personal Voice** pide 10 frases desde iOS 26, pero solo tiene **español de México** y no maneja emociones.
- **ElevenLabs** pide de 1 a 30 minutos de audio. **v3** tiene etiquetas de emoción (`[laughs]`, `[sarcastic]`, `[whispers]`) y soporta español. Su programa de impacto da la licencia gratis. Su latencia publicada es de ~100 ms con Flash v2.5 y ~165 ms con la variante Conversational de v3. No medimos nada.
- **Los usuarios dicen que la voz propia importa por identidad, pero que el clon suena plano:** *"good for pre-prepared statements, but not for conversation"* (Joyce Esser, MND).
- **El editor fino de emoción tardó 2,8 veces más** que un teclado de emojis (Voicesetting). Hay que usar pocos controles y rápidos.
- **"Triste" y "enojado" casi no se distinguen en la voz sintética** (Speak Ease). La risa, el sarcasmo y el cariño sí se notan. Por eso la emoción también se muestra en la TV, con emoji y color.

### 2.5 Conversación y familia *(05)*
- **Cuando se pierde el turno, los demás cambian de tema o sacan el celular.** Un indicador visible de "Marta está escribiendo" lo evita.
- **Los usuarios inventan sus propios recursos:** algunos dicen una palabra para "pedir la palabra" y otros escriben la emoción al inicio de la frase. Ambos se pueden convertir en funciones.
- **Que terminen tus frases es aceptable en privado, pero molesta en grupo.** *"I am very uncomfortable with someone speaking for me"* (usuario de AACrobat).
- **La cuidadora quiere que el aparato la reemplace en lo mecánico:** *"You are making me obsolete, which I would love to be."*

### 2.6 Alarmas y noche *(05, 06)*
- **Despertar a la cuidadora es una pregunta repetida en los foros desde 2007.** Hoy se resuelve chasqueando la lengua, con una campanilla o con un interruptor facial, y el aparato suele estar apagado de noche.
- **Fatiga de alarmas:** entre 85 y 99 % de las alarmas clínicas no requieren intervención (Joint Commission, 2013). Hay que usar 2 niveles como máximo.
- **No encontramos ningún proyecto que use combos de gestos como lenguaje de comandos.** Es diseño propio y hay que probar los falsos positivos.

---

## 3. Contra qué competimos

| | Apple Eye Tracking | Look to Speak | Tobii TD Talk + Pilot | **WOKI** |
|---|---|---|---|---|
| Precio | Incluido | Gratis | Miles de US$ | Unos US$375 en hardware |
| Precisión necesaria | Cursor fino | 3 direcciones | Rastreador IR | Zonas grandes + clic EMG |
| Predicción | Palabras | Frases fijas | Frases personales | 4 frases de Claude con contexto |
| Voz propia | Personal Voice (es-MX) | Voz del celular | Varios bancos de voz | Clon en español |
| Emoción | No | No | No documentada | **Propuesta por la IA, confirmada por la persona** |
| Emergencia | No | No | "No depender de él" | **Combo EMG + escalamiento + confirmación** |
| Funciona si llora o hay poca luz | No | No | No | **Sí, por EMG** |

---

## 4. Lo que no sabemos (decirlo en el pitch)

- No hay ningún estudio con mirada más EMG de ceja o mandíbula.
- No hay ningún estudio sobre una IA que "hable por" una persona con ELA.
- No hay ningún estudio sobre combos de gestos como comandos.
- No hay estudios de emoción con mirada o EMG, ni en español de Chile o Colombia.
- Todos los números de la guía de diseño son puntos de partida. Hay que calibrarlos con alguien del equipo haciendo de Marta.

---

## 5. Frases reales para el pitch (con atribución)

1. *"Las conversaciones avanzan rápido y yo ya no hablo rápido... el momento lo es todo."* Persona con ELA (Kane et al., Microsoft Research, 2016).
2. *"La velocidad es el factor número uno. Y poder expresar sarcasmo, el dos."* Persona con ELA (Kane et al., 2016).
3. *"¿Cómo despiertas a tu cuidador si no puedes hablar ni usar brazos y manos?"* Usuario de ALS Forums, 2007.
4. *"Sirve para frases preparadas, no para conversar."* Joyce Esser, MND, sobre su voz clonada (MIT Technology Review, 2025).
5. *"Me estás volviendo obsoleta, y me encantaría."* Una cuidadora (Fiannaca et al., AACrobat).
6. *"Quiero que mi hija se sienta orgullosa de mí por lo que soy; no por lo que fui."* Raúl Ordóñez, persona con ELA (El Tiempo, 2018).

Las URLs están en `hallazgos/05-voz-usuarios.md`. Atribuyan cada frase a la fuente y no inventen nombres.
