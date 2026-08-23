// Piezas de interfaz compartidas por el dashboard (app.js) y la vista de
// operador de recurso (grua.js). Vive aparte para que el feedback de un botón
// sea IGUAL en las 2 pantallas: antes cada archivo tenía su propia versión y
// unos botones decían "Enviando…", otros solo se apagaban y otros no daban
// ninguna señal.

// Feedback de "botón trabajando" para cualquier acción que sale por la red.
// Hace 3 cosas: deshabilita el botón, cambia su texto y marca aria-busy.
// - deshabilitar es el candado contra el doble envío: el navegador no dispara
//   click en un botón deshabilitado.
// - el texto le dice a la persona que su toque SÍ quedó registrado. Esto
//   importa por radio LoRa, donde una respuesta tarda segundos.
// - aria-busy se lo anuncia a un lector de pantalla.
// Al terminar deja el botón como estaba, salga bien o mal (finally). Devuelve
// lo que devuelva `accion`.
window.conBoton = async function conBoton(button, textoOcupado, accion) {
  if (!button) return accion();
  const original = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = textoOcupado;
  try {
    return await accion();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = original;
  }
};
