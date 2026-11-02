import { NextResponse } from "next/server";
import { listTechnicians } from "@/lib/visits";

export async function GET() {
  return NextResponse.json(await listTechnicians());
}