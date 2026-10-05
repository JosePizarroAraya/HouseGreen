# Paso 59: lee la ficha de un remate (la página con el detalle) y entrega sus datos ordenados.
# Para probarlo:  python -m app.scraper.ficha_remate
import re
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from app.scraper.comuna_matcher import normalizar
from app.scraper.remates_scraper import BASE_URL, limpiar_precio, obtener_html

ZONA_CHILE = ZoneInfo("America/Santiago")

# Cómo se llama cada fila en la ficha del sitio (sin tildes ni mayúsculas) y con qué nombre la guardamos
ETIQUETAS = {
    "origen": "origen",
    "tribunal / juez": "tribunal",
    "rol": "rol_causa",
    "tipo remate": "modalidad",
    "fecha": "fecha",
    "lugar": "lugar",
    "tipo propiedad": "tipo_propiedad",
    "postura minima": "postura_minima",
    "direccion": "direccion",
    "garantia": "garantia",
    "forma de pago": "forma_pago",
    "plazo": "plazo",
    "requisitos": "requisitos",
    "condiciones": "condiciones",
    "anuncio": "anuncio",
    "observaciones": "observaciones",
}

# Palabras que indican que NO se remata la propiedad completa
PALABRAS_OTRO_DOMINIO = ["derecho", "cuota", "nuda propiedad", "usufructo"]


def limpiar_texto(texto: str) -> str | None:
    # Junta los espacios y saltos de línea repetidos; si queda vacío, devuelve None
    texto = " ".join(texto.split())
    return texto or None


def convertir_fecha_hora(texto: str | None) -> datetime | None:
    # Convierte "2026-10-07 Hora: 11:30:00" en una fecha con hora de Chile.
    # Si la ficha no trae hora, queda a las 00:00 (que en HouseGreen significa "hora no informada").
    encontrado = re.search(r"(\d{4})-(\d{2})-(\d{2})(?:\D+(\d{1,2}):(\d{2}))?", texto or "")
    if not encontrado:
        return None
    anio, mes, dia, hora, minuto = encontrado.groups()
    try:
        return datetime(int(anio), int(mes), int(dia), int(hora or 0), int(minuto or 0), tzinfo=ZONA_CHILE)
    except ValueError:
        return None


def monto_de_garantia(texto: str | None) -> float | None:
    # "29.538.183 CLP, Garantía por el 10% del mínimo..." -> 29538183.0
    encontrado = re.match(r"\s*\$?\s*([\d.]+)\s*CLP", texto or "")
    return limpiar_precio(encontrado.group(1)) if encontrado else None


def dominio_de_la_ficha(titulo: str | None, tipo_propiedad: str | None) -> str | None:
    # Reglas del semáforo v2: "exclusivo" si se remata la propiedad completa, "otro" si se rematan
    # derechos, una cuota, la nuda propiedad o un usufructo, y None si no hay cómo saberlo.
    # Se mira el título y el tipo de propiedad, que dicen QUÉ se remata. El anuncio no se usa porque
    # casi siempre nombra "derechos" por otros motivos (bienes comunes, servidumbres) y daría falsos avisos.
    texto = normalizar(f"{titulo or ''} {tipo_propiedad or ''}")
    if not texto:
        return None
    if any(palabra in texto for palabra in PALABRAS_OTRO_DOMINIO) or re.search(r"\d\s*%", texto):
        return "otro"
    return "exclusivo"


def extraer_ficha(html: str) -> dict | None:
    # Recibe el HTML de la ficha y devuelve un diccionario con sus datos (None si la página no trae datos)
    soup = BeautifulSoup(html, "lxml")

    # Cada dato viene en una fila de tabla: en la primera celda el nombre ("Tribunal / Juez:") y en la segunda el valor
    datos = {}
    for fila in soup.find_all("tr"):
        celdas = fila.find_all(["td", "th"])
        if len(celdas) < 2:
            continue
        etiqueta = normalizar(celdas[0].get_text()).rstrip(":").strip()
        if etiqueta in ETIQUETAS:
            datos[ETIQUETAS[etiqueta]] = limpiar_texto(celdas[1].get_text())

    if not datos:
        return None

    # El título es el encabezado que describe la propiedad (el otro encabezado dice solo "Ficha del Remate")
    titulo = None
    for encabezado in soup.find_all(["h1", "h2", "h3"]):
        texto = limpiar_texto(encabezado.get_text())
        if texto and normalizar(texto) != "ficha del remate":
            titulo = texto
            break

    return {
        "titulo": titulo,
        "origen": datos.get("origen"),
        "tribunal": datos.get("tribunal"),
        "rol_causa": datos.get("rol_causa"),
        "modalidad": datos.get("modalidad"),
        "fecha_hora": convertir_fecha_hora(datos.get("fecha")),
        "lugar": datos.get("lugar"),
        "tipo_propiedad": datos.get("tipo_propiedad"),
        "postura_minima": limpiar_precio(datos.get("postura_minima") or ""),
        "direccion": datos.get("direccion"),
        "garantia": datos.get("garantia"),
        "garantia_monto": monto_de_garantia(datos.get("garantia")),
        "forma_pago": datos.get("forma_pago"),
        "plazo": datos.get("plazo"),
        "requisitos": datos.get("requisitos"),
        "condiciones": datos.get("condiciones"),
        "anuncio": datos.get("anuncio"),
        "observaciones": datos.get("observaciones"),
        "dominio": dominio_de_la_ficha(titulo, datos.get("tipo_propiedad")),
    }


def leer_ficha(remate_id: str) -> dict | None:
    # Abre la ficha de un remate en el sitio. Si la ficha no existe, devuelve None.
    try:
        html = obtener_html(f"{BASE_URL}/ficha-remate.php?id={remate_id}")
    except requests.HTTPError as error:
        if error.response is not None and error.response.status_code == 404:
            return None
        raise
    ficha = extraer_ficha(html)
    if ficha:
        ficha["remate_id"] = remate_id
    return ficha


if __name__ == "__main__":
    # Prueba: lee dos fichas que ya conocemos y muestra lo que entendió de cada una
    for remate_id in ["58465", "60200"]:
        ficha = leer_ficha(remate_id)
        print("=" * 70)
        if not ficha:
            print("Ficha", remate_id, ": no se pudo leer")
            continue
        for nombre, valor in ficha.items():
            if isinstance(valor, str) and len(valor) > 90:
                valor = valor[:90] + "…"
            print(f"{nombre:15} {valor}")