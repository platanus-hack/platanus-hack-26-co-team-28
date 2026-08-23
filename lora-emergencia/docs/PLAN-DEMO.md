# Plan del demo · OS de emergencias offline

**Duración objetivo:** 3 minutos.
**Setup:** 2 placas físicas (rescatista + centro) + operador de grúa simulado (`/grua`).
**Mensaje al jurado:** funciona **sin internet** (radio LoRa) **y** coordina como **Uber**
(la solicitud llega al operador correcto y se acepta como un viaje).

---

## 1. Qué pantallas mostrar (priorizado para wow + claridad)

Con 2 placas + grúa simulada, la historia se cuenta con **2 pantallas protagonistas**,
1 de entrada y las OLED como prueba física. No muestres todo a la vez: satura.

| Prioridad | Pantalla | Dónde | Para qué |
|---|---|---|---|
| **1. Principal** | **Dashboard del centro** (`http://localhost:8080`) | Proyector / monitor grande | Es el cerebro visible. Aparece el pin con prioridad, y el feed **"Red LoRa en vivo"** muestra cada mensaje cruzando con su RSSI. Aquí se ve la claridad. |
| **2. Wow** | **App del operador** (`/grua`) | Tablet o 2da laptop, visible al público | El momento Uber: aparece la solicitud y el operador toca **"Aceptar el viaje"**. |
| **3. Entrada** | **Celular del rescatista** | En mano o cámara cenital | El gancho humano: una persona pide ayuda y da su GPS, sin app. |
| **4. Prueba física** | **OLED de las 2 placas** | Sobre la mesa | Muestran `LINK OK` y el RSSI. Demuestran que es hardware real y offline. Se señalan al inicio y al cierre. |

**El pico (wow moment):** cuando el operador toca **"Aceptar el viaje"** en `/grua` y, en
el mismo instante, el dashboard del centro cambia el estado a **ACEPTADA** y el feed muestra
`Grúa → Centro  ACC`. Todo con los teléfonos en modo avión.

---

## 2. Guion minuto a minuto

**0:00 · Gancho (sin internet)**
Muestra las 2 placas con OLED `LINK OK`. "Terremoto. La red celular cayó. Esto es una malla
de radio LoRa: sin internet, sin celular." Pon los teléfonos en **modo avión** a la vista.

**0:30 · El civil pide ayuda (celular real)**
El celular se conecta al WiFi **`AYUDA_AQUI_RESCATISTA_911`**. El portal **abre solo**. El
rescatista toca **"Rescate: hay atrapados"** y autoriza el **GPS**. "Una persona atrapada, aquí."

**1:00 · Llega al centro por radio**
En el dashboard aparece el **pin** con **prioridad 0 (crítico)**. En el feed:
`Rescatista → Centro  SOS  RSSI -XX`. "Llegó por radio. Sin una barra de señal."

**1:30 · El centro despacha**
El operador del centro toca **"Asignar recurso"** → **GRUA07**. Feed: `Centro → Grúa  DISP`.

**1:45 · WOW: la grúa acepta (estilo Uber)**
En la app del operador (`/grua`) aparece la solicitud con su ubicación. El operador toca
**"Aceptar el viaje"**. Feed: `Grúa → Centro  ACC`. El dashboard cambia a **ACEPTADA** en vivo.

**2:15 · Cierra el ciclo**
El operador toca **"Voy en camino"** → **"Rescate resuelto"**. La solicitud pasa a **RESUELTA**
en el dashboard. El pin se cierra.

**2:30 · Cierre**
"Todo este ciclo ocurrió sin internet. Un OS de emergencias que reemplaza el caos por
coordinación." Señala las OLED: siguen en `LINK OK`.

---

## 3. Plan B (por si el portal falla en vivo)

El celular real es lo más potente, pero el portal cautivo depende del teléfono. Ten listos:

1. **iPhone de respaldo:** su portal (CNA) es más predecible que Android. Ten uno probado.
2. **Sin GPS igual sirve:** el portal permite reportar por **nombre de lugar** (campo de texto).
   Si el permiso de GPS falla en escena, el demo sigue con la ubicación escrita.
3. **Respaldo de entrada:** si el portal no abre en ningún teléfono, ten la vista `/grua` y el
   dashboard listos para narrar el ciclo desde el despacho. (Opcional: un disparo de SOS por
   placa como último recurso.)

Regla de oro Android: en el teléfono de prueba, **"Olvidar la red"** antes del demo y **apagar
los datos móviles**. El portal solo abre solo la primera vez que ve la red como portal cautivo.

---

## 4. Checklist previo (antes de subir a tarima)

- [ ] Rescatista (`43461`) flasheado con **`nodo_portal_https`** (hoy tiene `range_movil`; hay que reflashear).
- [ ] Centro (`68871`) flasheado con **`gateway_bidir`**. ✅ (ya está)
- [ ] `credentials.h` presente en `nodo_portal_https/` para compilar el rescatista.
- [ ] `center.py` corriendo, conectado al gateway. Dashboard en el proyector.
- [ ] `/grua` abierto en el 2do dispositivo. Tocar **"Conectar mi grúa"** para entrar en servicio.
- [ ] Celular de prueba: red olvidada, datos móviles **apagados**, **ubicación encendida**.
- [ ] Placas cargadas o con powerbank. Antenas enroscadas (nunca energizar sin antena).
- [ ] Ensayo completo una vez, cronometrado.

---

## 5. Reparto de roles (equipo)

- **Narrador:** cuenta la historia y maneja el dashboard del centro.
- **Rescatista:** opera el celular que pide ayuda.
- **Operador de grúa:** maneja la vista `/grua` y hace el "Aceptar el viaje".
- **Soporte técnico:** vigila que las placas y `center.py` sigan vivos; ejecuta el plan B.

---

## 6. Frase de cierre sugerida

> "En un terremoto, la primera víctima es la comunicación. Nuestro sistema la devuelve:
> pedir ayuda, ver el mapa y coordinar el rescate, todo por radio, sin una sola barra de señal.
> No es una app más. Es el sistema operativo de la emergencia."
