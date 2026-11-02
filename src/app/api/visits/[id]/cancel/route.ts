import { NextResponse } from "next/server";
import { cancelVisit } from "@/lib/visits";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "VALIDACION", message: "Id inválido." }, { status: 400 });
  }

  const result = await cancelVisit(id);
  if (result.ok) return NextResponse.json(result.visit);
  if (result.reason === "NOT_FOUND") {
    return NextResponse.json({ error: "NO_ENCONTRADO", message: "La visita no existe." }, { status: 404 });
  }
  return NextResponse.json({ error: "YA_CANCELADA", message: "La visita ya estaba cancelada." }, { status: 409 });
}