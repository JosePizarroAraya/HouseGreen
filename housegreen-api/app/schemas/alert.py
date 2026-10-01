from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class SavedFilterCreate(BaseModel):
    comuna_id: int | None = None
    max_risk_level: str | None = None  # "verde" | "amarillo" | "rojo" | None (cualquiera)
    max_price: Decimal | None = None

class SavedFilterOut(SavedFilterCreate):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

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