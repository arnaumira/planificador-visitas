# Planificador de visitas

Prueba técnica · Talent Clau. Primera versión de una aplicación web para planificar las visitas de cuatro técnicos a obras de varios municipios, evitando solapamientos, falta de tiempo de desplazamiento y visitas fuera de jornada.

**Aplicación publicada:** _pendiente de añadir_

**Stack:** Next.js 15 (App Router) · TypeScript · Node.js · PostgreSQL (`pg`, SQL directo) · zod · Vitest

## Ejecutar en local (< 10 min)

Requisitos: **Node.js 20.6 o superior** y **Docker** (para PostgreSQL). Si no usas Docker, consulta la nota al final de esta sección.

```bash
cp .env.example .env     # en cmd de Windows: copy .env.example .env
npm install
npm run db:up            # levanta PostgreSQL en Docker (puerto 5433)
npm run db:migrate       # crea las tablas y restricciones
npm run db:seed          # técnicos, obras y visitas de ejemplo
npm run dev              # http://localhost:3000
```

Otros comandos: `npm test` (tests de las reglas), `npm run build`, `npm run db:reset` (borra y recrea la BD local).

El contenedor publica PostgreSQL en el puerto **5433** para no chocar con un PostgreSQL que ya esté instalado en el 5432. Para usar una base de datos propia (local o de un servicio como Neon), basta con poner su cadena de conexión en `DATABASE_URL` dentro de `.env`; el archivo `.env` no se sube al repositorio.

Los datos de ejemplo usan fechas de **noviembre de 2026** (por ejemplo, el 2026-11-02 para probar los conflictos).

## Estructura

```
db/migrations/001_init.sql   esquema, restricciones CHECK y EXCLUDE
db/seed.sql                  datos de ejemplo inventados
scripts/                     migrate.ts y seed.ts
src/lib/rules.ts             las 3 reglas como función pura (+ rules.test.ts)
src/lib/schemas.ts           validación de entrada con zod
src/lib/visits.ts            crear, cancelar y listar visitas (SQL, transacción)
src/app/api/                 endpoints REST
src/app/ y src/components/   interfaz (una sola página)
```

| Endpoint | Descripción |
|---|---|
| `GET /api/visits?technicianId=&date=` | Listado ordenado por fecha y hora, con filtros opcionales |
| `POST /api/visits` | Programa una visita. `201` creada · `400` entrada inválida · `422` regla incumplida · `404` técnico u obra inexistente |
| `POST /api/visits/:id/cancel` | Cancela una visita. `200` · `404` · `409` si ya estaba cancelada |
| `GET /api/technicians`, `GET /api/sites` | Datos para los desplegables |

---

# Explicación

## a) Qué he hecho y qué queda pendiente

**Hecho:** todos los requisitos funcionales. Técnicos y obras con datos de ejemplo; programar una visita indicando obra, técnico, fecha, hora de inicio y duración, con un mensaje que indica **qué regla (a, b o c) no se cumple**; las tres reglas de planificación; cancelar (la visita sigue visible como *Cancelada* y libera el horario); y un listado ordenado por fecha y hora con filtros por técnico y por fecha. Las validaciones se hacen en el servidor, no solo en el formulario.

**Pendiente:**
- Editar o reprogramar una visita (ahora hay que cancelar y crear otra).
- Gestión (alta, baja, edición) de técnicos y obras desde la interfaz: hoy solo existen los del script de datos de ejemplo.
- Autenticación y roles.
- Tests de integración de la API y un test automático de concurrencia (la protección existe, pero la he probado a mano, no con un test).
- Paginación del listado y una vista de calendario por técnico.
- Si no consigo publicarla, la URL de la aplicación desplegada.

## b) Decisiones principales

