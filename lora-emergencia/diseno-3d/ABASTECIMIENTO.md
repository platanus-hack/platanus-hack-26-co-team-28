# Abastecimiento y compatibilidad

Investigación cerrada el **23 de agosto de 2026**. Precio y stock pueden cambiar;
las cotas y parámetros eléctricos se enlazan a fabricante siempre que existe.

## Compra recomendada

### Un centro maestro

| Cant. | Componente exacto o especificación | Decisión |
|---:|---|---|
| 1 | Raspberry Pi 4 Model B existente | Reutilizar |
| 1 | [Carcasa oficial Raspberry Pi 4](https://www.raspberrypi.com/products/raspberry-pi-4-case/) | Comprar si la Pi sigue expuesta |
| 1 | [Ventilador oficial para esa carcasa](https://www.raspberrypi.com/products/raspberry-pi-4-case-fan/) | Comprar; incluye disipador 18 × 18 × 10 mm |
| 1 | Pantalla existente, candidata [Waveshare 7inch HDMI LCD (C)](https://www.waveshare.com/wiki/7inch_HDMI_LCD_%28C%29) | Reutilizar; confirmar etiqueta trasera |
| 1 | TTGO T3 V1.6.1 maestro existente | Reutilizar |
| 1 | [Baseus Adaman 65 W, 20.000 mAh](https://www.baseus.com/products/adaman-power-bank-65w-20000mah) | Candidato principal: 74 Wh, 154 × 65 × 27 mm, USB-C 5 V/3 A |
| 1 | Cable USB-C a USB-C de 3 A, 0,3–0,5 m | Power bank → Raspberry |
| 1 | Cable micro-HDMI macho a HDMI macho, 0,3–0,5 m | Raspberry → pantalla |
| 2 | Cable USB-A a micro-USB **de datos**, corto | Pantalla táctil y TTGO serie |
| 4 | Correas de velcro 15–20 mm | Dos para Pi, dos para power bank |
| 4 | M3 × 12 + arandela; 4 separadores M3 de 12–18 mm | Pantalla y bandeja |

La Raspberry Pi 4 requiere una fuente recomendada de 3 A y admite hasta 1,2 A
totales para periféricos USB. La pantalla declara 500 mA; por eso la validación
eléctrica de pantalla + TTGO es obligatoria.

### Cada nodo de campo

| Cant. | Componente exacto o especificación | Decisión |
|---:|---|---|
| 1 | [TTGO T3 LoRa32 V1.6.1 915 MHz](https://lilygo.cc/products/lora3) | Placa existente; SMA estándar |
| 1 | [Hammond 1554F2GYCL](https://www.hammfg.com/part/1554F2GYCL) | Policarbonato IP68, 119 × 89 × 61 mm, tapa transparente |
| 1 | [Amphenol 095-902-569-006](https://www.amphenolrf.com/en-us/part/095-902-569-006/9316/) | SMA 50 Ω, RG-316, 153 mm, pasamuros IP67 |
| 1 | Antena 915 MHz incluida por LILYGO | Se conecta al pasamuros; nunca transmitir sin antena |
| 1 | [LiPo protegida 2.000 mAh](https://www.adafruit.com/product/2011) **o** [Li-ion protegida 4.400 mAh](https://www.adafruit.com/product/354) | Compacta 60 × 36 × 7 mm o extendida 69 × 37 × 18 mm |
| 1 | Pigtail JST-GH 1,25 mm incluido con TTGO | Adaptar a batería; verificar polaridad |
| 2 | Correas de velcro 10–15 mm | Una TTGO, una batería |
| 4 | M3 × 8 mm | Bandeja a insertos internos Hammond |
| 1 | Prensaestopa IP68 adicional, si se agrega cable externo | Dimensionar al cable real; preferir ningún cable |

## Por qué se seleccionó así

### Pantalla

La foto coincide en orejas verdes, HDMI/USB laterales y proporción con la
Waveshare C. El fabricante indica panel de 164,9 × 106,96 × 8 mm, 2,5 W, 5 V y
500 mA; el dibujo mecánico amplía la envolvente con PCB/orejas a 164,9 × 124,27
mm. El marco usa ranuras para tolerancia, pero la etiqueta sigue siendo la prueba
definitiva de revisión.

### Raspberry y refrigeración

Usar la carcasa y el ventilador oficiales convierte la Pi en un submódulo
protegido, con flujo probado de hasta 1,4 CFM. La bandeja impresa lo sujeta con
correas y no comprime directamente la PCB.

### Energía del nodo

LILYGO dice expresamente que T3 V1.6.1 **no tiene BMS** y exige batería con
protección. También especifica 3,7 V y carga de 500 mA. Las dos baterías elegidas
incorporan protección; la de 4.400 mAh admite carga lenta a 500 mA.

Los conectores no coinciden: Adafruit usa JST-PH 2,0 mm y LILYGO JST-GH 1,25 mm.
No forzar ni invertir un conector. Empalmar el pigtail suministrado, aislar cada
conductor y verificar con multímetro positivo/negativo antes de enchufar.

### Protección de campo

La Hammond mantiene un grado IP real y ofrece insertos M3. El pasamuros Amphenol
evita transferir palanca de la antena al SMA de la placa. Una carcasa FDM abierta
se conserva únicamente para mesa/demo.

## Disponibilidad observada

- Adafruit: baterías de 2.000 y 4.400 mAh figuraban disponibles al consultar.
- Hammond: la referencia tiene distribución por DigiKey/Mouser; el fabricante
  publica dibujo, STEP/IGES y repuestos de junta/tornillos.
- Baseus: la referencia exacta puede variar por país; si no está disponible,
  aceptar solo un reemplazo de 20.000 mAh con salida USB-C sostenida de 5 V/3 A,
  tres salidas y dimensiones medidas antes de imprimir la cuna.
- Baterías enviadas internacionalmente pueden tener restricciones. Priorizar un
  proveedor local que declare **PCM/BMS**, voltaje, medidas y polaridad.

## No comprar todavía

- Baterías sin ficha, celdas 18650 sueltas o paquetes sin protección.
- Conectores “JST” sin indicar familia y paso.
- Antena RP-SMA: la selección es SMA estándar de 50 Ω.
- Una segunda caja impresa “impermeable”; duplica trabajo y no prueba IP.
- GPS físico para el nodo: el flujo actual acepta ubicación del celular y no
  requiere rastreo continuo.

## Criterio para aceptar sustitutos

1. Igual voltaje y corriente, nunca solo “mismos watts”.
2. Medidas documentadas y tolerancia de al menos 0,7 mm por lado en CAD.
3. Batería 1S protegida y polaridad verificada.
4. Radio/antena 915 MHz, 50 Ω y SMA estándar.
5. Caja de campo con certificación IP del fabricante, no del vendedor.
6. Cable USB de datos cuando transporta táctil o serial; uno de carga no basta.
