from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, Role
from app.schemas.user import UserCreate, UserLogin, UserOut, UserMe, Token
from app.auth.security import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/registro", response_model=UserOut)
def registrar_usuario(datos: UserCreate, db: Session = Depends(get_db)):
    # Verifica que el correo no esté ya registrado
    usuario_existente = db.query(User).filter(User.email == datos.email).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")

    # Busca el rol "inversionista" (el rol por defecto de cualquiera que se registra solo)
    rol_inversionista = db.query(Role).filter(Role.name == "inversionista").first()
    if not rol_inversionista:
        raise HTTPException(status_code=500, detail="Rol 'inversionista' no existe en la base de datos")

    nuevo_usuario = User(
        email=datos.email,
        password_hash=hash_password(datos.password),  # nunca se guarda la contraseña en texto plano
        full_name=datos.full_name,
        phone=datos.phone,
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

    token = create_access_token(data={"sub": str(usuario.id), "email": usuario.email})

    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserMe)
def usuario_actual(usuario: User = Depends(get_current_user)):
    # La web lo llama al iniciar sesión (y al recargar la página) para saber
    # quién está conectado y qué rol tiene. Si el token venció, responde 401.
    return UserMe(
        id=usuario.id,
        email=usuario.email,
        full_name=usuario.full_name,
        role_id=usuario.role_id,
        phone=usuario.phone,
        role_name=usuario.role.name if usuario.role else None,
    )