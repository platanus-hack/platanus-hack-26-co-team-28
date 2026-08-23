// Personas a cargo de cada unidad. Fuente unica de verdad: la carga el
// dashboard (app.js) y la vista de operador (grua.js). Antes el nombre vivia
// duplicado en los 2 archivos y podian quedar desincronizados.
//
// `nombre` es quien conduce o atiende la unidad. `rol` describe el puesto y se
// muestra bajo el nombre. `sembrado` marca las unidades de relleno del demo,
// frente a GRUA07, que es la unidad del guion.
//
// Ninguna de estas unidades tiene una placa LoRa propia: todas se operan desde
// su vista (/grua?nodo=NODO), que inyecta los frames ACC/ST por el simulador
// del centro. El unico enlace de radio real del demo es el nodo del ciudadano
// (a3f21c) hacia el gateway del centro.
window.OPERADORES = {
  GRUA07:    { nombre: "Manuel Vargas",   rol: "Conductor de grúa",     sembrado: false },
  MEDICO01:  { nombre: "Camila Rojas",    rol: "Paramédica",            sembrado: true },
  MEDICO02:  { nombre: "Andrés Beltrán",  rol: "Paramédico",            sembrado: true },
  RESCATE01: { nombre: "Daniela Quintero", rol: "Jefa de rescate",      sembrado: true },
  RESCATE02: { nombre: "Iván Cárdenas",   rol: "Rescatista",            sembrado: true },
  FUEGO01:   { nombre: "Laura Peña",      rol: "Bombera",               sembrado: true },
  AGUA01:    { nombre: "Óscar Villamil",  rol: "Técnico de agua",       sembrado: true },
};

// Un nodo que no este en la tabla (ej. una placa nueva que aparezca por radio)
// se identifica por su nombre de nodo y se trata como sembrado.
window.operadorDe = function operadorDe(node) {
  return window.OPERADORES[node] || { nombre: node, rol: "Unidad sin registrar", sembrado: true };
};
