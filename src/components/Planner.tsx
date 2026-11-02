"use client";

import { useEffect, useState } from "react";
import type { Visit } from "@/lib/visits";
import { VisitForm } from "./VisitForm";
import type { Site, Technician } from "./types";

interface Props {
  technicians: Technician[];
  sites: Site[];
}

export function Planner({ technicians, sites }: Props) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [technicianId, setTechnicianId] = useState("");
  const [date, setDate] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Recarga el listado cuando cambian los filtros o tras crear/cancelar una visita
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (technicianId) params.set("technicianId", technicianId);
    if (date) params.set("date", date);

    setLoading(true);
    fetch(`/api/visits?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        setVisits(await res.json());
        setListError(null);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setListError("No se pudieron cargar las visitas.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [technicianId, date, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  async function handleCancel(v: Visit) {
    if (!window.confirm(`¿Cancelar la visita de ${v.technicianName} en ${v.siteName} (${v.date} ${v.startTime})?`)) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/visits/${v.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.message ?? "No se pudo cancelar la visita.");
      }
    } catch {
      setActionError("Error de red al cancelar la visita.");
    }
    reload(); // recargamos siempre: el estado real puede haber cambiado
  }

  return (
    <>
      <VisitForm technicians={technicians} sites={sites} onCreated={reload} />

      <section className="card">
        <h2>Visitas</h2>
        <div className="filters">
          <label>
            Técnico
            <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
              <option value="">Todos</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setTechnicianId("");
              setDate("");
            }}
            disabled={!technicianId && !date}
          >
            Limpiar filtros
          </button>
        </div>

        {actionError && (
          <p className="feedback error" role="alert">
            {actionError}
          </p>
        )}
        {listError && (
          <p className="feedback error" role="alert">
            {listError}
          </p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Técnico</th>
                <th>Obra</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className={v.status === "Cancelada" ? "cancelled" : undefined}>
                  <td>{v.date}</td>
                  <td>
                    {v.startTime}–{v.endTime}
                  </td>
                  <td>{v.technicianName}</td>
                  <td>
                    {v.siteName} <span className="muted">({v.municipality})</span>
                  </td>
                  <td>
                    <span className={`badge ${v.status === "Programada" ? "scheduled" : "cancelled"}`}>{v.status}</span>
                  </td>
                  <td>
                    {v.status === "Programada" && (
                      <button type="button" className="secondary" onClick={() => handleCancel(v)}>
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && visits.length === 0 && !listError && (
                <tr>
                  <td colSpan={6} className="muted">
                    No hay visitas para estos filtros.
                  </td>
                </tr>
              )}
              {loading && visits.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}