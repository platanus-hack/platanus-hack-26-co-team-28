# Portal cautivo AYUDA · flujo e2e y verdad sobre el GPS

Este documento describe el flujo completo del portal cautivo del ESP32, por
sistema operativo, desde que el telefono se conecta a la red WiFi `AYUDA`
hasta que captura el GPS. Incluye la tabla `ruta -> respuesta` que el firmware
debe implementar, la verdad honesta sobre `navigator.geolocation` en el
navegador cautivo de cada SO, y como correr el validador.

Dominio del portal HTTPS: `ayuda.homiapp.xyz` con cert Let's Encrypt valido.
IP del ESP32 en la red: `192.168.4.1`. El DNS cautivo resuelve todo a esa IP.

Firmware de referencia: `nodo_portal_https/nodo_portal_https.ino`.

---

## 1. Flujo e2e por sistema operativo

### 1.1 Android

Android detecta el portal con un sondeo HTTP. La URL por defecto es
`http://connectivitycheck.gstatic.com/generate_204` (fuente AOSP,
`DEFAULT_CAPTIVE_PORTAL_HTTP_URL`). El DNS cautivo la resuelve a `192.168.4.1`.

Pasos:

1. El telefono se conecta a la red `AYUDA`.
2. Android hace `GET http://connectivitycheck.gstatic.com/generate_204`.
   - Con internet real: espera `HTTP 204` sin body.
   - Contra el ESP32: recibe `HTTP 302` (o `200` con body). Como no es `204`,
     Android marca "Iniciar sesion en la red" y abre `CaptivePortalLogin`.
3. `CaptivePortalLogin` sigue el `302` y carga la landing HTTP, luego el portal
   HTTPS `https://ayuda.homiapp.xyz/` con cert valido.
4. El portal HTTPS muestra el boton "PEDIR AYUDA". El usuario toca el boton.
5. Aqui hay un limite: `CaptivePortalLogin` es un WebView del sistema, no
   Chrome. `navigator.geolocation.getCurrentPosition()` NO dispara el callback
   de exito. Ver seccion 3.
6. Para capturar GPS, el usuario sale a Chrome real con el enlace `intent://`
   de la landing, o con el menu de 3 puntos "Abrir en navegador". En Chrome
   real, con HTTPS valido, el prompt de ubicacion aparece y el GPS funciona.

URLs de sondeo Android y respuesta de exito (internet real):

| URL de sondeo | Respuesta de exito |
|---|---|
| `http://connectivitycheck.gstatic.com/generate_204` | `HTTP 204` sin body |
| `http://www.google.com/generate_204` | `HTTP 204` sin body |
| `http://www.google.com/gen_204` | `HTTP 204` sin body |
| `http://clients3.google.com/generate_204` | `HTTP 204` sin body |
| `http://connectivitycheck.android.com/generate_204` | `HTTP 204` sin body |
| `http://play.googleapis.com/generate_204` | `HTTP 204` sin body |
| `https://www.google.com/generate_204` | `HTTP 204` sobre TLS valido de google.com |

El sondeo HTTPS `https://www.google.com/generate_204` falla el TLS contra el
ESP32, porque el ESP32 presenta el cert de `ayuda.homiapp.xyz`, no de
`www.google.com`. Android trata ese fallo como "sin validacion" y decide el
estado del portal con el sondeo HTTP. Dejar que falle el TLS es correcto.

### 1.2 iOS

iOS detecta el portal con `http://captive.apple.com/hotspot-detect.html`. El
DNS cautivo la resuelve a `192.168.4.1`.

Pasos:

1. El telefono se conecta a la red `AYUDA`.
2. iOS hace `GET http://captive.apple.com/hotspot-detect.html`.
   - Con internet real: espera `HTTP 200` con body exacto
     `<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>`
     (unos 69 bytes).
   - Contra el ESP32: recibe `HTTP 200` con un body que NO contiene `Success`
     (la landing). Como falta `Success`, iOS abre el CNA (Captive Network
     Assistant).
3. El CNA muestra la landing. La landing instruye salir a Safari.
4. Limite: el CNA es un WebKit recortado, no Safari.
   `navigator.geolocation` esta bloqueado. `getCurrentPosition` no muestra el
   prompt y expira o da error. Aplica en iOS 15, 16, 17. Ver seccion 3.
5. Para capturar GPS, el usuario sale del CNA. Toca "Cancelar" y elige "Usar
   sin conexion". Esto deja el WiFi conectado sin reabrir el CNA. Luego abre
   Safari a mano y entra a `ayuda.homiapp.xyz` o a `192.168.4.1`.
