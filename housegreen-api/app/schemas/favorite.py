from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.schemas.property import PropertyOut

class FavoriteCreate(BaseModel):
    notes: str | None = None

class FavoriteOut(BaseModel):
    id: UUID
    property_id: UUID
    notes: str | None = None
    saved_at: datetime
    property: PropertyOut  # trae la propiedad completa, no solo el id

    class Config:
        from_attributes = True