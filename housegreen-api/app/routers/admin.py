from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import UUID, uuid4
from pathlib import Path

from app.database import get_db
from app.auth.dependencies import requerir_admin
from app.nube import subir_foto_a_la_nube, borrar_foto_de_la_nube, ErrorDeNube
from app.models.property import Property, Comuna, PropertyEvaluation, PropertyView, PropertyPhoto
from app.models.favorite import SavedProperty
from app.models.user import User
from app.schemas.admin import (
    PublicacionAdmin, PublicacionDetalleAdmin, PersonaQueLaVio, PersonaQueLaGuardo, DescripcionIn, FotoOut,
    FotoOrdenIn,
)

# Todas las rutas de este archivo son solo para el administrador (role_id 3)
router = APIRouter(prefix="/admin", tags=["Admin"])

# Igual que las vistas (paso 11), los guardados solo cuentan si los hizo un inversionista:
# así las pruebas del admin o del analista no inflan las cifras.
ROL_INVERSIONISTA_ID = 1

# Fotos (paso 23): se guardan en la carpeta housegreen-api/uploads/propiedades/
# y main.py las publica en http://localhost:8000/uploads/propiedades/<archivo>
CARPETA_UPLOADS = Path(__file__).resolve().parents[2] / "uploads"
CARPETA_FOTOS = CARPETA_UPLOADS / "propiedades"
MAX_FOTOS = 15
MAX_BYTES_FOTO = 5 * 1024 * 1024  # 5 MB

@router.get("/publicaciones", response_model=list[PublicacionAdmin])
def listar_publicaciones(db: Session = Depends(get_db), usuario=Depends(requerir_admin)):
    # 1) Vistas por propiedad: visitas totales y personas distintas.
    #    GROUP BY hace el conteo en la base, en una sola consulta para todas las propiedades.
    vistas = {
        fila.property_id: (fila.vistas, fila.personas)
        for fila in db.query(
            PropertyView.property_id,
            func.count(PropertyView.id).label("vistas"),
            func.count(func.distinct(PropertyView.user_id)).label("personas"),
        ).group_by(PropertyView.property_id)
    }

    # 2) Guardados por propiedad (solo inversionistas): { property_id: cantidad }
    guardados = dict(
        db.query(SavedProperty.property_id, func.count(SavedProperty.id))
        .join(User, User.id == SavedProperty.user_id)
        .filter(User.role_id == ROL_INVERSIONISTA_ID)
        .group_by(SavedProperty.property_id)
        .all()
    )

    # 3) Última evaluación de cada propiedad. Se recorren de la más antigua a la más nueva,
    #    así en el diccionario queda guardada la más reciente.
    evaluaciones = {}
    for evaluacion in db.query(PropertyEvaluation).order_by(PropertyEvaluation.evaluated_at):
        evaluaciones[evaluacion.property_id] = evaluacion

    # 4) Nombres de las comunas: { comuna_id: nombre }
    comunas = dict(db.query(Comuna.id, Comuna.name).all())

    
    # 4b) Portada de cada propiedad que tenga fotos (paso 27): la de menor posición
    portadas = {}
    for property_id, url in db.query(PropertyPhoto.property_id, PropertyPhoto.url).order_by(PropertyPhoto.position):
        portadas.setdefault(property_id, url)  # setdefault guarda solo la primera que aparece

    # 5) Se arma una fila por propiedad; si no tiene vistas o guardados, va con 0
    resultado = []
    for propiedad in db.query(Property).all():
        n_vistas, n_personas = vistas.get(propiedad.id, (0, 0))
        evaluacion = evaluaciones.get(propiedad.id)
        resultado.append(
            PublicacionAdmin(
                id=propiedad.id,
                title=propiedad.title,
                comuna=comunas.get(propiedad.comuna_id),
                property_type=propiedad.property_type,
                status=propiedad.status,
                image_url=portadas.get(propiedad.id, propiedad.image_url),  # portada si hay fotos (paso 27)
                result_level=evaluacion.result_level if evaluacion else None,
                total_points=evaluacion.total_points if evaluacion else None,
                vistas=n_vistas,
                personas=n_personas,
                guardados=guardados.get(propiedad.id, 0),
            )
        )
    return resultado


