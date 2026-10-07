from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.auth.dependencies import get_current_user, requerir_admin
from app.models.announcement import Announcement, AnnouncementRecipient
from app.models.favorite import SavedProperty
from app.models.property import Property, PropertyView
from app.models.user import User
from app.schemas.announcement import AnnouncementCreate, AnnouncementAdminOut, AnnouncementOut

# Paso 87: anuncios que el administrador envía a los inversionistas.
# Llegan dentro de HouseGreen (no por correo) y se envían en el momento.
router_admin = APIRouter(prefix="/admin/anuncios", tags=["Admin"])
# Paso 89: lo que hace quien recibe los anuncios
router = APIRouter(prefix="/anuncios", tags=["Anuncios"])

# A quiénes puede ir un anuncio (los mismos valores que acepta la base de datos)
AUDIENCIAS = {"todos", "persona", "vieron", "guardaron"}

LARGO_MAXIMO_DEL_TITULO = 120
LARGO_MAXIMO_DEL_MENSAJE = 1000
ROL_INVERSIONISTA_ID = 1


def _para_el_admin(anuncio: Announcement, destinatarios: int, leidos: int) -> AnnouncementAdminOut:
    return AnnouncementAdminOut(
        id=anuncio.id,
        title=anuncio.title,
        message=anuncio.message,
        audience=anuncio.audience,
        target_user_id=anuncio.target_user_id,
        property_id=anuncio.property_id,
        created_at=anuncio.created_at,
        persona=anuncio.target_user.full_name if anuncio.target_user else None,
        publicacion=anuncio.property.title if anuncio.property else None,
        destinatarios=destinatarios,
        leidos=leidos,
    )


# El administrador envía un anuncio. Se guarda el anuncio y una fila por cada persona que lo recibe.
@router_admin.post("", response_model=AnnouncementAdminOut)
def enviar_anuncio(
    datos: AnnouncementCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(requerir_admin),
):
    titulo = datos.title.strip()
    mensaje = datos.message.strip()
    if not titulo:
        raise HTTPException(status_code=400, detail="Escribe el título del anuncio.")
    if len(titulo) > LARGO_MAXIMO_DEL_TITULO:
        raise HTTPException(
            status_code=400,
            detail=f"El título puede tener como máximo {LARGO_MAXIMO_DEL_TITULO} caracteres.",
        )
    if not mensaje:
        raise HTTPException(status_code=400, detail="Escribe el mensaje del anuncio.")
    if len(mensaje) > LARGO_MAXIMO_DEL_MENSAJE:
        raise HTTPException(
            status_code=400,
            detail=f"El mensaje puede tener como máximo {LARGO_MAXIMO_DEL_MENSAJE} caracteres.",
        )
    if datos.audience not in AUDIENCIAS:
        raise HTTPException(status_code=400, detail="Elige a quiénes va el anuncio.")

    # Los anuncios solo llegan a inversionistas con la cuenta habilitada
    inversionistas = db.query(User.id).filter(User.role_id == ROL_INVERSIONISTA_ID, User.is_active.is_(True))

    persona_id = None
    publicacion_id = None

    if datos.audience == "todos":
        destinatarios = [fila.id for fila in inversionistas]
        if not destinatarios:
            raise HTTPException(status_code=400, detail="Todavía no hay inversionistas registrados.")

    elif datos.audience == "persona":
        if datos.target_user_id is None:
            raise HTTPException(status_code=400, detail="Elige a la persona.")
        persona = db.query(User).filter(User.id == datos.target_user_id).first()
        if not persona:
            raise HTTPException(status_code=404, detail="Persona no encontrada")
        if persona.role_id != ROL_INVERSIONISTA_ID:
            raise HTTPException(status_code=400, detail="Los anuncios son solo para inversionistas.")
        if not persona.is_active:
            raise HTTPException(status_code=400, detail="Esa cuenta está deshabilitada.")
        persona_id = persona.id
        destinatarios = [persona.id]

    else:  # "vieron" o "guardaron": depende de una publicación
        if datos.property_id is None:
            raise HTTPException(status_code=400, detail="Elige la publicación.")
        publicacion = db.query(Property).filter(Property.id == datos.property_id).first()
        if not publicacion:
            raise HTTPException(status_code=404, detail="Publicación no encontrada")
        publicacion_id = publicacion.id

        if datos.audience == "vieron":
            quienes = db.query(PropertyView.user_id).filter(PropertyView.property_id == publicacion.id)
            nadie = "Nadie ha visto esa publicación todavía."
        else:
            quienes = db.query(SavedProperty.user_id).filter(SavedProperty.property_id == publicacion.id)
            nadie = "Nadie tiene guardada esa publicación."

        # User.id.in_(...) deja solo a los inversionistas que aparecen en la otra consulta.
        # Aunque alguien haya visto la publicación varias veces, aquí sale una sola vez.
        destinatarios = [fila.id for fila in inversionistas.filter(User.id.in_(quienes))]
        if not destinatarios:
            raise HTTPException(status_code=400, detail=nadie)

    anuncio = Announcement(
        admin_id=usuario.id,
        title=titulo,
        message=mensaje,
        audience=datos.audience,
        target_user_id=persona_id,
        property_id=publicacion_id,
    )
    db.add(anuncio)
    db.flush()  # flush le pide el id a la base sin terminar la operación; se necesita para las filas de abajo
    db.add_all([AnnouncementRecipient(announcement_id=anuncio.id, user_id=user_id) for user_id in destinatarios])
    db.commit()  # el anuncio y sus destinatarios se guardan juntos: o todo o nada
    db.refresh(anuncio)
    return _para_el_admin(anuncio, destinatarios=len(destinatarios), leidos=0)


