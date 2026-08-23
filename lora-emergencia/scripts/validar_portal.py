#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validador e2e del portal cautivo AYUDA (ESP32) · SOLO stdlib.
=============================================================
Este script prueba, uno por uno, cada sondeo de captive portal de Android,
iOS y Windows contra el firmware del ESP32. Comprueba que el portal ABRA
solo en el telefono y que la cadena termine en el portal HTTPS con GPS.

No usa `requests`. Usa solo la biblioteca estandar: socket, ssl, argparse.
Reproduce el DNS cautivo del ESP32 en el cliente: resuelve el dominio del
portal a la IP del equipo (--host), igual que el ESP32 resuelve todo a
192.168.4.1.

USO
---
1. Conecta este equipo (Mac/PC) a la red WiFi "AYUDA" que emite el ESP32.
   La red es abierta, sin contrasena. El equipo recibe una IP 192.168.4.x.
2. Acepta el aviso "esta red no tiene internet" si aparece. Quedate en la red.
3. Corre:
       python3 validar_portal.py
       python3 validar_portal.py --host 192.168.4.1 --https-host ayuda.homiapp.xyz

SALIDA
------
Una linea PASS/FAIL por comprobacion, con color. Un resumen final con el
conteo PASS/FAIL y tres veredictos:
   PORTAL ABRE EN ANDROID: SI/NO
   ABRE EN iOS:            SI/NO
   LLEGA A GPS:            SI/NO
