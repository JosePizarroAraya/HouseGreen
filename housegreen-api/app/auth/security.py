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



# Paso 73: reglas de la contraseña, en un solo lugar.
# Las usan el registro y el cambio de contraseña. Si el equipo cambia las reglas, se cambian aquí.
LARGO_MINIMO = 8
LARGO_MAXIMO = 64

def problema_de_contrasena(password: str) -> str | None:
    """Devuelve el motivo por el que la contraseña no sirve, o None si cumple las reglas."""
    if len(password) < LARGO_MINIMO:
        return f"La contraseña debe tener al menos {LARGO_MINIMO} caracteres."
    # bcrypt solo usa los primeros 72 bytes (una "ñ" o una letra con tilde ocupan 2)
    if len(password) > LARGO_MAXIMO or len(password.encode("utf-8")) > 72:
        return f"La contraseña puede tener como máximo {LARGO_MAXIMO} caracteres."
    if not any(caracter.isalpha() for caracter in password):
        return "La contraseña debe tener al menos una letra."
    if not any(caracter.isdigit() for caracter in password):
        return "La contraseña debe tener al menos un número."
    return None