6. Safari carga `https://ayuda.homiapp.xyz/` (DNS cautivo -> `192.168.4.1`,
   cert valido). El prompt nativo de ubicacion aparece y el GPS funciona.

En iOS no existe URL scheme fiable que abra Safari desde dentro del CNA.
`intent://` no funciona en iOS. Hay que instruir al usuario.

URLs de sondeo iOS y respuesta de exito (internet real):

| URL de sondeo | Respuesta de exito |
|---|---|
| `http://captive.apple.com/hotspot-detect.html` | `HTTP 200`, body `...Success...` |
| `http://www.apple.com/library/test/success.html` | `HTTP 200`, body `...Success...` |
| `https://captive.apple.com/hotspot-detect.html` | `HTTP 200` sobre TLS de captive.apple.com |

El sondeo HTTPS a `captive.apple.com` falla el TLS por mismatch de hostname
(el cert es de `ayuda.homiapp.xyz`). iOS lo toma como "sin internet" y usa el
sondeo HTTP para abrir el CNA. No sirvas `Success` por HTTPS a este host.

### 1.3 Windows (contexto)

Windows sondea `http://www.msftconnecttest.com/connecttest.txt` (body de exito
`Microsoft Connect Test`) y `http://www.msftncsi.com/ncsi.txt` (body de exito
`Microsoft NCSI`). El ESP32 responde con un body distinto o un `302`, y Windows
abre el portal.

---

## 2. Tabla ruta -> respuesta que el firmware debe implementar

Esta tabla alinea el `.ino`. El servidor HTTP escucha en el puerto 80 y el
HTTPS en el 443. El HTTP siempre empuja al HTTPS. El HTTPS nunca redirige.

| Ruta (HTTP :80) | Respuesta | Razon |
|---|---|---|
| `GET /generate_204` | `302 Found`, `Location: https://ayuda.homiapp.xyz/`, `Content-Length: 0` | Nunca `204`. Un `302` marca portal presente y abre `CaptivePortalLogin`. |
| `GET /gen_204` | `302 Found`, `Location: https://ayuda.homiapp.xyz/`, `Content-Length: 0` | Variante corta del sondeo Android. Mismo trato. |
| `GET /hotspot-detect.html` | `200 OK`, `text/html`, landing con meta-refresh a `https://ayuda.homiapp.xyz/` | El body NO debe contener `Success`. Fuerza a iOS a abrir el CNA. |
| `GET /library/test/success.html` | `200 OK`, landing (igual que hotspot-detect) | Sonda secundaria de Apple. Nunca devolver `Success`. |
| `GET /ncsi.txt` | `302 Found`, `Location: https://ayuda.homiapp.xyz/`, `Content-Length: 0` | Sondeo Windows NCSI. No devolver `Microsoft NCSI`. |
| `GET /connecttest.txt` | `302 Found`, `Location: https://ayuda.homiapp.xyz/`, `Content-Length: 0` | Sondeo Windows 10/11. No devolver `Microsoft Connect Test`. |
| `GET /redirect` | `302 Found`, `Location: https://ayuda.homiapp.xyz/` | Ruta de redirect de Windows. Empuja al portal. |
| `GET /canonical.html` | `302 Found`, `Location: https://ayuda.homiapp.xyz/` | Sondeo de Firefox. Empuja al portal. |
| `GET /*` (catch-all) | `302 Found`, `Location: https://ayuda.homiapp.xyz/` (o `200` landing) | Cualquier ruta desconocida abre el portal. Nunca `404`. |
| `GET /` (landing) | `200 OK`, `text/html`, landing con meta-refresh + `location.replace` + enlace `intent://` a Chrome + texto "Abrir en Safari" | Punto de transicion. Debe ofrecer salida al navegador real. |

| Ruta (HTTPS :443) | Respuesta | Razon |
|---|---|---|
| `GET /*` | `200 OK`, `text/html`, `PAGE_HTTPS` con `navigator.geolocation`, cert LE valido, SIN cabecera `Strict-Transport-Security` | Contexto seguro. Aqui llega el usuario. Todo recurso embebido, cero URLs externas. |
| `POST /report` | `200 OK`, `application/json {"ok":true}` | Endpoint de datos del ciudadano. Handler exacto antes del catch-all. |

Reglas de orden en `esp_http_server`: registra PRIMERO los handlers exactos y
el catch-all `/*` de ULTIMO. Sube `config.max_uri_handlers` a `>=16`. El HTTP
:80 SIEMPRE empuja al HTTPS. El HTTPS :443 NUNCA redirige. No mandes HSTS.

---

## 3. Verdad honesta sobre geolocation en el navegador cautivo

