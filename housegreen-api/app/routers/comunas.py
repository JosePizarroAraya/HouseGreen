from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Comuna
from app.schemas.comuna import ComunaOut
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/comunas", tags=["Comunas"])

@router.get("", response_model=list[ComunaOut])
def listar_comunas(db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    # Ordenadas alfabéticamente, para que sea cómodo armar el <select> en el frontend
    return db.query(Comuna).order_by(Comuna.name).all()