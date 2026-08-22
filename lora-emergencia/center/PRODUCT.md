# Definición funcional

## Actores

- **Operador:** supervisa la situación y autoriza acciones críticas.
- **Recurso:** persona, vehículo o equipo operativo que porta un nodo.
- **Civil:** persona que envía una solicitud desde el portal de un nodo.
- **Agente:** propone priorizaciones y asignaciones; no suplanta la autorización humana.

## Entidades

### Nodo

TTGO LoRa32 asociado temporalmente a un recurso o desplegado como punto fijo. Tiene identidad, estado de comunicación, versión, última observación y asignación vigente.

### Recurso

Persona, vehículo o equipo capaz de responder. Ejemplos: rescatista, ambulancia y grúa. Su identidad e historial no dependen de una placa específica.

### Zona

Área de responsabilidad operacional. No equivale a ubicación: un recurso puede atravesar una zona sin ser reasignado a ella.

### Reporte

Solicitud o información originada en campo. Conserva el contenido recibido y una evolución operacional independiente.

### Broadcast

Comunicación del centro dirigida a todos los nodos, una zona o una selección explícita. Tiene prioridad, expiración y seguimiento de recepción.

### Asignación

Relación temporal entre un recurso y una zona o incidente. Mantiene autor, motivo, estado e historial.

### Ubicación observada

Posición de un recurso o reporte junto con fuente, precisión y momento de observación. Puede provenir del celular, de GPS físico o de configuración manual.

## Estados

### Reporte — entrega

- Recibido.
- Duplicado.
- Inválido.

### Reporte — operación

- Nuevo.
- Revisado.
- Asignado.
- En atención.
- Resuelto.
- Descartado.

### Recurso

- Disponible.
- Asignado.
- En camino.
- En operación.
- Fuera de servicio.
- Sin comunicación.

### Broadcast por destinatario

- Pendiente.
- Recibido por radio.
- Confirmado por persona.
- Sin confirmar.
- Expirado.

## Reglas operativas iniciales

1. El command center es la fuente de verdad para zonas y asignaciones.
2. La posición observada no cambia automáticamente la zona asignada.
3. Un agente puede recomendar una reasignación; un operador la autoriza.
4. ACK de radio no significa que una persona leyó el mensaje.
5. Una transmisión sin ACK queda `sin confirmar`, no necesariamente `fallida`.
6. Reportes duplicados se conservan como evidencia técnica, pero no crean incidentes duplicados.
7. La interfaz siempre muestra la antigüedad de la ubicación.
8. Datos desconocidos no se convierten en estados positivos por defecto.

## Ubicación de recursos

Para el demo, el celular proporciona posiciones puntuales mediante el portal local:

- Al abrir o vincular la sesión.
- Al aceptar una misión.
- Al indicar llegada.
- Al finalizar una misión.
- Cada cinco minutos mientras el portal permanezca activo.
- Manualmente mediante `Actualizar ubicación`.

La posición se considera reciente durante 10 minutos, envejecida entre 10 y 30, y desactualizada después de 30. El heartbeat del nodo es independiente y puede ser más frecuente.

## Human in the loop

El agente puede:

- Priorizar reportes.
- Recomendar recursos.
- Detectar zonas sin cobertura.
- Proponer broadcasts.
- Señalar ubicaciones antiguas o nodos ausentes.

Requieren autorización humana:

- Asignar o reasignar recursos.
- Cambiar una zona operativa.
- Enviar un broadcast.
- Cerrar o descartar un reporte crítico.

Cada recomendación debe incluir evidencia, confianza y alternativas. Cada decisión registra quién la propuso, quién la autorizó y qué resultado tuvo.

## Alcance inicial del dashboard

- Resumen operacional.
- Mapa offline.
- Cola de reportes.
- Inventario y estado de recursos.
- Gestión manual de zonas.
- Asignación de recursos.
- Composición y seguimiento de broadcasts.
- Salud de gateways y nodos.
- Panel de recomendaciones con autorización humana.

## Fuera del primer alcance

- Autonomía completa del agente.
- Rastreo garantizado con el celular bloqueado.
- Sincronización cloud obligatoria.
- Optimización multi-canal con dos radios simultáneas.
- Cartografía offline de todo el país.
- Aplicación móvil nativa.
