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
- La llave `TWO_FA_KEY` del equipo (ver "Cuentas y seguridad")
- Para entrar como administrador: un teléfono con una aplicación de autenticación
  (Google Authenticator, Microsoft Authenticator u otra parecida)

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
TWO_FA_KEY=la-llave-del-equipo
```

El archivo `.env` nunca se sube al repositorio.

Para iniciar la API:

```
uvicorn app.main:app --reload
```

Queda en `http://localhost:8000`. La documentación de las rutas está en `http://localhost:8000/docs`.
Si cambias el `.env`, detén la API y vuelve a iniciarla: el reinicio automático no lo lee.

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

| Rol | Qué puede hacer |
|---|---|
| Inversionista | Ver el catálogo con filtros (precio, comuna, tipo de propiedad y riesgo), el detalle de cada remate con su semáforo, guardar favoritos, crear alertas, recibir los anuncios del administrador, enviar su opinión sobre la aplicación y editar su perfil. |
| Administrador | Además: Panel, Publicaciones, Semáforo, Opiniones, Anuncios y Usuarios (ver abajo). |
| Analista | El rol existe en la base, pero todavía no tiene pantallas propias. |

Apartados del administrador:

| Apartado | Para qué sirve |
|---|---|
| Panel | Resumen de los últimos 7 días: usuarios nuevos, publicaciones nuevas, vistas, guardados, pendientes, semáforo de las publicaciones vigentes y las más vistas. |
| Publicaciones | Lista con vistas y guardados; quién vio y quién guardó cada una; fotos y descripción. |
| Semáforo | Propiedades que todavía no tienen zona de precio, ordenadas por fecha de remate. Se elige con un clic y también se puede corregir el tipo de dominio. |
| Opiniones | Promedio y calificaciones recibidas, con filtros. Se puede responder solo a quien lo autorizó. |
| Anuncios | Mensajes para todos los inversionistas, para una persona o para quienes vieron o guardaron una publicación. Muestra cuántas personas recibieron cada anuncio y cuántas lo leyeron. |
| Usuarios | Personas registradas, con sus vistas, guardados, opiniones y última actividad. Se entra desde el Panel. |

Sobre los anuncios:

- Llegan dentro de HouseGreen, no por correo. El inversionista los ve en la página Alertas,
  y el número rojo del encabezado le avisa cuántos tiene sin leer.
- Un anuncio cuenta como leído cuando la persona lo abre.
- Solo los reciben los inversionistas con la cuenta habilitada.
- Un anuncio enviado no se puede retirar ni borrar desde la web.

Sobre el catálogo:

- No muestra los remates que ya se realizaron ni los que el sitio de origen retiró.
  Siguen en la base y aparecen en Favoritos con una etiqueta.
- El filtro por tipo agrupa los nombres que usa el sitio de remates en 8 categorías
  (departamentos, casas, terrenos, parcelas, oficinas y locales, bodegas, derechos y otros).
  La agrupación está en `housegreen-web/src/components/tipoPropiedad.ts`.

## 6. Cuentas y seguridad

### Contraseñas

Deben tener entre 8 y 64 caracteres, con al menos una letra y un número.
La regla se aplica al registrarse y al cambiar la contraseña desde el Perfil. Está definida en dos lugares
que deben decir lo mismo:

- API: `housegreen-api/app/auth/security.py` (función `problema_de_contrasena`)
- Web: `housegreen-web/src/utils/contrasena.ts`

### Verificación en dos pasos (2FA)

Además de la contraseña, la cuenta puede pedir un código de 6 dígitos que cambia cada 30 segundos
y que genera una aplicación en el teléfono. El código no llega por correo.

- **Inversionista:** es opcional. Se activa y se desactiva en el Perfil.
- **Administrador:** es obligatoria. Mientras no la active puede entrar a su Perfil, pero no al panel
  de administración. Una vez activada no se puede desactivar.

Para activarla: Perfil → Verificación en dos pasos → Activar, escanear el código QR con la aplicación
y confirmar con el código que muestra.

Si varias personas comparten una misma cuenta de administrador, todas deben escanear el mismo código QR
en el momento de activarla.

### La llave `TWO_FA_KEY`

