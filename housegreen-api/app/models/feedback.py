from sqlalchemy import Column, String, Boolean, SmallInteger, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

# Paso 81: opiniones de los usuarios sobre HouseGreen (tablas feedback y feedback_replies)

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(SmallInteger, nullable=False)  # calificación de 1 a 5
    topic = Column(String(30), nullable=False)  # tema (ver TEMAS en el router)
    message = Column(String(500))  # opcional
    allows_reply = Column(Boolean, nullable=False, default=False)  # si acepta que le respondan
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    user = relationship("User")
    # Las respuestas del administrador, de la más antigua a la más nueva
    replies = relationship("FeedbackReply", order_by="FeedbackReply.created_at", cascade="all, delete-orphan")


class FeedbackReply(Base):
    __tablename__ = "feedback_replies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feedback_id = Column(UUID(as_uuid=True), ForeignKey("feedback.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    message = Column(String(1000), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())