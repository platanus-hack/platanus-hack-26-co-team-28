# Glosario del dominio

## Recurso

Persona, vehículo o equipo operativo que porta un nodo y puede ser desplegado para atender una necesidad. Ejemplos: rescatista, ambulancia o grúa.

## Nodo

Dispositivo TTGO LoRa32 asociado temporalmente con un recurso. El nodo proporciona comunicación y puede reportar su posición, pero no es el recurso.

## Zona

Área operativa a la cual el centro asigna recursos. La zona representa responsabilidad o misión y no se deduce necesariamente de la ubicación actual.

## Ubicación

Posición observada de un recurso en un momento determinado. Puede provenir de GPS, del teléfono o de una configuración manual, y puede estar desactualizada o ser imprecisa.

## Asignación

Relación operativa entre un recurso y una zona o un incidente durante un periodo determinado.

## Recomendación

Propuesta generada por una persona o agente para cambiar una asignación o ejecutar otra acción operativa. No modifica el estado del sistema hasta ser autorizada cuando la política exige intervención humana.

## Autorización

Decisión explícita de un operador humano que permite ejecutar una recomendación sujeta a control humano.

## Centro local

Puesto de mando que mantiene la autoridad operacional aun cuando no existe conectividad externa. Recibe reportes, conserva el estado vigente y registra las decisiones tomadas durante la emergencia.

## Hub online

Vista remota de una o más operaciones. Recibe réplicas del Centro local y puede producir recomendaciones, pero no sustituye su autoridad mientras una operación está activa.

## Evento operacional

Hecho inmutable que ocurrió dentro de la operación, como recibir un reporte, autorizar una Asignación o resolver un incidente. Puede replicarse sin reescribir su historia.

## Sincronización

Proceso que replica Eventos operacionales entre el Centro local y el Hub online cuando existe conectividad. Puede demorarse o repetirse sin cambiar el resultado final.

## Réplica

Representación derivada de Eventos operacionales originados en otra autoridad. Una Réplica permite consulta y coordinación, pero no demuestra por sí sola que la fuente siga conectada.
