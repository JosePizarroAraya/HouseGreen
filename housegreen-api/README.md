# HouseGreen

Plataforma para evaluar propiedades en remate en Chile: catálogo con semáforo de riesgo,
favoritos, alertas y panel de administración.

- **housegreen-api**: API en FastAPI + SQLAlchemy
- **housegreen-web**: web en React + Vite + TypeScript
- **Base de datos**: PostgreSQL en la nube (Neon)
- **Fotos**: en la nube (Cloudinary)

## Requisitos

1. **Python 3.11**
2. **Node.js 20.19 o más nuevo** (recomendado: 22 LTS)
3. **Git**

No hace falta instalar PostgreSQL: la base de datos y las fotos están en la nube,
así que el proyecto funciona igual en cualquier computador.

## 1. API (housegreen-api)

```bash
cd housegreen-api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Copiar `.env.example` como `.env` y completar los 5 valores
(la conexión de Neon y las claves de Cloudinary se piden al equipo; **no se suben al repositorio**).

Levantar la API:

```bash
uvicorn app.main:app --reload
```

Comprobar en http://localhost:8000/docs

## 2. Web (housegreen-web)

En otra terminal:

```bash
cd housegreen-web
npm install
npm run dev
```

Abrir **http://localhost:5173** (usar `localhost`, no `127.0.0.1`, porque la API solo acepta ese origen).

## Uso diario

1. API: `venv\Scripts\activate` y `uvicorn app.main:app --reload`
2. Web: `npm run dev`

## Base de datos

- Las consultas SQL se corren en la consola de Neon → **SQL Editor**.
- Neon muestra las horas en UTC (3 horas más que en Chile); la web las muestra en hora local.

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

- **La web dice que no puede conectar:** la API no está corriendo, o falta el archivo `.env`.
- **La primera carga demora unos segundos:** Neon apaga la base cuando no se usa y la enciende sola con la primera consulta.
- **Error de CORS en la consola:** abrir la web en `http://localhost:5173`, no en `127.0.0.1`.
- **`uvicorn` no se reconoce como comando:** el venv no está activado o le faltan dependencias; correr `venv\Scripts\activate` y `pip install -r requirements.txt`.
- **Error al subir fotos ("No se pudo guardar la foto en la nube"):** revisar las 3 claves de Cloudinary en el `.env` y la conexión a internet.
- **Pantalla en blanco al volver a la pestaña (Opera GX):** apretar F5, o usar Chrome o Edge.