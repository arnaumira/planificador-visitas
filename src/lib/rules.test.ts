import { describe, expect, it } from "vitest";
import { checkVisitRules, toMinutes, type ExistingVisit } from "./rules";

const t = toMinutes;

// Visita existente: obra 1, 10:00-11:00
const existing: ExistingVisit[] = [
  { id: 1, siteId: 1, startMinutes: t("10:00"), endMinutes: t("11:00") },
];

const rulesOf = (siteId: number, start: string, duration: number, ex = existing) =>
  checkVisitRules({ siteId, startMinutes: t(start), durationMinutes: duration }, ex).map(
    (v) => v.rule
  );

describe("regla c) jornada", () => {
  it("acepta una visita que empieza justo a las 08:00", () => {
    expect(rulesOf(1, "08:00", 60, [])).toEqual([]);
  });
  it("acepta una visita que termina justo a las 17:00", () => {
    expect(rulesOf(1, "16:00", 60, [])).toEqual([]);
  });
  it("rechaza una visita que empieza antes de las 08:00", () => {
    expect(rulesOf(1, "07:59", 30, [])).toEqual(["JORNADA"]);
  });
  it("rechaza una visita que termina después de las 17:00", () => {
    expect(rulesOf(1, "16:30", 31, [])).toEqual(["JORNADA"]);
  });
});

describe("regla a) solapamiento", () => {
  it("rechaza solapamiento parcial", () => {
    expect(rulesOf(1, "10:30", 60)).toEqual(["SOLAPAMIENTO"]);
  });
  it("rechaza una visita contenida en otra", () => {
    expect(rulesOf(1, "10:15", 15)).toEqual(["SOLAPAMIENTO"]);
  });
  it("rechaza una visita idéntica", () => {
    expect(rulesOf(1, "10:00", 60)).toEqual(["SOLAPAMIENTO"]);
  });
  it("no considera solapamiento que una visita acabe justo cuando empieza otra", () => {
    expect(rulesOf(1, "09:00", 60)).toEqual([]); // 09:00-10:00 vs 10:00-11:00, misma obra
  });
  it("no añade DESPLAZAMIENTO cuando ya hay solapamiento con otra obra", () => {
    expect(rulesOf(2, "10:30", 60)).toEqual(["SOLAPAMIENTO"]);
  });
});

describe("regla b) desplazamiento", () => {
  it("permite visitas consecutivas en la misma obra", () => {
    expect(rulesOf(1, "11:00", 60)).toEqual([]);
    expect(rulesOf(1, "09:00", 60)).toEqual([]);
  });
  it("rechaza obras diferentes sin margen (después)", () => {
    expect(rulesOf(2, "11:00", 60)).toEqual(["DESPLAZAMIENTO"]);
  });
  it("rechaza obras diferentes con 29 minutos (después)", () => {
    expect(rulesOf(2, "11:29", 60)).toEqual(["DESPLAZAMIENTO"]);
  });
  it("acepta obras diferentes con exactamente 30 minutos (después)", () => {
    expect(rulesOf(2, "11:30", 60)).toEqual([]);
  });
  it("rechaza obras diferentes con 29 minutos (antes)", () => {
    expect(rulesOf(2, "09:01", 30)).toEqual(["DESPLAZAMIENTO"]); // acaba 09:31
  });
  it("acepta obras diferentes con exactamente 30 minutos (antes)", () => {
    expect(rulesOf(2, "09:00", 30)).toEqual([]); // acaba 09:30
  });
});

describe("varias reglas a la vez", () => {
  it("devuelve todas las reglas incumplidas", () => {
    // 07:30-10:30: empieza antes de la jornada y se solapa con 10:00-11:00
    expect(rulesOf(1, "07:30", 180).sort()).toEqual(["JORNADA", "SOLAPAMIENTO"]);
  });
  it("sin visitas existentes y dentro de jornada no hay violaciones", () => {
    expect(rulesOf(1, "09:00", 120, [])).toEqual([]);
  });
});

describe("el que llama pasa solo visitas Programada", () => {
  it("con la lista vacía (p. ej. todas canceladas) el horario está libre", () => {
    expect(rulesOf(1, "10:00", 60, [])).toEqual([]);
  });
});