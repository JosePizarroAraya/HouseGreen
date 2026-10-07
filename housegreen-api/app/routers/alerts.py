from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import SavedFilter, Alert
from app.models.property import Comuna, Property
from app.models.user import User
from app.schemas.alert import SavedFilterCreate, SavedFilterOut, AlertOut
from app.auth.dependencies import get_current_user

router = APIRouter(tags=["Alertas"])

# Orden de los niveles, para poder comparar "el riesgo de esta propiedad es igual o menor al máximo aceptado"
ORDEN_RIESGO = {"verde": 0, "amarillo": 1, "rojo": 2}

MAXIMO_DE_ALERTAS = 10  # por persona
PRECIO_TOPE = Decimal("1000000000000")  # la columna de la base guarda hasta 12 cifras


def notificar_nueva_propiedad(db: Session, propiedad: Property, nivel_riesgo: str):
    # Recorre TODOS los filtros guardados de TODOS los usuarios, y genera
    # una notificación para cada uno que calce con esta propiedad nueva.
    # Se llama automáticamente desde properties.py al crear una propiedad
    # (también cuando la crea el scraper, que usa esa misma función).
    filtros = db.query(SavedFilter).all()
    avisados = set()  # paso 93: aunque calce con varias de sus alertas, cada persona recibe UN aviso por propiedad

    for filtro in filtros:
        if filtro.user_id in avisados:
            continue
        coincide_comuna = filtro.comuna_id is None or filtro.comuna_id == propiedad.comuna_id
        coincide_riesgo = (
            filtro.max_risk_level is None
            or ORDEN_RIESGO[nivel_riesgo] <= ORDEN_RIESGO[filtro.max_risk_level]
        )
        coincide_precio = filtro.max_price is None or propiedad.opening_price <= filtro.max_price

        if coincide_comuna and coincide_riesgo and coincide_precio:
            nueva_alerta = Alert(
                user_id=filtro.user_id,
                property_id=propiedad.id,
                alert_type="nueva_propiedad",
                message=f"Nueva propiedad que calza con tus filtros: {propiedad.title}",
            )
            db.add(nueva_alerta)
            avisados.add(filtro.user_id)

    db.commit()


# ---------- Alertas (lo que la persona pide que le avisen) ----------

def _alerta_para_la_web(filtro: SavedFilter, comunas: dict) -> SavedFilterOut:
    return SavedFilterOut(
        id=filtro.id,
        comuna_id=filtro.comuna_id,
        max_risk_level=filtro.max_risk_level,
        max_price=filtro.max_price,
        created_at=filtro.created_at,
        comuna_name=comunas.get(filtro.comuna_id),
    )


@router.get("/alertas/filtros", response_model=list[SavedFilterOut])
def listar_filtros(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    filtros = (
        db.query(SavedFilter)
        .filter(SavedFilter.user_id == usuario.id)
        .order_by(SavedFilter.created_at.desc())  # la más nueva primero
        .all()
    )
    comunas = dict(db.query(Comuna.id, Comuna.name).all())  # { id: nombre }
    return [_alerta_para_la_web(filtro, comunas) for filtro in filtros]


@router.post("/alertas/filtros", response_model=SavedFilterOut)
def crear_filtro(
    datos: SavedFilterCreate, db: Session = Depends(get_db), usuario: User = Depends(get_current_user)
):
    # Paso 93: se revisa lo que llega antes de guardarlo
    if datos.comuna_id is None and datos.max_risk_level is None and datos.max_price is None:
        raise HTTPException(status_code=400, detail="Elige al menos una condición: comuna, riesgo o precio.")

    comuna = None
    if datos.comuna_id is not None:
        comuna = db.query(Comuna).filter(Comuna.id == datos.comuna_id).first()
        if not comuna:
            raise HTTPException(status_code=400, detail="Elige una comuna de la lista.")

    if datos.max_risk_level is not None and datos.max_risk_level not in ORDEN_RIESGO:
        raise HTTPException(status_code=400, detail="Elige un nivel de riesgo de la lista.")

    if datos.max_price is not None:
        if datos.max_price <= 0:
            raise HTTPException(status_code=400, detail="El precio máximo debe ser mayor que cero.")
        if datos.max_price >= PRECIO_TOPE:
            raise HTTPException(status_code=400, detail="El precio máximo es demasiado alto.")

    mias = db.query(SavedFilter).filter(SavedFilter.user_id == usuario.id).all()
    if len(mias) >= MAXIMO_DE_ALERTAS:
        raise HTTPException(
            status_code=400,
            detail=f"Puedes tener hasta {MAXIMO_DE_ALERTAS} alertas. Elimina una para crear otra.",
        )
    for otra in mias:
        if (
            otra.comuna_id == datos.comuna_id
            and otra.max_risk_level == datos.max_risk_level
            and otra.max_price == datos.max_price
        ):
            raise HTTPException(status_code=400, detail="Ya tienes una alerta con esas mismas condiciones.")

    nuevo_filtro = SavedFilter(user_id=usuario.id, **datos.model_dump())
    db.add(nuevo_filtro)
    db.commit()
    db.refresh(nuevo_filtro)
    return _alerta_para_la_web(nuevo_filtro, {comuna.id: comuna.name} if comuna else {})


@router.delete("/alertas/filtros/{filtro_id}")
def eliminar_filtro(
    filtro_id: UUID, db: Session = Depends(get_db), usuario: User = Depends(get_current_user)
):
    filtro = (
        db.query(SavedFilter)
        .filter(SavedFilter.id == filtro_id, SavedFilter.user_id == usuario.id)
        .first()
    )
    if not filtro:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    db.delete(filtro)
    db.commit()
    return {"mensaje": "Alerta eliminada"}


# ---------- Notificaciones (propiedades que calzaron con una alerta) ----------

@router.get("/alertas", response_model=list[AlertOut])
def listar_notificaciones(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    alertas = (
        db.query(Alert)
        .filter(Alert.user_id == usuario.id)
        .order_by(Alert.created_at.desc())
        .all()
    )

    # Paso 93: las propiedades de todas las notificaciones se piden en UNA consulta
    # (antes se hacía una consulta por cada notificación)
    ids = {alerta.property_id for alerta in alertas if alerta.property_id is not None}
    propiedades = {p.id: p for p in db.query(Property).filter(Property.id.in_(ids))} if ids else {}

    resultado = []
    for alerta in alertas:
        propiedad = propiedades.get(alerta.property_id)
        resultado.append(
            AlertOut(
                id=alerta.id,
                property_id=alerta.property_id,
                property_title=propiedad.title if propiedad else None,
                property_image_url=propiedad.image_url if propiedad else None,
                alert_type=alerta.alert_type,
                message=alerta.message,
                is_read=bool(alerta.is_read),
                created_at=alerta.created_at,
            )
        )
    return resultado


# Paso 93: marca como leídas todas las notificaciones de la persona
@router.post("/alertas/leidas")
def marcar_todas_leidas(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    marcadas = (
        db.query(Alert)
        .filter(Alert.user_id == usuario.id, Alert.is_read.isnot(True))
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"marcadas": marcadas}


@router.patch("/alertas/{alert_id}/leida")
def marcar_leida(alert_id: UUID, db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    alerta = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == usuario.id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    alerta.is_read = True
    db.commit()
    return {"mensaje": "Marcada como leída"}