import { NextResponse } from "next/server";
import { searchText } from "@/lib/places";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") || "";
  const pagetoken = url.searchParams.get("pagetoken") || undefined;
  const data = await searchText(query, pagetoken);
  return NextResponse.json(data);
}