# Los anuncios enviados (el más nuevo primero), con a cuántas personas les llegó y cuántas lo leyeron
@router_admin.get("", response_model=list[AnnouncementAdminOut])
def listar_anuncios(db: Session = Depends(get_db), usuario: User = Depends(requerir_admin)):
    # Una sola consulta para contar los destinatarios de todos los anuncios.
    # count(read_at) cuenta solo las filas donde read_at tiene fecha: esos son los que ya lo leyeron.
    cuentas = {
        announcement_id: (total, leidos)
        for announcement_id, total, leidos in db.query(
            AnnouncementRecipient.announcement_id,
            func.count(AnnouncementRecipient.user_id),
            func.count(AnnouncementRecipient.read_at),
        ).group_by(AnnouncementRecipient.announcement_id)
    }

    anuncios = (
        db.query(Announcement)
        .options(joinedload(Announcement.target_user), joinedload(Announcement.property))
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return [_para_el_admin(anuncio, *cuentas.get(anuncio.id, (0, 0))) for anuncio in anuncios]


# ---------- Paso 89: quien recibe los anuncios ----------

def _para_quien_lo_recibe(anuncio: Announcement, read_at) -> AnnouncementOut:
    return AnnouncementOut(
        id=anuncio.id,
        title=anuncio.title,
        message=anuncio.message,
        created_at=anuncio.created_at,
        read_at=read_at,
        property_id=anuncio.property_id,
        publicacion=anuncio.property.title if anuncio.property else None,
    )


# Los anuncios que recibió la persona de la sesión (el más nuevo primero)
@router.get("", response_model=list[AnnouncementOut])
def mis_anuncios(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    filas = (
        # Se piden dos cosas por fila: el anuncio y la fecha en que ESTA persona lo leyó
        db.query(Announcement, AnnouncementRecipient.read_at)
        .join(AnnouncementRecipient, AnnouncementRecipient.announcement_id == Announcement.id)
        .filter(AnnouncementRecipient.user_id == usuario.id)
        .options(joinedload(Announcement.property))
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return [_para_quien_lo_recibe(anuncio, read_at) for anuncio, read_at in filas]


# La persona abrió un anuncio: queda marcado como leído (solo la primera vez se guarda la fecha)
@router.patch("/{announcement_id}/leido", response_model=AnnouncementOut)
def marcar_leido(
    announcement_id: UUID,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    # Se busca la fila de ESTA persona: así nadie puede marcar (ni ver) un anuncio que no recibió
    fila = (
        db.query(AnnouncementRecipient)
        .filter(
            AnnouncementRecipient.announcement_id == announcement_id,
            AnnouncementRecipient.user_id == usuario.id,
        )
        .first()
    )
    if not fila:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")

    if fila.read_at is None:
        fila.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(fila)
    return _para_quien_lo_recibe(fila.announcement, fila.read_at)