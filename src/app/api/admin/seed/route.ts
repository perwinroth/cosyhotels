import { NextResponse } from "next/server";

// Curated admin seed removed; keep endpoint as a harmless no-op for compatibility
export async function POST() {
  return NextResponse.json({ upserted: 0 });
}

export async function GET() { return POST(); }
