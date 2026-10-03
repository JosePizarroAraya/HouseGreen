from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import requests
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.property import Comuna, Property, Region
from app.routers.properties import crear_propiedad
from app.schemas.property import PropertyCreate
from app.scraper.comuna_matcher import nombre_para_direccion, normalizar
from app.scraper.remates_scraper import URL_RM, extraer_comuna, extraer_pagina

# Nombre de la fuente: se guarda en source_system junto con el número del remate (source_reference).
# Con esos dos datos la base sabe si un remate ya fue cargado.
FUENTE = "rematesinmobiliarios"

ZONA_CHILE = ZoneInfo("America/Santiago")

def tipo_de_remate(texto: str | None) -> str | None:
    # El sitio escribe "Remate Judicial" o "Remate Extrajudicial"; en la base se guarda "judicial" o "extrajudicial".
    # Se pregunta primero por "extrajudicial" porque esa palabra también contiene "judicial".
    texto = normalizar(texto or "")
    if "extrajudicial" in texto:
        return "extrajudicial"
    if "judicial" in texto:
        return "judicial"
    return None

def armar_propiedad(remate: dict, comuna: Comuna, tipo_remate: str) -> PropertyCreate:
    # Convierte un remate del scraper en los datos que pide la API para crear una propiedad
    tipo = (remate["tipo_propiedad"] or "propiedad").lower()
    fecha = remate["fecha_remate"]
    return PropertyCreate(
        title=f"{tipo.capitalize()} en {comuna.name}",  # "Departamento en Providencia"
        address=(remate["direccion"] or "")[:255] or None,
        comuna_id=comuna.id,
        property_type=tipo,
        auction_type=tipo_remate,
        opening_price=Decimal(int(remate["precio_minimo"])),
        # El listado no trae la hora del remate: se guarda a las 00:00 de Chile,
        # que en HouseGreen significa "hora no informada"
        auction_date=datetime(fecha.year, fecha.month, fecha.day, tzinfo=ZONA_CHILE) if fecha else None,
        surface_m2=Decimal(str(remate["m2"])) if remate["m2"] else None,
        source_system=FUENTE,
        source_reference=remate["remate_id"],
    )


def cargar(remates: list[dict]) -> dict:
    resumen = {"creados": 0, "ya_existian": 0, "sin_comuna": [], "sin_precio": [], "tipo_desconocido": [], "con_error": []}
    db = SessionLocal()
    try:
        # Se leen una sola vez: las comunas de la base y los remates que ya están cargados
        comunas = {normalizar(c.name): c for c in db.query(Comuna).all()}
        ya_cargados = {
            referencia
            for (referencia,) in db.query(Property.source_reference).filter(Property.source_system == FUENTE)
        }

        for remate in remates:
            referencia = remate["remate_id"]
            if referencia in ya_cargados:
                resumen["ya_existian"] += 1
                continue

            comuna = comunas.get(normalizar(remate["comuna"]))
            if comuna is None:
                resumen["sin_comuna"].append(f"{referencia} ({remate['comuna']})")
                continue

            if not remate["precio_minimo"]:
                resumen["sin_precio"].append(referencia)
                continue

            tipo_remate = tipo_de_remate(remate["tipo_remate"])
            if tipo_remate is None:
                resumen["tipo_desconocido"].append(f"{referencia} ({remate['tipo_remate']})")
                continue

            try:
                # Se usa la misma función que la API (POST /propiedades): guarda la propiedad,
                # calcula el semáforo y crea las alertas. Así esa lógica no se repite aquí.
                datos = armar_propiedad(remate, comuna, tipo_remate)
                crear_propiedad(datos=datos, db=db, usuario=None)
                resumen["creados"] += 1
                print(f"  + {referencia}  {datos.title}")
            except HTTPException:
                # 409: otro proceso la cargó mientras tanto
                resumen["ya_existian"] += 1
            except Exception as error:
                # Si alcanzó a guardarse a medias, se borra para que la próxima carga la intente completa
                db.rollback()
                db.query(Property).filter(
                    Property.source_system == FUENTE, Property.source_reference == referencia
                ).delete()
                db.commit()
                resumen["con_error"].append(f"{referencia}: {error}")
    finally:
        db.close()
    return resumen


def mostrar_resumen(resumen: dict):
    print(f"\nCreados: {resumen['creados']}")
    print(f"Ya existían: {resumen['ya_existian']}")
    for nombre, texto in [
        ("sin_comuna", "Sin comuna en la base"),
        ("sin_precio", "Sin precio mínimo"),
        ("tipo_desconocido", "Tipo de remate desconocido"),
        ("con_error", "Con error"),
    ]:
        print(f"{texto}: {len(resumen[nombre])} {resumen[nombre]}")


def leer_region_metropolitana() -> list[dict]:
    # Paso 50: junta los remates de la Región Metropolitana leyendo solo páginas públicas del sitio:
    # la primera página de la región (los 25 más nuevos) y la página de cada comuna (hasta 25 por comuna).
    # Las páginas 2, 3... del sitio se piden a /api-remates.php, que su robots.txt prohíbe usar; por eso no se usa.
    db = SessionLocal()
    try:
        comunas = [
            c.name
            for c in db.query(Comuna)
            .join(Region, Comuna.region_id == Region.id)
            .filter(Region.name.ilike("%metropolitana%"))
            .order_by(Comuna.name)
        ]
    finally:
        db.close()

    # Diccionario por número de remate: si un remate aparece en dos páginas, queda una sola vez
    remates = {r["remate_id"]: r for r in extraer_pagina(URL_RM)}
    print(f"  Primera página de la región: {len(remates)}")

    for nombre in comunas:
        try:
            encontrados = extraer_comuna(nombre_para_direccion(nombre))
        except requests.RequestException as error:
            print(f"  {nombre}: no se pudo leer ({error})")
            continue
        if encontrados:
            print(f"  {nombre}: {len(encontrados)}")
        for remate in encontrados:
            remates[remate["remate_id"]] = remate

    # Por seguridad, solo se dejan los remates que el sitio marca como Región Metropolitana
    return [r for r in remates.values() if normalizar(r["region"]).startswith("metropolitana")]


if __name__ == "__main__":
    print("Leyendo los listados del sitio (tarda cerca de 2 minutos)...")
    remates = leer_region_metropolitana()
    print(f"\nSe leyeron {len(remates)} remates distintos. Guardando en la base (puede tardar varios minutos)...")
    mostrar_resumen(cargar(remates))