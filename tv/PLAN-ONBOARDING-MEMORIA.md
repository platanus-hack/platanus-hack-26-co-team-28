# WOKI · Plan de onboarding y memoria personal

**Objetivo:** que WOKI suene a Marta desde el primer día y cada vez más con el uso. Que sepa cómo se llaman sus nietos, que los domingos almuerza con Sofía, que dice "obvio" y "porfa", que su humor es irónico y que no habla de su diagnóstico con todos.

**Por qué importa (con datos):**
- En sus pruebas, **agregar un perfil subió el acierto de Sonnet de 7 a 15 de 100** en habla personal. Es la palanca con más ganancia que midieron.
- Lo que más critican los usuarios de CAA es el **tono genérico y sin personalidad** (Valencia, CHI 2023).
- El riesgo principal es la **privacidad**: en una autoetnografía de 7 meses, la IA sugirió datos privados fuera de contexto.

Por eso la memoria se diseña con control de Marta desde el inicio.

---

## 1. Las 3 capas del onboarding

| Capa | Quién la hace | Cuándo | Tiempo | Resultado |
|---|---|---|---|---|
| **A. Contexto de vida** | Familia o cuidadora con Marta, desde un celular o computador (no con la mirada) | Antes del primer uso | 20–30 min | Perfil inicial |
| **B. Acceso al cuerpo** | Acompañante + Marta en la TV | Primer uso, y cada día al iniciar | 1–2 min | Calibración de nariz o mirada, umbrales del EMG, tiempo de mirada |
| **C. Aprender a usarlo** | Marta, con una práctica guiada | Primera semana, con funciones que se van desbloqueando | 5 min al día | Confianza con los gestos y menos errores |

### A. Contexto de vida (formulario conversacional para la familia)

Se hace en un formulario de celular, por bloques y con ejemplos. **Todo es opcional y editable.**

| Bloque | Qué se pregunta | Ejemplo | Para qué lo usa WOKI |
|---|---|---|---|
| **Identidad** | Nombre, cómo le gusta que le digan, edad, de dónde es, cómo habla | "Marta, la Tata para los nietos. Santiago. Dice 'porfa', 'obvio', 'ya po'" | Vocabulario y tono |
| **Personas** | Nombre, relación, apodo, cómo le habla a cada una | "Sofía, hija, 'Sofi', cariñosa y bromista". "Camila, cuidadora, formal pero cercana" | Respuestas distintas según con quién habla |
| **Personalidad** | Humor, cómo muestra cariño, cómo se enoja, temas favoritos | "Irónica, fan de Colo-Colo, odia que la traten como enferma" | Variedad de tono en las 4 frases |
| **Rutinas** | Horarios del día y de la semana | "Café 8:00, kinesiólogo los martes 10:00, almuerzo familiar los domingos" | Sugerencias según la hora |
| **Gustos** | Comida, música, programas, lugares | "Café con leche, boleros, Los Bunker, Viña del Mar" | Pedidos rápidos, acciones (música) |
| **Salud práctica** | Molestias frecuentes, posiciones, señales | "Le duele la espalda baja, prefiere el lado izquierdo" | Frases de cuidado y necesidades urgentes |
| **Frases propias** | Dichos, chistes internos, cómo saluda y se despide | "Chao, pescao". "¿Y qué esperabas?" | Ejemplos de estilo |
| **Límites** | Temas privados y con quién no hablarlos | "No mencionar el diagnóstico con los nietos" | Reglas que la IA nunca rompe |

**Importación opcional, con consentimiento explícito:**
- **Un chat de WhatsApp exportado** (`.txt`) con la persona que más escribe. Lo planteó la reunión: los últimos 30 días disponibles.
  - Se extraen el vocabulario, las muletillas, los emojis y el largo típico de los mensajes.
  - **Se procesa en el equipo y no se guardan los mensajes de los demás.**
- **Notas de voz** para clonar la voz (ElevenLabs), con permiso escrito.
- **Contactos** para el agente de mensajes, solo los que la familia elija.

### B. Acceso al cuerpo (ya está en el prototipo)