@router.get("/publicaciones/{property_id}", response_model=PublicacionDetalleAdmin)
def detalle_publicacion(property_id: UUID, db: Session = Depends(get_db), usuario=Depends(requerir_admin)):
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    # 1) Visitas de cada persona a esta propiedad: { user_id: (cantidad, última visita) }.
    #    El order_by deja primero a quien la vio más recientemente.
    visitas = {
        fila.user_id: (fila.visitas, fila.ultima)
        for fila in db.query(
            PropertyView.user_id,
            func.count(PropertyView.id).label("visitas"),
            func.max(PropertyView.viewed_at).label("ultima"),
        )
        .filter(PropertyView.property_id == property_id)
        .group_by(PropertyView.user_id)
        .order_by(func.max(PropertyView.viewed_at).desc())
    }

    # 2) Inversionistas que la guardaron: { user_id: fecha en que la guardó }, la más reciente primero
    guardados = {
        g.user_id: g.saved_at
        for g in db.query(SavedProperty)
        .join(User, User.id == SavedProperty.user_id)
        .filter(SavedProperty.property_id == property_id, User.role_id == ROL_INVERSIONISTA_ID)
        .order_by(SavedProperty.saved_at.desc())
    }

    # 3) Nombre y correo de todas esas personas, en una sola consulta
    ids = set(visitas) | set(guardados)
    usuarios = {u.id: u for u in db.query(User).filter(User.id.in_(ids))}

    la_vieron = [
        PersonaQueLaVio(
            user_id=uid,
            full_name=usuarios[uid].full_name,
            email=usuarios[uid].email,
            visitas=cantidad,
            ultima_visita=ultima,
            la_guardo=uid in guardados,
        )
        for uid, (cantidad, ultima) in visitas.items()
    ]
    la_guardaron = [
        PersonaQueLaGuardo(
            user_id=uid,
            full_name=usuarios[uid].full_name,
            email=usuarios[uid].email,
            guardada_el=fecha,
            visitas=visitas[uid][0] if uid in visitas else 0,
        )
        for uid, fecha in guardados.items()
    ]

    # 4) Fotos, en orden (la primera es la portada)
    fotos = (
        db.query(PropertyPhoto)
        .filter(PropertyPhoto.property_id == property_id)
        .order_by(PropertyPhoto.position)
        .all()
    )

    # 5) Última evaluación del semáforo
    evaluacion = (
        db.query(PropertyEvaluation)
        .filter(PropertyEvaluation.property_id == property_id)
        .order_by(PropertyEvaluation.evaluated_at.desc())
        .first()
    )

    return PublicacionDetalleAdmin(
        id=propiedad.id,
        title=propiedad.title,
        comuna=propiedad.comuna.name if propiedad.comuna else None,
        property_type=propiedad.property_type,
        status=propiedad.status,
        image_url=fotos[0].url if fotos else propiedad.image_url,  # portada si hay fotos (paso 27)
        opening_price=propiedad.opening_price,
        description=propiedad.description,
        fotos=[FotoOut.model_validate(f) for f in fotos],
        result_level=evaluacion.result_level if evaluacion else None,
        total_points=evaluacion.total_points if evaluacion else None,
        vistas=sum(p.visitas for p in la_vieron),
        personas=len(la_vieron),
        guardados=len(la_guardaron),
        la_vieron=la_vieron,
        la_guardaron=la_guardaron,
    )


@router.patch("/publicaciones/{property_id}/descripcion")
def editar_descripcion(
    property_id: UUID, datos: DescripcionIn, db: Session = Depends(get_db), usuario=Depends(requerir_admin)
):
    # El admin solo puede cambiar la descripción (y más adelante las fotos): los datos del remate no se editan
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    texto = (datos.description or "").strip()
    propiedad.description = texto or None  # si queda vacía, se guarda como "sin descripción"
    propiedad.updated_at = func.now()
    db.commit()
    return {"description": propiedad.description}


def _extension_de_imagen(contenido: bytes) -> str | None:
    # Reconoce el tipo por los primeros bytes del archivo, no por el nombre (que se puede cambiar)
    if contenido.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return ".webp"
    return None


