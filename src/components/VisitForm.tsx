"use client";

import { useState, type FormEvent } from "react";
import type { RuleViolation } from "@/lib/rules";
import type { Site, Technician } from "./types";

type Feedback =
  | { kind: "ok"; text: string }
  | { kind: "rules"; violations: RuleViolation[] }
  | { kind: "error"; messages: string[] }
  | null;

const RULE_LABELS: Record<RuleViolation["rule"], string> = {
  SOLAPAMIENTO: "a) Solapamiento",
  DESPLAZAMIENTO: "b) Desplazamiento",
  JORNADA: "c) Jornada",
};

const FIELD_LABELS: Record<string, string> = {
  technicianId: "Técnico",
  siteId: "Obra",
  date: "Fecha",
  startTime: "Hora de inicio",
  durationMinutes: "Duración",
};

interface Props {
  technicians: Technician[];
  sites: Site[];
  onCreated: () => void;
}

export function VisitForm({ technicians, sites, onCreated }: Props) {
  const [technicianId, setTechnicianId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: Number(technicianId),
          siteId: Number(siteId),
          date,
          startTime,
          durationMinutes: Number(duration),
        }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 201) {
        setFeedback({
          kind: "ok",
          text: `Visita programada: ${body.technicianName} en ${body.siteName}, el ${body.date} de ${body.startTime} a ${body.endTime}.`,
        });
        onCreated();
      } else if (res.status === 422) {
        setFeedback({ kind: "rules", violations: body.violations });
      } else if (res.status === 400 && Array.isArray(body?.details)) {
        setFeedback({
          kind: "error",
          messages: body.details.map(
            (d: { field: string; message: string }) => `${FIELD_LABELS[d.field] ?? d.field}: ${d.message}`
          ),
        });
      } else {
        setFeedback({ kind: "error", messages: [body?.message ?? "No se pudo guardar la visita."] });
      }
    } catch {
      setFeedback({ kind: "error", messages: ["Error de red al guardar la visita."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>Programar visita</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Técnico
          <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} required>
            <option value="">Selecciona…</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Obra
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            <option value="">Selecciona…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.municipality})
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Hora de inicio
          <input type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </label>
        <label>
          Duración (minutos)
          <input type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} required />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : "Programar visita"}
          </button>
        </div>
      </form>

      {feedback?.kind === "ok" && (
        <p className="feedback ok" role="status">
          {feedback.text}
        </p>
      )}
      {feedback?.kind === "rules" && (
        <div className="feedback error" role="alert">
          <strong>No se puede guardar la visita. Reglas incumplidas:</strong>
          <ul>
            {feedback.violations.map((v, i) => (
              <li key={i}>
                <strong>{RULE_LABELS[v.rule]}:</strong> {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback?.kind === "error" && (
        <div className="feedback error" role="alert">
          <ul>
            {feedback.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}