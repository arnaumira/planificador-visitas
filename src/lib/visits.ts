import type { PoolClient } from "pg";
import { pool } from "./db";
import { checkVisitRules, toMinutes, type RuleViolation } from "./rules";
import type { CreateVisitInput, ListVisitsQuery } from "./schemas";

export interface Visit {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  technicianId: number;
  technicianName: string;
  siteId: number;
  siteName: string;
  municipality: string;
  status: "Programada" | "Cancelada";
}

const SELECT_VISIT = `SELECT v.id, to_char(v.starts_at, 'YYYY-MM-DD') AS "date", to_char(v.starts_at, 'HH24:MI') AS "startTime", to_char(v.ends_at, 'HH24:MI') AS "endTime", t.id AS "technicianId", t.name AS "technicianName", s.id AS "siteId", s.name AS "siteName", s.municipality, v.status FROM visits v JOIN technicians t ON t.id = v.technician_id JOIN sites s ON s.id = v.site_id`;

export type CreateResult =
  | { ok: true; visit: Visit }
  | { ok: false; reason: "RULES"; violations: RuleViolation[] }
  | { ok: false; reason: "NOT_FOUND"; message: string };

export type CancelResult =
  | { ok: true; visit: Visit }
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_CANCELLED" };

async function getVisit(client: Pick<PoolClient, "query">, id: number): Promise<Visit> {
  const res = await client.query<Visit>(`${SELECT_VISIT} WHERE v.id = $1`, [id]);
  return res.rows[0];
}

export async function listTechnicians() {
  const res = await pool.query("SELECT id, name FROM technicians ORDER BY name");
  return res.rows as { id: number; name: string }[];
}

export async function listSites() {
  const res = await pool.query("SELECT id, name, municipality FROM sites ORDER BY name");
  return res.rows as { id: number; name: string; municipality: string }[];
}

export async function listVisits(query: ListVisitsQuery): Promise<Visit[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (query.technicianId !== undefined) {
    params.push(query.technicianId);
    conditions.push(`v.technician_id = $${params.length}`);
  }
  if (query.date !== undefined) {
    params.push(query.date);
    conditions.push(`v.starts_at::date = $${params.length}::date`);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const res = await pool.query<Visit>(`${SELECT_VISIT}${where} ORDER BY v.starts_at, v.id`, params);
  return res.rows;
}

export async function createVisit(input: CreateVisitInput): Promise<CreateResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloquea al técnico: las peticiones simultáneas para el mismo técnico se serializan
    const tech = await client.query("SELECT id FROM technicians WHERE id = $1 FOR UPDATE", [input.technicianId]);
    if (!tech.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND", message: "El técnico no existe." };
    }
    const site = await client.query("SELECT id FROM sites WHERE id = $1", [input.siteId]);
    if (!site.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND", message: "La obra no existe." };
    }

    // Solo visitas Programada del mismo técnico y del mismo día (las canceladas no cuentan)
    const existing = await client.query(
      `SELECT id, site_id, (EXTRACT(HOUR FROM starts_at) * 60 + EXTRACT(MINUTE FROM starts_at))::int AS start_minutes, (EXTRACT(HOUR FROM ends_at) * 60 + EXTRACT(MINUTE FROM ends_at))::int AS end_minutes FROM visits WHERE technician_id = $1 AND status = 'Programada' AND starts_at::date = $2::date`,
      [input.technicianId, input.date]
    );

    const violations = checkVisitRules(
      { siteId: input.siteId, startMinutes: toMinutes(input.startTime), durationMinutes: input.durationMinutes },
      existing.rows.map((r) => ({ id: r.id, siteId: r.site_id, startMinutes: r.start_minutes, endMinutes: r.end_minutes }))
    );
    if (violations.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "RULES", violations };
    }

    const ins = await client.query(
      `INSERT INTO visits (site_id, technician_id, starts_at, ends_at) VALUES ($1, $2, $3::date + $4::time, $3::date + $4::time + make_interval(mins => $5::int)) RETURNING id`,
      [input.siteId, input.technicianId, input.date, input.startTime, input.durationMinutes]
    );
    const visit = await getVisit(client, ins.rows[0].id);
    await client.query("COMMIT");
    return { ok: true, visit };
  } catch (e) {
    await client.query("ROLLBACK");
    // Red de seguridad: la restricción EXCLUDE de la BD detectó un solapamiento
    if ((e as { code?: string }).code === "23P01") {
      return {
        ok: false,
        reason: "RULES",
        violations: [{ rule: "SOLAPAMIENTO", message: "El técnico ya tiene una visita que se solapa." }],
      };
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function cancelVisit(id: number): Promise<CancelResult> {
  const upd = await pool.query(
    "UPDATE visits SET status = 'Cancelada', cancelled_at = now() WHERE id = $1 AND status = 'Programada' RETURNING id",
    [id]
  );
  if (upd.rowCount) return { ok: true, visit: await getVisit(pool, id) };

  const exists = await pool.query("SELECT 1 FROM visits WHERE id = $1", [id]);
  return { ok: false, reason: exists.rowCount ? "ALREADY_CANCELLED" : "NOT_FOUND" };
}