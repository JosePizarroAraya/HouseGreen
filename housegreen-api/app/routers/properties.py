from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import text
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.database import get_db
from app.models.property import (
    Property, PropertyFinancialInfo, PropertyLegalInfo,
    PropertyPhysicalInfo, PropertyOccupancyInfo, PropertyMarketDynamics,
    PropertyEvaluation, PropertyMarketComparable, PropertyDebt, PropertyView, PropertyPhoto,
        EvaluationDetail, SemaforoCriteria, PropertyAuctionInfo,
)
from app.schemas.property import PropertyOut, PropertyCreate, EvaluationOut, EvaluationDetailOut, AuctionInfoOut
from app.schemas.admin import FotoOut
from app.auth.dependencies import get_current_user, requerir_admin
from app.routers.alerts import notificar_nueva_propiedad

router = APIRouter(prefix="/propiedades", tags=["Propiedades"])

def _ejecutar_calculo_riesgo(db: Session, property_id: UUID):
    # Llama a la función PL/pgSQL que ya armaron en el motor de reglas.
    # text() nos permite ejecutar SQL "crudo" en vez de armarlo con SQLAlchemy,
    # que es lo correcto cuando estás llamando a una función de base de datos, no una tabla.
    db.execute(text("SELECT calculate_score(:pid)"), {"pid": str(property_id)})
    db.commit()

def _obtener_ultima_evaluacion(db: Session, property_id: UUID) -> PropertyEvaluation | None:
    return (
        db.query(PropertyEvaluation)
        .filter(PropertyEvaluation.property_id == property_id)
        .order_by(PropertyEvaluation.evaluated_at.desc())
        .first()
    )

def _detalles_de_evaluaciones(db: Session, evaluation_ids: list) -> dict:
    # Paso 64: puntos de cada factor, para varias evaluaciones en UNA sola consulta.
    # Devuelve un diccionario: id de la evaluación -> lista con sus 4 factores.
    detalles = {}
    if not evaluation_ids:
        return detalles
    filas = (
        db.query(
            EvaluationDetail.evaluation_id, SemaforoCriteria.name,
            EvaluationDetail.contribution, EvaluationDetail.criteria_value,
        )
        .join(SemaforoCriteria, SemaforoCriteria.id == EvaluationDetail.criteria_id)
        .filter(EvaluationDetail.evaluation_id.in_(evaluation_ids))
        .order_by(SemaforoCriteria.id)
    )
    for evaluation_id, nombre, puntos, valor in filas:
        detalles.setdefault(evaluation_id, []).append(
            EvaluationDetailOut(criteria_name=nombre, points=int(puntos or 0), has_data=valor is not None)
        )
    return detalles

def _evaluacion_con_detalle(evaluacion: PropertyEvaluation | None, detalles: dict) -> EvaluationOut | None:
    # Paso 64: une la evaluación con el detalle de sus factores
    if not evaluacion:
        return None
    salida = EvaluationOut.model_validate(evaluacion)
    salida.details = detalles.get(evaluacion.id, [])
    return salida

def _armar_respuesta(db: Session, propiedad: Property) -> PropertyOut:
    # Junta la propiedad con su última evaluación de riesgo, para devolver todo junto.
    salida = PropertyOut.model_validate(propiedad)
    evaluacion = _obtener_ultima_evaluacion(db, propiedad.id)
    if evaluacion:
        detalles = _detalles_de_evaluaciones(db, [evaluacion.id])
        salida.evaluation = _evaluacion_con_detalle(evaluacion, detalles)
    # Paso 27: si el admin subió fotos, se muestra la portada en vez de la imagen original
    portada = (
        db.query(PropertyPhoto.url)
        .filter(PropertyPhoto.property_id == propiedad.id)
        .order_by(PropertyPhoto.position)
        .first()
    )
    if portada:
        salida.image_url = portada.url
    return salida

