from typing import Literal
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from decimal import Decimal

# Una fila de la lista "Publicaciones" del administrador.
# Los campos en inglés son columnas de la base; los en español se calculan (conteos).
class PublicacionAdmin(BaseModel):
    id: UUID
    title: str
    comuna: str | None = None
    property_type: str
    status: str | None = None
    image_url: str | None = None
    result_level: str | None = None   # verde / amarillo / rojo (None si nunca se evaluó)
    total_points: int | None = None
    vistas: int = 0      # visitas totales (tabla property_views)
    personas: int = 0    # personas distintas que la vieron
    guardados: int = 0   # cuántos la tienen en favoritos (tabla saved_properties)
    # Paso 67: datos para que el admin complete el semáforo
    opening_price: Decimal | None = None
    auction_date: datetime | None = None
    market_zone: str | None = None    # zona de precio que eligió el admin (None = todavía no la elige)
    domain_type: str | None = None    # "exclusivo", "otro" o None (no especificado)



class PersonaQueLaVio(BaseModel):
    user_id: UUID
    full_name: str
    email: str
    visitas: int              # cuántas veces la vio (ya sin repetir dentro de 30 min)
    ultima_visita: datetime
    la_guardo: bool           # True si además la tiene en favoritos

class PersonaQueLaGuardo(BaseModel):
    user_id: UUID
    full_name: str
    email: str
    guardada_el: datetime
    visitas: int              # 0 si la guardó desde el catálogo sin abrir el detalle

class FotoOut(BaseModel):
    id: UUID
    url: str                  # "/uploads/propiedades/<archivo>": la web le antepone la dirección de la API
    label: str | None = None
    position: int             # 0 = portada

    class Config:
        from_attributes = True

class PublicacionDetalleAdmin(PublicacionAdmin):
    opening_price: Decimal | None = None   # se muestra bloqueado: los datos del remate no se editan
    description: str | None = None
    fotos: list[FotoOut] = []
    la_vieron: list[PersonaQueLaVio] = []
    la_guardaron: list[PersonaQueLaGuardo] = []



class DescripcionIn(BaseModel):
    description: str | None = Field(max_length=1000)  # obligatorio: null o "" para dejarla vacía

    
class FotoOrdenIn(BaseModel):
    # Una foto en el orden nuevo (paso 24): la primera de la lista queda como portada
    id: UUID
    label: str | None = Field(default=None, max_length=40)
# --- Paso 67: lo que el admin define del semáforo ---

class SemaforoAdminIn(BaseModel):
    # Solo se cambia lo que se envía: se puede mandar la zona, el dominio o los dos.
    # Enviar null borra el dato (vuelve a "sin revisar" o "no especificado").
    market_zone: Literal["verde", "amarillo", "rojo"] | None = None
    domain_type: Literal["exclusivo", "otro"] | None = None

class SemaforoAdminOut(BaseModel):
    # Cómo quedó la propiedad después de recalcular
    market_zone: str | None = None
    domain_type: str | None = None
    result_level: str | None = None
    total_points: int | None = None