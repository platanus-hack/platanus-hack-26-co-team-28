# Diseño 3D · sistema físico WOKI

Kit mecánico del centro LoRa y los nodos de campo. La carpeta contiene archivos
STL/3MF, fuente OpenSCAD, cotas, lista de compra y pruebas pendientes.

## Qué se fabrica

- **Centro maestro:** marco y pies para la pantalla, bandeja de servicio para
  Raspberry Pi 4 + TTGO maestro y cuna del power bank.
- **Nodo demo:** base, tapa abierta y placa universal de batería.
- **Nodo de campo:** bandeja interna para una caja comercial Hammond IP68. La
  caja sellada no se imprime: eso evita afirmar resistencia al agua sin ensayos.

La selección no imprimible y sus fuentes están en
[`ABASTECIMIENTO.md`](ABASTECIMIENTO.md). La arquitectura está en
[`MODULOS.md`](MODULOS.md) y el dictamen de suficiencia en
[`VERIFICACION.md`](VERIFICACION.md).

## Ver el inventario

```bash
python3 -m http.server 8090 --directory lora-emergencia/diseno-3d
```

Abre <http://localhost:8090> o la copia pública:
<https://woki-lora-enclosures.vercel.app>.

Cada tarjeta permite abrir la pieza en un visor 3D. Dentro del modal se puede
rotar arrastrando, acercar con la rueda o un pellizco, desplazar con clic derecho
o dos dedos y recuperar el encuadre con **Reiniciar vista**. El visor carga los
STL y Three.js desde esta misma carpeta, sin depender de un CDN o de Internet.

## Generar y validar

```bash
cd lora-emergencia/diseno-3d
make all
make validate
make previews
```

OpenSCAD genera ocho geometrías distintas; `pantalla_pie` se imprime dos veces.
Cada pieza tiene STL y 3MF. El validador comprueba dimensiones, componentes y
aristas manifold sin dependencias externas de Python.

## Estado de certeza

- Raspberry Pi 4 y TTGO T3 V1.6.1: hardware confirmado.
- Pantalla: coincidencia visual fuerte con Waveshare 7inch HDMI LCD (C); el CAD
  usa el dibujo oficial y ranuras de tolerancia, pero falta leer la etiqueta
  trasera de la unidad real antes de imprimir el marco definitivo.
- Energía del nodo: solo batería 1S protegida; el TTGO no incorpora BMS.
- Uso con lluvia: caja comercial IP68 + bandeja interna impresa.
- Ningún ajuste se considera validado hasta imprimirlo contra el hardware real.
