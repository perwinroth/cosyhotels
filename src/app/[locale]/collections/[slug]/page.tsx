import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCollection } from "@/data/collections";
import { cosyBadgeClass } from "@/lib/scoring/cosy";
import { getServerSupabase } from "@/lib/supabase/server";
import { locales } from "@/i18n/locales";

type Props = { params: { slug: string; locale: string } };

export function generateMetadata({ params }: Props): Metadata {
  const c = getCollection(params.slug);
  if (!c) return {};
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/collections/${c.slug}`]));
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: `/${params.locale}/collections/${c.slug}`, languages },
    openGraph: {
      title: c.title,
      description: c.description,
      type: "website",
      images: [{ url: "/logo-seal.svg", width: 1200, height: 800 }],
    },
  };
}

// Using explicit row types from Supabase queries

export default async function CollectionPage({ params }: Props) {
  const c = getCollection(params.slug);
  if (!c) return <div className="mx-auto max-w-6xl px-4 py-8">Collection not found.</div>;
  const supabase = getServerSupabase();
  if (!supabase) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  let query = supabase
    .from("hotels")
    .select("id,slug,name,city,country,rating,price,amenities");
  switch (c.slug) {
    case "city-rooftops":
      query = query.contains("amenities", ["Rooftop"]);
      break;
    case "spa-retreats":
      query = query.or("amenities.cs.{Spa},amenities.cs.{Sauna}");
      break;
    case "pet-friendly":
      query = query.contains("amenities", ["Pet-friendly"]);
      break;
    case "romantic-paris":
      query = query.ilike("city", "%Paris%");
      break;
  }
  const { data: rows, error } = await query.limit(60);
  if (error) return <div className="mx-auto max-w-6xl px-4 py-8">Error loading collection.</div>;
  type HotelRow = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null; amenities?: string[] | null };
  type ScoreRow = { hotel_id: string; score: number | null };
  const typedRows = (rows || []) as unknown as HotelRow[];
  const ids = typedRows.map((r) => r.id);
  let scoreMap = new Map<string, number>();
  if (ids.length) {
    const { data: scores } = await supabase
      .from("cosy_scores")
      .select("hotel_id,score")
      .in("hotel_id", ids);
    const typedScores = (scores || []) as unknown as ScoreRow[];
    scoreMap = new Map(typedScores.map((s) => [String(s.hotel_id), Number(s.score || 0)]));
  }
  // Prefetch images for these hotels
  const imgMap = new Map<string, string>();
  if (ids.length) {
    const { data: imgs } = await supabase
      .from('hotel_images')
      .select('hotel_id,url,created_at')
      .in('hotel_id', ids)
      .order('created_at', { ascending: false });
    for (const row of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = row.hotel_id ? String(row.hotel_id) : '';
      const url = row.url ? String(row.url) : '';
      if (!hid || !url) continue;
      if (!imgMap.has(hid)) imgMap.set(hid, url);
    }
  }
  const results = typedRows.map((h) => ({
    _id: String(h.id), slug: String(h.slug), name: String(h.name), city: String(h.city || ''), country: String(h.country || ''), rating: typeof h.rating === 'number' ? h.rating : 0, price: typeof h.price === 'number' ? h.price : undefined, _cosy: scoreMap.get(String(h.id)) || 0, _img: imgMap.get(String(h.id)) || '/logo-seal.svg',
  }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{c.title}</h1>
      <p className="mt-2 text-black max-w-2xl">{c.description}</p>
      {results.length === 0 ? (
        <div className="mt-6 rounded-xl border brand-border p-4 bg-white">
          <div className="font-medium">We’re curating this collection.</div>
          <p className="text-sm text-black mt-1">No hotels match yet. Explore all hotels or check back soon.</p>
          <div className="mt-3"><Link className="underline" href={`/${params.locale}/hotels`}>Browse all hotels</Link></div>
        </div>
      ) : (
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {results.map((h) => (
            <Link key={h.slug} href={`/${params.locale}/hotels/${h.slug}`} className="block rounded-2xl border brand-border overflow-hidden hover:shadow-md bg-white">
              <div className="relative aspect-[4/3] bg-zinc-100">
                <Image src={h._img} alt={`${h.name} – ${h.city}`} fill className="object-cover" />
                {h._cosy >= 7 ? (
                  <div className="absolute left-2 bottom-2">
                    <div className="flex items-center gap-1 bg-[#0EA5A4] text-white text-xs px-3 py-1 rounded-full shadow">
                      <span>Seal of approval</span>
                    </div>
                  </div>
                ) : null}
                <div className="absolute right-2 top-2"><span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`}>Cosy {h._cosy.toFixed(1)}</span></div>
              </div>
              <div className="p-3">
                <h3 className="font-medium line-clamp-1">{h.name}</h3>
                <div className="text-sm text-zinc-600">{h.city}, {h.country}</div>
                <div className="mt-4" />
                <div className="mt-2 flex justify-end">
                  <button type="button" className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50">Save to shortlist</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
