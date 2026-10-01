from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID

from app.routers.properties import _armar_respuesta
from app.database import get_db
from app.models.favorite import SavedProperty
from app.models.property import Property
from app.models.user import User
from app.schemas.favorite import FavoriteCreate, FavoriteOut
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/favoritos", tags=["Favoritos"])

@router.get("", response_model=list[FavoriteOut])
def listar_favoritos(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    favoritos = db.query(SavedProperty).filter(SavedProperty.user_id == usuario.id).all()

    resultado = []
    for favorito in favoritos:
        propiedad_completa = _armar_respuesta(db, favorito.property)
        resultado.append(
            FavoriteOut(
                id=favorito.id,
                property_id=favorito.property_id,
                notes=favorito.notes,
                saved_at=favorito.saved_at,
                property=propiedad_completa,
            )
        )
    return resultado

@router.post("/{property_id}", response_model=FavoriteOut)
def agregar_favorito(
    property_id: UUID,
    datos: FavoriteCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    nuevo_favorito = SavedProperty(user_id=usuario.id, property_id=property_id, notes=datos.notes)
    db.add(nuevo_favorito)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Esta propiedad ya está en tus favoritos")

    db.refresh(nuevo_favorito)

    propiedad_completa = _armar_respuesta(db, propiedad)
    return FavoriteOut(
        id=nuevo_favorito.id,
        property_id=nuevo_favorito.property_id,
        notes=nuevo_favorito.notes,
        saved_at=nuevo_favorito.saved_at,
        property=propiedad_completa,
    )

@router.delete("/{property_id}")
def quitar_favorito(
    property_id: UUID, db: Session = Depends(get_db), usuario: User = Depends(get_current_user)
):
    favorito = (
        db.query(SavedProperty)
        .filter(SavedProperty.user_id == usuario.id, SavedProperty.property_id == property_id)
        .first()
    )
    if not favorito:
        raise HTTPException(status_code=404, detail="No tienes esta propiedad en favoritos")

    db.delete(favorito)
    db.commit()
    return {"mensaje": "Favorito eliminado"}