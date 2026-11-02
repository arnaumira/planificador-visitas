TRUNCATE visits, sites, technicians RESTART IDENTITY CASCADE;

INSERT INTO technicians (name) VALUES
  ('Marta Ferrer'), ('Jordi Puig'), ('Laia Soler'), ('Pau Roca');

INSERT INTO sites (name, municipality) VALUES
  ('Obra Residencial Can Roca', 'Terrassa'),
  ('Reforma Nau Industrial Nord', 'Sabadell'),
  ('Edifici Passeig Verdaguer', 'Barcelona'),
  ('Ampliació Centre Cívic', 'Rubí'),
  ('Rehabilitació Masia Vella', 'Granollers');

-- Exemples vàlids (ajusta les dates si vols dades properes a avui)
INSERT INTO visits (site_id, technician_id, starts_at, ends_at) VALUES
  (1, 1, '2026-11-02 09:00', '2026-11-02 10:30'),
  (2, 1, '2026-11-02 11:30', '2026-11-02 13:00'),
  (3, 2, '2026-11-02 08:00', '2026-11-02 09:00');
