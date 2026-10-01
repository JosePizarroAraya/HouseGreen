# HouseGreen

Plataforma para evaluar propiedades en remate en Chile: catálogo con semáforo de riesgo,
favoritos, alertas y panel de administración.

- **housegreen-api**: API en FastAPI + SQLAlchemy + PostgreSQL
- **housegreen-web**: web en React + Vite + TypeScript

## Requisitos

Instalar antes, en este orden:

1. **PostgreSQL 18** (incluye pgAdmin)
2. **Python 3.11**
3. **Node.js 20.19 o más nuevo** (recomendado: 22 LTS)
4. **Git**

## 1. Base de datos

1. En pgAdmin, crear una base vacía llamada `HouseGreenDB`.
2. Clic sobre `HouseGreenDB` → **Query Tool** → ícono de carpeta (Open File) →
   elegir `housegreen-api/db/housegreen.sql` → **Execute** (F5).
3. Comprobar con `SELECT count(*) FROM properties;` (debe dar 7).

> Si el script no está en el repositorio, pedirlo al equipo.
> Las fotos subidas por el admin no van en el script: copiar la carpeta `housegreen-api/uploads/`.
## 2. API (housegreen-api)

```bash
cd housegreen-api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Copiar `.env.example` como `.env` y completar la clave de PostgreSQL:

```
DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/HouseGreenDB
SECRET_KEY=una-clave-larga-y-secreta
```

Levantar la API:

```bash
uvicorn app.main:app --reload
```

Comprobar en http://localhost:8000/docs

Las fotos que sube el administrador se guardan en `housegreen-api/uploads/`
(la carpeta se crea sola). Si se usa un respaldo de la base que tiene fotos,
copiar también esa carpeta.

## 3. Web (housegreen-web)

En otra terminal:

```bash
cd housegreen-web
npm install
npm run dev
```

Abrir **http://localhost:5173** (usar `localhost`, no `127.0.0.1`, porque la API solo acepta ese origen).

## Uso diario

Con todo instalado, cada vez se levanta en este orden:

1. PostgreSQL (normalmente ya está corriendo como servicio)
2. API: `venv\Scripts\activate` y `uvicorn app.main:app --reload`
3. Web: `npm run dev`

## Cuentas de prueba

| Rol | Correo |
|---|---|
| Administrador | jose@example.com |
| Inversionista | jose1@gmail.com |

Las contraseñas se piden al equipo.

## Scraper (en desarrollo)

Lee la primera página de rematesinmobiliarios.cl y muestra los remates en la terminal
(todavía no los guarda en la base):

```bash
cd housegreen-api
venv\Scripts\activate
python -m app.scraper.remates_scraper
```

## Problemas comunes

- **La web dice que no puede conectar:** la API no está corriendo, o PostgreSQL está detenido.
- **Error de CORS en la consola:** abrir la web en `http://localhost:5173`, no en `127.0.0.1`.
- **La API no arranca y menciona `python-multipart`:** faltan dependencias; correr `pip install -r requirements.txt` con el venv activado.
- **Pantalla en blanco al volver a la pestaña (Opera GX):** apretar F5, o usar Chrome o Edge.