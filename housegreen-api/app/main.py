from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth
from app.routers import auth, properties, favorites, alerts, comunas, admin

app = FastAPI(title="HouseGreen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(favorites.router)
app.include_router(alerts.router)
app.include_router(comunas.router)
app.include_router(admin.router)

admin.CARPETA_UPLOADS.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=admin.CARPETA_UPLOADS), name="uploads")

@app.get("/")
def read_root():
    return {"mensaje": "HouseGreen API funcionando"}
