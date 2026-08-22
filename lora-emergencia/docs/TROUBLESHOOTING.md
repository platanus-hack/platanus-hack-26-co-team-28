# TROUBLESHOOTING · Errores reales y sus soluciones

Estos son problemas que ya ocurrieron y cómo se resolvieron.

## La subida falla: "Unable to verify flash chip connection"

La subida conecta con el ESP32 pero falla al cambiar a 921600 baudios.

**Solución:** sube a 115200. Usa el FQBN con `UploadSpeed=115200`:

```bash
arduino-cli compile --upload -p <PUERTO> --fqbn esp32:esp32:ttgo-lora32:UploadSpeed=115200 <sketch>
```

Los scripts del repo ya lo hacen.

## El puerto no aparece

- Revisa que el cable sea **de datos**, no de solo carga.
- Instala el driver USB-serial si hace falta (ver SETUP.md).
- Prueba otro puerto USB.

## La subida falla al conectar

Mantén presionado el botón **BOOT** de la placa mientras empieza la subida. Suéltalo cuando veas "Writing...".

## El receptor no recibe nada

Esta es la falla nº1 de LoRa. Casi siempre es esto:

- Los 6 parámetros de `radio.begin()` NO coinciden entre las placas. Revisa freq, BW, SF, CR, sync, preámbulo. Deben ser idénticos.
- Una placa quedó en 868 y otra en 915.
- La antena no está enroscada (baja mucho el alcance, aunque de cerca a veces igual llega).

No hay mensaje de error cuando los parámetros no calzan. Simplemente no llega nada.

## La primera compilación tarda mucho

Es normal. La primera vez arma todo el core ESP32. Puede pasar de 2 minutos. Las siguientes compilaciones son rápidas. Si usas un timeout, corre la primera compilación en segundo plano.

## Leer el serial en macOS

`arduino-cli monitor` a veces no muestra nada al cerrarse rápido. Alternativa con `stty` + `cat`:

```bash
PORT=/dev/cu.usbserial-XXXX
stty -f "$PORT" 115200 raw -echo
cat "$PORT"
# Ctrl+C para salir
```

Al abrir el puerto puede aparecer texto basura: es el mensaje del bootloader de la ROM a otra velocidad. Ignóralo, lo importante son las líneas legibles.

## Tormenta de ACK / el gateway recibe su propio mensaje

Síntoma: el gateway imprime en bucle `RECV|ACK|ACK...` con un timestamp congelado, y el nodo nunca recibe el ACK.

Causa: mezclar recepción por interrupción (`setPacketReceivedAction` + `startReceive`) con `transmit()` bloqueante en la misma placa. Cuando la placa transmite, la interrupción de "TX terminado" dispara la misma bandera de "paquete recibido", y luego `readData()` lee de vuelta el propio FIFO de transmisión como si fuera un paquete nuevo. Eso crea un bucle de auto-respuesta.

Solución: no mezclar interrupción con `transmit()`. Usa el patrón BLOQUEANTE: `radio.transmit()` seguido de `radio.receive()`. Es lo que hacen `nodo_bidir` y `gateway_bidir` en este repo. Regla: en una placa half-duplex, o usas interrupciones para todo, o bloqueante para todo, pero no mezcles con `transmit()` de por medio.

## Resets intermitentes del gateway conectado a la Raspberry Pi

Los 4 puertos USB de la Pi 4B comparten 1.2 A. Si cuelgas varios aparatos, el gateway resetea.

- Usa la fuente de 3 A de la Pi.
- Si sigue, alimenta el gateway por un hub USB con energía propia, o dale corriente aparte.