El cert HTTPS resuelve la APERTURA del portal y el contexto seguro. El cert NO
resuelve el GPS. El GPS se bloquea por el navegador host, no por el cert.

### Android

El portal se abre en `CaptivePortalLogin`, un WebView del sistema, no Chrome.
Fuente AOSP `CaptivePortalLoginActivity.java`: su `MyWebChromeClient` solo
implementa `onProgressChanged`. NO implementa
`onGeolocationPermissionsShowPrompt`. Ademas el manifest de
`CaptivePortalLogin` no declara `ACCESS_FINE_LOCATION` ni
`ACCESS_COARSE_LOCATION`. Sin ese handler y sin ese permiso, el WebView niega
la geolocalizacion en silencio. `getCurrentPosition()` nunca dispara el
callback de exito. El error da `code 1` (PERMISSION_DENIED) o nunca vuelve.
Esto pasa AUNQUE la pagina sea HTTPS con cert valido.

Como llegar a un contexto que SI funciona en Android:

1. Enlace `intent://` en la landing que lanza Chrome real.
   `CaptivePortalLoginActivity` implementa `shouldOverrideUrlLoading`. Para
   esquemas no http(s) hace `startActivity(Intent.parseUri())`, asi el
   `intent://` sale del WebView hacia Chrome. Ejemplo:
   `intent://ayuda.homiapp.xyz/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fayuda.homiapp.xyz%2F;end`
2. Instruir "toca el menu de 3 puntos y elige Abrir en navegador".
3. Android 12+ con el modulo Mainline CaptivePortalLogin (enero 2026): el
   header `x-android-use-custom-tabs: 361335020` abre el portal en un Custom
   Tab, que es el navegador real, donde el GPS SI funciona. No esta activo por
   defecto. Requiere Google Play system updates.

En Chrome real con HTTPS valido, el prompt de ubicacion aparece y
`navigator.geolocation` funciona.

Fuentes:
- https://android.googlesource.com/platform/packages/modules/CaptivePortalLogin/+/refs/heads/master/src/com/android/captiveportallogin/CaptivePortalLoginActivity.java
- https://developer.android.com/reference/android/webkit/GeolocationPermissions
- https://source.android.com/docs/core/connect/android-custom-tabs-captive-portal

### iOS

El portal se abre en el CNA (Captive Network Assistant), un WebKit recortado,
no Safari. `navigator.geolocation` esta bloqueado por diseno en iOS 15, 16 y
17. `getUserMedia` (camara) tambien. El prompt de permiso no se renderiza y
`getCurrentPosition` da error o expira. Es restriccion deliberada de Apple, no
un bug que se sortee con permisos ni con el cert.

Como llegar a un contexto que SI funciona en iOS:

1. El usuario sale del CNA a Safari real.
2. Flujo: en el CNA toca "Cancelar", luego "Usar sin conexion". El WiFi queda
   conectado sin reabrir el CNA.
3. Abre Safari a mano y entra a `ayuda.homiapp.xyz` o a `192.168.4.1`.
4. Safari carga `https://ayuda.homiapp.xyz/` con cert valido. El prompt nativo
   de ubicacion aparece y el GPS funciona.

En iOS 26 (Apple Developer Forums, thread 805035) la autodeteccion a veces
falla con "Hotspot login cannot open the page because the network connection
was lost". El workaround es el mismo: abrir Safari a mano.

Fuentes:
- https://developer.apple.com/forums/thread/805035
- https://forum.netgate.com/topic/119487

### Regla de oro

El WebView cautivo (CNA en iOS, CaptivePortalLogin en Android) sirve para
MOSTRAR el portal y las instrucciones. La captura de GPS ocurre en el navegador
real (Safari o Chrome). El cert HTTPS hace que el portal ABRA y se VEA. Para el
GPS hay que sacar al usuario al navegador real.

---

## 4. Como correr el validador

Script: `scripts/validar_portal.py`. Usa solo la biblioteca estandar de Python
3 (`socket`, `ssl`, `argparse`). No necesita `requests` ni `pip install`.

Pasos:

1. Enciende el ESP32 con el firmware. Emite la red WiFi `AYUDA`.
2. Conecta este equipo (Mac o PC) a la red `AYUDA`. Es abierta, sin contrasena.
3. Acepta el aviso "esta red no tiene internet". Quedate en la red.
4. Corre:

```
python3 scripts/validar_portal.py
```

Con parametros:

```
python3 scripts/validar_portal.py --host 192.168.4.1 --https-host ayuda.homiapp.xyz
```

Parametros:

- `--host` : IP del ESP32 en la red. Default `192.168.4.1`.
- `--https-host` : dominio del portal HTTPS. Default `ayuda.homiapp.xyz`.
- `--timeout` : timeout de socket en segundos. Default `6`.

