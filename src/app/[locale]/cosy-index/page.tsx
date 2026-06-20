// The Cosy Index — flagship, citable, link-worthy page: the world's cosiest hotels, AI-ranked.
// A data asset for backlinks/PR + AEO/GEO (schema.org ItemList of Hotel+Review). Indexed.
import type { Metadata } from "next";
import Image from "next/image";
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, displayCountry, isLatin } from "@/lib/placeText";
import { cityToSlug } from "@/lib/citySlug";

export const revalidate = 3600;

const TITLE = "The Cosy Index — The World's Cosiest Hotels, AI-Ranked";
const DESC = "An AI-scored ranking of the world's cosiest hotels — rated 0–10 for warmth, character and intimacy, not stars. Updated continuously from real data.";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const url = `/${params.locale}/cosy-index`;
  return { title: TITLE, description: DESC, alternates: { canonical: url }, openGraph: { title: TITLE, description: DESC, type: "website", url }, twitter: { card: "summary_large_image", title: TITLE, description: DESC } };
}

type Row = { hotel_id: string; score: number | null; score_final: number | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; country: string | null } | null };

function cosyColor(s: number): string { return s >= 9 ? "#5c6b56" : s >= 8.5 ? "#6f8159" : "#7c8a5f"; }

export default async function CosyIndexPage({ params }: { params: { locale: string } }) {
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-5xl px-4 py-10">Server not configured.</div>;

  const { data } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, hotel:hotel_id!inner(slug, name, name_en, city, country)")
    .gte("score", 8)
    .order("score", { ascending: false })
    .limit(150);

  const rows = (data || []) as unknown as Row[];
  const seen = new Set<string>();
  const picked: Array<{ id: string; slug: string; name: string; city: string; country: string; score: number }> = [];
  for (const r of rows) {
    const h = r.hotel; if (!h || !r.hotel_id) continue;
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    seen.add(name);
    picked.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), country: displayCountry(h.country), score: Number((r.score_final ?? r.score) || 0) });
  }

  // Real vetted photos for the picks.
  const photo = new Map<string, string>();
  const ids = picked.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true);
    for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const u = im.url || "";
      if (hid && u && !u.includes("placehold.co") && !photo.has(hid)) photo.set(hid, u);
    }
  }
  const list = picked.filter((p) => photo.has(p.id)).slice(0, 50);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: TITLE, numberOfItems: list.length,
    itemListElement: list.map((p, i) => ({
      "@type": "ListItem", position: i + 1,
      item: {
        "@type": "Hotel", name: p.name, url: `${siteUrl}/${params.locale}/hotels/${p.slug}`, image: photo.get(p.id),
        ...(p.city || p.country ? { address: { "@type": "PostalAddress", ...(p.city ? { addressLocality: p.city } : {}), ...(p.country ? { addressCountry: p.country } : {}) } } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(p.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } },
      },
    })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-3xl font-semibold tracking-tight">The Cosy Index</h1>
      <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>The world&apos;s {list.length} cosiest hotels, AI-ranked for warmth, character and intimacy — not star ratings. Each is scored 0–10 from real data on property type and scale, amenities, the language guests use in reviews, and setting.</p>

      <ol className="mt-8 space-y-3">
        {list.map((p, i) => (
          <li key={p.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <div className="flex items-center gap-4">
              <span className="text-sm tabular-nums w-6 text-center" style={{ color: "var(--muted)" }}>{i + 1}</span>
              <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyColor(p.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 21, fontWeight: 600 }}>{p.score.toFixed(1)}</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold leading-tight"><a href={`/${params.locale}/hotels/${p.slug}`} className="hover:underline">{p.name}</a></h2>
                {(p.city || p.country) && <div className="text-sm" style={{ color: "var(--muted)" }}>{p.city && <a href={`/${params.locale}/guides/${cityToSlug(p.city)}`} className="hover:underline">{p.city}</a>}{p.city && p.country ? ", " : ""}{p.country}</div>}
              </div>
              {photo.get(p.id) && (
                <a href={`/${params.locale}/hotels/${p.slug}`} className="flex-shrink-0 hidden sm:block">
                  <div className="relative rounded-lg overflow-hidden" style={{ width: 110, height: 82 }}>
                    <Image src={photo.get(p.id)!} alt={p.name} fill className="object-cover" sizes="110px" quality={60} unoptimized={/^https?:\/\//.test(photo.get(p.id)!)} />
                  </div>
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">How the Cosy Index works</h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Every hotel is scored by AI on the signals that actually make a stay cosy — small room counts, fireplaces and soaking tubs, natural materials, intimate design, and reviews where guests feel genuinely welcomed rather than processed. Scores run 0–10; only hotels clearing 8.0 make the Index. Browse the full rankings by city in our <a href={`/${params.locale}`} className="underline">cosy hotel guides</a>.</p>
      </section>
    </div>
  );
}