1. **Calibración de nariz:** centro, 4 esquinas para medir su rango cómodo y una prueba de 3 objetivos. Se guarda, y cada día basta con recentrar.
2. **Umbrales del EMG** (pendiente): 5 s relajada y 3 contracciones de ceja y de mandíbula. El umbral queda al 60 % entre el reposo y su contracción. 10 s tragando saliva sirven para calibrar el veto.
3. **Tiempo de mirada:** arranca en 800 ms y lo ajusta Marta.

### C. Aprender a usarlo (desbloqueo progresivo)

| Día | Qué se habilita | Práctica guiada |
|---|---|---|
| 1 | Hablar (4 frases) + **emergencia** + reacciones | "Elige la frase que dice 'sí'" ×5. Practicar el combo de emergencia 3 veces, con la alarma en modo práctica |
| 2–3 | Cambiar emoción + pedir la palabra | Responder 5 preguntas de la familia con la emoción que ella quiera |
| 4–5 | Escribir (teclado por grupos) | Escribir su nombre y el de un nieto |
| 6–7 | Mensajes (agente) + música | Mandarle un mensaje real a Sofía, con doble confirmación |

En los primeros días hay menos opciones, así que hay menos errores y no se frustra. El abandono de los aparatos por frustración está documentado en la investigación.

---

## 2. Arquitectura de memoria

Son 5 tipos de memoria, cada uno con su propia regla de privacidad:

| Memoria | Qué guarda | Cómo se llena | Ejemplo |
|---|---|---|---|
| **1. Perfil** (explícita) | Identidad, personas, personalidad, límites | Onboarding A, editable siempre | `{"nombre":"Marta","apodo":"Tata","humor":"irónico"}` |
| **2. Léxico** | Palabras y frases que usa, con frecuencia y fecha | Automático, cada vez que habla | `"obvio": 41, "porfa": 33` · **ya funciona en el prototipo** |
| **3. Estilo** | Frases que ella **eligió o editó**, con contexto | Automático: elegir o editar una sugerencia | "Sofía: ¿vienes? → Marta: ¡Obvio! Guárdame postre 🥰" |
| **4. Episodios** | Hechos recientes de su vida | Lo que se habla + lo que agrega la familia | "El domingo vino Tomás con la polola" |
| **5. Rutinas** | Qué pasa a qué hora | Onboarding + patrones que se repiten | "Martes 10:00 kinesiólogo" → a las 9:45 sugiere "¿A qué hora llega el kine?" |

### Modelo de datos (JSON local)

```json
{
  "perfil": {
    "nombre": "Marta", "apodos": ["Tata"], "region": "Santiago, Chile",
    "personalidad": ["irónica", "cariñosa con los nietos", "odia que la traten como enferma"],
    "muletillas": ["obvio", "porfa", "ya po"],
    "limites": [{"tema": "diagnóstico", "no_con": ["nietos"]}]
  },
  "personas": [
    {"id": "sofia", "nombre": "Sofía", "relacion": "hija", "apodo": "Sofi", "tono": "cariñosa, bromista", "whatsapp": true},
    {"id": "camila", "nombre": "Camila", "relacion": "cuidadora", "tono": "cercana"}
  ],
  "rutinas": [{"cuando": "dom 13:00", "que": "almuerzo familiar con Sofía"}],
  "lexico": {"obvio": {"n": 41, "ult": "2026-11-21"}},
  "estilo": [{"contexto": "Sofía: ¿vienes el domingo?", "respuesta": "¡Obvio! Guárdame postre", "emocion": "carinosa", "fecha": "2026-11-21"}],
  "episodios": [{"fecha": "2026-11-16", "hecho": "Vino Tomás con su polola", "personas": ["tomas"], "privado": false}]
}
```

### Cómo arma las 4 frases (en cada turno)

```
1. Detecta con quién habla       → la persona elegida o la voz reconocida (después)
2. Recupera solo lo relevante     → perfil corto + esa persona + 5 frases de estilo con esa persona
                                    + 3 episodios recientes + la rutina de la hora actual
3. Aplica los límites             → filtra los temas privados para esa persona ANTES de enviarlo a Claude
4. Llama a Claude                 → system: perfil + reglas · user: lo que dijo la otra persona
                                    → JSON con 4 frases de tono variado + una emoción por frase
5. Marta elige o edita            → se guarda en estilo y léxico (lo que eligió es la mejor señal)
```

