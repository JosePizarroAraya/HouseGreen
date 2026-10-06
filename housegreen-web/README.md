# HouseGreen

Plataforma web para revisar remates de propiedades de la Región Metropolitana.
Cada remate se muestra con un semáforo de riesgo (verde, amarillo o rojo) que ayuda
al inversionista a decidir cuáles vale la pena estudiar.

## Qué contiene este repositorio

| Carpeta | Qué es |
|---|---|
| `housegreen-api` | API en FastAPI + SQLAlchemy. Incluye el scraper que carga los remates. |
| `housegreen-web` | Sitio web en React + Vite + TypeScript. |

La base de datos es PostgreSQL y está en Neon. Las fotos de las propiedades se guardan en Cloudinary.

## Requisitos

- Python 3.11
- Node.js 20.19 o superior
- La cadena de conexión de la base en Neon
- Las credenciales de la cuenta de Cloudinary

## 1. Levantar la API

Desde la carpeta `housegreen-api`:

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Crea un archivo `.env` en `housegreen-api` (copia `.env.example` y completa los valores):

```
DATABASE_URL_NEON=postgresql://usuario:clave@servidor.neon.tech/neondb?sslmode=require
SECRET_KEY=una-clave-larga-y-aleatoria
CLOUDINARY_CLOUD_NAME=nombre-de-la-nube
CLOUDINARY_API_KEY=clave
CLOUDINARY_API_SECRET=secreto
```

El archivo `.env` nunca se sube al repositorio.

Para iniciar la API:

```
uvicorn app.main:app --reload
```

Queda en `http://localhost:8000`. La documentación de las rutas está en `http://localhost:8000/docs`.

## 2. Levantar la web

Desde la carpeta `housegreen-web`:

```
npm install
npm run dev
```

Queda en `http://localhost:5173`. La web busca la API en `http://localhost:8000`
(se cambia en `src/api/client.ts`).

## 3. Cargar los remates (scraper)

Los remates se leen de las páginas públicas de rematesinmobiliarios.cl.
Son dos comandos y se ejecutan en este orden, desde `housegreen-api` con el entorno activado:

```
python -m app.scraper.cargar_remates
python -m app.scraper.cargar_fichas
```

| Comando | Qué hace |
|---|---|
| `cargar_remates` | Lee el listado de cada comuna y crea los remates que todavía no están en la base. |
| `cargar_fichas` | Abre la ficha de cada remate y guarda la hora, el tribunal, el rol de la causa, la modalidad, la garantía, el anuncio y el tipo de dominio. Después recalcula el semáforo. |

Detalles útiles:

- Para probar con pocas fichas: `python -m app.scraper.cargar_fichas 5`.
- Si se corta a la mitad, al ejecutarlo de nuevo sigue con las que faltan.
- Si la ficha de un remate ya no existe en el sitio, el remate queda marcado como retirado.
- El scraper espera 1,5 segundos entre páginas y no usa las direcciones que el sitio prohíbe en su `robots.txt`.

Los remates salen del catálogo cuando pasa su fecha, así que conviene ejecutar los dos comandos
cada pocos días (y siempre antes de una presentación) para que entren los nuevos.

## 4. Cómo se calcula el semáforo

Son cuatro factores. Cada uno vale 0, 1 o 2 puntos, así que el máximo es 8.

| Factor | De dónde sale | 2 puntos | 1 punto | 0 puntos |
|---|---|---|---|---|
| Precio y rentabilidad | Lo elige el administrador | Zona verde | Zona amarilla | Zona roja o sin revisar |
| Estado legal | Tipo de dominio que se remata | Exclusivo | Otro (derechos, cuota, usufructo) | No especificado |
| Dinamismo del barrio | Tabla por comuna | Verde | Amarilla | Roja |
| Seguridad de la comuna | Tabla por comuna | Verde | Amarilla | Roja |

Resultado:

- 6 a 8 puntos: riesgo bajo (verde)
- 3 a 5 puntos: riesgo medio (amarillo)
- 0 a 2 puntos: riesgo alto (rojo)

Un factor sin dato vale 0 puntos y los demás suman igual. La web muestra cuánto aportó cada factor
y qué le falta a la propiedad para subir de zona.

Hay un solo veto: si la propiedad tiene usufructo vitalicio, herencia no resuelta o prohibición,
queda en riesgo alto sin importar los puntos.

Criterio para la zona de precio:

- Verde: el precio mínimo está 40 % o más bajo el valor de mercado.
- Amarilla: está entre 15 % y 39,9 % más bajo.
- Roja: el descuento es menor a 15 %.

El cálculo lo hace la función `calculate_score` de la base de datos. Se ejecuta al crear o editar
una propiedad, al leer su ficha y cuando el administrador cambia la zona de precio o el dominio.

## 5. Qué puede hacer cada rol

| Rol | Qué ve |
|---|---|
| Inversionista | Catálogo con filtros, detalle de cada remate, favoritos y alertas. |
| Administrador | Además: Publicaciones (fotos, descripción, vistas y guardados) y Semáforo. |

En la pestaña **Semáforo** el administrador ve las propiedades que todavía no tienen zona de precio,
ordenadas por fecha de remate, y la elige con un clic. También puede corregir el tipo de dominio.

El catálogo no muestra los remates que ya se realizaron ni los que el sitio de origen retiró.
Siguen en la base y aparecen en Favoritos con una etiqueta.

## 6. Base de datos

Tablas y columnas que usa el semáforo:

| Objeto | Para qué sirve |
|---|---|
| `comuna_risk_index` | Seguridad de cada comuna. |
| `comuna_dynamism_index` | Dinamismo de cada comuna (52 comunas de la Región Metropolitana). |
| `property_financial_info.market_zone` | Zona de precio que elige el administrador. |
| `property_legal_info.domain_type` | Tipo de dominio: `exclusivo`, `otro` o vacío. |
| `property_auction_info` | Datos leídos de la ficha: tribunal, rol, modalidad, garantía, anuncio. |
| `property_evaluations` | Resultado de cada evaluación. `missing_data` anota qué datos faltaban. |
| `evaluation_details` | Puntos de cada factor en cada evaluación. |
| `calculate_score(uuid)` | Función que calcula el semáforo de una propiedad. |
| `zone_points(semaforo_level)` | Convierte una zona en puntos: verde 2, amarillo 1, rojo 0. |

Para recalcular el semáforo de todas las propiedades, en el SQL Editor de Neon:

```sql
SELECT zona, count(*) AS propiedades
  FROM (SELECT calculate_score(id) AS zona FROM properties) AS t
 GROUP BY zona
 ORDER BY zona;
```

## 7. Antes de subir cambios

Dentro de `housegreen-web`, para confirmar que la web compila:

```
npm run build
```

Y desde la carpeta raíz