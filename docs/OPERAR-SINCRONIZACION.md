# Operar la sincronización desde la laptop del Centro

Responsable previsto para la demo: **Juan Ortega**.

## Resultado esperado

La laptop conectada por USB al LoRa Maestro ejecuta el Centro local y conserva toda la operación
en `center.db`. Si tiene internet, replica automáticamente los eventos al Hub online.

```text
Nodos → LoRa Maestro → USB → center.py → SQLite
                                          │
                                     cuando hay internet
                                          ▼
                            Vercel → Supabase → WOKI Hub
```

El Centro no necesita internet para recibir, priorizar o asignar emergencias. Si se pierde la
conexión, los eventos quedan pendientes y se reintentan después.

## Antes de entregar la laptop a Juan

- Los cambios de sincronización deben estar integrados en `main` y publicados en GitHub.
- Deben existir `lora-emergencia/center/sync_worker.py` y la tabla local `sync_outbox`.
- El LoRa Maestro debe tener antena y firmware de gateway antes de conectarlo por USB.
- Juan debe recibir `WOKI_SYNC_TOKEN` por un canal privado. Es el mismo secreto configurado en
  Vercel; no es una clave de Supabase, Anthropic ni ElevenLabs.

## Preparación única en macOS o Linux

Obtén el repositorio con `git clone` o descarga el ZIP. Desde la carpeta raíz ejecuta:

```bash
bash lora-emergencia/scripts/instalar_maestro.sh
```

El instalador detecta la placa y prepara Arduino CLI, ESP32, RadioLib, U8g2 y un Python aislado;
no requiere Arduino IDE. Antes de flashear exige confirmar que la antena 915 MHz está conectada.
Si hay varios puertos usa `--port /dev/cu.usbserial-XXXXXXXX`.

Al final solicita de forma privada el `WOKI_SYNC_TOKEN`. Si se ingresa, lo guarda fuera del
repositorio en `~/.config/woki/center.env` con permisos restringidos y arranca el Centro en
<http://localhost:8080>. Si se omite, el Centro opera completamente offline.

La configuración también puede crearse manualmente. Crea el directorio y abre el archivo:

```bash
mkdir -p ~/.config/woki
chmod 700 ~/.config/woki
nano ~/.config/woki/center.env
```

Dentro del archivo escribe:

```bash
export WOKI_SYNC_URL='https://woki-hub.vercel.app/api/sync'
export WOKI_SYNC_TOKEN='PEGAR_AQUI_EL_SECRETO_ENTREGADO_POR_EL_ADMIN'
```

Guarda con `Ctrl+O`, confirma con `Enter` y sal con `Ctrl+X`. Luego protege el archivo:

```bash
chmod 600 ~/.config/woki/center.env
```

Ese archivo nunca debe copiarse al repositorio ni compartirse por chat.

## Preparar un LoRa Esclavo de recurso

Conecta su antena, cambia la placa USB y ejecuta:

```bash
bash lora-emergencia/scripts/instalar_esclavo.sh
```

El instalador pregunta el ID, tipo y zona; por defecto prepara `GRUA07`, `GRUA`, `NORTE`. El
celular se conecta luego a `RECURSO_GRUA07` y abre <http://192.168.4.1> sin instalar una app.

## Arranque diario

```bash
cd lora-emergencia
[ -f ~/.config/woki/center.env ] && source ~/.config/woki/center.env

center/.venv/bin/python center/center.py /dev/cu.usbserial-XXXXXXXX \
  --host 127.0.0.1 --port 8080 --db center/center.db
```

Reemplaza el puerto por el obtenido en el paso anterior. La terminal debe mostrar:

```text
Sincronización online habilitada.
Command center en http://127.0.0.1:8080
```

Abre el dashboard local en <http://localhost:8080>. En el Hub remoto, el flujo referencial es
<https://woki-hub.vercel.app> → preparación guiada →
<https://woki-hub.vercel.app/command-center>. Ese acceso no implementa autenticación real.

## Prueba offline → online

1. Apaga el WiFi de la laptop.
2. Envía una solicitud real desde un nodo LoRa.
3. Confirma que el dashboard local continúa funcionando y muestra eventos pendientes.
4. Enciende nuevamente el WiFi.
5. Espera el reintento automático y confirma que el estado cambie a `Sincronizado`.
6. Comprueba que el evento y su posición aproximada aparezcan en el Hub online.

El worker consulta la cola cada 2 segundos. Después de varios fallos usa backoff progresivo, con
un máximo de 5 minutos. El Hub actualiza su lectura cada 15 segundos; no fuerza ni omite el
backoff local.

Se replican solicitudes, Centro, recursos, broadcasts, recibos y reportes de personas a salvo.
Las coordenadas se redondean a tres decimales y los reportes de personas no incluyen nombre ni
documento. La base local conserva el detalle exacto.

## Diagnóstico rápido

| Síntoma | Acción |
|---|---|
| No aparece `Sincronización online habilitada` | Ejecuta de nuevo `source ~/.config/woki/center.env` antes de iniciar el Centro. |
| El LoRa Maestro no aparece | Revisa antena, cable de datos y `arduino-cli board list`. |
| El Hub responde `401` | El token local y `WOKI_SYNC_TOKEN` de Vercel no coinciden. |
| Los eventos siguen pendientes | Verifica internet con `curl https://woki-hub.vercel.app/api/health` y espera el próximo reintento. |
| El dashboard local no abre | Confirma que `center.py` siga ejecutándose y abre `http://localhost:8080`. |

No borres `center.db` para resolver un problema de sincronización: contiene la operación local y
la cola durable pendiente.

## Cierre seguro

Detén el Centro con `Ctrl+C`. El proceso cierra el worker y SQLite de forma ordenada. Al iniciar
de nuevo con la misma base `center.db`, los eventos pendientes continúan en la cola.
