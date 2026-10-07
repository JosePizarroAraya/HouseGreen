from pydantic import BaseModel
from uuid import UUID

# Paso 84: Panel del administrador (resumen de los últimos días)

# Una de las publicaciones más vistas del período
class PublicacionMasVista(BaseModel):
    id: UUID
    title: str
    comuna: str | None = None
    vistas: int
    guardados: int

class PanelAdmin(BaseModel):
    dias: int  # de cuántos días es el resumen (7)

    usuarios_nuevos: int  # inversionistas registrados en el período
    usuarios_total: int  # inversionistas registrados en total
    publicaciones_nuevas: int  # publicaciones creadas en el período
    publicaciones_vigentes: int  # remates que todavía no se realizan ni fueron retirados
    vistas: int  # veces que se abrió el detalle de una propiedad en el período
    guardados: int  # propiedades guardadas en favoritos en el período

    mas_vistas: list[PublicacionMasVista]  # hasta 5, de la más vista a la menos vista

    # Publicaciones vigentes según su semáforo: {"verde": 14, "amarillo": 360, "rojo": 6, "sin_evaluar": 0}
    semaforo: dict[str, int]

    # Lo que el administrador tiene pendiente
    sin_zona_de_precio: int  # publicaciones vigentes sin zona de precio
    opiniones_por_responder: int  # opiniones que aceptan respuesta y todavía no tienen