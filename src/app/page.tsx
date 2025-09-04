import Link from "next/link";
import { FeaturedHotels, PopularDestinations, SearchBar } from "@/components/HomeSections";
import Filters from "@/components/Filters";
import { messages } from "@/i18n/messages";

export default function RootHome() {
  const locale = "en";
  const m = messages.en;
  return (
    <div>
      <section className="bg-zinc-50 border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">{m.brand.tagline}</h1>
          <p className="mt-3 text-zinc-600 max-w-2xl">{m.brand.description}</p>
          <div className="mt-6">
            <SearchBar locale={locale} />
          </div>
          <div className="mt-4 text-sm text-zinc-600">
            <Link href={`/${locale}/hotels`} className="underline">{m.home.browseAll}</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 grid md:grid-cols-[16rem_1fr] gap-6">
        <div>
          <h2 className="text-xl font-semibold">Refine your search</h2>
          <div className="mt-4">
            <Filters basePath={`/${locale}/hotels`} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Popular destinations</h2>
          <PopularDestinations className="mt-4" locale={locale} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="text-xl font-semibold">Featured stays</h2>
        <FeaturedHotels className="mt-4" locale={locale} />
      </section>
    </div>
  );
}
