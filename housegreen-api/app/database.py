import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Carga las variables del archivo .env (DATABASE_URL, SECRET_KEY) al entorno de Python
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL_NEON")

# pool_pre_ping: antes de usar una conexión guardada, comprueba que siga viva.
# Hace falta con Neon, que se "duerme" tras unos minutos sin uso y corta las conexiones.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# SessionLocal genera "sesiones" de trabajo con la base de datos.
# Cada petición a la API va a abrir su propia sesión, hacer sus consultas, y cerrarla.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base es la clase de la que van a heredar todos nuestros "modelos"
# (las clases de Python que representan las tablas: Property, User, etc.)
Base = declarative_base()

# Esta función se usa en cada endpoint para obtener una sesión de base de datos,
# y se asegura de cerrarla siempre al terminar (incluso si algo falla).
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()