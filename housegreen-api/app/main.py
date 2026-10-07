from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth
from app.routers import auth, properties, favorites, alerts, comunas, admin
from app.routers import feedback  # paso 81: opiniones
from app.routers import admin_panel  # paso 84: panel del administrador
from app.routers import admin_usuarios  # paso 85: usuarios para el administrador
from app.routers import announcements  # paso 87: anuncios

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
app.include_router(feedback.router)
app.include_router(feedback.router_admin)  # paso 83: opiniones para el administrador
app.include_router(admin_panel.router)
app.include_router(admin_usuarios.router)
app.include_router(announcements.router_admin)
app.include_router(announcements.router)  # paso 89: anuncios para quien los recibe

admin.CARPETA_UPLOADS.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=admin.CARPETA_UPLOADS), name="uploads")

@app.get("/")
def read_root():
    return {"mensaje": "HouseGreen API funcionando"}
