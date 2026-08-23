/*
 * WOKI · módulos mecánicos v0.3
 *
 * Geometría paramétrica para el prototipo físico:
 *   centro_bandeja Bandeja Raspberry Pi 4 + dock TTGO maestro
 *   nodo_base      Base del TTGO esclavo
 *   nodo_tapa      Tapa ventilada del TTGO esclavo
 *   bateria_placa  Placa universal para batería/power bank con velcro
 *   pantalla_marco Marco trasero para Waveshare 7inch HDMI LCD (C)
 *   pantalla_pie   Pie inclinado (imprimir dos)
 *   centro_powerbank Cuna Baseus Adaman 65W 20 Ah
 *   nodo_bandeja_ip68 Bandeja interna Hammond 1554F2GYCL
 *
 * Exportar, por ejemplo:
 *   openscad -o nodo_base.stl -D 'part="nodo_base"' woki_modulos.scad
 *
 * Unidades: milímetros.
 */

$fn = 48;
part = "assembly";

// Envolventes confirmadas por fabricante.
ttgo_length = 66;
ttgo_width = 36;
ttgo_height = 15;
rpi_length = 85;
rpi_width = 56;

// Candidato de pantalla identificado por geometría y puertos. Confirmar la
// etiqueta trasera antes de montar. El patrón usa ranuras para absorber ±1 mm.
screen_full_x = 164.90;
screen_full_y = 124.27;
screen_hole_x = 148.90;
screen_hole_y = 114.96;

// Componentes comerciales seleccionados.
baseus_x = 154;
baseus_y = 65;
baseus_z = 27;
hammond_tray_x = 106;
hammond_tray_y = 75;

// Parámetros de impresión FDM.
wall = 2.4;
fit_clearance = 0.7; // por lado; revisar con test de tolerancia de la impresora
floor_h = 2.4;
corner_r = 3;

field_inner_x = ttgo_length + fit_clearance * 2;
field_inner_y = ttgo_width + fit_clearance * 2;
field_outer_x = field_inner_x + wall * 2;
field_outer_y = field_inner_y + wall * 2;
field_base_h = 20.5;

module rounded_box(size, radius = 2) {
  linear_extrude(height = size[2])
    offset(r = radius)
      square([size[0] - radius * 2, size[1] - radius * 2], center = true);
}

module slot_3d(length, width, height) {
  linear_extrude(height = height)
    hull() {
      translate([-(length - width) / 2, 0]) circle(d = width);
      translate([ (length - width) / 2, 0]) circle(d = width);
    }
}

module screw_standoff(outer_d = 6, inner_d = 2.8, height = 6) {
  difference() {
    cylinder(d = outer_d, h = height);
    translate([0, 0, -0.1]) cylinder(d = inner_d, h = height + 0.2);
  }
}

module field_base() {
  difference() {
    rounded_box([field_outer_x, field_outer_y, field_base_h], corner_r);

    // Cavidad principal; el TTGO descansa sobre dos rieles inferiores.
    translate([0, 0, floor_h])
      rounded_box([field_inner_x, field_inner_y, field_base_h + 1], 1.8);

    // Ventanas deliberadamente amplias: absorben variaciones de lote en USB/SMA.
    translate([-field_outer_x / 2 - 0.1, -(field_inner_y - 8) / 2, 5])
      cube([wall + 0.3, field_inner_y - 8, 10]);
    translate([field_outer_x / 2 - wall - 0.2, -(field_inner_y - 8) / 2, 5])
      cube([wall + 0.4, field_inner_y - 8, 12]);

    // Ventilación inferior; evita encerrar calor y deja inspeccionar la batería.
    for (x = [-21, -7, 7, 21])
      translate([x, 0, -0.1]) rotate([0, 0, 90]) slot_3d(19, 3, floor_h + 0.2);
  }

  // Rieles: soportan la PCB sin depender de las coordenadas de sus dos agujeros.
  translate([0,  field_inner_y / 2 - 1.4, floor_h]) cube([ttgo_length - 5, 2.8, 1.4], center = true);
  translate([0, -field_inner_y / 2 + 1.4, floor_h]) cube([ttgo_length - 5, 2.8, 1.4], center = true);

  // Topes cortos evitan que la placa se deslice hacia las ventanas laterales.
  for (x = [-ttgo_length / 2 + 2, ttgo_length / 2 - 2])
    for (y = [-field_inner_y / 2 + 2.1, field_inner_y / 2 - 2.1])
      translate([x, y, floor_h + 0.7]) cube([2.2, 3.2, 3], center = true);
}

module field_lid() {
  lid_top = 2.2;
  lip_h = 1.95;
  lip_outer_x = field_inner_x - 0.5;
  lip_outer_y = field_inner_y - 0.5;

