# Fotos en la nube (paso 41): se guardan en Cloudinary en vez de una carpeta del computador,
# así se ven desde cualquier lugar, igual que la base de datos en Neon.
import os

import cloudinary
import cloudinary.exceptions
import cloudinary.uploader
from dotenv import load_dotenv

# Lee el .env aquí también, por si este archivo se carga antes que database.py
load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,  # direcciones con https
)

# Carpeta dentro de Cloudinary donde quedan las fotos de las propiedades
CARPETA_NUBE = "housegreen/propiedades"

# Cualquier error de Cloudinary (sin internet, claves malas, etc.)
ErrorDeNube = cloudinary.exceptions.Error


def subir_foto_a_la_nube(contenido: bytes, nombre: str) -> str:
    # Sube la imagen y devuelve su dirección completa: https://res.cloudinary.com/...
    resultado = cloudinary.uploader.upload(
        contenido,
        public_id=f"{CARPETA_NUBE}/{nombre}",  # nombre único de la foto dentro de Cloudinary
        asset_folder=CARPETA_NUBE,  # carpeta donde aparece en la Media Library de Cloudinary
        resource_type="image",
    )
    return resultado["secure_url"]

def borrar_foto_de_la_nube(url: str):
    # Paso 42. Solo toca fotos de nuestra carpeta de Cloudinary
    if f"/{CARPETA_NUBE}/" not in url:
        return
    # De la dirección se saca el nombre con que se guardó la foto:
    # https://res.cloudinary.com/.../housegreen/propiedades/abc123.jpg  ->  "abc123"
    archivo = url.split("/")[-1]  # "abc123.jpg"
    nombre = archivo.split(".")[0]  # "abc123"
    # invalidate=True: además la saca de la memoria (caché) de Cloudinary, para que la dirección deje de funcionar
    cloudinary.uploader.destroy(f"{CARPETA_NUBE}/{nombre}", invalidate=True)