@router.post("/publicaciones/{property_id}/fotos", response_model=FotoOut, status_code=201)
def subir_foto(
    property_id: UUID,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario=Depends(requerir_admin),
):
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    cantidad = db.query(PropertyPhoto).filter(PropertyPhoto.property_id == property_id).count()
    if cantidad >= MAX_FOTOS:
        raise HTTPException(status_code=400, detail=f"La publicación ya tiene {MAX_FOTOS} fotos, que es el máximo")

    # Se lee como máximo 1 byte más del límite: si llega a leerlo, el archivo es demasiado grande
    contenido = archivo.file.read(MAX_BYTES_FOTO + 1)
    if len(contenido) > MAX_BYTES_FOTO:
        raise HTTPException(status_code=400, detail="La foto pesa más de 5 MB")

    if _extension_de_imagen(contenido) is None:
        raise HTTPException(status_code=400, detail="Solo se aceptan fotos JPG, PNG o WEBP")

    # Paso 41: la foto se guarda en la nube (Cloudinary) con un nombre al azar,
    # que evita choques entre archivos y no expone el nombre original
    try:
        url = subir_foto_a_la_nube(contenido, uuid4().hex)
    except ErrorDeNube:
        raise HTTPException(status_code=502, detail="No se pudo guardar la foto en la nube. Intenta de nuevo.")

    # Va al final de la lista; si es la primera foto (position 0), queda como portada
    foto = PropertyPhoto(property_id=property_id, url=url, position=cantidad)
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return foto


# --- Paso 24: borrar, ordenar y etiquetar fotos ---

def _fotos_ordenadas(db: Session, property_id: UUID) -> list[PropertyPhoto]:
    return (
        db.query(PropertyPhoto)
        .filter(PropertyPhoto.property_id == property_id)
        .order_by(PropertyPhoto.position)
        .all()
    )


def _borrar_archivo(url: str):
    if url.startswith("/uploads/propiedades/"):
        # Fotos antiguas, guardadas en la carpeta de la API. Path(url).name deja solo el nombre del archivo,
        # así una url rara (con "../") no puede borrar nada fuera de uploads/propiedades.
        (CARPETA_FOTOS / Path(url).name).unlink(missing_ok=True)
    else:
        # Paso 42: fotos en la nube (Cloudinary)
        try:
            borrar_foto_de_la_nube(url)
        except ErrorDeNube:
            # La foto ya se quitó de la base, así que para la web ya no existe.
            # Si la nube falla (por ejemplo, sin internet), solo queda un archivo suelto en Cloudinary.
            pass


@router.delete("/publicaciones/{property_id}/fotos/{foto_id}", response_model=list[FotoOut])
def borrar_foto(property_id: UUID, foto_id: UUID, db: Session = Depends(get_db), usuario=Depends(requerir_admin)):
    foto = (
        db.query(PropertyPhoto)
        .filter(PropertyPhoto.id == foto_id, PropertyPhoto.property_id == property_id)
        .first()
    )
    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    url = foto.url
    db.delete(foto)

    # Las que quedan se renumeran 0, 1, 2...: si se borró la portada, la siguiente pasa a ser portada
    restantes = [f for f in _fotos_ordenadas(db, property_id) if f.id != foto_id]
    for posicion, f in enumerate(restantes):
        f.position = posicion
    db.commit()

    _borrar_archivo(url)  # el archivo se borra después de confirmar el cambio en la base
    return restantes


@router.put("/publicaciones/{property_id}/fotos", response_model=list[FotoOut])
def ordenar_fotos(
    property_id: UUID, fotos: list[FotoOrdenIn], db: Session = Depends(get_db), usuario=Depends(requerir_admin)
):
    # Recibe TODAS las fotos en el orden nuevo, cada una con su etiqueta.
    # Sirve para reordenar, elegir la portada (se pone primera) y etiquetar, todo en un solo guardado.
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    actuales = {f.id: f for f in _fotos_ordenadas(db, property_id)}
    ids_nuevos = [f.id for f in fotos]
    if len(ids_nuevos) != len(set(ids_nuevos)) or set(ids_nuevos) != set(actuales):
        raise HTTPException(
            status_code=400,
            detail="La lista debe traer todas las fotos de la publicación, una sola vez cada una",
        )

    for posicion, dato in enumerate(fotos):
        foto = actuales[dato.id]
        foto.position = posicion
        foto.label = (dato.label or "").strip() or None  # etiqueta vacía = sin etiqueta
    db.commit()
    return _fotos_ordenadas(db, property_id)