// Hotelier lead-magnet + outreach hook: "How to make your hotel look cosy online", backed by the
// vision-QA reject data (what we discard) + the cosy signals. Links to the for-hotels claim flow.
import type { Metadata } from "next";
import { site } from "@/config/site";
import { jsonLd } from "@/lib/schema";

export const revalidate = 86400;

const TITLE = "How to make your hotel look cosy online — what 17,000 hotels taught us";
const DESC = "We analysed photos from 17,000+ hotels. Here's exactly which images make a hotel look cosy — and which quietly make it look cold. A practical guide for hoteliers.";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const url = `/${params.locale}/make-your-hotel-look-cosy`;
  return { title: TITLE, description: DESC, alternates: { canonical: url }, openGraph: { title: TITLE, description: DESC, type: "article", url }, twitter: { card: "summary_large_image", title: TITLE, description: DESC } };
}

const DONT = [
  { t: "Your logo or a branded banner", d: "The single most common non-photo we throw out. A logo tells a guest nothing about how it feels to stay." },
  { t: "A landmark that isn't your building", d: "The cathedral down the road is not your hotel. Guests want to see where they'll actually sleep." },
  { t: "Marketing collages with text overlays", d: "\"Book direct & save 15%\" graphics read as ads, not invitations. Let the room do the talking." },
  { t: "Photos with people in them", d: "Portraits and staff selfies pull focus from the space. A guest is imagining themselves there." },
  { t: "Empty function rooms", d: "Conference rooms, banquet halls and big bright lobbies are the opposite of cosy — cold, corporate, impersonal." },
  { t: "Bathrooms, corridors, car parks", d: "Necessary, never the hero. They make a listing feel utilitarian instead of warm." },
  { t: "Tight detail crops & 'image coming soon'", d: "A single pillow or a placeholder box doesn't sell a stay. Show the whole, inviting space." },
];

const DO = [
  { t: "A warm, inviting guest room", d: "Soft lighting, textiles, a welcoming bed shown as a room — the thing people are actually booking." },
  { t: "A snug, characterful interior", d: "A lounge with a fireplace, a candle-lit bar or restaurant, a library nook, a spa in warm tones." },
  { t: "Your building with real character", d: "A charming facade, a garden, a terrace or courtyard — especially with a warm evening glow." },
  { t: "Natural light and natural materials", d: "Wood, stone, linen, plants. Warmth reads instantly; cold, grey, glassy spaces don't." },
  { t: "Lead with your single cosiest photo", d: "The first image is the whole pitch. Make it the warmest, most intimate shot you have." },
];

export default function HotelGuidePage({ params }: { params: { locale: string } }) {
  const L = params.locale;
  const articleLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: TITLE, description: DESC,
    author: { "@type": "Organization", name: "Got Cosy" },
    publisher: { "@type": "Organization", name: "Got Cosy", logo: { "@type": "ImageObject", url: `${site.url}/icon` } },
    datePublished: "2026-06-29", dateModified: "2026-06-29",
    mainEntityOfPage: `${site.url}/${L}/make-your-hotel-look-cosy`,
  };
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />
      <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>For hoteliers</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">Your hotel&apos;s first photo is quietly costing you bookings</h1>
      <p className="mt-5 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>
        A traveller — or an AI travel assistant — decides whether your hotel looks cosy in about half a second, from a single photo. We analysed images from <strong style={{ color: "var(--foreground)" }}>17,000+ hotels</strong>, and the listings that come across cold almost always make the same handful of mistakes. They&apos;re free to fix. Most hotels never do.
      </p>

      <div className="longform mt-10">
        <p>Here&apos;s exactly which photos work, which quietly sabotage you, and the one rule that decides it — straight from the data.</p>
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Stop leading with these</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>The images we most often reject as &ldquo;not the hotel&rdquo; or &ldquo;not cosy&rdquo; — in order of how common they are.</p>
      <ul className="mt-4 space-y-2.5">
        {DONT.map((x) => (
          <li key={x.t} className="rounded-xl border p-4 flex gap-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <span className="flex-none mt-0.5" style={{ color: "var(--clay)" }} aria-hidden>✕</span>
            <div><div className="font-medium" style={{ color: "var(--foreground)" }}>{x.t}</div><div className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{x.d}</div></div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-2xl font-semibold">Lead with these instead</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>The images that consistently read as cosy — warm, intimate, characterful.</p>
      <ul className="mt-4 space-y-2.5">
        {DO.map((x) => (
          <li key={x.t} className="rounded-xl border p-4 flex gap-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <span className="flex-none mt-0.5" style={{ color: "var(--sage)" }} aria-hidden>✓</span>
            <div><div className="font-medium" style={{ color: "var(--foreground)" }}>{x.t}</div><div className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{x.d}</div></div>
          </li>
        ))}
      </ul>

      <div className="longform mt-10">
        <h2>One rule above all</h2>
        <p>Cosiness is warmth you can see: light, texture, intimacy, character. If a photo looks like it could belong to any hotel in any city, it&apos;s not selling yours. The warmest, most specific image you have should always come first.</p>
      </div>

      <div className="mt-10 rounded-2xl border p-6 text-center" style={{ borderColor: "color-mix(in srgb, var(--ember) 35%, transparent)", background: "color-mix(in srgb, var(--ember) 6%, var(--card))" }}>
        <p className="font-display text-xl font-semibold">Want to know how cosy your hotel looks?</p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Get your hotel&apos;s Cosy Score — and see exactly which of your photos work.</p>
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          <a href={`/${L}/for-hotels`} className="rounded-xl px-5 py-2.5 font-medium no-underline text-sm" style={{ background: "var(--ember)", color: "#16201C" }}>Get your Cosy Score →</a>
          <a href={`/${L}/what-makes-a-hotel-cosy`} className="rounded-xl px-5 py-2.5 font-medium no-underline text-sm" style={{ border: "1px solid var(--line)", color: "var(--foreground)" }}>The full data study</a>
        </div>
      </div>
    </article>
  );
}
