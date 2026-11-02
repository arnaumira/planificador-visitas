import { z } from "zod";

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (AAAA-MM-DD)")
  .refine(isRealDate, "La fecha no existe");

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:MM)");

export const createVisitSchema = z.object({
  siteId: z.number().int().positive(),
  technicianId: z.number().int().positive(),
  date: dateSchema,
  startTime: timeSchema,
  durationMinutes: z.number().int().min(1, "La duración debe ser positiva").max(1440),
});

export const listVisitsQuerySchema = z.object({
  technicianId: z.coerce.number().int().positive().optional(),
  date: dateSchema.optional(),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;

export function formatIssues(error: z.ZodError) {
  return error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}