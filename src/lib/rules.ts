export const WORKDAY_START = 8 * 60; // 08:00
export const WORKDAY_END = 17 * 60; // 17:00
export const TRAVEL_BUFFER = 30; // minuts mínims entre obres diferents

export type Rule = "SOLAPAMIENTO" | "DESPLAZAMIENTO" | "JORNADA";

export interface ProposedVisit {
  siteId: number;
  startMinutes: number;
  durationMinutes: number;
}

/** Visites ja guardades: només Programada, mateix tècnic i mateix dia. */
export interface ExistingVisit {
  id: number;
  siteId: number;
  startMinutes: number;
  endMinutes: number;
}

export interface RuleViolation {
  rule: Rule;
  message: string;
  conflictingVisitId?: number;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function checkVisitRules(
  proposed: ProposedVisit,
  existing: ExistingVisit[]
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const start = proposed.startMinutes;
  const end = start + proposed.durationMinutes;

  // c) Dentro de la jornada
  if (start < WORKDAY_START || end > WORKDAY_END) {
    violations.push({
      rule: "JORNADA",
      message: `La visita (${formatMinutes(start)}-${formatMinutes(end)}) debe estar dentro de la jornada, de ${formatMinutes(WORKDAY_START)} a ${formatMinutes(WORKDAY_END)}.`,
    });
  }

  for (const other of existing) {
    const range = `${formatMinutes(other.startMinutes)}-${formatMinutes(other.endMinutes)}`;

    // a) Solapamiento
    if (start < other.endMinutes && other.startMinutes < end) {
      violations.push({
        rule: "SOLAPAMIENTO",
        message: `El técnico ya tiene una visita que se solapa (${range}).`,
        conflictingVisitId: other.id,
      });
      continue; // si se solapa, no tiene sentido evaluar el desplazamiento
    }

    // b) Desplazamiento entre obras diferentes
    if (other.siteId !== proposed.siteId) {
      const gap =
        start >= other.endMinutes ? start - other.endMinutes : other.startMinutes - end;
      if (gap < TRAVEL_BUFFER) {
        violations.push({
          rule: "DESPLAZAMIENTO",
          message: `Entre visitas a obras diferentes hacen falta al menos ${TRAVEL_BUFFER} minutos de desplazamiento; con la visita de ${range} solo hay ${gap}.`,
          conflictingVisitId: other.id,
        });
      }
    }
  }

  return violations;
}