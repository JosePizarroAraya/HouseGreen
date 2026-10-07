import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, Role
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserOut,
    UserMe,
    ProfileUpdate,
    PasswordChange,
    TwoFactorSetup,
    TwoFactorCode,
    TwoFactorDisable,
    Token,
)
from app.auth.security import hash_password, verify_password, create_access_token, problema_de_contrasena
from app.auth.dependencies import get_current_user
from app.auth import two_factor

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# Paso 73: el nombre y el teléfono se revisan igual al registrarse y al editar el perfil
def _nombre_revisado(texto: str | None) -> str:
    nombre = (texto or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede quedar vacío.")
    if len(nombre) > 150:
        raise HTTPException(status_code=400, detail="El nombre puede tener como máximo 150 caracteres.")
    return nombre


def _telefono_revisado(texto: str | None) -> str | None:
    telefono = (texto or "").strip()
    if not telefono:
        return None  # el teléfono es opcional
    # Acepta números y espacios, con un + opcional al inicio: "+56 9 1234 5678"
    cantidad_de_numeros = sum(caracter.isdigit() for caracter in telefono)
    if not re.fullmatch(r"\+?[0-9 ]+", telefono) or not 8 <= cantidad_de_numeros <= 15:
        raise HTTPException(
            status_code=400,
            detail="El teléfono debe tener entre 8 y 15 números (puede llevar espacios y un + al inicio).",
        )
    return telefono


def _usuario_me(usuario: User) -> UserMe:
    return UserMe(
        id=usuario.id,
        email=usuario.email,
        full_name=usuario.full_name,
        role_id=usuario.role_id,
        phone=usuario.phone,
        role_name=usuario.role.name if usuario.role else None,
        two_fa_enabled=bool(usuario.two_fa_enabled),
        two_fa_required=two_factor.es_obligatoria_para(usuario.role_id),
    )


# Paso 76: mensaje y lectura de la clave de dos pasos (los usan el login y las rutas /2fa)
CODIGO_INCORRECTO = "El código no es correcto. Revisa que sea el más reciente de la aplicación."


def _clave_de_dos_pasos(usuario: User) -> str:
    # La clave está cifrada en la base. Si falla, es un problema del .env del servidor (TWO_FA_KEY).
    try:
        return two_factor.descifrar(usuario.two_fa_secret)
    except two_factor.ErrorDeDosPasos as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/registro", response_model=UserOut)
def registrar_usuario(datos: UserCreate, db: Session = Depends(get_db)):
    # Verifica que el correo no esté ya registrado
    usuario_existente = db.query(User).filter(User.email == datos.email).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")

    # Paso 73: la contraseña debe cumplir las reglas (app/auth/security.py)
    problema = problema_de_contrasena(datos.password)
    if problema:
        raise HTTPException(status_code=400, detail=problema)

    # Busca el rol "inversionista" (el rol por defecto de cualquiera que se registra solo)
    rol_inversionista = db.query(Role).filter(Role.name == "inversionista").first()
    if not rol_inversionista:
        raise HTTPException(status_code=500, detail="Rol 'inversionista' no existe en la base de datos")

    nuevo_usuario = User(
        email=datos.email,
        password_hash=hash_password(datos.password),  # nunca se guarda la contraseña en texto plano
        full_name=_nombre_revisado(datos.full_name),
        phone=_telefono_revisado(datos.phone),
        role_id=rol_inversionista.id,
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)  # trae de vuelta el id/created_at que generó la base de datos

    return nuevo_usuario


@router.post("/login", response_model=Token)
def iniciar_sesion(datos: UserLogin, db: Session = Depends(get_db)):
    usuario = db.query(User).filter(User.email == datos.email).first()

    # Ojo: el mensaje de error es genérico a propósito ("correo o contraseña incorrectos"),
    # no decimos "el correo no existe" — eso evita que alguien pueda "adivinar" qué correos
    # están registrados probando uno por uno.
    if not usuario or not verify_password(datos.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    if not usuario.is_active:
        raise HTTPException(status_code=403, detail="Esta cuenta está deshabilitada")

    # Paso 77: segundo paso. Recién aquí (con la contraseña ya correcta) se revisa el código.
    if usuario.two_fa_enabled:
        if not datos.code:
            # Todavía no se entrega el token: la web debe pedir el código y volver a llamar
            return Token(requires_2fa=True)
        if not two_factor.codigo_correcto(_clave_de_dos_pasos(usuario), datos.code):
            raise HTTPException(status_code=401, detail=CODIGO_INCORRECTO)

    token = create_access_token(data={"sub": str(usuario.id), "email": usuario.email})

    return Token(access_token=token)


@router.get("/me", response_model=UserMe)
def usuario_actual(usuario: User = Depends(get_current_user)):
    # El frontend lo llama al iniciar sesión (y al recargar la página) para saber
    # quién está conectado y qué rol tiene. Si el token expiró, responde 401.
    return _usuario_me(usuario)


# Paso 73: editar el perfil. Cada persona edita solo su propia cuenta (la de su token).
@router.patch("/me", response_model=UserMe)
def editar_perfil(
    datos: ProfileUpdate,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    # model_fields_set = los campos que de verdad vinieron en la petición
    if "full_name" in datos.model_fields_set:
        usuario.full_name = _nombre_revisado(datos.full_name)
    if "phone" in datos.model_fields_set:
        usuario.phone = _telefono_revisado(datos.phone)

    db.commit()
    db.refresh(usuario)
    return _usuario_me(usuario)


# Paso 73: cambiar la contraseña. Pide la actual para que nadie más pueda cambiarla
# si la persona dejó la sesión abierta.
@router.post("/me/contrasena")
def cambiar_contrasena(
    datos: PasswordChange,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    if not verify_password(datos.current_password, usuario.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")

    problema = problema_de_contrasena(datos.new_password)
    if problema:
        raise HTTPException(status_code=400, detail=problema)

    if datos.new_password == datos.current_password:
        raise HTTPException(status_code=400, detail="La contraseña nueva debe ser distinta de la actual.")

    usuario.password_hash = hash_password(datos.new_password)
    db.commit()
    return {"mensaje": "Contraseña actualizada"}


# ---------- Paso 76: verificación en dos pasos (2FA) ----------

# 1. Empezar: se crea una clave nueva y se entrega para escanearla. Todavía NO queda activada.
@router.post("/2fa/iniciar", response_model=TwoFactorSetup)
def iniciar_dos_pasos(db: Session = Depends(get_db), usuario: User = Depends(get_current_user)):
    if usuario.two_fa_enabled:
        raise HTTPException(status_code=400, detail="Ya tienes activada la verificación en dos pasos.")

    clave = two_factor.nueva_clave()
    try:
        usuario.two_fa_secret = two_factor.cifrar(clave)
    except two_factor.ErrorDeDosPasos as error:
        raise HTTPException(status_code=500, detail=str(error))
    db.commit()

    return TwoFactorSetup(secret=clave, otpauth_url=two_factor.enlace_para_la_app(clave, usuario.email))


# 2. Confirmar: la persona escribe un código de su aplicación. Si es correcto, queda activada.
#    Así se comprueba que escaneó bien la clave antes de exigírsela al iniciar sesión.
@router.post("/2fa/confirmar", response_model=UserMe)
def confirmar_dos_pasos(
    datos: TwoFactorCode,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    if usuario.two_fa_enabled:
        raise HTTPException(status_code=400, detail="Ya tienes activada la verificación en dos pasos.")
    if not usuario.two_fa_secret:
        raise HTTPException(status_code=400, detail="Primero inicia la activación para obtener la clave.")

    if not two_factor.codigo_correcto(_clave_de_dos_pasos(usuario), datos.code):
        raise HTTPException(status_code=400, detail=CODIGO_INCORRECTO)

    usuario.two_fa_enabled = True
    db.commit()
    db.refresh(usuario)
    return _usuario_me(usuario)


# 3. Desactivar: pide la contraseña y un código, para que nadie más pueda quitarla
#    si la persona dejó la sesión abierta.
@router.post("/2fa/desactivar", response_model=UserMe)
def desactivar_dos_pasos(
    datos: TwoFactorDisable,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    if not usuario.two_fa_enabled:
        raise HTTPException(status_code=400, detail="No tienes activada la verificación en dos pasos.")
    # Paso 80: quien está obligado a usarla no puede quitarla
    if two_factor.es_obligatoria_para(usuario.role_id):
        raise HTTPException(
            status_code=400,
            detail="Tu tipo de cuenta exige la verificación en dos pasos: no se puede desactivar.",
        )
    if not verify_password(datos.password, usuario.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña no es correcta.")
    if not two_factor.codigo_correcto(_clave_de_dos_pasos(usuario), datos.code):
        raise HTTPException(status_code=400, detail=CODIGO_INCORRECTO)

    usuario.two_fa_enabled = False
    usuario.two_fa_secret = None
    db.commit()
    db.refresh(usuario)
    return _usuario_me(usuario)