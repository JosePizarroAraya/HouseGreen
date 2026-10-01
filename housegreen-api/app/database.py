import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Carga las variables del archivo .env (DATABASE_URL, SECRET_KEY) al entorno de Python
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL_NEON")

# El "engine" es la conexión de bajo nivel hacia PostgreSQL
engine = create_engine(DATABASE_URL)

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