La clave de dos pasos de cada persona se guarda cifrada en la base, y `TWO_FA_KEY` es la llave que la cifra.

- **Todo el equipo debe tener la misma** en su `.env`, porque la base es compartida.
  Con otra llave, la API no puede validar los códigos.
- **No se cambia.** Si se cambia, las cuentas que ya tienen 2FA dejan de poder entrar.
- **No se sube al repositorio** ni se comparte por canales públicos.

Solo si el proyecto parte desde cero (una base nueva) se genera una llave nueva con:

```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Recuperar una cuenta que perdió su aplicación

Si alguien pierde el teléfono o borra la cuenta de su aplicación, se le quita el 2FA desde el SQL Editor
de Neon y lo vuelve a activar desde su Perfil:

```sql
UPDATE users SET two_fa_enabled = false, two_fa_secret = NULL
WHERE email = 'correo@ejemplo.com';
```

### Crear una cuenta de administrador

Las cuentas nuevas siempre se crean como inversionista. Para convertir una en administrador:

```sql
UPDATE users SET role_id = 3 WHERE email = 'correo@ejemplo.com';
```

Los roles son: 1 inversionista, 2 analista y 3 administrador.

## 7. Base de datos

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

Tablas de usuarios y de uso de la aplicación:

| Objeto | Para qué sirve |
|---|---|
| `users` | Cuentas. `two_fa_enabled` y `two_fa_secret` guardan la verificación en dos pasos; `is_active` permite deshabilitar una cuenta. |
| `roles` | Los tres tipos de cuenta. |
| `property_views` | Cada vez que un inversionista abre el detalle de una propiedad. |
| `saved_properties` | Favoritos de cada persona. |
| `property_photos` | Fotos de cada propiedad (los archivos están en Cloudinary). |
| `feedback` | Opiniones: calificación de 1 a 5, tema, mensaje y si la persona acepta respuesta. |
| `feedback_replies` | Respuestas del administrador a las opiniones. |
| `announcements` | Anuncios enviados por el administrador: título, mensaje y a quiénes iba (`audience`). |
| `announcement_recipients` | Una fila por cada persona que recibió un anuncio. `read_at` guarda cuándo lo leyó (vacío = sin leer). |

Para recalcular el semáforo de todas las propiedades, en el SQL Editor de Neon:

```sql
SELECT zona, count(*) AS propiedades
  FROM (SELECT calculate_score(id) AS zona FROM properties) AS t
 GROUP BY zona
 ORDER BY zona;
```

## 8. Antes de subir cambios

Dentro de `housegreen-web`, para confirmar que la web compila:

```
npm run build
```

Y desde la carpeta raíz del repositorio:

```
git add .
git status
git commit -m "Qué se hizo"
git push
```

Antes del `commit`, revisa en `git status` que no aparezca ningún archivo `.env`.

## 9. Estado del proyecto

Al 7 de octubre de 2026.

Funcionando: scraper y catálogo con remates reales, semáforo con sus cuatro factores, detalle de cada
remate, favoritos, perfil, verificación en dos pasos, opiniones, anuncios, y los apartados Panel,
Publicaciones, Semáforo, Opiniones, Anuncios y Usuarios del administrador.

Pendiente:

- Alertas por criterios: en la página Alertas, los criterios y sus notificaciones todavía usan datos de
  ejemplo guardados en el navegador. Falta conectarlos a la API (los anuncios de esa página sí son reales).
- Carga automática de los remates (hoy se ejecutan los dos comandos a mano).
- Publicar la web y la API en internet.
- Pantallas del analista y mapa por comuna.
- Zona de precio de las publicaciones vigentes, que completa el administrador.

## 10. Fuente de los datos

Los remates provienen de las páginas públicas de [rematesinmobiliarios.cl](https://www.rematesinmobiliarios.cl).
Cada ficha de HouseGreen enlaza a la publicación original.

El scraper respeta el `robots.txt` del sitio. Los términos del sitio piden autorización escrita para
reproducir su contenido: el equipo tiene pendiente solicitarla.

HouseGreen es un proyecto académico. La información es de referencia y no reemplaza la revisión de los
documentos de cada remate: antes de ofertar hay que verificar las deudas, el avalúo y las inscripciones
en los sitios oficiales (la web indica cómo en cada propiedad).