- **Reglas como función pura (`rules.ts`), con tests.** No depende de la BD ni del framework, así que se puede probar con casos límite (acabar exactamente a las 17:00, 29 frente a 30 minutos de margen, visitas pegadas en la misma obra). Devuelve **todas** las reglas incumplidas, no solo la primera.
- **Doble defensa.** El servicio aplica las reglas antes de insertar, y la BD tiene sus propias restricciones: un `CHECK` para la jornada y una restricción `EXCLUDE` (con `btree_gist`) que impide solapamientos de visitas *Programada* del mismo técnico. La regla b) solo se garantiza en la aplicación, porque no se puede expresar limpiamente como restricción.
- **Bloqueo por técnico.** Crear una visita ocurre en una transacción que hace `SELECT ... FOR UPDATE` sobre el técnico, de modo que dos peticiones simultáneas para el mismo técnico se serializan y no se pueden colar dos visitas incompatibles.
- **Fechas y horas como texto.** El driver `pg` convierte los `timestamp` a `Date` de JavaScript usando la zona horaria de la máquina, una fuente típica de errores de una hora. Formateo en SQL (`to_char`) y trabajo en minutos desde medianoche.
- **Cancelar es un cambio de estado**, no un borrado, como pide el enunciado.
- **SQL directo con `pg` en lugar de un ORM**, porque el modelo es pequeño y las consultas clave (bloqueo, restricciones, rangos) quedan más claras en SQL.
- **Route Handlers en lugar de Server Actions**: el contrato HTTP (códigos y formato de error) es explícito y se puede probar sin interfaz.
- **Docker solo para la base de datos**, para que cualquiera pueda levantarla con un comando.

## c) Supuestos

- Dos visitas consecutivas del mismo técnico **a la misma obra** no necesitan tiempo de desplazamiento; la regla b) solo se aplica entre obras distintas.
- Los 30 minutos son fijos, sin importar los municipios (no hay distancias entre obras).
- Que una visita termine justo cuando empieza otra **no es solapamiento**.
- Una visita se desarrolla en un único día (no cruza la medianoche) y se guarda en **hora local**, sin zona horaria.
- Las visitas canceladas no cuentan para ninguna regla.
- Si hay solapamiento con una visita, no se añade además el aviso de desplazamiento respecto a esa misma visita.
- La duración es cualquier número entero de minutos positivo; no hay granularidad mínima ni fechas pasadas bloqueadas.

## d) Cómo he utilizado la IA

He usado Claude (chat) durante todo el proyecto para: proponer la arquitectura, generar el esqueleto (migraciones, scripts, configuración), escribir las reglas y sus tests, la API y la interfaz. Probé cada paso ejecutando los tests, los endpoints y la interfaz, y cuando algo falló analicé la causa antes de aplicar la corrección. Tres casos en los que tuve que corregir lo generado:

1. **Los scripts de BD no leían `.env`.** El esqueleto usaba `tsx scripts/migrate.ts`, pero `tsx` no carga `.env` (Next.js sí, los scripts no). `process.env.DATABASE_URL` quedaba vacío y `pg` se conectaba con valores por defecto, con el error `client password must be a string`. Lo corregí añadiendo `--env-file=.env` a los scripts.
2. **Un test mal calculado.** Un test de "varias reglas a la vez" proponía una visita de 07:30 con 150 minutos, que termina a las 10:00, justo cuando empieza la visita existente, así que no se solapa. El fallo estaba en el test, no en `rules.ts`: corregí la duración a 180 minutos y añadí un test que fija explícitamente que tocarse en los extremos no es solapamiento.
3. **El puerto de PostgreSQL.** Al ver un error de autenticación, la IA dio por hecho que el servidor era el contenedor. El mensaje llegaba en castellano, mientras que el PostgreSQL del contenedor responde en inglés: me estaba conectando a otro PostgreSQL instalado en Windows que ocupaba el puerto 5432. Lo resolví publicando el contenedor en el 5433, y por eso `.env.example` y `docker-compose.yml` usan ese puerto.