**Regla clave:** se manda a Claude **lo mínimo necesario para ese turno**, nunca la memoria completa. Así baja la latencia (la meta es menos de 2 s) y se reduce el riesgo de que salga un dato privado fuera de contexto.

### Señales de aprendizaje

| Lo que hace Marta | Qué aprende WOKI |
|---|---|
| Elige una frase sin cambios | +1 a ese estilo con esa persona |
| Cambia la emoción | Ajusta la emoción por defecto con esa persona |
| Edita una palabra | Guarda la versión corregida como ejemplo (vale más que elegir) |
| "Ninguna sirve" y escribe | Ejemplo de alto valor: lo que la IA no supo predecir |
| Usa mucho una reacción | La sube en el orden de las reacciones |

---

## 3. Privacidad y control (no negociable)

1. **Local primero.** La memoria vive en el equipo de Marta. Solo sale el contexto mínimo de cada turno hacia Claude.
2. **Marta es la dueña.** Ella aprueba lo que la familia carga y puede ver, editar o borrar cualquier recuerdo.
3. **"No aprendas esto".** Un gesto marca la conversación actual como no guardable.
4. **Modo íntimo.** Sin sugerencias visibles en la TV y sin guardar nada. Se activa con un combo.
5. **Límites duros por persona.** Se filtran antes de llamar a la IA, no se le pide a la IA que "no lo diga".
6. **Nada de los demás.** Del chat de WhatsApp solo se aprende cómo escribe Marta.
7. **Consentimiento escrito** para clonar la voz y para importar chats. Ley 1581 en Colombia y Ley 19.628 en Chile.

---

## 4. Pantallas del onboarding

| # | Pantalla | Dispositivo |
|---|---|---|
| 1 | Bienvenida: "Vamos a conocer a Marta", y quién está completando el perfil | Celular de la familia |
| 2 | Personas: tarjetas con foto, nombre, relación, apodo y tono | Celular |
| 3 | Personalidad: chips para elegir ("irónica", "dulce", "directa") + texto libre | Celular |
| 4 | Rutinas: una línea de tiempo del día y la semana | Celular |
| 5 | Frases propias: "¿Qué dice siempre Marta?" | Celular |
| 6 | Límites: temas privados y con quién | Celular |
| 7 | Importar (opcional): WhatsApp y voz, con consentimiento | Celular |
| 8 | **Marta revisa**: la TV muestra un resumen y ella aprueba cada bloque con la ceja | TV |
| 9 | Calibración (ya hecha) | TV |
| 10 | Práctica del día 1 | TV |

---

## 5. Qué entra en la hackathon y qué queda para después

| Ahora (antes del domingo 14:00) | Después |
|---|---|
| ✅ Calibración de nariz al inicio | Calibración de los umbrales EMG por persona |
| ✅ Léxico local: la predicción prioriza sus palabras | Importar un chat de WhatsApp |
| **Perfil JSON escrito a mano** para la Marta ficticia, enviado a Claude en cada turno | Formulario de onboarding para la familia |
| **Personas: elegir con quién habla** (Sofía o Camila) cambia el tono de las 4 frases | Reconocer quién habla por la voz |
| **Guardar la frase elegida como estilo** y mostrar "WOKI recordó que dices 'obvio'" | Episodios y rutinas automáticas |
| Mencionar la privacidad en el pitch | Panel para ver y borrar recuerdos, modo íntimo, "no aprendas esto" |

**Momento para la demo:** la misma pregunta, "¿Vienes el domingo?", hecha por Sofía y luego por Camila, produce respuestas distintas: cariñosa y con chiste para la hija, cordial para la cuidadora. En 15 segundos se ve la personalización sin explicarla.

## 6. Cómo sabremos que funciona

| Métrica | Meta inicial |
|---|---|
| Acierto entre las 4 frases (la elige sin editar) | Medir sin perfil y con perfil. La referencia propia es 7 → 15 de 100 |
| Veces que usa "ninguna sirve" | Que baje semana a semana |
| Tiempo desde la pregunta hasta que habla | Menos de 5 s en respuestas cortas |
| Ediciones de tono (cambia la emoción) | Que baje con el uso |
| Datos privados sugeridos fuera de contexto | 0 (revisión manual del registro) |
