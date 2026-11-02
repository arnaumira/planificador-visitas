# Planificador de visitas

Prueba técnica · Talent Clau.

## Ejecutar en local (< 10 min)

```bash
cp .env.example .env
npm install
npm run db:up        # PostgreSQL en Docker
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3000
```

> Si no usas Docker, crea una BD PostgreSQL y ajusta `DATABASE_URL` en `.env`.

## Qué he hecho y qué queda pendiente
TODO

## Decisiones principales
TODO

## Supuestos
TODO

## Uso de la IA
Ver `docs/AI_LOG.md` → resumir aquí (incluye al menos un caso donde corregí lo generado).
