from pydantic import BaseModel, EmailStr
from uuid import UUID

# Lo que el frontend ENVÍA al registrarse (incluye password en texto plano,
# que nosotros vamos a encriptar antes de guardar).
# Las reglas de la contraseña se revisan en el router (app/auth/security.py, paso 73)
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None

# Lo que el frontend ENVÍA al hacer login.
# Paso 77: "code" es el código de 6 dígitos de la aplicación; solo lo necesitan
# las cuentas que tienen activada la verificación en dos pasos.
class UserLogin(BaseModel):
    email: EmailStr
    password: str
    code: str | None = None

# Lo que la API DEVUELVE — fíjate que NO incluye password_hash.
# Nunca se expone la contraseña (ni siquiera encriptada) en una respuesta.
class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role_id: int

    # Esto le dice a Pydantic: "puedes construir este schema directamente
    # desde un objeto de SQLAlchemy (el modelo User), no solo desde un dict"
    class Config:
        from_attributes = True

# Lo que devuelve GET /auth/me: el usuario de la sesión actual, con el nombre de su rol,
# para que el frontend sepa si mostrar el panel de administración.
class UserMe(UserOut):
    phone: str | None = None
    role_name: str | None = None
    two_fa_enabled: bool = False  # paso 76: si tiene activada la verificación en dos pasos
    two_fa_required: bool = False  # paso 80: si su tipo de cuenta está obligado a usarla

# Paso 73: lo que la web ENVÍA al editar el perfil (PATCH /auth/me).
# Solo se cambia lo que viene en la petición; el correo no se puede cambiar.
class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None

# Paso 73: lo que la web ENVÍA al cambiar la contraseña (POST /auth/me/contrasena)
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Paso 76: lo que la API DEVUELVE al iniciar la activación de la verificación en dos pasos.
# Es la única vez que se entrega la clave: la persona la escanea con su aplicación.
class TwoFactorSetup(BaseModel):
    secret: str  # la clave, por si se escribe a mano en la aplicación
    otpauth_url: str  # el enlace que la web convierte en código QR

# Paso 76: el código de 6 dígitos que muestra la aplicación
class TwoFactorCode(BaseModel):
    code: str

# Paso 76: para desactivar se piden la contraseña y un código
class TwoFactorDisable(BaseModel):
    password: str
    code: str

# Lo que la API devuelve después de un login.
# Paso 77: si la cuenta tiene verificación en dos pasos y todavía no se envió el código,
# no se entrega el token: access_token viene vacío y requires_2fa en true.
class Token(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    requires_2fa: bool = False