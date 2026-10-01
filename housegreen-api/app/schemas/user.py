from pydantic import BaseModel, EmailStr
from uuid import UUID

# Lo que el frontend ENVÍA al registrarse (incluye password en texto plano,
# que nosotros vamos a encriptar antes de guardar)
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None

# Lo que el frontend ENVÍA al hacer login
class UserLogin(BaseModel):
    email: EmailStr
    password: str

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

# Lo que devuelve GET /auth/me: el usuario conectado, con el nombre de su rol,
# para que la web sepa si mostrar el panel de administración.
class UserMe(UserOut):
    phone: str | None = None
    role_name: str | None = None
    
# Lo que la API devuelve después de un login exitoso
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"