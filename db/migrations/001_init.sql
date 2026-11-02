CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE technicians (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE sites (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  municipality TEXT NOT NULL
);

CREATE TABLE visits (
  id            SERIAL PRIMARY KEY,
  site_id       INT NOT NULL REFERENCES sites(id),
  technician_id INT NOT NULL REFERENCES technicians(id),
  starts_at     TIMESTAMP NOT NULL,  -- hora local, sense zona horària (supòsit)
  ends_at       TIMESTAMP NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Programada' CHECK (status IN ('Programada', 'Cancelada')),
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  cancelled_at  TIMESTAMP,

  CONSTRAINT visits_end_after_start CHECK (ends_at > starts_at),
  -- regla c) dins la jornada 08:00-17:00 i el mateix dia
  CONSTRAINT visits_within_workday CHECK (
    ends_at::date = starts_at::date
    AND starts_at::time >= TIME '08:00'
    AND ends_at::time   <= TIME '17:00'
  ),
  -- regla a) xarxa de seguretat contra solapaments (també davant concurrència)
  CONSTRAINT visits_no_overlap EXCLUDE USING gist (
    technician_id WITH =,
    tsrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'Programada')
);

CREATE INDEX visits_technician_start_idx ON visits (technician_id, starts_at);
