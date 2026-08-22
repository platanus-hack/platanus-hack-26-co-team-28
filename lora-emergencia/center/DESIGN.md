# Command Center — Style Reference

> Operational clarity on rice paper

**Referencia base:** Dub  
**Tema inicial:** claro  
**Contexto:** sala de operaciones offline, no landing ni dashboard financiero

## Dirección

El command center adapta la estética editorial y contenida de Dub a una herramienta de emergencia. Conserva el canvas casi blanco, los bordes de 1 px, la tipografía compacta y las superficies planas. Sustituye el contenido promocional por una jerarquía operacional: primero anomalías y decisiones; después contexto y métricas.

El color no decora. Comunica estado, prioridad o acción. El rojo queda reservado para peligro y urgencia; el azul identifica selección y acción primaria.

## Principios

1. **Decisiones antes que estadísticas.** Una emergencia sin asignar tiene más peso que un contador total.
2. **Mapa como superficie operacional.** El mapa domina la vista principal y admite capas, selección y acciones.
3. **Doble codificación.** Ningún estado depende solo del color; siempre incluye texto, icono o patrón.
4. **Antigüedad visible.** Reportes, posiciones y conectividad muestran cuándo se observaron por última vez.
5. **Confirmación explícita.** Broadcasts y asignaciones críticas requieren revisión antes de transmitirse.
6. **Offline visible.** La interfaz no aparenta depender de la nube y muestra el estado local de radio, almacenamiento y cartografía.
7. **Densidad controlada.** La pantalla contiene mucha información, pero revela detalles técnicos bajo demanda.

## Tokens de color

### Base Dub conservada

| Token | Valor | Uso |
|---|---|---|
| `--canvas` | `#ffffff` | Fondo principal |
| `--paper` | `#f5f5f5` | Superficies secundarias y hover |
| `--border` | `#e5e5e5` | Bordes estructurales de 1 px |
| `--border-strong` | `#d4d4d4` | Separadores y controles enfatizados |
| `--text-primary` | `#171717` | Texto principal |
| `--text-secondary` | `#525252` | Texto secundario |
| `--text-muted` | `#737373` | Metadatos y placeholders |
| `--accent` | `#2563eb` | Selección, enlaces y foco |
| `--action-primary` | `#1e40af` | Acción primaria de una superficie |

### Semántica operacional

| Token | Valor | Significado |
|---|---|---|
| `--critical` | `#b42318` | Urgencia crítica, peligro o acción vencida |
| `--critical-bg` | `#fef3f2` | Fondo de estado crítico |
| `--warning` | `#b54708` | Degradación, posición antigua o confirmación pendiente |
| `--warning-bg` | `#fffaeb` | Fondo de advertencia |
| `--success` | `#067647` | Disponible, confirmado o resuelto |
| `--success-bg` | `#ecfdf3` | Fondo de estado positivo |
| `--info` | `#175cd3` | Asignado, en camino o información operacional |
| `--info-bg` | `#eff8ff` | Fondo informativo |
| `--offline` | `#525252` | Sin comunicación o sin datos recientes |

El violeta y el naranja decorativos de Dub no se usan libremente: solo aparecen cuando tengan un significado definido y consistente.

## Tipografía

- **Inter:** toda la interfaz. Pesos 400, 500 y 600.
- **Geist Mono:** IDs, payloads, RSSI, SNR y diagnósticos.
- **Satoshi:** opcional para identidad o una pantalla de bienvenida; no se usa en la operación diaria.

Escala operacional:

| Rol | Tamaño | Uso |
|---|---:|---|
| Micro | 11 px | Metadatos técnicos no críticos |
| Caption | 12 px | Antigüedad, fuente y etiquetas |
| Body | 14 px | Tablas, tarjetas y controles |
| Body large | 16 px | Mensajes y detalles importantes |
| Section | 20 px | Título de panel |
| Screen | 24 px | Título de pantalla |
| Critical count | 30 px | Métrica que requiere atención |

No se usan titulares de 36–48 px dentro del dashboard: consumen área operacional sin aportar jerarquía útil.

## Espaciado y formas

- Unidad base: 4 px.
- Gap habitual: 8 px.
- Padding de tarjeta: 12–16 px.
- Sidebar: 224 px en escritorio; colapsable.
- Bordes: 1 px `--border`.
- Cards: radio de 12 px.
- Botones: radio de 8 px.
- Inputs: radio de 6 px.
- Badges: radio completo.
- Sombras: solo popovers, diálogos y elementos que flotan sobre el mapa.

## App shell

```text
┌────────────────────────────────────────────────────────────────────┐
│ Command Center │ Gateway A activo │ 11/12 nodos │ 2 alertas │ hora │
├───────────┬───────────────────────────────────┬────────────────────┤
│ Resumen   │                                   │ Cola priorizada    │
│ Mapa      │                                   │                    │
│ Reportes  │           MAPA OFFLINE            ├────────────────────┤
│ Recursos  │                                   │ Recomendaciones    │
│ Zonas     │                                   │ del agente         │
│ Broadcast │                                   │ Human in the loop  │
│ Red LoRa  │                                   │                    │
├───────────┴───────────────────────────────────┴────────────────────┤
│ Estado local: radio · base de datos · cartografía · sincronización │
└────────────────────────────────────────────────────────────────────┘
```

