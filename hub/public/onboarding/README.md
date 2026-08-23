# Imágenes del onboarding WOKI

Estas imágenes no contienen instrucciones incrustadas. El texto, los indicadores y las
flechas interactivas deben superponerse desde la interfaz para poder corregirlos sin
regenerar los recursos.

| Archivo | Uso sugerido | Mensaje principal |
| --- | --- | --- |
| `kit-overview.webp` | Inventario inicial | Verifica que tienes las placas, antenas, cables, Raspberry Pi, batería y celulares. La pantalla externa no es necesaria. |
| `antenna-first.webp` | Preparación de cada TTGO | Conecta la antena antes de suministrar energía o conectar USB. |
| `connect-local-wifi.webp` | Nodo civil o de recurso | Desde el celular, conéctate directamente a `AYUDA` o `RECURSO_<ID>`. Es normal que el teléfono indique “sin internet”. Si el portal no abre solo, visita `http://192.168.4.1`. |
| `command-center-wiring.webp` | Centro local | Conecta el gateway por USB de datos a la Raspberry Pi, alimenta la Pi y abre el Centro desde el celular en la red local. |
| `system-topology.webp` | Explicación final | Los celulares hablan por Wi-Fi local con WOKI; los nodos hablan por LoRa; solo el Centro sincroniza eventualmente con internet. |

Código de color sugerido para las superposiciones:

- Azul: Wi-Fi local.
- Verde lima: LoRa.
- Naranja: USB, datos o alimentación.
- Gris punteado: sincronización online opcional.
