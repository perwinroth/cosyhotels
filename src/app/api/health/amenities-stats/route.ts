import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const client = getServerSupabase();
  if (client == null) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  async function countContains(val: string) {
    // TypeScript: client is non-null due to early return
    const { count } = await (client as NonNullable<typeof client>)
      .from('hotels')
      .select('id', { count: 'exact', head: true })
      .contains('amenities', [val]);
    return count || 0;
  }
  const [spa, sauna, rooftop, pet] = await Promise.all([
    countContains('Spa'),
    countContains('Sauna'),
    countContains('Rooftop'),
    countContains('Pet-friendly'),
  ]);
  return NextResponse.json({ amenities: { Spa: spa, Sauna: sauna, Rooftop: rooftop, 'Pet-friendly': pet } });
}
