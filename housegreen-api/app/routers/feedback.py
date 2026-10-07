from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models.feedback import Feedback, FeedbackReply
from app.models.user import User
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackOut,
    FeedbackAdminOut,
    FeedbackAdminList,
    FeedbackSummary,
    FeedbackReplyCreate,
)
from app.auth.dependencies import get_current_user, requerir_admin

# Paso 81: opiniones de los usuarios sobre HouseGreen
router = APIRouter(prefix="/opiniones", tags=["Opiniones"])
# Paso 83: lo que hace el administrador con las opiniones
router_admin = APIRouter(prefix="/admin/opiniones", tags=["Admin"])

# Temas permitidos (los mismos que acepta la base de datos y que muestra la web)
TEMAS = {"catalogo", "propiedad", "semaforo", "alertas", "cuenta", "otro"}

LARGO_MAXIMO_DEL_MENSAJE = 500
LARGO_MAXIMO_DE_LA_RESPUESTA = 1000
MAXIMO_POR_DIA = 5  # para que nadie llene la lista de opiniones repetidas


@router.post("", response_model=FeedbackOut)
def enviar_opinion(
    datos: FeedbackCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    if not 1 <= datos.rating <= 5:
        raise HTTPException(status_code=400, detail="La calificación debe ser de 1 a 5.")
    if datos.topic not in TEMAS:
        raise HTTPException(status_code=400, detail="Elige un tema de la lista.")

    mensaje = (datos.message or "").strip()
    if len(mensaje) > LARGO_MAXIMO_DEL_MENSAJE:
        raise HTTPException(
            status_code=400,
            detail=f"El mensaje puede tener como máximo {LARGO_MAXIMO_DEL_MENSAJE} caracteres.",
        )

    # Límite por día: se cuentan las opiniones de esta persona en las últimas 24 horas
    hace_un_dia = datetime.now(timezone.utc) - timedelta(hours=24)
    enviadas_hoy = (
        db.query(Feedback).filter(Feedback.user_id == usuario.id, Feedback.created_at >= hace_un_dia).count()
    )
    if enviadas_hoy >= MAXIMO_POR_DIA:
        raise HTTPException(
            status_code=400,
            detail=f"Ya enviaste {MAXIMO_POR_DIA} opiniones en las últimas 24 horas. Mañana puedes enviar otra.",
        )

    opinion = Feedback(
        user_id=usuario.id,
        rating=datos.rating,
        topic=datos.topic,
        message=mensaje or None,  # sin texto se guarda vacío (NULL)
        allows_reply=datos.allows_reply,
    )
    db.add(opinion)
    db.commit()
    db.refresh(opinion)
    return opinion


# Las opiniones que envió la persona de la sesión, con las respuestas del administrador
@router.get("/mias", response_model=list[FeedbackOut])
def mis_opiniones(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    return (
        db.query(Feedback)
        .filter(Feedback.user_id == usuario.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )


# ---------- Paso 83: administrador ----------

def _opinion_para_el_admin(opinion: Feedback) -> FeedbackAdminOut:
    return FeedbackAdminOut(
        id=opinion.id,
        rating=opinion.rating,
        topic=opinion.topic,
        message=opinion.message,
        allows_reply=opinion.allows_reply,
        created_at=opinion.created_at,
        replies=opinion.replies,
        user_name=opinion.user.full_name,
        user_email=opinion.user.email,
    )


# Todas las opiniones (la más nueva primero) y un resumen: promedio, cuántas hay de cada
# calificación y cuántas esperan respuesta.
@router_admin.get("", response_model=FeedbackAdminList)
def listar_opiniones(db: Session = Depends(get_db), usuario: User = Depends(requerir_admin)):
    opiniones = (
        db.query(Feedback)
        # joinedload y selectinload traen a la persona y las respuestas en la misma consulta,
        # en vez de hacer una consulta por cada opinión
        .options(joinedload(Feedback.user), selectinload(Feedback.replies))
        .order_by(Feedback.created_at.desc())
        .all()
    )

    por_calificacion = {numero: 0 for numero in range(1, 6)}
    for opinion in opiniones:
        por_calificacion[opinion.rating] += 1

    total = len(opiniones)
    resumen = FeedbackSummary(
        total=total,
        average=round(sum(o.rating for o in opiniones) / total, 1) if total else None,
        by_rating=por_calificacion,
        pending_reply=sum(1 for o in opiniones if o.allows_reply and not o.replies),
    )
    return FeedbackAdminList(summary=resumen, items=[_opinion_para_el_admin(o) for o in opiniones])


# El administrador responde una opinión. Solo se puede si la persona aceptó que le respondan.
@router_admin.post("/{feedback_id}/respuesta", response_model=FeedbackAdminOut)
def responder_opinion(
    feedback_id: UUID,
    datos: FeedbackReplyCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(requerir_admin),
):
    opinion = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not opinion:
        raise HTTPException(status_code=404, detail="Opinión no encontrada")
    if not opinion.allows_reply:
        raise HTTPException(status_code=400, detail="Esta persona no autorizó que le respondan.")

    mensaje = datos.message.strip()
    if not mensaje:
        raise HTTPException(status_code=400, detail="Escribe la respuesta.")
    if len(mensaje) > LARGO_MAXIMO_DE_LA_RESPUESTA:
        raise HTTPException(
            status_code=400,
            detail=f"La respuesta puede tener como máximo {LARGO_MAXIMO_DE_LA_RESPUESTA} caracteres.",
        )

    db.add(FeedbackReply(feedback_id=opinion.id, admin_id=usuario.id, message=mensaje))
    db.commit()
    db.refresh(opinion)
    return _opinion_para_el_admin(opinion)