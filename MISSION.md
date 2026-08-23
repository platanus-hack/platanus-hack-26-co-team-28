# Misión de aprendizaje

## Objetivo

Construir el command center de la red de emergencia LoRa para que el equipo pueda operarlo localmente sin depender de internet y recuperar visibilidad remota cuando regresa la conectividad.

## Resultado práctico

Construir un dashboard desplegable en una Raspberry Pi que reciba reportes de nodos TTGO LoRa32, los conserve localmente, permita priorizar y coordinar la respuesta, y sincronice después los eventos con un hub online.

## Contexto del sistema

- Los nodos de campo son TTGO LoRa32 T3 V1.6.1 alimentados con power banks.
- Cada nodo ofrece una web local a los civiles mediante WiFi.
- Los reportes viajan desde los nodos al command center por LoRa 915 MHz.
- La comunicación exacta, el protocolo definitivo y el comportamiento ante desconexiones aún deben definirse.

## Prioridades

1. Operación completamente offline.
2. Recepción confiable y confirmación de reportes.
3. Persistencia local para no perder información al reiniciar.
4. Interfaz clara para una situación de emergencia.
5. Arquitectura que permita evolucionar sin reemplazar el firmware de radio innecesariamente.
6. Sincronización eventual que nunca bloquee ni sustituya la operación local.
