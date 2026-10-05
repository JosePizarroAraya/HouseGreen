# Paso 61: lee la ficha de cada remate que ya está en la base y guarda sus datos
# (tribunal, rol de la causa, modalidad, lugar, garantía, hora del remate y tipo de dominio).
#
# Se ejecuta con:
#   python -m app.scraper.cargar_fichas 5     -> lee solo 5 fichas (para probar)
#   python -m app.scraper.cargar_fichas       -> lee todas las que faltan
#
# Si se corta a la mitad no pasa nada: al ejecutarlo de nuevo sigue con las que faltan.
import sys

import requests
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal
from app.models.property import Property, PropertyAuctionInfo, PropertyLegalInfo
from app.scraper.cargar_remates import FUENTE
from app.scraper.ficha_remate import leer_ficha


def recortar(texto: str | None, largo: int) -> str | None:
    # Las columnas cortas de la base tienen un largo máximo; si el texto es más largo, se corta
    return texto[:largo] if texto else None


def guardar_ficha(db, propiedad: Property, ficha: dict) -> None:
    # 1) Datos del remate (si la propiedad ya tenía una fila, se actualiza)
    info = db.get(PropertyAuctionInfo, propiedad.id)
    if not info:
        info = PropertyAuctionInfo(property_id=propiedad.id)
        db.add(info)
    info.source_title = ficha["titulo"]
    info.origin = recortar(ficha["origen"], 100)
    info.court = recortar(ficha["tribunal"], 200)
    info.case_number = recortar(ficha["rol_causa"], 50)
    info.modality = recortar(ficha["modalidad"], 50)
    info.place = ficha["lugar"]
    info.guarantee_amount = ficha["garantia_monto"]
    info.guarantee_text = ficha["garantia"]
    info.payment_method = ficha["forma_pago"]
    info.payment_term = ficha["plazo"]
    info.requirements = ficha["requisitos"]
    info.conditions = ficha["condiciones"]
    info.announcement = ficha["anuncio"]
    info.observations = ficha["observaciones"]

    # 2) Fecha del remate: la ficha trae la hora, que el listado no tenía
    if ficha["fecha_hora"]:
        propiedad.auction_date = ficha["fecha_hora"]

    # 3) Tipo de dominio, para el factor Estado legal del semáforo
    legal = db.query(PropertyLegalInfo).filter_by(property_id=propiedad.id).first()
    if not legal:
        legal = PropertyLegalInfo(property_id=propiedad.id)
        db.add(legal)
    legal.domain_type = ficha["dominio"]

    db.commit()

    # 4) Paso 71: como cambió el dominio, se recalcula el semáforo de esta propiedad
    db.execute(text("SELECT calculate_score(:pid)"), {"pid": str(propiedad.id)})
    db.commit()


def cargar_fichas(maximo: int | None = None) -> dict:
    resumen = {"leidas": 0, "con_hora": 0, "exclusivo": 0, "otro": [], "sin_dominio": 0, "retiradas": [], "con_error": []}
    db = SessionLocal()
    try:
        ya_leidas = {property_id for (property_id,) in db.query(PropertyAuctionInfo.property_id)}
        # Primero las que se rematan antes
        del_scraper = (
            db.query(Property)
            .filter(Property.source_system == FUENTE, Property.source_reference.isnot(None))
            .filter(Property.status != "retirada")  # paso 71: las que el sitio ya retiró no se vuelven a pedir
            .order_by(Property.auction_date)
            .all()
        )
        pendientes = [propiedad for propiedad in del_scraper if propiedad.id not in ya_leidas]
        total_pendientes = len(pendientes)
        if maximo:
            pendientes = pendientes[:maximo]
        print(f"Fichas ya leídas antes: {len(ya_leidas)} | pendientes: {total_pendientes} | se leerán ahora: {len(pendientes)}")

        for numero, propiedad in enumerate(pendientes, start=1):
            referencia = propiedad.source_reference
            titulo = propiedad.title
            try:
                ficha = leer_ficha(referencia)
                if not ficha:
                    # Paso 71: el sitio ya no tiene este remate ("Remate no encontrado"): se marca como retirado.
                    # No se borra: así no se pierden sus vistas ni quienes lo guardaron.
                    propiedad.status = "retirada"
                    db.commit()
                    resumen["retiradas"].append(referencia)
                    continue
                guardar_ficha(db, propiedad, ficha)
            except (requests.RequestException, SQLAlchemyError) as error:
                # Si una ficha falla (sin conexión, dato raro), se anota y se sigue con la siguiente
                db.rollback()
                resumen["con_error"].append(f"{referencia}: {type(error).__name__}")
                continue

            resumen["leidas"] += 1
            if ficha["fecha_hora"] and (ficha["fecha_hora"].hour or ficha["fecha_hora"].minute):
                resumen["con_hora"] += 1
            if ficha["dominio"] == "exclusivo":
                resumen["exclusivo"] += 1
            elif ficha["dominio"] == "otro":
                resumen["otro"].append(f"{referencia} | {titulo} | {ficha['titulo']}")
            else:
                resumen["sin_dominio"] += 1

            if numero % 25 == 0:
                print(f"  ... {numero} de {len(pendientes)}")
    finally:
        db.close()
    return resumen


def mostrar_resumen(resumen: dict) -> None:
    print()
    print("Fichas leídas y guardadas:", resumen["leidas"])
    print("  con hora del remate:    ", resumen["con_hora"])
    print("  dominio exclusivo:      ", resumen["exclusivo"])
    print("  otro dominio:           ", len(resumen["otro"]))
    print("  dominio sin especificar:", resumen["sin_dominio"])
    print("Retiradas por el sitio (marcadas):", len(resumen["retiradas"]), resumen["retiradas"])
    print("Con error:", len(resumen["con_error"]), resumen["con_error"])
    if resumen["otro"]:
        print()
        print("Remates marcados con OTRO dominio (para revisar):")
        for linea in resumen["otro"]:
            print("  -", linea[:150])


if __name__ == "__main__":
    # Si se escribe un número después del comando, se leen como máximo esas fichas
    maximo = int(sys.argv[1]) if len(sys.argv) > 1 else None
    mostrar_resumen(cargar_fichas(maximo))