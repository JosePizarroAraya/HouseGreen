from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

# Paso 81: opiniones

# Lo que la web ENVÍA al dejar una opinión
class FeedbackCreate(BaseModel):
    rating: int  # 1 a 5
    topic: str  # uno de los temas permitidos
    message: str | None = None  # opcional, hasta 500 caracteres
    allows_reply: bool = False

# Una respuesta del administrador
class FeedbackReplyOut(BaseModel):
    id: UUID
    message: str
    created_at: datetime

    class Config:
        from_attributes = True

# Lo que la API DEVUELVE por cada opinión
class FeedbackOut(BaseModel):
    id: UUID
    rating: int
    topic: str
    message: str | None = None
    allows_reply: bool
    created_at: datetime
    replies: list[FeedbackReplyOut] = []

    class Config:
        from_attributes = True


# ---------- Paso 83: lo que ve y envía el administrador ----------

# Una opinión con los datos de quien la envió
class FeedbackAdminOut(FeedbackOut):
    user_name: str
    user_email: str

# Resumen de todas las opiniones
class FeedbackSummary(BaseModel):
    total: int
    average: float | None = None  # promedio de 1 a 5 (vacío si todavía no hay opiniones)
    by_rating: dict[int, int]  # cuántas opiniones hay de cada calificación: {1: 0, 2: 3, ...}
    pending_reply: int  # aceptan respuesta y todavía no tienen ninguna

class FeedbackAdminList(BaseModel):
    summary: FeedbackSummary
    items: list[FeedbackAdminOut]

# Lo que la web ENVÍA cuando el administrador responde
class FeedbackReplyCreate(BaseModel):
    message: str