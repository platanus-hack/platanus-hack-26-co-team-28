# Protocolo del Command Center — borrador

Este documento define intenciones y garantías. El formato de bytes permanece pendiente hasta probarlo con el hardware.

## Clases de mensaje

### Uplink: nodo hacia centro

- `REPORT`: reporte de emergencia.
- `POSITION`: ubicación observada de un recurso.
- `HB`: presencia, tipo de recurso y zona conocida.
- `ACK`: recepción técnica de una orden dirigida.
- `BCA`: recepción técnica escalonada de un broadcast.
- `STATUS`: cambio de estado operacional del recurso.

### Downlink: centro hacia nodo

- `BC`: comunicación global o zonal.
- `DISP`: asignación de un recurso a un incidente.
- `CONFIG`: configuración operacional versionada.
- `REQUEST_STATUS`: solicitud de estado o información pendiente.

## Campos comunes

- Versión de protocolo.
- Tipo de mensaje.
- ID único.
- ID de origen.
- Destino: todos, zona o nodo.
- Número de secuencia.
- Prioridad.
- Expiración cuando aplique.
- Contenido específico.
- Verificación de integridad o autenticidad, por definir.

## Identidad de solicitudes

Una solicitud se referencia siempre con `(request_origin, request_message_id)`. El número
de secuencia aislado no es global y puede repetirse en nodos diferentes.

## Broadcast

Un broadcast contiene:

- Destinatarios.
- Prioridad.
- Texto corto o código de plantilla.
- Momento de expiración.
- Necesidad de confirmación humana.

El dashboard sigue el estado por nodo. Los receptores envían `BCA` con retraso aleatorio;
no se emite un ACK grupal inmediato.

## Entrega

- El emisor puede repetir mensajes según prioridad.
- El receptor deduplica por origen e ID/secuencia.
- Los ACK de múltiples nodos usan retrasos aleatorios o ventanas asignadas.
- La ausencia de ACK significa `sin confirmar`.
- Mensajes expirados no se presentan como órdenes vigentes.
- Un ACK de radio y una confirmación humana son eventos distintos.

## Posición

Una observación puede incluir:

- Recurso o nodo asociado.
- Latitud y longitud.
- Precisión.
- Momento de medición.
- Fuente: teléfono, GPS físico o manual.
- Velocidad y rumbo opcionales.

El centro añade el momento de recepción y calcula la antigüedad. No sustituye una posición reciente por otra más antigua sin conservar ambas observaciones.

## Heartbeat

El heartbeat confirma presencia del nodo; no confirma la posición del recurso. Puede incluir batería, versión, zona conocida, último broadcast y estado del portal.

## Restricciones

- Payloads cortos y estructurados.
- Sin fotos, audio, video ni texto libre largo.
- LoRa es half-duplex.
- El diseño debe tolerar pérdida, duplicación y reordenamiento.
- La interfaz no debe prometer entrega exactamente una vez.

## Parámetros por validar en hardware

- Intervalo de heartbeat.
- Latencia objetivo de broadcast.
- Número y espaciado de repeticiones.
- Ventanas de escucha.
- Tiempo aleatorio de confirmación.
- Tamaño máximo seguro de cada clase de mensaje.
