import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { collections } from "@/data/collections";
import { messages as i18n } from "@/i18n/messages";
import { locales } from "@/i18n/locales";
import { getServerSupabase } from "@/lib/supabase/server";
import { getImageForHotel } from "@/lib/hotelImages";
import { placeholderUrl } from "@/lib/image";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `/${l}/collections`]),
    ["x-default", "/en/collections"],
  ]);
  return {
    alternates: { canonical: `/${params.locale}/collections`, languages },
    title: i18n[params.locale as keyof typeof i18n]?.collections?.title || 'Collections',
    description: i18n[params.locale as keyof typeof i18n]?.collections?.intro || 'Curated themes to explore cosy boutique stays.',
  };
}

export default async function CollectionsIndex({ params }: { params: { locale: string } }) {
  const supabase = getServerSupabase();
  // Fetch a thumbnail and count for each collection to make the page useful
  async function fetchPreview(slug: string): Promise<{ count: number; img: string | null; name: string | null }> {
    if (!supabase) return { count: 0, img: null, name: null };
    let query = supabase
      .from('hotels')
      .select('id,slug,name,city,country,amenities', { count: 'exact' });
    switch (slug) {
      case 'city-rooftops': {
        type OverlapsCapable<T> = T & { overlaps: (column: string, value: unknown[]) => T };
        const q = query as unknown as OverlapsCapable<typeof query>;
        query = q.overlaps('amenities', ['Rooftop']);
        break;
      }
      case 'spa-retreats': {
        type OverlapsCapable<T> = T & { overlaps: (column: string, value: unknown[]) => T };
        const q = query as unknown as OverlapsCapable<typeof query>;
        query = q.overlaps('amenities', ['Spa','Sauna']);
        break;
      }
      case 'pet-friendly': {
        type OverlapsCapable<T> = T & { overlaps: (column: string, value: unknown[]) => T };
        const q = query as unknown as OverlapsCapable<typeof query>;
        query = q.overlaps('amenities', ['Pet-friendly']);
        break;
      }
      case 'romantic-paris':
        query = query.ilike('city', '%Paris%');
        break;
    }
    const res = await query.limit(1);
    const data = res.data;
    let count = res.count ?? 0;
    const error: unknown = res.error;
    let img: string | null = null;
    let first = (data || [])[0] as { id?: string; name?: string; slug?: string; city?: string | null } | undefined;
    if (first && first.id) {
      const { data: imgRow } = await supabase
        .from('hotel_images')
        .select('url')
        .eq('hotel_id', first.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      img = (imgRow?.url as string | undefined) || null;
    }
    // For spa-retreats, if no rows via overlaps, try contains Spa/Sauna to improve preview reliability
    if ((error || !data || data.length === 0 || !count) && slug === 'spa-retreats') {
      const spaQ = supabase.from('hotels').select('id,slug,name,city,country,amenities', { count: 'exact' }).contains('amenities', ['Spa']).limit(1);
      const sauQ = supabase.from('hotels').select('id,slug,name,city,country,amenities', { count: 'exact' }).contains('amenities', ['Sauna']).limit(1);
      const [a, b] = await Promise.all([spaQ, sauQ]);
      const d1 = (a.data || []) as Array<{ id?: string; name?: string; slug?: string; city?: string | null }>;
      const d2 = (b.data || []) as Array<{ id?: string; name?: string; slug?: string; city?: string | null }>;
      count = d1.length + d2.length;
      first = d1[0] || d2[0] || undefined;
      // ignore error here; union queries handled above
    }

    // If we have no cached image but there is a first row, resolve one via helper and persist
    if (!img && first && first.id) {
      try {
        const resolved = await getImageForHotel(String(first.name || ''), String(first.city || ''), String(first.slug || ''), String(first.id));
        if (resolved) {
          img = resolved;
          await supabase.from('hotel_images').insert({ hotel_id: first.id, url: resolved });
        }
      } catch {}
    }
    return { count: count || 0, img, name: (first?.name as string | undefined) || null };
  }

  const previews = await Promise.all(collections.map(async (c) => ({ slug: c.slug, title: c.title, description: c.description, ...(await fetchPreview(c.slug)) })));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{i18n[params.locale as keyof typeof i18n]?.collections?.title || 'Collections'}</h1>
      <p className="mt-2 text-zinc-600">{i18n[params.locale as keyof typeof i18n]?.collections?.intro || 'Curated hotel themes for inspiration and planning.'}</p>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {previews.map((c) => (
          <Link key={c.slug} href={`/${params.locale}/collections/${c.slug}`} className="block rounded-xl border border-zinc-200 overflow-hidden hover:shadow-sm bg-white">
            <div className="relative aspect-[16/9] bg-zinc-100">
              <Image
                src={c.img || placeholderUrl}
                alt={c.name ? `${c.name}` : c.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
                quality={70}
                unoptimized={Boolean(c.img && /^https?:\/\//.test(c.img))}
              />
              <div className="absolute right-2 bottom-2 text-xs rounded px-2 py-0.5 bg-white/90 border border-zinc-200">{c.count} {i18n[params.locale as keyof typeof i18n]?.collections?.hotels || 'hotels'}</div>
            </div>
            <div className="p-4">
              <h2 className="font-medium">{c.title}</h2>
              <p className="text-sm text-zinc-600 mt-1">{c.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
