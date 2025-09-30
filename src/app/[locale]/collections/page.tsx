import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { collections } from "@/data/collections";
import { locales } from "@/i18n/locales";
import { getServerSupabase } from "@/lib/supabase/server";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `/${l}/collections`]),
    ["x-default", "/en/collections"],
  ]);
  return {
    alternates: { canonical: `/${params.locale}/collections`, languages },
    title: "Collections",
    description: "Curated themes to explore cosy boutique stays.",
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
      case 'city-rooftops':
        query = query.contains('amenities', ['Rooftop']);
        break;
      case 'spa-retreats':
        query = query.or('amenities.cs.{Spa},amenities.cs.{Sauna}');
        break;
      case 'pet-friendly':
        query = query.contains('amenities', ['Pet-friendly']);
        break;
      case 'romantic-paris':
        query = query.ilike('city', '%Paris%');
        break;
    }
    const { data, count } = await query.limit(1);
    const first = (data || [])[0] as { id?: string; name?: string } | undefined;
    let img: string | null = null;
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
    return { count: count || 0, img, name: (first?.name as string | undefined) || null };
  }

  const previews = await Promise.all(collections.map(async (c) => ({ slug: c.slug, title: c.title, description: c.description, ...(await fetchPreview(c.slug)) })));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Collections</h1>
      <p className="mt-2 text-zinc-600">Curated hotel themes for inspiration and planning.</p>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {previews.map((c) => (
          <Link key={c.slug} href={`/${params.locale}/collections/${c.slug}`} className="block rounded-xl border border-zinc-200 overflow-hidden hover:shadow-sm bg-white">
            <div className="relative aspect-[16/9] bg-zinc-100">
              <Image
                src={c.img || '/logo-seal.svg'}
                alt={c.name ? `${c.name}` : c.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
                quality={70}
                unoptimized={Boolean(c.img && /^https?:\/\//.test(c.img))}
              />
              <div className="absolute right-2 bottom-2 text-xs rounded px-2 py-0.5 bg-white/90 border border-zinc-200">{c.count} hotels</div>
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
