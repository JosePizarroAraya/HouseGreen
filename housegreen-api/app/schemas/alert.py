from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from decimal import Decimal

# Una "alerta" es lo que la persona pide que le avisen: una comuna, un riesgo máximo y/o un precio máximo.
# En la base se guarda en la tabla saved_filters.

# Lo que la web ENVÍA al crear una alerta
class SavedFilterCreate(BaseModel):
    comuna_id: int | None = None  # vacío = cualquier comuna
    max_risk_level: str | None = None  # "verde" | "amarillo" | "rojo" | vacío (cualquier riesgo)
    max_price: Decimal | None = None  # vacío = sin tope de precio

# Lo que la API DEVUELVE por cada alerta
class SavedFilterOut(SavedFilterCreate):
    id: UUID
    created_at: datetime
    comuna_name: str | None = None  # paso 93: el nombre de la comuna, para mostrarlo sin buscarlo aparte

    class Config:
        from_attributes = True

# Una notificación: una propiedad que calzó con alguna alerta de la persona (tabla alerts)
class AlertOut(BaseModel):
    id: UUID
    property_id: UUID | None = None
    property_title: str | None = None
    property_image_url: str | None = None
    alert_type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True