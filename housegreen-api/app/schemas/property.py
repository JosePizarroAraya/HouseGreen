from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from datetime import date
# --- Sub-schemas: uno por cada tabla relacionada ---
class ComparableIn(BaseModel):
    reference_address: str | None = None
    sale_price: Decimal
    surface_m2: Decimal
    distance_km: Decimal | None = None
    reference_date: date | None = None
    is_auction: bool = False

class ComparableOut(BaseModel):
    reference_address: str | None = None
    sale_price: Decimal
    surface_m2: Decimal
    price_per_m2: Decimal | None = None
    distance_km: Decimal | None = None
    reference_date: date | None = None
    is_auction: bool

    class Config:
        from_attributes = True
        
class DebtIn(BaseModel):
    debt_type: str  # "contribuciones" | "gastos_comunes" | "otras"
    amount: Decimal
    verified: bool = False
    verified_at: date | None = None

class DebtOut(DebtIn):
    class Config:
        from_attributes = True

class FinancialInfoOut(BaseModel):
    estimated_value_arv: Decimal | None = None
    repair_cost: Decimal | None = None
    expected_return: Decimal | None = None

    class Config:
        from_attributes = True

class LegalInfoOut(BaseModel):
    title_status: str
    has_liens: bool
    num_liens: int
    lifetime_usufruct: bool
    unresolved_inheritance: bool
    expropriation_ban: bool

    class Config:
        from_attributes = True

class PhysicalInfoOut(BaseModel):
    bedrooms: int | None = None
    bathrooms: int | None = None
    surface_m2: Decimal | None = None

    class Config:
        from_attributes = True

class OccupancyInfoOut(BaseModel):
    status: str
    estimated_months: Decimal | None = None

    class Config:
        from_attributes = True

class MarketDynamicsOut(BaseModel):
    liquidity_months: Decimal

    class Config:
        from_attributes = True

class EvaluationOut(BaseModel):
    result_level: str
    score: Decimal | None = None
    total_points: int | None = None
    veto_applied: bool
    veto_reason: str | None = None
    is_complete: bool
    evaluated_at: datetime

    class Config:
        from_attributes = True

# --- Schema principal: lo que la API devuelve para una propiedad ---

class PropertyOut(BaseModel):
    id: UUID
    title: str
    address: str | None = None
    comuna_id: int
    property_type: str
    auction_type: str
    opening_price: Decimal
    auction_date: datetime | None = None  # Paso 36: fecha y hora del remate
    status: str
    image_url: str | None = None
    description: str | None = None
    source_system: str | None = None
    source_reference: str | None = None
    created_at: datetime

    # Estos son opcionales porque una propiedad recién creada podría
    # no tener todavía toda la información cargada (o la evaluación aún no corrió)
    financial_info: FinancialInfoOut | None = None
    legal_info: LegalInfoOut | None = None
    physical_info: PhysicalInfoOut | None = None
    occupancy_info: OccupancyInfoOut | None = None
    market_dynamics: MarketDynamicsOut | None = None
    market_comparables: list[ComparableOut] = []
    debts: list[DebtOut] = []
    evaluation: EvaluationOut | None = None

    class Config:
        from_attributes = True

# --- Schema de entrada: lo que el admin envía para crear/editar una propiedad ---

class PropertyCreate(BaseModel):
    title: str
    address: str | None = None
    comuna_id: int
    property_type: str
    auction_type: str
    opening_price: Decimal
    auction_date: datetime | None = None  # Paso 45: fecha del remate (la envía el scraper)
    image_url: str | None = None
    description: str | None = None

    # Datos para el motor de riesgo (todos opcionales al crear,
    # porque la regla de completitud ya se encarga de marcar Zona Roja si faltan)
    estimated_value_arv: Decimal | None = None
    repair_cost: Decimal | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    surface_m2: Decimal | None = None
    title_status: str = "desconocido"
    num_liens: int = 1
    lifetime_usufruct: bool = False
    unresolved_inheritance: bool = False
    expropriation_ban: bool = False
    occupancy_status: str = "desconocida"
    liquidity_months: Decimal | None = None
    source_system: str | None = None
    source_reference: str | None = None
    market_comparables: list[ComparableIn] = []
    debts: list[DebtIn] = []