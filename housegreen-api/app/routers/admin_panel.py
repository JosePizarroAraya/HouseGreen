from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import requerir_admin
from app.models.property import Property, Comuna, PropertyEvaluation, PropertyView, PropertyFinancialInfo
from app.models.favorite import SavedProperty
from app.models.feedback import Feedback, FeedbackReply
from app.models.user import User
from app.schemas.admin_panel import PanelAdmin, PublicacionMasVista

# Paso 84: Panel del administrador. Solo lectura: junta cifras que ya están en la base.
router = APIRouter(prefix="/admin", tags=["Admin"])

DIAS_DEL_RESUMEN = 7
ROL_INVERSIONISTA_ID = 1
ZONA_CHILE = ZoneInfo("America/Santiago")
CUANTAS_MAS_VISTAS = 5


def _esta_vigente(estado: str | None, fecha_remate: datetime | None, ahora: datetime) -> bool:
    """La misma regla que usa la web para mostrar un remate en el catálogo."""
    if estado == "retirada":
        return False
    if fecha_remate is None:
        return True
    if fecha_remate.tzinfo is None:
        fecha_remate = fecha_remate.replace(tzinfo=timezone.utc)
    en_chile = fecha_remate.astimezone(ZONA_CHILE)
    # Las 00:00 significan "hora no informada": el remate vale hasta que termina ese día
    if en_chile.hour == 0 and en_chile.minute == 0:
        return ahora < en_chile + timedelta(days=1)
    return ahora <= fecha_remate


@router.get("/panel", response_model=PanelAdmin)
def ver_panel(db: Session = Depends(get_db), usuario=Depends(requerir_admin)):
    ahora = datetime.now(timezone.utc)
    desde = ahora - timedelta(days=DIAS_DEL_RESUMEN)

    # 1) Usuarios: solo inversionistas (las cuentas de administrador y analista no cuentan)
    inversionistas = db.query(User).filter(User.role_id == ROL_INVERSIONISTA_ID)
    usuarios_total = inversionistas.count()
    usuarios_nuevos = inversionistas.filter(User.created_at >= desde).count()

    # 2) Publicaciones: se traen solo las columnas que se necesitan
    propiedades = db.query(
        Property.id, Property.title, Property.comuna_id, Property.status, Property.auction_date, Property.created_at
    ).all()
    vigentes = {p.id for p in propiedades if _esta_vigente(p.status, p.auction_date, ahora)}
    publicaciones_nuevas = db.query(Property).filter(Property.created_at >= desde).count()

    # 3) Vistas y guardados del período, por propiedad: { property_id: cantidad }
    vistas = dict(
        db.query(PropertyView.property_id, func.count(PropertyView.id))
        .filter(PropertyView.viewed_at >= desde)
        .group_by(PropertyView.property_id)
        .all()
    )
    guardados = dict(
        db.query(SavedProperty.property_id, func.count(SavedProperty.id))
        .join(User, User.id == SavedProperty.user_id)
        .filter(User.role_id == ROL_INVERSIONISTA_ID, SavedProperty.saved_at >= desde)
        .group_by(SavedProperty.property_id)
        .all()
    )

    # 4) Las más vistas del período (si empatan en vistas, primero la más guardada)
    comunas = dict(db.query(Comuna.id, Comuna.name).all())
    por_id = {p.id: p for p in propiedades}
    ids_ordenados = sorted(vistas, key=lambda pid: (vistas[pid], guardados.get(pid, 0)), reverse=True)
    mas_vistas = [
        PublicacionMasVista(
            id=pid,
            title=por_id[pid].title,
            comuna=comunas.get(por_id[pid].comuna_id),
            vistas=vistas[pid],
            guardados=guardados.get(pid, 0),
        )
        for pid in ids_ordenados[:CUANTAS_MAS_VISTAS]
        if pid in por_id
    ]

    # 5) Semáforo de las publicaciones vigentes: cuenta la última evaluación de cada una.
    #    Se recorren de la más antigua a la más nueva, así queda guardada la más reciente.
    ultimo_nivel = {}
    for property_id, nivel in db.query(PropertyEvaluation.property_id, PropertyEvaluation.result_level).order_by(
        PropertyEvaluation.evaluated_at
    ):
        ultimo_nivel[property_id] = nivel
    semaforo = {"verde": 0, "amarillo": 0, "rojo": 0, "sin_evaluar": 0}
    for pid in vigentes:
        semaforo[ultimo_nivel.get(pid) or "sin_evaluar"] += 1

    # 6) Pendientes del administrador
    con_zona_de_precio = {
        property_id
        for (property_id,) in db.query(PropertyFinancialInfo.property_id).filter(
            PropertyFinancialInfo.market_zone.isnot(None)
        )
    }
    sin_zona_de_precio = len(vigentes - con_zona_de_precio)
    opiniones_por_responder = (
        db.query(Feedback)
        .outerjoin(FeedbackReply, FeedbackReply.feedback_id == Feedback.id)
        .filter(Feedback.allows_reply.is_(True), FeedbackReply.id.is_(None))
        .count()
    )

    return PanelAdmin(
        dias=DIAS_DEL_RESUMEN,
        usuarios_nuevos=usuarios_nuevos,
        usuarios_total=usuarios_total,
        publicaciones_nuevas=publicaciones_nuevas,
        publicaciones_vigentes=len(vigentes),
        vistas=sum(vistas.values()),
        guardados=sum(guardados.values()),
        mas_vistas=mas_vistas,
        semaforo=semaforo,
        sin_zona_de_precio=sin_zona_de_precio,
        opiniones_por_responder=opiniones_por_responder,
    )