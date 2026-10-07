from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import requerir_admin
from app.models.property import PropertyView
from app.models.favorite import SavedProperty
from app.models.feedback import Feedback
from app.models.user import User, Role
from app.schemas.admin_usuarios import UsuarioAdmin

# Paso 85: usuarios registrados, para el administrador. Solo lectura.
router = APIRouter(prefix="/admin", tags=["Admin"])


def _cantidad_y_ultima(db: Session, columna_usuario, columna_id, columna_fecha) -> dict:
    """Por cada usuario: (cuántas filas tiene, fecha de la más reciente). Una sola consulta con GROUP BY."""
    return {
        user_id: (cantidad, ultima)
        for user_id, cantidad, ultima in db.query(
            columna_usuario, func.count(columna_id), func.max(columna_fecha)
        ).group_by(columna_usuario)
    }


@router.get("/usuarios", response_model=list[UsuarioAdmin])
def listar_usuarios(db: Session = Depends(get_db), usuario=Depends(requerir_admin)):
    roles = dict(db.query(Role.id, Role.name).all())

    vistas = _cantidad_y_ultima(db, PropertyView.user_id, PropertyView.id, PropertyView.viewed_at)
    guardados = _cantidad_y_ultima(db, SavedProperty.user_id, SavedProperty.id, SavedProperty.saved_at)
    opiniones = _cantidad_y_ultima(db, Feedback.user_id, Feedback.id, Feedback.created_at)

    resultado = []
    # Los más nuevos primero
    for persona in db.query(User).order_by(User.created_at.desc()):
        n_vistas, ultima_vista = vistas.get(persona.id, (0, None))
        n_guardados, ultimo_guardado = guardados.get(persona.id, (0, None))
        n_opiniones, ultima_opinion = opiniones.get(persona.id, (0, None))
        fechas = [fecha for fecha in (ultima_vista, ultimo_guardado, ultima_opinion) if fecha is not None]
        resultado.append(
            UsuarioAdmin(
                id=persona.id,
                full_name=persona.full_name,
                email=persona.email,
                phone=persona.phone,
                role_name=roles.get(persona.role_id),
                is_active=bool(persona.is_active),
                two_fa_enabled=bool(persona.two_fa_enabled),
                created_at=persona.created_at,
                vistas=n_vistas,
                guardados=n_guardados,
                opiniones=n_opiniones,
                ultima_actividad=max(fechas) if fechas else None,
            )
        )
    return resultado