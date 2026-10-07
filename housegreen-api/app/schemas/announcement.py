from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

# Paso 87: anuncios

# Lo que la web ENVÍA cuando el administrador manda un anuncio
class AnnouncementCreate(BaseModel):
    title: str  # hasta 120 caracteres
    message: str  # hasta 1000 caracteres
    audience: str  # "todos", "persona", "vieron" o "guardaron"
    target_user_id: UUID | None = None  # obligatorio si audience es "persona"
    property_id: UUID | None = None  # obligatorio si audience es "vieron" o "guardaron"

# Lo que la API DEVUELVE al administrador por cada anuncio enviado
class AnnouncementAdminOut(BaseModel):
    id: UUID
    title: str
    message: str
    audience: str
    target_user_id: UUID | None = None
    property_id: UUID | None = None
    created_at: datetime
    persona: str | None = None  # nombre de la persona (si el anuncio fue para una sola)
    publicacion: str | None = None  # título de la publicación (si fue para quienes la vieron o guardaron)
    destinatarios: int  # a cuántas personas les llegó
    leidos: int  # cuántas ya lo leyeron


# ---------- Paso 89: lo que ve quien recibe el anuncio ----------

class AnnouncementOut(BaseModel):
    id: UUID
    title: str
    message: str
    created_at: datetime
    read_at: datetime | None = None  # vacío = todavía no lo lee
    property_id: UUID | None = None  # si el anuncio es sobre una publicación, para poder abrirla
    publicacion: str | None = None  # título de esa publicación