El script reproduce el DNS cautivo: resuelve `ayuda.homiapp.xyz` a `--host` en
el socket. No toca `/etc/hosts`. Manda el `Host` header exacto de cada SO y NO
sigue redirects, para ver el `status` y el `Location` crudos.

### Que significa cada PASS/FAIL

- `Android <host><path> no da 204` : el sondeo NO devuelve `204`. Si diera
  `204`, Android cree que hay internet y NO abre el portal. FAIL = el portal no
  abre en Android.
- `Android <host><path> abre el portal` : el sondeo da `302` o `200` con
  cuerpo. FAIL = Android no abre el portal.
- `Android <host><path> 302 apunta al portal` : el `Location` lleva al dominio
  o a la IP. Aviso si el `302` no va directo a `https://ayuda.homiapp.xyz/`.
- `iOS <host><path> no contiene 'Success'` : el body NO trae `Success`. Si lo
  trae, iOS cree que hay internet y NO abre el CNA. FAIL = el CNA no abre.
- `iOS <host><path> 200 con landing` y `landing redirige` : la landing existe
  y redirige al HTTPS. FAIL = la landing no empuja al portal.
- `Windows <host><path> no da la firma exacta` : el body NO es
  `Microsoft Connect Test` ni `Microsoft NCSI`. FAIL = Windows no abre el
  portal.
- `catch-all no da 404` : cualquier ruta rara abre el portal. Un `404` rompe la
  deteccion.
- `HTTPS portal responde 200` : el portal HTTPS responde.
- `HTTPS cert valido` : el cert de `ayuda.homiapp.xyz` valida cadena + SNI. Si
  el cert no valida, el script lo reporta y sigue.
- `HTML del portal usa navigator.geolocation` : el HTML pide GPS.
- `HTTPS sin cabecera HSTS` : no hay `Strict-Transport-Security`. HSTS rompe el
  fallback http.
- `landing HTTP ofrece salida a Chrome (intent://)` : la landing trae el enlace
  `intent://`. Necesario para el GPS en Android.
- `landing HTTP menciona Safari para iOS` : la landing instruye abrir Safari.

Veredictos finales:

- `PORTAL ABRE EN ANDROID: SI/NO` : todos los sondeos Android no dan `204` y
  abren el portal.
- `ABRE EN iOS: SI/NO` : los sondeos iOS no traen `Success` y la landing abre y
  redirige.
- `LLEGA A GPS: SI/NO` : el portal HTTPS sirve `navigator.geolocation` con cert
  valido y hay salida a Chrome/Safari. Recuerda: el WebView cautivo NO da GPS
  por si mismo. El usuario debe llegar al navegador real.

Codigo de salida: `0` si todo PASS, `1` si algo falla.

---

## 5. Checklist de preparacion del telefono para el demo

Antes del demo, prepara el telefono asi:

Ambos (Android y iOS):

- [ ] Fecha y hora del telefono correctas. El navegador valida el cert contra
      su propio reloj. El reloj del ESP32 en 1970 no afecta.
- [ ] Ubicacion (GPS) del sistema activada.
- [ ] Apaga los datos moviles. Fuerza todo el trafico por el WiFi `AYUDA`.
- [ ] Conecta a la red `AYUDA`.
- [ ] Si pregunta "esta red no tiene internet, seguir?", responde SI.

Android:

- [ ] Permiso de ubicacion concedido a Chrome.
- [ ] Al abrir el portal, toca "PEDIR AYUDA".
- [ ] Si no pide ubicacion, toca el enlace "Abrir en Chrome" (intent://) o el
      menu de 3 puntos "Abrir en navegador". Reintenta en Chrome.
- [ ] Acepta el prompt de ubicacion en Chrome.

iOS:

- [ ] Permiso de ubicacion concedido a Safari (Ajustes -> Safari -> Ubicacion).
- [ ] Cuando abra el CNA, toca "Cancelar" y luego "Usar sin conexion".
- [ ] Abre Safari a mano. Entra a `ayuda.homiapp.xyz` o a `192.168.4.1`.
- [ ] Toca "PEDIR AYUDA" y acepta el prompt de ubicacion.

Cartel para el punto de ayuda:

- iPhone: cuando abra la ventana de login, toca "Cancelar", luego "Usar sin
  conexion". Abre Safari y entra a `ayuda.homiapp.xyz`. Toca "PEDIR AYUDA".
- Android: apaga los datos moviles. Toca "PEDIR AYUDA". Si no pide ubicacion,
  usa "Abrir en Chrome" y reintenta.