def _guardar_datos_relacionados(db: Session, property_id: UUID, datos: PropertyCreate):
    # Financiero
    financiero = db.query(PropertyFinancialInfo).filter_by(property_id=property_id).first()
    if not financiero:
        financiero = PropertyFinancialInfo(property_id=property_id)
        db.add(financiero)
    financiero.estimated_value_arv = datos.estimated_value_arv
    financiero.repair_cost = datos.repair_cost

    # Legal
    legal = db.query(PropertyLegalInfo).filter_by(property_id=property_id).first()
    if not legal:
        legal = PropertyLegalInfo(property_id=property_id)
        db.add(legal)
    legal.title_status = datos.title_status
    legal.num_liens = datos.num_liens
    legal.has_liens = datos.num_liens > 0
    legal.lifetime_usufruct = datos.lifetime_usufruct
    legal.unresolved_inheritance = datos.unresolved_inheritance
    legal.expropriation_ban = datos.expropriation_ban

    # Física
    fisica = db.query(PropertyPhysicalInfo).filter_by(property_id=property_id).first()
    if not fisica:
        fisica = PropertyPhysicalInfo(property_id=property_id)
        db.add(fisica)
    fisica.bedrooms = datos.bedrooms
    fisica.bathrooms = datos.bathrooms
    fisica.surface_m2 = datos.surface_m2

    # Ocupación
    ocupacion = db.query(PropertyOccupancyInfo).filter_by(property_id=property_id).first()
    if not ocupacion:
        ocupacion = PropertyOccupancyInfo(property_id=property_id)
        db.add(ocupacion)
    ocupacion.status = datos.occupancy_status

    # Dinamismo del barrio (solo si mandaron el dato)
    if datos.liquidity_months is not None:
        dinamismo = db.query(PropertyMarketDynamics).filter_by(property_id=property_id).first()
        if not dinamismo:
            dinamismo = PropertyMarketDynamics(property_id=property_id, liquidity_months=datos.liquidity_months)
            db.add(dinamismo)
        else:
            dinamismo.liquidity_months = datos.liquidity_months

    # Comparables de mercado: a diferencia de financiero/legal/físico,
    # esto es una LISTA — así que borramos los anteriores y creamos los nuevos.
    # Es la forma más simple de manejar "reemplazar una lista completa" al editar.
    db.query(PropertyMarketComparable).filter_by(property_id=property_id).delete()
    for comparable in datos.market_comparables:
        db.add(PropertyMarketComparable(property_id=property_id, **comparable.model_dump()))

    # Deudas: mismo criterio — se reemplaza la lista completa cada vez.
    db.query(PropertyDebt).filter_by(property_id=property_id).delete()
    for deuda in datos.debts:
        db.add(PropertyDebt(property_id=property_id, **deuda.model_dump()))

    db.commit()

