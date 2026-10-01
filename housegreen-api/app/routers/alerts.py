from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.models.alert import SavedFilter, Alert
from app.models.property import Property
from app.models.user import User
from app.schemas.alert import SavedFilterCreate, SavedFilterOut, AlertOut
from app.auth.dependencies import get_current_user

router = APIRouter(tags=["Alertas"])

# --- Orden de severidad, igual que usamos en el motor de reglas del frontend,
# para poder comparar "el riesgo de esta propiedad es igual o menor al máximo aceptado" ---
ORDEN_RIESGO = {"verde": 0, "amarillo": 1, "rojo": 2}

def notificar_nueva_propiedad(db: Session, propiedad: Property, nivel_riesgo: str):
    # Recorre TODOS los filtros guardados de TODOS los usuarios, y genera
    # una notificación para cada uno que calce con esta propiedad nueva.
    # Se llama automáticamente desde properties.py al crear una propiedad.
    filtros = db.query(SavedFilter).all()

    for filtro in filtros:
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

    db.commit()

# --- Endpoints de filtros guardados ---

@router.get("/alertas/filtros", response_model=list[SavedFilterOut])
def listar_filtros(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    return db.query(SavedFilter).filter(SavedFilter.user_id == usuario.id).all()

@router.post("/alertas/filtros", response_model=SavedFilterOut)
def crear_filtro(
    datos: SavedFilterCreate, db: Session = Depends(get_db), usuario: User = Depends(get_current_user)
):
    nuevo_filtro = SavedFilter(user_id=usuario.id, **datos.model_dump())
    db.add(nuevo_filtro)
    db.commit()
    db.refresh(nuevo_filtro)
    return nuevo_filtro

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
        raise HTTPException(status_code=404, detail="Filtro no encontrado")
    db.delete(filtro)
    db.commit()
    return {"mensaje": "Filtro eliminado"}

# --- Endpoints de notificaciones ---

@router.get("/alertas", response_model=list[AlertOut])
def listar_notificaciones(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    alertas = (
        db.query(Alert)
        .filter(Alert.user_id == usuario.id)
        .order_by(Alert.created_at.desc())
        .all()
    )
    resultado = []
    for alerta in alertas:
        propiedad = db.query(Property).filter(Property.id == alerta.property_id).first()
        resultado.append(
            AlertOut(
                id=alerta.id,
                property_id=alerta.property_id,
                property_title=propiedad.title if propiedad else None,
                property_image_url=propiedad.image_url if propiedad else None,
                alert_type=alerta.alert_type,
                message=alerta.message,
                is_read=alerta.is_read,
                created_at=alerta.created_at,
            )
        )
    return resultado

@router.patch("/alertas/{alert_id}/leida")
def marcar_leida(alert_id: UUID, db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    alerta = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == usuario.id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    alerta.is_read = True
    db.commit()
    return {"mensaje": "Marcada como leída"}