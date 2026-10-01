from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.sql import func
import uuid
from app.database import Base

class SavedFilter(Base):
    __tablename__ = "saved_filters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comuna_id = Column(Integer, ForeignKey("comunas.id"))
    max_risk_level = Column(ENUM("verde", "amarillo", "rojo", name="semaforo_level"))
    max_price = Column(Numeric(14, 2))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    alert_type = Column(
        ENUM("nueva_propiedad", "cambio_precio", "cambio_semaforo", "cambio_estado", name="alert_type"),
        nullable=False,
    )
    message = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())