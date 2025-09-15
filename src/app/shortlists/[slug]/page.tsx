import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { cosyBadgeClass } from "@/lib/scoring/cosy";
import { getServerSupabase } from "@/lib/supabase/server";
import ShareButton from "@/components/ShareButton";
import ShortlistLocalFallback from "@/components/ShortlistLocalFallback";
import EditShortlistMeta from "@/components/EditShortlistMeta";

async function getShortlist(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/shortlists/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function ShortlistPage({ params }: { params: { slug: string } }) {
  const sl = await getShortlist(params.slug);
  const items: string[] = sl?.items || [];
  const supabase = getServerSupabase();
  let withCosy: Array<{ slug: string; name: string; city: string; country: string; price?: number; rating: number; image?: string; _cosy: number }>=[];
  if (supabase && items.length) {
    const { data: rows } = await supabase
      .from("hotels")
      .select("id,slug,name,city,country,rating,price")
      .in("slug", items);
    type HotelRow = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null };
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
    withCosy = typedRows.map((h) => ({
      slug: String(h.slug),
      name: String(h.name),
      city: String(h.city || ''),
      country: String(h.country || ''),
      price: typeof h.price === 'number' ? h.price : undefined,
      rating: typeof h.rating === 'number' ? h.rating : 0,
      _cosy: scoreMap.get(String(h.id)) || 0,
    }));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Shortlist: {sl?.title || params.slug}</h1>
        <div className="flex gap-2 items-center">
          <ShareButton className="text-sm px-3 py-1.5 rounded border brand-border hover:bg-zinc-50" />
          <EditShortlistMeta slug={params.slug} title={sl?.title} />
        </div>
      </div>
      {!sl && (
        <>
          <div className="mt-4 text-sm text-zinc-600">Shortlist not found on server. Checking your device…</div>
          <ShortlistLocalFallback slug={params.slug} hotels={[]} />
        </>
      )}
      <div className="mt-6 grid md:grid-cols-3 gap-4 auto-rows-fr">
        {withCosy.map((h) => (
          <Link key={h.slug} href={`/en/hotels/${h.slug}`} className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full">
            <div className="relative aspect-[4/3] bg-zinc-100">
              <Image src={h.image || "/logo-seal.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
              {h._cosy >= 7 ? (
                <div className="absolute left-2 bottom-2">
                  <div className="flex items-center gap-1 bg-[#0EA5A4] text-white text-xs px-3 py-1 rounded-full shadow">
                    <Image src="/seal.svg" alt="seal" width={14} height={14} />
                    <span>Seal of approval</span>
                  </div>
                </div>
              ) : null}
              <div className="absolute right-2 top-2 flex gap-2">
                <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`}>Cosy {h._cosy.toFixed(1)}</span>
              </div>
              
            </div>
            <div className="p-3 flex flex-col h-[188px]">
              <div>
                <h3 className="font-medium line-clamp-1">{h.name}</h3>
                <div className="text-sm text-black">{h.city}, {h.country}</div>
                <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>
              </div>
              <div className="mt-auto pt-4 flex justify-end"></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// client-only fallback moved to component

// Client-only edit controls moved to component
