import { NextResponse } from "next/server";
import { listSites } from "@/lib/visits";

export async function GET() {
  return NextResponse.json(await listSites());
}