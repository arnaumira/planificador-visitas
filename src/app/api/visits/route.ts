import { NextResponse } from "next/server";
import { createVisitSchema, formatIssues, listVisitsQuerySchema } from "@/lib/schemas";
import { createVisit, listVisits } from "@/lib/visits";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw: Record<string, string> = {};
  for (const key of ["technicianId", "date"]) {
    const value = searchParams.get(key);
    if (value) raw[key] = value;
  }
  const parsed = listVisitsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDACION", details: formatIssues(parsed.error) }, { status: 400 });
  }
  return NextResponse.json(await listVisits(parsed.data));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDACION", details: formatIssues(parsed.error) }, { status: 400 });
  }

  const result = await createVisit(parsed.data);
  if (result.ok) return NextResponse.json(result.visit, { status: 201 });
  if (result.reason === "NOT_FOUND") {
    return NextResponse.json({ error: "NO_ENCONTRADO", message: result.message }, { status: 404 });
  }
  return NextResponse.json({ error: "REGLAS", violations: result.violations }, { status: 422 });
}