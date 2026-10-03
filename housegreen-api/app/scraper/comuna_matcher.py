import re
import unicodedata


def normalizar(texto: str) -> str:
    # Quita tildes y pasa a minúsculas, para comparar "Ñuñoa" con "nunoa" sin problema.
    # NFKD separa la letra de su tilde (á -> a + ´), y el filtro se queda solo con la letra.
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("utf-8")
    return sin_tildes.lower().strip()


def nombre_para_direccion(nombre: str) -> str:
    # Paso 50: "Estación Central" -> "estacion-central", que es como el sitio escribe
    # las comunas en sus direcciones (/remates/estacion-central/)
    return re.sub(r"[^a-z0-9]+", "-", normalizar(nombre)).strip("-")