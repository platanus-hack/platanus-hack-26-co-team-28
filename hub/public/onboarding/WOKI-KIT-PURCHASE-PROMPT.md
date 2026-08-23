# Copiloto de compra del kit WOKI

Ayúdame a comprar el kit WOKI cerca de mi ubicación. Debes investigar en la web en tiempo real,
comparar disponibilidad y precios actuales, y devolver una recomendación verificable. No inventes
productos, tiendas, stock, precios, distancias ni URLs.

Responde siempre en español. Conserva los nombres comerciales originales de productos y tiendas
cuando sea necesario para encontrarlos.

Repositorio y fuentes técnicas:

- <https://github.com/platanus-hack/platanus-hack-26-co-team-28>
- `lora-emergencia/docs/HARDWARE.md`
- `lora-emergencia/diseno-3d/ABASTECIMIENTO.md`
- `lora-emergencia/diseno-3d/IMPRESION.md`

## Primero pregúntame

Haz una sola pregunta inicial:

**¿En qué país, ciudad y código postal o barrio estás, y prefieres retiro local, envío o ambos?**

No solicites una dirección exacta. Infiere la moneda oficial del país y confírmala antes de
presentar precios. Si prefiero otra moneda, muestra ambas e indica la tasa y fecha de conversión.

## Alcance de la compra

Separa la búsqueda en tres niveles para evitar compras innecesarias.

### 1. Kit mínimo funcional

- 2 × LilyGO TTGO LoRa32 T3 V1.6.1, banda 915 MHz.
- 2 × antena 915 MHz, 50 Ω, SMA estándar; confirmar si ya vienen incluidas.
- 2 × cable micro-USB de datos.
- 1 × laptop macOS o Linux: priorizar reutilizar, no comprar automáticamente.
- 1 × celular: priorizar reutilizar, no comprar automáticamente.

### 2. Centro autónomo recomendado

- Raspberry Pi 4 Model B: reutilizar si ya existe.
- Carcasa oficial Raspberry Pi 4 y ventilador compatible.
- Pantalla candidata Waveshare 7inch HDMI LCD (C); confirmar revisión y medidas.
- Power bank de 20.000 mAh con salida USB-C sostenida de 5 V/3 A.
- Cable USB-C a USB-C de 3 A, 0,3–0,5 m.
- Cable micro-HDMI macho a HDMI macho, 0,3–0,5 m.
- 2 × cable USB-A a micro-USB de datos, cortos.
- Correas de velcro de 15–20 mm, tornillos M3 × 12, arandelas y separadores M3.

### 3. Cada nodo de campo protegido

- 1 × TTGO T3 LoRa32 V1.6.1 915 MHz.
- 1 × caja Hammond 1554F2GYCL o alternativa realmente compatible.
- 1 × pasamuros Amphenol 095-902-569-006, SMA 50 Ω, RG-316, IP67, o equivalente validado.
- 1 × batería 1S de 3,7 V con PCM/BMS: 2.000 mAh o 4.400 mAh.
- Pigtail JST-GH 1,25 mm; advertir que muchas baterías usan JST-PH 2,0 mm.
- Correas de velcro de 10–15 mm y 4 × tornillos M3 × 8 mm.
- Prensaestopa IP68 solo si se agregará un cable externo.

Las piezas impresas están en <https://woki-lora-enclosures.vercel.app>. No cotices una carcasa
FDM como si tuviera certificación IP; la protección de campo usa una caja comercial.

## Reglas de compatibilidad

Rechaza o marca como incompatible cualquier opción que incumpla:

- Radio distinta de 915 MHz.
- Antena RP-SMA, 433 MHz o 868 MHz.
- TTGO de otra revisión sin demostrar pines y medidas compatibles.
- Cable micro-USB que sea solo de carga.
- Batería 1S sin PCM/BMS, voltaje, medidas o polaridad declarados.
- Conector anunciado solo como “JST” sin familia y paso.
- Power bank que no entregue 5 V/3 A de forma sostenida.
- Caja “impermeable” sin certificación del fabricante.

No aceptes una alternativa solamente porque se parece o porque coincide la potencia en watts.
Valida voltaje, corriente, frecuencia, conector, dimensiones y protección.

## Búsqueda y disponibilidad

- Busca primero tiendas físicas o distribuidores autorizados cercanos.
- Después compara tiendas nacionales con envío y marketplaces confiables.
- Usa páginas de producto directas, no páginas de resultados de búsqueda.
- Verifica stock en la página actual y registra fecha y hora de consulta.
- Excluye de la tabla de compra productos agotados, descontinuados, en preventa o backorder.
- Si el stock es ambiguo, colócalo aparte como **No verificado**, nunca como disponible.
- Para marketplaces, identifica al vendedor y evita publicaciones sin ficha técnica.
- Considera restricciones locales para envío de baterías de litio.

## Precios

- Usa la moneda local de mi país.
- Conserva también el precio original cuando sea otra moneda.
- Separa precio unitario, envío, impuestos conocidos y total estimado entregado.
- Indica la fecha y fuente de cualquier conversión.
- No presentes el total como exacto si faltan impuestos o transporte.

## Respuesta obligatoria

Empieza con un resumen breve de qué puedo reutilizar y qué necesito comprar. Después entrega esta
tabla, ordenada por prioridad y luego por menor costo total/menor distancia:

| Prioridad | Cant. | Producto exacto | Por qué es necesario | Compatibilidad clave | Tienda | Local/online | Distancia o entrega | Precio unitario local | Envío/impuestos | Subtotal estimado | Stock verificado | URL directa | Observaciones |
|---|---:|---|---|---|---|---|---|---:|---:|---:|---|---|---|

Incluye solamente productos disponibles y compatibles. Luego agrega:

1. **Alternativas compatibles:** máximo dos por producto, con la diferencia importante.
2. **No verificados:** enlaces útiles cuyo stock o compatibilidad no pudiste confirmar.
3. **Totales:** kit mínimo, Centro recomendado y costo adicional por nodo de campo.
4. **Antes de pagar:** frecuencia 915 MHz, SMA estándar, USB de datos, batería protegida y
   dimensiones de las piezas.

Sé breve en las descripciones, cita las fuentes junto a cada afirmación y aclara cuándo un dato es
estimado. No completes la compra ni envíes datos personales: prepara la lista para mi aprobación.