  union() {
    // Marco abierto: OLED, botones y LEDs siguen visibles y accesibles.
    difference() {
      rounded_box([field_outer_x, field_outer_y, lid_top], corner_r);
      translate([0, 0, -0.1])
        rounded_box([ttgo_length - 8, ttgo_width - 8, lid_top + 0.2], 2);
    }

    // Labio de encaje con holgura FDM; se imprime orientado hacia arriba.
    translate([0, 0, lid_top - 0.15])
      difference() {
        rounded_box([lip_outer_x, lip_outer_y, lip_h], 1.6);
        translate([0, 0, -0.1])
          rounded_box([lip_outer_x - 2.8, lip_outer_y - 2.8, lip_h + 0.2], 1.1);
      }
  }
}

module ttgo_master_dock() {
  dock_x = ttgo_width + fit_clearance * 2;
  dock_y = ttgo_length + fit_clearance * 2;
  rail_h = 6.2;
  rail_t = 2.4;

  // El piso lo aporta la bandeja central; estos rieles abrazan el TTGO rotado 90°.
  for (x = [-dock_x / 2 - rail_t / 2, dock_x / 2 + rail_t / 2])
    translate([x, 0, 3]) cube([rail_t, dock_y, rail_h], center = true);
  for (y = [-dock_y / 2 - rail_t / 2, dock_y / 2 + rail_t / 2])
    translate([0, y, 3]) cube([dock_x + rail_t * 2, rail_t, rail_h], center = true);

  // Cuatro clips bajos; no cubren la antena, OLED ni conectores.
  for (x = [-dock_x / 2 + 1.8, dock_x / 2 - 1.8])
    for (y = [-dock_y / 2 + 5, dock_y / 2 - 5])
      translate([x, y, rail_h + 0.7]) cube([3.6, 8, 1.8], center = true);
}

module center_tray() {
  tray_x = 168;
  tray_y = 76;
  tray_h = 3;
  ttgo_center_x = 56;

  difference() {
    rounded_box([tray_x, tray_y, tray_h], 4);

    // Ranuras universales de montaje a la trasera de la pantalla/soporte.
    for (x = [-73, 73])
      for (y = [-31, 31])
        translate([x, y, -0.1]) rotate([0, 0, 90]) slot_3d(12, 4.5, tray_h + 0.2);

    // Ventilación bajo Raspberry Pi 4.
    for (x = [-52, -36, -20])
      translate([x, 0, -0.1]) rotate([0, 0, 90]) slot_3d(34, 4, tray_h + 0.2);

    // Dos correas sujetan la carcasa oficial de Raspberry Pi 4. También sirven
    // para una carcasa equivalente: no se atornilla directamente la PCB.
    for (x = [-63, -20])
      for (y = [-31, 31])
        translate([x, y, -0.1]) slot_3d(20, 4, tray_h + 0.2);

    // Ventilación bajo TTGO maestro.
    for (y = [-20, 0, 20])
      translate([ttgo_center_x, y, -0.1]) slot_3d(21, 3.2, tray_h + 0.2);
  }

  translate([ttgo_center_x, 0, tray_h - 0.15]) ttgo_master_dock();
}

module battery_plate() {
  plate_x = 94;
  plate_y = 58;
  plate_h = 3;

  difference() {
    rounded_box([plate_x, plate_y, plate_h], 4);

    // Dos correas de velcro de hasta 20 mm sujetan un power bank o LiPo protegido.
    for (x = [-31, 31])
      for (y = [-19, 19])
        translate([x, y, -0.1]) rotate([0, 0, 90]) slot_3d(22, 4, plate_h + 0.2);

    // Montaje del nodo a la cara opuesta mediante bridas o velcro angosto.
    for (y = [-11, 11])
      translate([0, y, -0.1]) slot_3d(47, 4, plate_h + 0.2);

    // Ventilación/inspección central.
    translate([0, 0, -0.1]) rounded_box([30, 12, plate_h + 0.2], 3);
  }
}

module screen_carrier() {
  carrier_x = 170;
  carrier_y = 129;
  carrier_h = 3.2;

  difference() {
    rounded_box([carrier_x, carrier_y, carrier_h], 4);

    // Gran ventana trasera: no toca la electrónica y mantiene ventilación.
    translate([0, 0, -0.1]) rounded_box([134, 91, carrier_h + 0.2], 5);

    // Cuatro ranuras M3 para el patrón observado de la Waveshare 7" LCD (C).
    for (x = [-screen_hole_x / 2, screen_hole_x / 2])
      for (y = [-screen_hole_y / 2, screen_hole_y / 2])
        translate([x, y, -0.1]) slot_3d(6, 3.6, carrier_h + 0.2);

    // Coincide con las ranuras de centro_bandeja. Usar separadores M4 de
    // 12–18 mm para no acercar la bandeja a la PCB del display.
    for (x = [-73, 73])
      for (y = [-31, 31])
        translate([x, y, -0.1]) rotate([0, 0, 90]) slot_3d(10, 4.5, carrier_h + 0.2);

    // Bridas de 4–5 mm para ordenar HDMI, USB táctil y alimentación.
    for (x = [-44, 0, 44])
      translate([x, -55, -0.1]) slot_3d(14, 4, carrier_h + 0.2);
  }
}

