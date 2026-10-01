import requests
import unicodedata

API_URL = "http://localhost:8000"


def normalizar(texto: str) -> str:
    # Quita tildes y pasa a minúsculas, para comparar "Ñuñoa" con "nunoa" sin problema.
    # NFKD separa la letra de su tilde (á -> a + ´), y el filtro se queda solo con la letra.
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("utf-8")
    return sin_tildes.lower().strip()


def obtener_mapa_comunas(token: str) -> dict[str, int]:
    """
    Trae las comunas reales desde la API y arma un diccionario
    {"nombre normalizado": id} para buscar rápido.
    """
    respuesta = requests.get(f"{API_URL}/comunas", headers={"Authorization": f"Bearer {token}"})
    respuesta.raise_for_status()
    comunas = respuesta.json()
    return {normalizar(c["name"]): c["id"] for c in comunas}


def buscar_comuna_id(nombre_scrapeado: str, mapa_comunas: dict[str, int]) -> int | None:
    nombre_normalizado = normalizar(nombre_scrapeado)
    return mapa_comunas.get(nombre_normalizado)


if __name__ == "__main__":
    # Prueba rápida: pega acá un token válido (cópialo de un login reciente en /docs)
    TOKEN_DE_PRUEBA = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiMmRlZjdkYS1kOTM2LTRmNjQtYWFkYi0zNzZiMjc1Y2NmZDYiLCJlbWFpbCI6Impvc2VAZXhhbXBsZS5jb20iLCJleHAiOjE3OTA1NTY1Mjh9.rYUu5sCy_5uFFI4NQ4QKJopTdIbLHJpbv-zFcWo5ioY"

    mapa = obtener_mapa_comunas(TOKEN_DE_PRUEBA)
    print(f"Se cargaron {len(mapa)} comunas desde la API.\n")

    # Probamos con los nombres reales que vimos en el scraper
    for nombre in ["La Cisterna", "Las Cabras", "La Serena", "Ñuñoa", "COMUNA QUE NO EXISTE"]:
        resultado = buscar_comuna_id(nombre, mapa)
        print(f"{nombre!r} -> comuna_id: {resultado}")