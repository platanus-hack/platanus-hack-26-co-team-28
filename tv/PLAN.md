# WOKI · Plan de construcción hasta el congelamiento

**Congelamiento: domingo 22 de noviembre, 14:00.** Después de esa hora solo se ensaya.
Demo: "La noche de Luis", adaptada a Marta. Las pantallas y los números salen de `GUIA-DISENO.md`.

## Prioridades

| Prioridad | Qué | Por qué |
|---|---|---|
| **P0: sin esto no hay demo** | Clic de ceja por EMG que llega al Mac · pantalla de conversación 2×2 con mirada · 4 frases de Claude · voz clonada · combo de emergencia → LCD, LED y teléfono · confirmación con RFID | Es el circuito completo que va de una persona a la cuidadora |
| **P1: lo que nos diferencia** | Emoción propuesta y confirmada · reacciones pregrabadas · indicador "Marta está escribiendo" · cambio automático a EMG cuando la cámara no la ve · bandera con servo | Son los dos huecos del mercado (emoción y alarma) y la robustez |
| **P2: solo si sobra tiempo** | Iniciales con cursor que se imanta · plan del agente para WhatsApp · veto al tragar · escalamiento a los 30 y 90 s | Suman, pero si salen a medias restan |

**Regla:** si algo de P2 no funciona 10 de 10 veces a las 12:00 del domingo, sale de la demo y se menciona como próximo paso.

## Frentes de trabajo

### A. Sensores EMG
1. Cargar `MyoWareBLEPeripheral` en los 3 Wireless Shield, con nombres distintos (`WOKI-CEJA`, `WOKI-MAND`, `WOKI-TRAGAR`). Probar cuáles de las 3 unidades Ding & Dent funcionan.
2. En el Mac, recibir los datos por Bluetooth (Python con `bleak`) y emitir eventos con el formato común `{src, seq, t_dev, t_host, type, value, conf}`.
3. Detector de clic: umbral más calibración de 10 s (reposo y contracción). Clic corto, doble y largo.
4. Detector de combos: 250 ms entre clics, 1,2 s entre gestos, 3 s para el combo completo.
5. Apagado seguro: si no llegan datos en 500 ms, no se ejecuta ningún comando.
- **Prueba de salida:** 10 minutos en reposo hablando y tragando, contando falsos clics. 20 combos de emergencia seguidos, contando aciertos.

### B. Interfaz para la TV
1. Pantalla de conversación: franja de estado, línea del mensaje, indicador "escribiendo" y 4 tarjetas en 2×2.
2. Mirada por webcam con 4 zonas (MediaPipe o WebGazer), filtro suavizador y calibración rápida de 5 puntos.
3. Anillo de progreso, clic sonoro y bloqueo de repetición.
4. Pantallas de alarma, señal perdida y descanso.
5. P1: chip de emoción con el anillo de 6 emociones. Reacciones rápidas.
- **Prueba de salida:** con la TV a 2 m, quien hace de Marta elige 20 tarjetas al azar. Se cuentan aciertos y tiempo.

### C. IA y voz
1. Claude (Sonnet o Haiku, por latencia) recibe la pregunta, el perfil de Marta y el historial, y devuelve 4 frases con tono variado más una emoción por frase, en JSON.
2. Contexto: alguien escribe lo que dijo la otra persona. El micrófono no queda activo. Es más simple y evita la pregunta de privacidad.
3. Clonar la voz de un integrante voluntario en ElevenLabs. Pregenerar las 8 a 12 reacciones como archivos locales.
4. Medir la latencia en la red del evento con Flash v2.5 y con v3. Elegir.
5. Voz de respaldo, más un video grabado por si no hay red.
- **Prueba de salida:** menos de 2 s desde la pregunta hasta las 4 frases, y menos de 500 ms desde la confirmación hasta el audio.

### D. Alarma y hardware de la cama (Uno)
1. Comunicación serial entre el Mac y el Uno, con heartbeat cada 2 s.
2. LCD (estado y tiempo), LEDs, servo como bandera y RFID con dos llaveros.
3. Aviso al teléfono de la cuidadora (notificación o mensaje).
4. P2: escalamiento a los 30 y 90 s y relé con carga de baja tensión.
- **Prueba de salida:** 20 cadenas completas: gesto, alarma, LCD, teléfono, RFID y "Camila viene".

### E. Pitch y demo
1. Guion de 3 minutos con tiempos y quién hace qué.
2. Dos o tres frases reales de la sección 5 de `INFORME.md`.
3. Slide de límites honestos: "probado solo con personas sanas", sin estudios con EMG facial ni con combos.
4. Video de respaldo grabado el domingo a las 13:00 con el sistema funcionando.

## Cronograma

| Bloque | A. Sensores | B. Interfaz | C. IA y voz | D. Alarma | E. Pitch |
|---|---|---|---|---|---|
| **Sábado, lo que queda** | 1 a 3 | 1 a 2 | 1 a 3 | 1 a 2 | 1 |
| **Domingo 8:00–11:00** | 4 a 5 + pruebas | 3 a 4 | 4 a 5 | 3 + prueba | 2 a 3 |
| **11:00 Integración** | Primera demo completa de punta a punta. Todos juntos | | | | |
| **12:00 Corte** | Decidir qué entra de P1 y P2 con la regla de 10 de 10 | | | | |
| **12:00–13:30** | Arreglos | P1 si entra | P1 si entra | P2 si entra | Ensayo 1 |
| **13:00** | Grabar el video de respaldo | | | | |
| **14:00 Congelamiento** | Solo ensayos: al menos 3 completos con cronómetro | | | | |

## Checklist del escenario
- [ ] Sensores inalámbricos cargados. Uno puesto y dos de repuesto, cargados separados del sensor.
- [ ] Electrodos nuevos y alcohol para limpiar la piel.
- [ ] Nada que toque a la persona conectado a la red. El Uno solo maneja la cama, nunca sensores.
- [ ] La TV a 2 a 2,5 m de quien hace de Marta. Revisar la luz del escenario.
- [ ] Respaldo de dwell de 800 ms activable con una tecla.
- [ ] Video grabado listo, por si falla el Wi-Fi.
- [ ] Mensaje en pantalla: "Prototipo. No es un dispositivo médico."