module screen_foot() {
  foot_x = 54;
  foot_y = 46;
  foot_z = 16;

  difference() {
    rounded_box([foot_x, foot_y, foot_z], 4);

    // Canal de 4,4 mm inclinado 12°: recibe el marco de 3,2 mm con holgura.
    translate([0, 0, 18]) rotate([12, 0, 0])
      cube([foot_x + 2, 4.4, 26], center = true);

    // Dos pasos de brida permiten asegurar el pie al marco para transporte.
    for (x = [-17, 17])
      translate([x, 12, -0.1]) slot_3d(12, 4, foot_z + 0.2);
  }
}

module center_powerbank_cradle() {
  clearance = 1.2;
  wall_pb = 2.4;
  plate_x = baseus_x + clearance * 2 + wall_pb * 2;
  plate_y = baseus_y + clearance * 2 + wall_pb * 2;
  plate_h = 3;
  rail_h = 7;

  difference() {
    rounded_box([plate_x, plate_y, plate_h], 4);

    // Dos bandas de velcro de hasta 20 mm. No cubrir pantalla/puertos del banco.
    for (x = [-48, 48])
      for (y = [-baseus_y / 2 + 7, baseus_y / 2 - 7])
        translate([x, y, -0.1]) rotate([0, 0, 90])
          slot_3d(22, 4, plate_h + 0.2);

    // Montaje universal al soporte o mesa.
    for (x = [-67, 67])
      translate([x, 0, -0.1]) rotate([0, 0, 90]) slot_3d(14, 4.5, plate_h + 0.2);
  }

  // Rieles largos abiertos en ambos extremos para conservar todos los puertos.
  for (y = [-plate_y / 2 + wall_pb / 2, plate_y / 2 - wall_pb / 2])
    translate([0, y, rail_h / 2]) cube([plate_x - 9, wall_pb, rail_h], center = true);
}

module node_ip68_tray() {
  tray_h = 3;

  difference() {
    rounded_box([hammond_tray_x, hammond_tray_y, tray_h], 3);

    // Patrón nominal de insertos M3 Hammond (100 × 68 mm), ranurado para
    // tolerancia. Confirmar contra la caja recibida antes de apretar.
    for (x = [-50, 50])
      for (y = [-34, 34])
        translate([x, y, -0.1]) slot_3d(5.5, 3.5, tray_h + 0.2);

    // Velcro/bridas independientes: TTGO y batería nunca comparten una correa.
    for (x = [-25, 25]) {
      for (y = [-30, -7])
        translate([x, y, -0.1]) rotate([0, 0, 90]) slot_3d(13, 4, tray_h + 0.2);
      for (y = [7, 30])
        translate([x, y, -0.1]) rotate([0, 0, 90]) slot_3d(13, 4, tray_h + 0.2);
    }

    // Inspección y ventilación debajo de ambos módulos.
    translate([0, -18.5, -0.1]) slot_3d(45, 5, tray_h + 0.2);
    translate([0,  18.5, -0.1]) slot_3d(45, 5, tray_h + 0.2);
  }

  // Separador central bajo; evita contacto entre la batería y la PCB.
  translate([0, 0, tray_h + 1]) cube([73, 2.2, 2], center = true);

  // Topes bajos de extremos; no aprietan ni comprimen la batería.
  for (x = [-36, 36]) {
    translate([x, -18.5, tray_h + 1]) cube([2.2, 31, 2], center = true);
    translate([x,  18.5, tray_h + 1]) cube([2.2, 32, 2], center = true);
  }
}

module assembly_preview() {
  translate([-190, 35, 0]) center_tray();
  translate([0, 45, 0]) screen_carrier();
  translate([125, 42, 0]) center_powerbank_cradle();
  translate([-165, -75, 0]) field_base();
  translate([-75, -75, 0]) field_lid();
  translate([20, -75, 0]) battery_plate();
  translate([125, -75, 0]) node_ip68_tray();
  translate([215, -75, 0]) screen_foot();
}

if (part == "centro_bandeja") center_tray();
else if (part == "nodo_base") field_base();
else if (part == "nodo_tapa") field_lid();
else if (part == "bateria_placa") battery_plate();
else if (part == "pantalla_marco") screen_carrier();
else if (part == "pantalla_pie") screen_foot();
else if (part == "centro_powerbank") center_powerbank_cradle();
else if (part == "nodo_bandeja_ip68") node_ip68_tray();
else assembly_preview();
