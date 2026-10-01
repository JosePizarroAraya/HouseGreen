import os
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # el token dura 24 horas

# CryptContext maneja el encriptado con bcrypt — un algoritmo diseñado
# específicamente para contraseñas (lento a propósito, para dificultar ataques de fuerza bruta)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    # Convierte "miContraseña123" en algo como "$2b$12$KIXQ...", irreversible
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Compara la contraseña que el usuario escribió contra el hash guardado.
    # Nunca se "desencripta" el hash — se vuelve a encriptar lo ingresado y se comparan los resultados.
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # Genera el token firmado con tu SECRET_KEY — solo tu servidor puede crear
    # tokens válidos, porque solo él conoce esa clave.
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.JWTError:
        # Si el token fue manipulado, expiró, o no fue firmado con tu SECRET_KEY, falla acá
        return None