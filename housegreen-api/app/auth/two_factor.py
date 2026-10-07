# Paso 76: verificación en dos pasos (2FA) con códigos de 6 dígitos que cambian cada 30 segundos (TOTP).
# La persona escanea una clave con una aplicación (Google Authenticator, Microsoft Authenticator...)
# y la aplicación genera los códigos. Aquí está todo lo que la API necesita para eso.
import os

import pyotp
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

NOMBRE_EN_LA_APP = "HouseGreen"  # el nombre con que la cuenta aparece en la aplicación del teléfono

# Paso 80: roles obligados a usar la verificación en dos pasos (3 = administrador).
# Para el resto es opcional: cada persona decide en su Perfil.
ROLES_QUE_LA_EXIGEN = {3}


def es_obligatoria_para(role_id: int) -> bool:
    return role_id in ROLES_QUE_LA_EXIGEN

class ErrorDeDosPasos(Exception):
    """Problema de configuración del servidor (no un error de la persona)."""


def _cifrador() -> Fernet:
    # TWO_FA_KEY es la llave con que se guarda cifrada la clave de cada persona en la base.
    # Todos los computadores del equipo deben tener LA MISMA, porque la base es compartida.
    llave = os.getenv("TWO_FA_KEY")
    if not llave:
        raise ErrorDeDosPasos("Falta TWO_FA_KEY en el archivo .env de la API.")
    try:
        return Fernet(llave)
    except ValueError:
        raise ErrorDeDosPasos("TWO_FA_KEY no tiene el formato correcto: debe generarse con Fernet.generate_key().")


def nueva_clave() -> str:
    # 32 letras y números al azar; es lo que se escanea con la aplicación
    return pyotp.random_base32()


def cifrar(clave: str) -> str:
    return _cifrador().encrypt(clave.encode()).decode()


def descifrar(clave_cifrada: str) -> str:
    try:
        return _cifrador().decrypt(clave_cifrada.encode()).decode()
    except InvalidToken:
        raise ErrorDeDosPasos(
            "No se pudo leer la clave de dos pasos: la TWO_FA_KEY de este computador "
            "no es la misma con la que se activó."
        )


def enlace_para_la_app(clave: str, correo: str) -> str:
    # Enlace "otpauth://..." que la web convierte en código QR
    return pyotp.TOTP(clave).provisioning_uri(name=correo, issuer_name=NOMBRE_EN_LA_APP)


def codigo_correcto(clave: str, codigo: str) -> bool:
    codigo = codigo.replace(" ", "")  # la aplicación lo muestra como "123 456"
    if len(codigo) != 6 or not codigo.isdigit():
        return False
    # valid_window=1: también acepta el código anterior y el siguiente,
    # por si el reloj del teléfono está unos segundos corrido
    return pyotp.TOTP(clave).verify(codigo, valid_window=1)