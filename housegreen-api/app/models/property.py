from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, TIMESTAMP, Text, Date, CheckConstraint, Computed
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    
class Comuna(Base):
    __tablename__ = "comunas"

    id = Column(Integer, primary_key=True)
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=False)
    name = Column(String(100), nullable=False)
    postal_code = Column(String(20))

class ComunaRiskIndex(Base):
    __tablename__ = "comuna_risk_index"

    id = Column(Integer, primary_key=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False)
    level = Column(ENUM("verde", "amarillo", "rojo", name="semaforo_level"), nullable=False)
    source = Column(Text)
    updated_at = Column(Date, server_default=func.current_date())
    active = Column(Boolean, default=True)

class Property(Base):
    __tablename__ = "properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False)
    title = Column(String(200), nullable=False)
    address = Column(String(255))
    property_type = Column(String(50), nullable=False)
    auction_type = Column(ENUM("judicial", "contribuciones", "banco", "extrajudicial", name="auction_type"), nullable=False)
    opening_price = Column(Numeric(14, 2), nullable=False)
    auction_date = Column(TIMESTAMP(timezone=True))  # Paso 36: fecha y hora del remate (puede venir vacía)
    status = Column(
        ENUM("disponible", "en_evaluacion", "rematada", "retirada", name="property_status"),
        default="disponible",
    )
    source_system = Column(String(30))
    source_reference = Column(String(100))
    image_url = Column(String(500))
    description = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # Estas relationship() permiten hacer property.comuna.name, property.financial_info.repair_cost, etc.
    # uselist=False porque son relaciones 1 a 1 (cada propiedad tiene UN solo registro financiero, legal, etc.)
    comuna = relationship("Comuna")
    financial_info = relationship("PropertyFinancialInfo", uselist=False, backref="property")
    legal_info = relationship("PropertyLegalInfo", uselist=False, backref="property")
    physical_info = relationship("PropertyPhysicalInfo", uselist=False, backref="property")
    occupancy_info = relationship("PropertyOccupancyInfo", uselist=False, backref="property")
    market_dynamics = relationship("PropertyMarketDynamics", uselist=False, backref="property")
    market_comparables = relationship("PropertyMarketComparable", backref="property")
    debts = relationship("PropertyDebt", backref="property")

class PropertyFinancialInfo(Base):
    __tablename__ = "property_financial_info"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), unique=True, nullable=False)
    estimated_value_arv = Column(Numeric(14, 2))
    repair_cost = Column(Numeric(14, 2))
    expected_return = Column(Numeric(6, 2))

class PropertyLegalInfo(Base):
    __tablename__ = "property_legal_info"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), unique=True, nullable=False)
    title_status = Column(
        ENUM("limpio", "con_gravamen", "en_disputa", "desconocido", name="title_status"),
        default="desconocido",
    )
    has_liens = Column(Boolean, default=False)
    num_liens = Column(Integer, default=1)
    lifetime_usufruct = Column(Boolean, default=False)
    unresolved_inheritance = Column(Boolean, default=False)
    expropriation_ban = Column(Boolean, default=False)

class PropertyPhysicalInfo(Base):
    __tablename__ = "property_physical_info"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), unique=True, nullable=False)
    bedrooms = Column(Integer)
    bathrooms = Column(Integer)
    surface_m2 = Column(Numeric(8, 2))

class PropertyOccupancyInfo(Base):
    __tablename__ = "property_occupancy_info"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), unique=True, nullable=False)
    status = Column(ENUM("desocupada", "ocupada", "desconocida", name="occupation_status"), default="desconocida")
    estimated_months = Column(Numeric(5, 1))
    source = Column(String(150))

class PropertyMarketDynamics(Base):
    __tablename__ = "property_market_dynamics"

    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True)
    liquidity_months = Column(Numeric(5, 1), nullable=False)
    source = Column(String(150))

class PropertyEvaluation(Base):
    __tablename__ = "property_evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    result_level = Column(ENUM("verde", "amarillo", "rojo", name="semaforo_level"), nullable=False)
    score = Column(Numeric(6, 2))
    total_points = Column(Integer)
    veto_applied = Column(Boolean, default=False)
    veto_reason = Column(Text)
    is_complete = Column(Boolean, default=False)
    evaluated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class PropertyMarketComparable(Base):
    __tablename__ = "property_market_comparables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    reference_address = Column(String(255))
    sale_price = Column(Numeric(14, 2), nullable=False)
    surface_m2 = Column(Numeric(8, 2), nullable=False)
    price_per_m2 = Column(Numeric(14, 2), Computed("sale_price / surface_m2"))
    distance_km = Column(Numeric(6, 2))
    reference_date = Column(Date)
    is_auction = Column(Boolean, default=False)

class PropertyDebt(Base):
    __tablename__ = "property_debts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    debt_type = Column(ENUM("contribuciones", "gastos_comunes", "otras", name="debt_type"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    verified = Column(Boolean, default=False)
    verified_at = Column(Date)
    
class PropertyView(Base):
    # Una fila por cada vez que un usuario abre el detalle de una propiedad (tabla del paso 10)
    __tablename__ = "property_views"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    viewed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    

class PropertyPhoto(Base):
    # Fotos que sube el admin (tabla del paso 22). La de position 0 es la portada.
    __tablename__ = "property_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(500), nullable=False)
    label = Column(String(40))
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())