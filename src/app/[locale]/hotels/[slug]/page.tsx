// Curated hotels removed; rely on Google Places or Supabase
import { notFound } from "next/navigation";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { getDetails, photoUrl } from "@/lib/places";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import { adhocCosyScore } from "@/lib/scoring/cosy";

type Props = { params: { slug: string; locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/hotels/${params.slug}`]));
  // No curated hotel metadata path
  const d = await getDetails(params.slug);
  if (d) {
    const title = `${d.name} | ${site.name}`;
    const description = d.formatted_address || "Cosy boutique stay.";
    const url = `/${params.locale}/hotels/${params.slug}`;
    const ref = d.photos?.[0]?.photo_reference;
    const ogImg = ref ? photoUrl(ref, 1200) : "/logo-seal.svg";
    return { title, description, alternates: { canonical: url, languages }, openGraph: { title, description, type: "article", url, images: [{ url: ogImg, width: 1200, height: 800 }] }, twitter: { card: "summary_large_image", title, description, images: [ogImg] } };
  }
  return {};
}

export default async function HotelDetail({ params }: Props) {
  const d = await getDetails(params.slug);
  if (!d) return notFound();
  const ref = d.photos?.[0]?.photo_reference;
  const img = ref ? photoUrl(ref, 1200) : "/logo-seal.svg";
  const cosy = adhocCosyScore({ rating: d.rating, name: d.name, summary: d.formatted_address });
  const addrParts = (d.formatted_address || "").split(',').map(s => s.trim()).filter(Boolean);
  const city = addrParts[addrParts.length - 2] || "";
  const country = addrParts[addrParts.length - 1] || "";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-zinc-200">
        <Image src={img} alt={`${d.name}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, 720px" />
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{d.name}</h1>
      <div className="mt-1 text-zinc-600">{[city, country].filter(Boolean).join(', ')}</div>
      <div className="mt-4 border border-zinc-200 rounded-lg p-4 bg-white" aria-label={`Cosy score ${cosy.toFixed(1)} out of 10`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-600">Cosy score</div>
            <div className="text-2xl font-semibold">{cosy.toFixed(1)}<span className="text-base text-zinc-500">/10</span></div>
          </div>
          <span />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <a
          className="inline-flex items-center justify-center rounded-lg bg-white text-black border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
          href={`/go/${params.slug}`}
          target="_blank"
          rel="noopener nofollow sponsored"
        >
          Visit website →
        </a>
        <a className="inline-flex items-center justify-center rounded-lg bg-[#0EA5A4] text-white !text-white no-underline px-4 py-2 hover:bg-[#0B807F]" href={`/${params.locale}/hotels`}>
          Back to results
        </a>
      </div>
    </div>
  );
}
