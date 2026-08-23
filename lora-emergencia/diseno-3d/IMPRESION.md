# Fabricación e impresión

## Archivos

| Equipo | Pieza | Cantidad | STL / 3MF |
|---|---|---:|---|
| Centro | Bandeja RPi4 + TTGO | 1 | `centro_bandeja` |
| Centro | Marco trasero de pantalla | 1 | `pantalla_marco` |
| Centro | Pie inclinado | 2 | `pantalla_pie` |
| Centro | Cuna Baseus 20 Ah | 1 | `centro_powerbank` |
| Nodo demo | Base TTGO | 1 | `nodo_base` |
| Nodo demo | Tapa abierta | 1 | `nodo_tapa` |
| Nodo demo | Placa universal de batería | 1 | `bateria_placa` |
| Nodo campo | Bandeja interna Hammond IP68 | 1 | `nodo_bandeja_ip68` |

Cada nombre existe en `exports/stl/` y `exports/3mf/`. Los 3MF contienen la
geometría; el perfil del laminador se define según la impresora disponible.

## Perfil inicial

- PETG para piezas finales; PLA solo para pruebas de ajuste interiores.
- Boquilla 0,4 mm; capa 0,20 mm; 3 perímetros; 20–25 % gyroid.
- 5 capas superiores e inferiores para marco y pies.
- Sin soportes con la orientación exportada.
- Compensación de elephant foot: 0,15–0,20 mm si está disponible.
- No escalar los modelos en el laminador.

## Orden recomendado

1. Imprimir `pantalla_pie` una vez y probar el canal con una tira de 3,2 mm.
2. Confirmar etiqueta/cotas de pantalla; imprimir `pantalla_marco`.
3. Imprimir `centro_bandeja` y verificar carcasa RPi4, USB, HDMI y SMA.
4. Comprar la batería elegida y la caja Hammond.
5. Imprimir `nodo_bandeja_ip68`; presentar piezas sin batería conectada.
6. Solo después imprimir el resto del kit.

## Montaje y pruebas

- M3 con arandela para pantalla y caja Hammond; no sobreapretar plástico/PCB.
- Separadores de 12–18 mm entre marco de pantalla y bandeja de electrónica.
- Velcro de 15–20 mm; una correa por componente en el nodo.
- Mantener radios suaves en HDMI, USB y coaxial; ningún cable sostiene peso.
- Ensayo térmico de dos horas con WiFi/LoRa activos.
- Ensayo de autonomía completo y registro de reinicios/bajo voltaje.
- Ensayo de salpicadura solo con la caja comercial cerrada y electrónica de
  prueba. Perforar la caja puede invalidar su grado IP si el pasamuros no sella.

Los modelos son manifold e imprimibles, pero aún no tienen ajuste físico
verificado ni certificación de impacto, fuego o estanqueidad.
