import requests
from bs4 import BeautifulSoup
import time
import re
from datetime import date, datetime

BASE_URL = "https://www.rematesinmobiliarios.cl"
# Listado de remates de la Región Metropolitana
URL_RM = f"{BASE_URL}/remates/region-metropolitana/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
PAUSA_ENTRE_PETICIONES = 1.5


def obtener_html(url: str) -> str:
    respuesta = requests.get(url, headers=HEADERS, timeout=15)
    # La pausa va siempre (también si la página no existe), para no recargar al sitio
    time.sleep(PAUSA_ENTRE_PETICIONES)
    respuesta.raise_for_status()
    return respuesta.text


def limpiar_precio(texto: str) -> float | None:
    # Convierte "$62.125.239" en 62125239.0
    if not texto or not texto.strip():
        return None
    numeros = re.sub(r"[^\d]", "", texto)
    return float(numeros) if numeros else None


def limpiar_m2(texto: str) -> float | None:
    # Convierte "13.851" en 13851.0 (mismo formato que el precio, con puntos de miles)
    return limpiar_precio(texto)


def convertir_fecha(texto: str) -> date | None:
    # Paso 44: convierte "13-10-2026" (día-mes-año, como viene en el listado) en una fecha de verdad.
    # Si la celda viene vacía o con otro formato, devuelve None en vez de fallar.
    try:
        return datetime.strptime(texto.strip(), "%d-%m-%Y").date()
    except ValueError:
        return None


def extraer_remate_de_fila(fila) -> dict | None:
    remate_id = fila.get("title")
    celdas = fila.find_all("td")

    # Si la fila no tiene la forma esperada (por ejemplo, es un encabezado), la saltamos
    if not remate_id or len(celdas) < 9:
        return None

    tipo_remate_img = celdas[1].find("img")
    tipo_remate = tipo_remate_img.get("title") if tipo_remate_img else None

    fecha_remate = convertir_fecha(celdas[2].get_text(strip=True))
    fecha_publicado = convertir_fecha(celdas[3].get_text(strip=True))
    region = celdas[4].get_text(strip=True)
    comuna = celdas[5].get_text(strip=True)
    tipo_propiedad = celdas[6].get_text(strip=True)

    # La dirección completa viene en el "title" de la imagen del mapa, no como texto normal
    celda_mapa = celdas[7]
    img_mapa = celda_mapa.find("img")
    direccion_completa = img_mapa.get("title") if img_mapa else None

    m2 = limpiar_m2(celdas[8].get_text(strip=True))
    precio_minimo = limpiar_precio(celdas[9].get_text(strip=True)) if len(celdas) > 9 else None

    return {
        "remate_id": remate_id,
        "tipo_remate": tipo_remate,
        "fecha_remate": fecha_remate,
        "fecha_publicado": fecha_publicado,
        "region": region,
        "comuna": comuna,
        "tipo_propiedad": tipo_propiedad,
        "direccion": direccion_completa,
        "m2": m2,
        "precio_minimo": precio_minimo,
        "url_ficha": f"{BASE_URL}/ficha-remate.php?id={remate_id}",
    }


def extraer_pagina(url: str) -> list[dict]:
    html = obtener_html(url)
    soup = BeautifulSoup(html, "lxml")
    tabla = soup.find("table")
    if not tabla:
        return []

    filas = tabla.find_all("tr")
    remates = []
    for fila in filas:
        remate = extraer_remate_de_fila(fila)
        if remate:
            remates.append(remate)
    return remates

def extraer_comuna(nombre_en_direccion: str) -> list[dict]:
    # Paso 50: lee el listado público de una comuna, por ejemplo /remates/estacion-central/
    # Si el sitio no tiene página para esa comuna (porque no tiene remates), devuelve una lista vacía.
    try:
        return extraer_pagina(f"{BASE_URL}/remates/{nombre_en_direccion}/")
    except requests.HTTPError as error:
        if error.response is not None and error.response.status_code == 404:
            return []
        raise

if __name__ == "__main__":
    remates = extraer_pagina(URL_RM)
    print(f"Se extrajeron {len(remates)} remates de la primera página.\n")
    for r in remates[:5]:
        print(r["remate_id"], "|", r["fecha_remate"], "|", r["comuna"], "|", r["tipo_propiedad"], "|", r["precio_minimo"])
    sin_fecha = [r["remate_id"] for r in remates if r["fecha_remate"] is None]
    print(f"\nRemates sin fecha reconocida: {len(sin_fecha)} {sin_fecha}")