@router.get("", response_model=list[PropertyOut])
def listar_propiedades(db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    # Paso 47: antes se hacían unas 9 consultas por cada propiedad (con 500 remates, miles de consultas).
    # Ahora son unas 10 consultas en total, sin importar cuántas propiedades haya.

    # selectinload trae los datos relacionados de TODAS las propiedades en una consulta por tabla
    propiedades = (
        db.query(Property)
        .options(
            selectinload(Property.financial_info),
            selectinload(Property.legal_info),
            selectinload(Property.physical_info),
            selectinload(Property.occupancy_info),
            selectinload(Property.market_dynamics),
            selectinload(Property.market_comparables),
            selectinload(Property.debts),
        )
        .all()
    )

    # Última evaluación de cada propiedad: vienen de la más antigua a la más nueva,
    # así en el diccionario queda guardada la última
    evaluaciones = {}
    for evaluacion in db.query(PropertyEvaluation).order_by(PropertyEvaluation.evaluated_at):
        evaluaciones[evaluacion.property_id] = evaluacion

    # Portada de cada propiedad: la primera foto según su posición
    portadas = {}
    for property_id, url in db.query(PropertyPhoto.property_id, PropertyPhoto.url).order_by(PropertyPhoto.position):
        portadas.setdefault(property_id, url)

    # Paso 64: detalle por factor de esas últimas evaluaciones (una sola consulta para todas)
    detalles = _detalles_de_evaluaciones(db, [evaluacion.id for evaluacion in evaluaciones.values()])

    respuesta = []
    for propiedad in propiedades:
        salida = PropertyOut.model_validate(propiedad)
        salida.evaluation = _evaluacion_con_detalle(evaluaciones.get(propiedad.id), detalles)
        if propiedad.id in portadas:
            salida.image_url = portadas[propiedad.id]
        respuesta.append(salida)
    return respuesta

@router.get("/{property_id}", response_model=PropertyOut)
def obtener_propiedad(property_id: UUID, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")
    return _armar_respuesta(db, propiedad)

@router.post("", response_model=PropertyOut)
def crear_propiedad(datos: PropertyCreate, db: Session = Depends(get_db), usuario=Depends(requerir_admin)):
    # Si viene de una fuente externa (ej. el scraper), evitamos duplicados:
    # si ya existe una propiedad con la misma fuente y referencia, no la volvemos a crear.
    if datos.source_system and datos.source_reference:
        existente = (
            db.query(Property)
            .filter(
                Property.source_system == datos.source_system,
                Property.source_reference == datos.source_reference,
            )
            .first()
        )
        if existente:
            raise HTTPException(status_code=409, detail="Esta propiedad ya fue importada")

    nueva_propiedad = Property(
        title=datos.title,
        address=datos.address,
        comuna_id=datos.comuna_id,
        property_type=datos.property_type,
        auction_type=datos.auction_type,
        opening_price=datos.opening_price,
        auction_date=datos.auction_date,
        image_url=datos.image_url,
        description=datos.description,
        source_system=datos.source_system,
        source_reference=datos.source_reference,
    )
    db.add(nueva_propiedad)
    db.commit()
    db.refresh(nueva_propiedad)

    _guardar_datos_relacionados(db, nueva_propiedad.id, datos)
    _ejecutar_calculo_riesgo(db, nueva_propiedad.id)
    evaluacion = _obtener_ultima_evaluacion(db, nueva_propiedad.id)
    if evaluacion:
        notificar_nueva_propiedad(db, nueva_propiedad, evaluacion.result_level)

    db.refresh(nueva_propiedad)
    return _armar_respuesta(db, nueva_propiedad)

@router.put("/{property_id}", response_model=PropertyOut)
def editar_propiedad(
    property_id: UUID, datos: PropertyCreate, db: Session = Depends(get_db), usuario=Depends(requerir_admin)
):
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    propiedad.title = datos.title
    propiedad.address = datos.address
    propiedad.comuna_id = datos.comuna_id
    propiedad.property_type = datos.property_type
    propiedad.auction_type = datos.auction_type
    propiedad.opening_price = datos.opening_price
    propiedad.image_url = datos.image_url
    propiedad.description = datos.description
    db.commit()

    _guardar_datos_relacionados(db, property_id, datos)
    _ejecutar_calculo_riesgo(db, property_id)  # recalcula el riesgo con los datos actualizados

    db.refresh(propiedad)
    return _armar_respuesta(db, propiedad)

@router.delete("/{property_id}")
def eliminar_propiedad(property_id: UUID, db: Session = Depends(get_db), usuario=Depends(requerir_admin)):
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    db.delete(propiedad)  # ON DELETE CASCADE en el SQL borra automáticamente sus tablas relacionadas
    db.commit()
    return {"mensaje": "Propiedad eliminada"}

# --- Vistas (paso 11) ---

# Solo se cuentan las vistas de inversionistas: el administrador y el analista
# revisan propiedades por trabajo y no deben inflar los números.
ROL_INVERSIONISTA_ID = 1

# Si la misma persona vuelve a abrir la misma propiedad dentro de este tiempo,
# no se cuenta como otra visita (así no suman las recargas de página).
MINUTOS_ENTRE_VISITAS = 30

@router.post("/{property_id}/vista")
def registrar_vista(property_id: UUID, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    if usuario.role_id != ROL_INVERSIONISTA_ID:
        return {"registrada": False, "motivo": "Solo se cuentan las vistas de inversionistas"}

    hace_poco = datetime.now(timezone.utc) - timedelta(minutes=MINUTOS_ENTRE_VISITAS)
    vista_reciente = (
        db.query(PropertyView)
        .filter(
            PropertyView.user_id == usuario.id,
            PropertyView.property_id == property_id,
            PropertyView.viewed_at >= hace_poco,
        )
        .first()
    )
    if vista_reciente:
        return {"registrada": False, "motivo": "Ya se contó una visita hace poco"}

    db.add(PropertyView(user_id=usuario.id, property_id=property_id))
    db.commit()
    return {"registrada": True}

@router.get("/{property_id}/fotos", response_model=list[FotoOut])
def listar_fotos(property_id: UUID, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    # Fotos que subió el admin (paso 28), en orden: la primera es la portada.
    # Las puede ver cualquier usuario con sesión (inversionista, analista o admin).
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")
    return (
        db.query(PropertyPhoto)
        .filter(PropertyPhoto.property_id == property_id)
        .order_by(PropertyPhoto.position)
        .all()
    )

# --- Datos del remate (paso 66) ---

# Dirección de la ficha en el sitio de origen; al final va el número del remate
URL_FICHA_ORIGEN = "https://www.rematesinmobiliarios.cl/ficha-remate.php?id="

@router.get("/{property_id}/remate", response_model=AuctionInfoOut | None)
def obtener_datos_del_remate(property_id: UUID, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    # Datos que el scraper leyó de la ficha del remate: tribunal, rol de la causa, modalidad, garantía y anuncio.
    # Devuelve null si la propiedad no los tiene (no vino del scraper, o el sitio retiró el remate).
    propiedad = db.query(Property).filter(Property.id == property_id).first()
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    info = db.get(PropertyAuctionInfo, property_id)
    if not info:
        return None

    salida = AuctionInfoOut.model_validate(info)
    if propiedad.source_system == "rematesinmobiliarios" and propiedad.source_reference:
        salida.source_url = URL_FICHA_ORIGEN + propiedad.source_reference
    return salida