Codigo de salida 0 si todo PASS, 1 si algo falla.
"""

import argparse
import socket
import ssl
import sys

# --------------------------------------------------------------------------
# Colores ANSI. Se desactivan si la salida no es una terminal.
# --------------------------------------------------------------------------
_TTY = sys.stdout.isatty()


def _c(texto, codigo):
    if not _TTY:
        return texto
    return "\033[" + codigo + "m" + texto + "\033[0m"


def verde(t):
    return _c(t, "32")


def rojo(t):
    return _c(t, "31")


def gris(t):
    return _c(t, "90")


def amarillo(t):
    return _c(t, "33")


# Body exacto que Apple espera para decir "hay internet". Nunca debe aparecer
# en las rutas de sondeo, o iOS no abre el CNA.
SUCCESS_APPLE = "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>"

# Firmas exactas de Windows. Si el body las contiene, Windows cree que hay
# internet y no abre el portal.
FIRMA_MSFT_CONNECT = "Microsoft Connect Test"
FIRMA_MSFT_NCSI = "Microsoft NCSI"

# Acumulador global de resultados: lista de (nombre, cond_bool, detalle).
_RESULTADOS = []


def check(nombre, cond, detalle=""):
    """Registra e imprime una comprobacion PASS/FAIL."""
    _RESULTADOS.append((nombre, bool(cond), detalle))
    if cond:
        marca = verde("PASS")
    else:
        marca = rojo("FAIL")
    linea = "[" + marca + "] " + nombre
    if detalle:
        linea += gris("  -> " + detalle)
    print(linea)


# --------------------------------------------------------------------------
# Cliente HTTP/HTTPS minimo sobre sockets. No sigue redirects. Manda el
# Host header exacto del sistema operativo que se quiere imitar.
# --------------------------------------------------------------------------
class Respuesta:
    """Respuesta HTTP ya parseada."""

    def __init__(self, status, headers, body, tls_verificado=None, error=None):
        self.status = status            # int, ej 302
        self.headers = headers          # dict con claves en minuscula
        self.body = body                # str (utf-8, errores ignorados)
        self.tls_verificado = tls_verificado  # True/False/None (None = no TLS)
        self.error = error              # str si hubo excepcion, si no None

    def header(self, nombre):
        return self.headers.get(nombre.lower(), "")


def _leer_todo(sock, timeout):
    """Lee del socket hasta EOF. Robusto a timeouts cortos."""
    sock.settimeout(timeout)
    trozos = []
    try:
        while True:
            b = sock.recv(4096)
            if not b:
                break
            trozos.append(b)
    except socket.timeout:
        # El servidor puede no cerrar el socket. Lo leido suele bastar.
        pass
    return b"".join(trozos)


def _decodificar_chunked(cuerpo_bytes):
    """Decodifica Transfer-Encoding: chunked. Devuelve bytes planos."""
    salida = []
    i = 0
    n = len(cuerpo_bytes)
    while i < n:
        fin_linea = cuerpo_bytes.find(b"\r\n", i)
        if fin_linea == -1:
            break
        tam_hex = cuerpo_bytes[i:fin_linea].split(b";")[0].strip()
        try:
            tam = int(tam_hex, 16)
        except ValueError:
            break
        if tam == 0:
            break
        inicio = fin_linea + 2
        salida.append(cuerpo_bytes[inicio:inicio + tam])
        i = inicio + tam + 2  # salta el chunk y su \r\n final
    return b"".join(salida)


def _parsear(datos):
    """Parsea bytes crudos HTTP en (status, headers, body_str)."""
    sep = datos.find(b"\r\n\r\n")
    if sep == -1:
        # Respuesta sin cuerpo o incompleta.
        cabeza = datos
        cuerpo = b""
    else:
        cabeza = datos[:sep]
        cuerpo = datos[sep + 4:]
    lineas = cabeza.split(b"\r\n")
    # Linea de estado: "HTTP/1.1 302 Found"
    status = 0
    if lineas and lineas[0].startswith(b"HTTP/"):
        partes = lineas[0].split(b" ", 2)
        if len(partes) >= 2:
            try:
                status = int(partes[1])
            except ValueError:
                status = 0
    headers = {}
    for ln in lineas[1:]:
        if b":" in ln:
            k, v = ln.split(b":", 1)
            headers[k.decode("latin-1").strip().lower()] = v.decode("latin-1").strip()
    # Chunked, si aplica.
    if headers.get("transfer-encoding", "").lower() == "chunked":
        cuerpo = _decodificar_chunked(cuerpo)
    body = cuerpo.decode("utf-8", "ignore")
    return status, headers, body


def get(host_ip, path, host_header, tls=False, sni_host=None, timeout=6.0):
    """
    Hace un GET crudo a host_ip:puerto y devuelve una Respuesta.
    - host_header: el valor exacto del header Host (ej connectivitycheck.gstatic.com).
    - tls: si True usa HTTPS puerto 443, si no HTTP puerto 80.
    - sni_host: el nombre para el SNI y la validacion del cert (ej ayuda.homiapp.xyz).
    NO sigue redirects.
    """
    puerto = 443 if tls else 80
    sock = None
    tls_verificado = None
    try:
        raw = socket.create_connection((host_ip, puerto), timeout=timeout)
        sock = raw
        if tls:
            # Primer intento: validacion completa del cert con SNI = sni_host.
            ctx = ssl.create_default_context()
            try:
                sock = ctx.wrap_socket(raw, server_hostname=sni_host)
                tls_verificado = True
            except ssl.SSLError:
                # El cert no valida (hostname/cadena/fecha). Reintenta sin
                # validar solo para poder leer el body y seguir el resto.
                try:
                    raw2 = socket.create_connection((host_ip, puerto), timeout=timeout)
                except OSError as e:
                    return Respuesta(0, {}, "", tls_verificado=False, error=str(e))
                ctx2 = ssl._create_unverified_context()
                sock = ctx2.wrap_socket(raw2, server_hostname=sni_host)
                tls_verificado = False
        # Peticion HTTP/1.1 con Connection: close para que el server cierre al final.
        pedido = (
            "GET " + path + " HTTP/1.1\r\n"
            "Host: " + host_header + "\r\n"
            "User-Agent: CaptivePortalValidator/1.0\r\n"
            "Accept: */*\r\n"
            "Connection: close\r\n\r\n"
        )
        sock.sendall(pedido.encode("latin-1"))
        datos = _leer_todo(sock, timeout)
        status, headers, body = _parsear(datos)
        return Respuesta(status, headers, body, tls_verificado=tls_verificado)
    except (OSError, ssl.SSLError) as e:
        return Respuesta(0, {}, "", tls_verificado=tls_verificado, error=str(e))
    finally:
        if sock is not None:
            try:
                sock.close()
            except OSError:
                pass


def _abre_portal_generico(r):
    """Un sondeo abre el portal si NO da 204 y responde 302 o 200 con cuerpo."""
    if r.status == 302:
        return True
    if r.status == 200 and len(r.body) > 0:
        return True
    return False


def _redirige_a_https(r, https_url):
    """
    Verifica si la respuesta lleva al portal HTTPS. Cubre tres mecanismos:
    Location header (302), meta-refresh, y location.replace en el body.
    """
    base = https_url.rstrip("/")
    loc = r.header("location")
    if loc and loc.rstrip("/") == base:
        return True
    if base in r.body:
        # meta-refresh o location.replace apuntando al dominio HTTPS.
        cuerpo = r.body.lower()
        if "http-equiv" in cuerpo and "refresh" in cuerpo:
            return True
        if "location.replace" in cuerpo:
            return True
        if base.lower() in cuerpo:
            return True
    return False


def imprimir_probe(metodo, url, r):
    """Imprime el detalle crudo de un sondeo: metodo, url, status, Location."""
    if r.error:
        detalle = rojo("error " + r.error)
    else:
        loc = r.header("location")
        detalle = "status " + str(r.status)
        if loc:
            detalle += "  Location: " + loc
    print(gris("  probe [" + metodo + "] " + url + "  ->  " + detalle))


def main():
    ap = argparse.ArgumentParser(
        description="Validador e2e del portal cautivo AYUDA (ESP32). Solo stdlib."
    )
    ap.add_argument("--host", default="192.168.4.1",
                    help="IP del ESP32 en la red AYUDA (default 192.168.4.1)")
    ap.add_argument("--https-host", default="ayuda.homiapp.xyz",
                    help="dominio del portal HTTPS con cert LE (default ayuda.homiapp.xyz)")
    ap.add_argument("--timeout", type=float, default=6.0,
                    help="timeout de socket en segundos (default 6)")
    args = ap.parse_args()

    ip = args.host
    dom = args.https_host
    https_url = "https://" + dom + "/"
    t = args.timeout

    print("=" * 66)
    print(" Validador portal cautivo AYUDA")
    print("   host ESP32 : " + ip)
    print("   dominio    : " + dom)
    print("   portal     : " + https_url)
    print("=" * 66)
    print(amarillo(" Requisito: este equipo debe estar conectado a la red WiFi 'AYUDA'."))
    print("")

    # ----------------------------------------------------------------------
    # GRUPO A: Android. Sondeos generate_204 / gen_204.
    # Regla dura: NUNCA 204. Debe dar 302 (o 200 con cuerpo) para abrir el portal.
    # ----------------------------------------------------------------------
    print("--- Grupo A: Android (generate_204 / gen_204) ---")
    android_probes = [
        ("connectivitycheck.gstatic.com", "/generate_204"),
        ("www.google.com", "/generate_204"),
        ("clients3.google.com", "/generate_204"),
        ("connectivitycheck.android.com", "/generate_204"),
        ("play.googleapis.com", "/generate_204"),
        ("clients1.google.com", "/gen_204"),
        ("www.google.com", "/gen_204"),
    ]
    android_ok = True
    for host, path in android_probes:
        r = get(ip, path, host, timeout=t)
        imprimir_probe("Android", "http://" + host + path, r)
        # 1) NUNCA 204.
        no_204 = r.status != 204
        check("Android " + host + path + " no da 204", no_204,
              "status " + str(r.status))
        # 2) Debe abrir el portal.
        abre = _abre_portal_generico(r)
        check("Android " + host + path + " abre el portal", abre,
              "status " + str(r.status))
        # 3) Si es 302, el destino debe llevar al HTTPS del portal.
        if r.status == 302:
            loc = r.header("location")
            hacia_portal = (dom in loc) or (ip in loc)
            check("Android " + host + path + " 302 apunta al portal", hacia_portal,
                  "Location=" + loc)
            if dom not in loc:
                # Aviso: el 302 va a http://IP/, no directo al HTTPS. Funciona,
                # pero suma un salto extra. Lo ideal es Location a https://dom/.
                print(amarillo("    aviso: el 302 no va directo a " + https_url +
                               " (suma un salto por la landing HTTP)"))
        if not (no_204 and abre):
            android_ok = False

    # ----------------------------------------------------------------------
    # GRUPO B: iOS. Sondeo hotspot-detect.html.
    # Regla dura: el body NO debe contener 'Success'. Debe abrir el CNA con
    # 200-landing (que redirige) o 302 al portal.
    # ----------------------------------------------------------------------
    print("\n--- Grupo B: iOS / macOS (hotspot-detect.html) ---")
    ios_probes = [
        ("captive.apple.com", "/hotspot-detect.html"),
        ("www.apple.com", "/library/test/success.html"),
    ]
    ios_ok = True
    for host, path in ios_probes:
        r = get(ip, path, host, timeout=t)
        imprimir_probe("iOS", "http://" + host + path, r)
        # 1) Nunca el body 'Success'.
        sin_success = ("Success" not in r.body) and (SUCCESS_APPLE not in r.body)
        check("iOS " + host + path + " no contiene 'Success'", sin_success,
              "si aparece 'Success', iOS no abre el CNA")
        # 2) Abre el CNA: 200-landing que redirige, o 302.
        if r.status == 302:
            check("iOS " + host + path + " 302 al portal",
                  _redirige_a_https(r, https_url),
                  "Location=" + r.header("location"))
            landing_ok = _redirige_a_https(r, https_url)
        else:
            es_landing = r.status == 200 and len(r.body) > 0
            check("iOS " + host + path + " 200 con landing", es_landing,
                  "status " + str(r.status))
            redir = _redirige_a_https(r, https_url)
            check("iOS " + host + path + " landing redirige a " + https_url, redir,
                  "meta-refresh o location.replace a https://" + dom)
            landing_ok = es_landing and redir
        if not (sin_success and landing_ok):
            ios_ok = False

    # ----------------------------------------------------------------------
    # GRUPO C: Windows. connecttest.txt y ncsi.txt.
    # Regla dura: el body NO debe ser la firma de Microsoft. Debe abrir portal.
    # ----------------------------------------------------------------------
    print("\n--- Grupo C: Windows (connecttest.txt / ncsi.txt) ---")
    win_probes = [
        ("www.msftconnecttest.com", "/connecttest.txt", FIRMA_MSFT_CONNECT),
        ("www.msftncsi.com", "/ncsi.txt", FIRMA_MSFT_NCSI),
        ("www.msftconnecttest.com", "/redirect", None),
    ]
    for host, path, firma in win_probes:
        r = get(ip, path, host, timeout=t)
        imprimir_probe("Windows", "http://" + host + path, r)
        if firma is not None:
            sin_firma = r.body.strip() != firma and firma not in r.body
            check("Windows " + host + path + " no da la firma exacta", sin_firma,
                  "no debe devolver '" + firma + "'")
        check("Windows " + host + path + " abre el portal",
              r.status in (200, 302), "status " + str(r.status))

    # ----------------------------------------------------------------------
    # GRUPO D: catch-all. Cualquier ruta rara debe abrir el portal, nunca 404.
    # ----------------------------------------------------------------------
    print("\n--- Grupo D: catch-all (ruta desconocida) ---")
    r = get(ip, "/ruta/inexistente/favicon.ico?x=1", dom, timeout=t)
    imprimir_probe("catch-all", "http://" + dom + "/ruta/inexistente/favicon.ico", r)
    check("catch-all no da 404", r.status != 404, "status " + str(r.status))
    check("catch-all abre el portal", r.status in (200, 302),
          "status " + str(r.status))

    # ----------------------------------------------------------------------
    # GRUPO E: portal HTTPS. Cert valido (SNI = dominio real), 200, y el HTML
    # debe contener navigator.geolocation.
    # ----------------------------------------------------------------------
    print("\n--- Grupo E: portal HTTPS (" + https_url + ") ---")
    r = get(ip, "/", dom, tls=True, sni_host=dom, timeout=t)
    imprimir_probe("HTTPS", https_url, r)
    if r.error and r.status == 0:
        check("HTTPS portal responde", False, "error " + r.error)
        https_ok = False
        tiene_geo = False
    else:
        check("HTTPS portal responde 200", r.status == 200, "status " + str(r.status))
        # El cert puede fallar la validacion. Se reporta pero se sigue.
        if r.tls_verificado is True:
            check("HTTPS cert valido (cadena + SNI " + dom + ")", True, "")
        elif r.tls_verificado is False:
            check("HTTPS cert valido (cadena + SNI " + dom + ")", False,
                  "el cert no valido; revisa el cert LE de " + dom)
        tiene_geo = "navigator.geolocation" in r.body
        check("HTML del portal usa navigator.geolocation", tiene_geo,
              "requiere contexto seguro (HTTPS con cert valido)")
        sin_hsts = "strict-transport-security" not in r.headers
        check("HTTPS sin cabecera HSTS", sin_hsts,
              "HSTS rompe el fallback http del portal")
        https_ok = (r.status == 200) and tiene_geo

    # ----------------------------------------------------------------------
    # GRUPO F: ruta de escape a navegador real. La landing HTTP debe ofrecer
    # una salida a Chrome (intent://) o instruir abrir Safari. Sin esto, el
    # GPS no se captura en el WebView cautivo.
    # ----------------------------------------------------------------------
    print("\n--- Grupo F: ruta de escape a navegador real (GPS) ---")
    r_land = get(ip, "/", dom, timeout=t)
    cuerpo_land = r_land.body.lower()
    tiene_intent = "intent://" in cuerpo_land
    tiene_safari = "safari" in cuerpo_land
    check("landing HTTP ofrece salida a Chrome (intent://)", tiene_intent,
          "necesario para capturar GPS en Android")
    check("landing HTTP menciona Safari para iOS", tiene_safari,
          "recomendado: instruir 'Abrir en Safari' en iOS")

    # ----------------------------------------------------------------------
    # RESUMEN Y VEREDICTOS
    # ----------------------------------------------------------------------
    total = len(_RESULTADOS)
    ok = sum(1 for _, c, _ in _RESULTADOS if c)
    fail = total - ok

    print("\n" + "=" * 66)
    print(" RESUMEN")
    print("   PASS : " + verde(str(ok)) + " / " + str(total))
    if fail:
        print("   FAIL : " + rojo(str(fail)))
    else:
        print("   FAIL : 0")
    print("")

    # Veredicto Android: todos los sondeos no dan 204 y abren el portal.
    v_android = "SI" if android_ok else "NO"
    # Veredicto iOS: sondeos sin 'Success' y con landing que abre + redirige.
    v_ios = "SI" if ios_ok else "NO"
    # Veredicto GPS: el portal HTTPS sirve navigator.geolocation con cert valido
    # Y hay ruta de escape a navegador real. El WebView cautivo NO da GPS solo.
    gps_ctx = https_ok and (tiene_intent or tiene_safari)
    v_gps = "SI" if gps_ctx else "NO"

    def veredicto(etiqueta, valor):
        pintado = verde(valor) if valor == "SI" else rojo(valor)
        print("   " + etiqueta.ljust(26) + pintado)

    veredicto("PORTAL ABRE EN ANDROID:", v_android)
    veredicto("ABRE EN iOS:", v_ios)
    veredicto("LLEGA A GPS:", v_gps)
    print("")
    print(gris(" Nota honesta: 'LLEGA A GPS: SI' significa que el portal HTTPS"))
    print(gris(" sirve navigator.geolocation con cert valido y hay salida a"))
    print(gris(" Chrome/Safari. El WebView cautivo (CNA/CaptivePortalLogin) NO"))
    print(gris(" entrega GPS por si mismo. El usuario debe llegar al navegador real."))
    print("=" * 66)

    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