La aplicación ocupa el viewport completo. No usa el `max-width: 1200px` de la landing: un command center debe aprovechar monitores grandes. El contenido conserva márgenes de 16–24 px y limita el ancho de texto largo, no el de la superficie operacional.

## Navegación

| Sección | Propósito |
|---|---|
| Resumen | Situación actual y decisiones pendientes |
| Mapa | Vista geográfica de reportes, recursos, zonas y nodos |
| Reportes | Cola filtrable e historial de incidentes |
| Recursos | Disponibilidad, asignaciones y ubicación observada |
| Zonas | Definición y cobertura operacional |
| Broadcast | Composición, aprobación y seguimiento de mensajes |
| Red LoRa | Gateways, nodos, señal y diagnóstico |

Configuración queda en un menú secundario; no compite con la navegación operativa.

## Pantalla principal

### Barra de estado

Siempre visible. Muestra gateway activo, respaldo, número de nodos presentes, alertas, hora local y modo offline. Un fallo del gateway debe ser evidente en cualquier pantalla.

### Mapa

Capas configurables:

- Reportes e incidentes.
- Recursos.
- Nodos TTGO.
- Zonas operativas.
- Puntos seguros y bloqueos.

La ubicación usa indicadores de frescura:

- Reciente: menos de 10 minutos.
- Envejecida: entre 10 y 30 minutos.
- Desactualizada: más de 30 minutos.
- Desconocida: nunca observada.

### Cola priorizada

Ordena primero reportes críticos sin asignar, después advertencias operativas y finalmente actividad informativa. Cada fila muestra tipo, ubicación, antigüedad, estado y recurso asignado.

### Recomendaciones del agente

Una recomendación contiene propuesta, justificación, nivel de confianza e impacto. Las acciones críticas presentan `Autorizar`, `Modificar` y `Rechazar`. Una recomendación nunca aparenta estar ejecutada antes de la autorización correspondiente.

## Componentes adaptados

### Operational Card

Card blanca, borde de 1 px, radio de 12 px y padding de 16 px. No usa sombra. Puede tener una franja semántica izquierda, acompañada por icono y texto.

### Status Badge

Badge pill con fondo tintado, punto o icono y texto explícito. Ejemplos: `Crítico`, `En camino`, `Sin confirmar`, `Hace 18 min`.

### Primary Action

Un único botón azul oscuro por panel. En acciones peligrosas, el rojo aparece solo dentro del flujo de confirmación y nunca como CTA decorativo.

### Resource Row

Muestra icono de tipo, nombre, zona, estado, antigüedad de ubicación y conectividad. RSSI/SNR permanecen en el detalle técnico.

### Broadcast Composer

Incluye destinatarios, prioridad, mensaje, expiración y resumen previo a transmisión. Antes de enviar muestra cuántos nodos serán alcanzados según el inventario conocido.

### Agent Recommendation

Card con etiqueta `Sugerencia`, explicación verificable y controles human-in-the-loop. Debe distinguir recomendación de alerta y de acción ya ejecutada.

## Estados vacíos y degradados

- Sin cartografía: mantener recursos y reportes en una lista geográfica simplificada.
- Gateway desconectado: conservar operación local, bloquear transmisión y explicar el motivo.
- Sin GPS: mostrar última posición y antigüedad; no inventar coordenadas.
- Sin reportes: mostrar salud de red y recursos, no una ilustración promocional.
- Datos incompletos: exhibir `Desconocido`, nunca asumir `Disponible`.

## Accesibilidad y entorno

- Contraste mínimo AA.
- Objetivos táctiles de al menos 44×44 px en pantallas táctiles.
- Estados expresados con texto, icono y color.
- Soporte de teclado para la operación principal.
- Animaciones mínimas y desactivables.
- Ninguna fuente, iconografía, script o tile depende de CDN.
- La vista crítica debe funcionar a 1366×768 y escalar a monitores grandes.

## Qué se descarta de Dub

- Hero, logo cloud, social proof y estructura de landing.
- Titulares display en pantallas operativas.
- Gradiente de marca.
- Tarjetas elevadas promocionales.
- Color como adorno.
- Máximo global de 1200 px.
- Métricas o gráficas sin decisión asociada.

## Regla de coherencia

Antes de agregar un elemento, debe responder una de estas preguntas:

1. ¿Qué ocurrió?
2. ¿Dónde ocurrió?
3. ¿Qué requiere atención?
4. ¿Qué recurso puede responder?
5. ¿Qué decisión debe autorizar una persona?
6. ¿La red y los datos son confiables en este momento?

Si no responde ninguna, probablemente no pertenece al command center.
