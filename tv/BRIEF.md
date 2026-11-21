# Brief común: investigación UX/UI de WOKI

## Proyecto
WOKI es un comunicador manos libres para personas con ELA. Equipo finalista de Platanus Hack 26 (Santiago de Chile, 20-22 de noviembre de 2026). La demo es el domingo 22; las funciones se congelan a las 14:00. El plan que sale de esta investigación es **solo para la hackathon**.

## Usuaria principal: "Marta", ELA en etapa media
- Mueve los ojos y la cabeza. Ya no tiene habla funcional ni manos útiles.
- Lo que más necesita es **velocidad** y **conservar su propio estilo y personalidad**: interrumpir, hacer chistes, decir "te quiero" sin planearlo. No solo pedidos básicos.
- Habla español (Chile o Colombia).
- Hoy existen opciones gratis que le podrían servir (Apple Eye Tracking, Switch Control, Look to Speak). WOKI tiene que justificar por qué es mejor.

## Pantalla
**TV o monitor grande**, mirado a distancia desde la cama o la silla. La familia también lo ve.

## Entrada
- Mirada por webcam: error de 1,5 a 3,7 grados, así que solo sirven zonas grandes.
- Clic EMG con sensores MyoWare 2.0 en ceja o mandíbula, para confirmar.
- Movimiento de cabeza, posible.

## Funciones que nos interesan
1. **Texto a voz** con la voz clonada de la persona.
2. **Emociones en la voz**, modelo mixto: la IA propone una emoción y la persona la confirma o la cambia con un gesto.
3. **Predicción de texto**: Claude propone 4 frases completas a partir del contexto. Si ninguna sirve, la persona elige iniciales y Claude expande la frase.
4. **Cursores agénticos**, en dos sentidos:
   - **Cursor que predice**: se imanta hacia el objetivo que la IA cree que la persona va a elegir, y así compensa el error de la mirada.
   - **Agente que actúa**: la persona da una intención ("responde a mi hija que llego a las 8") y un agente ejecuta los pasos (WhatsApp, Spotify, avisar a la cuidadora) con una lista cerrada de herramientas.
5. **Atajos y combos** de gestos. Ejemplo: ceja, ceja, mandíbula = emergencia.
6. **Alarmas**: aviso a la cuidadora, escalamiento si nadie responde, confirmación de la cuidadora.
7. **Mockups** de las pantallas.

## Hardware disponible
- 3 sensores EMG MyoWare con Wireless Shield (Bluetooth).
- Arduino Uno, relé, servo, LCD 16×2 I2C, LEDs, lector RFID con llavero, sensor de sonido, DHT11 (temperatura), HC-SR04 (distancia), matriz LED 8×8.
- Mac con webcam, iPhone, AirPods Pro 2.

## Fuentes que priorizamos
Productos reales, papers de HCI (CHI, ASSETS, ETRA y similares) y la voz de los usuarios: personas con ELA y cuidadores.

## Reglas para cada informe
- Escribir en **español**.
- Cada afirmación con su **URL**.
- Separar lo **verificado** (leíste la fuente) de lo **inferido**.
- No inventar cifras. Si algo no se pudo verificar, decirlo.
- Terminar con: **"Insights accionables para WOKI"** (5 a 10 puntos concretos) y **"Recomendaciones de diseño con números"** cuando aplique (tamaños, tiempos, cantidades).
