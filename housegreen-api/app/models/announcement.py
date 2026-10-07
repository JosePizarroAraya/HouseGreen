from sqlalchemy import Column, String, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

# Paso 87: anuncios del administrador (tablas announcements y announcement_recipients)

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))  # quién lo envió
    title = Column(String(120), nullable=False)
    message = Column(String(1000), nullable=False)
    audience = Column(String(20), nullable=False)  # a quiénes va (ver AUDIENCIAS en el router)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))  # solo si es "persona"
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL"))  # "vieron" o "guardaron"
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Esta tabla apunta dos veces a users (admin_id y target_user_id), así que hay que decirle
    # a SQLAlchemy cuál de las dos columnas usa esta relación.
    target_user = relationship("User", foreign_keys=[target_user_id])
    property = relationship("Property")


class AnnouncementRecipient(Base):
    # Una fila por cada persona que recibe un anuncio. La llave son las dos columnas juntas:
    # la misma persona no puede recibir dos veces el mismo anuncio.
    __tablename__ = "announcement_recipients"

    announcement_id = Column(
        UUID(as_uuid=True), ForeignKey("announcements.id", ondelete="CASCADE"), primary_key=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    read_at = Column(TIMESTAMP(timezone=True))  # vacío = todavía no lo lee

    announcement = relationship("Announcement")