import Link from "next/link";
import { Suspense } from "react";
import { FeaturedHotels, PopularDestinations, SearchBar } from "@/components/HomeSections";
import Image from "next/image";
import Link from "next/link";
import { shimmer } from "@/lib/image";
import { hotels as baseHotels } from "@/data/hotels";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import { cosyBadgeClass, cosyRankLabel, cosyScore } from "@/lib/scoring/cosy";
import SaveToShortlistButton from "@/components/SaveToShortlistButton";
import FiltersBar from "@/components/FiltersBar";
import { messages } from "@/i18n/messages";

export default function RootHome() {
  const locale = "en";
  const m = messages.en;
  return (
    <div>
      <section className="bg-zinc-50 border-b brand-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">{m.brand.tagline}</h1>
          <p className="mt-3 text-black max-w-2xl">{m.brand.description}</p>
          <div className="mt-6">
            <SearchBar locale={locale} />
          </div>
          <div className="mt-4 text-sm text-black">
            <Link href={`/${locale}/hotels`} className="underline">{m.home.browseAll}</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-xl font-semibold">Refine your search</h2>
        <div className="mt-3">
          <Suspense fallback={<div className="text-sm text-black/60">Loading filters…</div>}>
            <FiltersBar />
          </Suspense>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <h2 className="text-xl font-semibold">Top cosy stays worldwide</h2>
        <Suspense fallback={<div className="mt-4 text-sm text-black/60">Loading top stays…</div>}>
          {/* @ts-expect-error Async Server Component */}
          <TopCosy locale={locale} />
        </Suspense>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-xl font-semibold">Popular destinations</h2>
        <PopularDestinations className="mt-4" locale={locale} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="text-xl font-semibold">Featured stays</h2>
        <FeaturedHotels className="mt-4" locale={locale} />
      </section>
    </div>
  );
}

async function TopCosy({ locale }: { locale: string }) {
  const overrides = await fetchOverrides();
  const hotels = applyOverrides(baseHotels, overrides);
  const withCosy = hotels.map((h) => ({ ...h, _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }) }));
  withCosy.sort((a, b) => b._cosy - a._cosy);
  const top = withCosy.slice(0, 12);
  return (
    <div className="mt-4 grid md:grid-cols-3 gap-4 auto-rows-fr">
      {top.map((h) => (
        <Link
          key={h.slug}
          href={`/${locale}/hotels/${h.slug}`}
          className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full"
          aria-label={`${h.name}, cosy score ${h._cosy.toFixed(1)} out of 10`}
        >
          <div className="relative aspect-[4/3] bg-zinc-100">
            <Image src={h.image || "/seal.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
            {h._cosy >= 6.5 ? (
              <div className="absolute -left-3 top-4 rotate-[-15deg]">
                <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
                  <Image src="/seal.svg" alt="seal" width={14} height={14} />
                  <span>Seal of approval</span>
                </div>
              </div>
            ) : null}
            <div className="absolute left-2 top-2 flex gap-2">
              <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`}>
                Cosy {h._cosy.toFixed(1)} · {cosyRankLabel(h._cosy)}
              </span>
            </div>
            <div className="absolute right-2 top-2 text-xs rounded bg-black/70 text-white px-2 py-0.5">★ {h.rating.toFixed(1)}</div>
          </div>
          <div className="p-3 flex flex-col h-[188px]">
            <div>
              <h3 className="font-medium line-clamp-1">{h.name}</h3>
              <div className="text-sm text-black">{h.city}</div>
              <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>
            </div>
            <div className="mt-auto pt-4 flex justify-end">
              <SaveToShortlistButton itemSlug={h.slug} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
