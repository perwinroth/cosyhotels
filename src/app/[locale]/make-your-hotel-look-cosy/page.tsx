// Hotelier lead-magnet + outreach hook: "How to make your hotel look cosy online", backed by the
// vision-QA reject data (what we discard) + real anonymised before/after examples. Links to the
// for-hotels claim flow. Example images are self-hosted in /public/guide-examples (don'ts
// anonymised — the lesson is the image TYPE, never a named hotel).
import type { Metadata } from "next";
import { site } from "@/config/site";
import { jsonLd } from "@/lib/schema";

export const revalidate = 86400;

const TITLE = "How to make your hotel look cosy online — what 17,000 hotels taught us";
const DESC = "We analysed photos from 17,000+ hotels. Here's exactly which images make a hotel look cosy — and which quietly make it look cold — with real before/after examples. A practical guide for hoteliers.";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const url = `/${params.locale}/make-your-hotel-look-cosy`;
  return { title: TITLE, description: DESC, alternates: { canonical: url }, openGraph: { title: TITLE, description: DESC, type: "article", url }, twitter: { card: "summary_large_image", title: TITLE, description: DESC } };
}

// Real reject categories, with the counts from our vision-QA pass (aesthetic rejects only).
const DONT = [
  { src: "dont-logo.png", label: "A logo or wordmark", count: 1057, why: "Our single most-rejected non-photo. A logo tells a guest nothing about how it feels to stay the night." },
  { src: "dont-landmark2.png", label: "A landmark that isn't your building", count: 737, why: "The famous view down the road is not your hotel. People want to see where they'll actually sleep." },
  { src: "dont-text.png", label: "A text or offer graphic", count: 422, why: "“A family of holiday accommodations” reads as an advert, not an invitation. Let a real room talk." },
  { src: "dont-person.jpg", label: "A stock photo of a person", count: 338, why: "A model at a spa could belong to any business on earth. A guest is picturing the space, not a stranger." },
  { src: "dont-detail.jpg", label: "A dark detail crop", count: 295, why: "A business card, a sleeve, a doorknob. Atmospheric maybe — but it shows nothing a traveller can book." },
  { src: "dont-badge.png", label: "An award badge", count: 172, why: "A Travellers' Choice sticker is a trust mark, not a photo. It belongs in the footer, never the first frame." },
];

const DO = [
  { src: "do-room.png", label: "A warm, characterful room", why: "A wrought-iron bed, warm wood, patterned tiles, soft lamplight. The exact thing people are booking." },
  { src: "do-interior2.jpeg", label: "A snug interior with character", why: "A reading nook, a lit lamp, a wall of books. One glance and you can feel what an evening here is like." },
  { src: "do-interior.jpg", label: "A warm, intimate lobby", why: "Golden light, a velvet sofa, an antique mirror. Even a reception reads as cosy when it glows, not gleams." },
  { src: "do-exterior.jpg", label: "Your building, full of character", why: "A timbered facade, lit windows, a glow on a winter night — the kind of character a guest travels for." },
];

const BASE = "/guide-examples/";

function ExampleCard({ src, label, why, kind, count }: { src: string; label: string; why: string; kind: "do" | "dont"; count?: number }) {
  const good = kind === "do";
  return (
    <figure className="not-prose m-0 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <div className="relative" style={{ aspectRatio: "4 / 3", background: "var(--surface-2)" }}>
        {/* self-hosted, vetted examples — plain img is fine and never breaks */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE}${src}`} alt={`${good ? "Cosy" : "Not cosy"}: ${label}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white shadow" style={{ background: good ? "var(--sage)" : "var(--clay)" }} aria-hidden>{good ? "✓" : "✕"}</span>
        {!good && count != null && (
          <span className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>{count.toLocaleString()} rejected</span>
        )}
      </div>
      <figcaption className="p-4">
        <div className="font-medium" style={{ color: "var(--foreground)" }}>{label}</div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{why}</p>
      </figcaption>
    </figure>
  );
}

export default function HotelGuidePage({ params }: { params: { locale: string } }) {
  const L = params.locale;
  const articleLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: TITLE, description: DESC,
    author: { "@type": "Organization", name: "Got Cosy" },
    publisher: { "@type": "Organization", name: "Got Cosy", logo: { "@type": "ImageObject", url: `${site.url}/icon` } },
    datePublished: "2026-06-29", dateModified: "2026-06-30",
    mainEntityOfPage: `${site.url}/${L}/make-your-hotel-look-cosy`,
  };
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />
      <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>For hoteliers</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">Your hotel&apos;s first photo is quietly costing you bookings</h1>
      <p className="mt-5 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>
        A traveller — or an AI travel assistant — decides whether your hotel looks cosy in about half a second, from a single photo. We analysed images from <strong style={{ color: "var(--foreground)" }}>17,000+ hotels</strong> and rejected <strong style={{ color: "var(--foreground)" }}>21,951</strong> of them as &ldquo;not cosy&rdquo; or &ldquo;not even the hotel.&rdquo; The ones that come across cold almost always make the same handful of mistakes. They&apos;re free to fix. Most hotels never do.
      </p>

      {/* The split-second test — one real reject vs one real cosy shot, side by side */}
      <h2 className="mt-12 font-display text-2xl font-semibold">The half-second test</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Both of these come from real hotel listings. Glance once — which one would you book?</p>
      <div className="not-prose mt-4 grid grid-cols-2 gap-3">
        <ExampleCard src="dont-landmark.jpeg" label="What many hotels lead with" why="A beautiful city — but you can't book a bridge. A guest learns nothing about the room." kind="dont" />
        <ExampleCard src="do-interior2.jpeg" label="What they could lead with" why="The actual lounge. Warmth, books, a lamp — you already know how a night here feels." kind="do" />
      </div>
      <p className="not-prose my-8 font-display text-2xl sm:text-3xl font-medium leading-snug" style={{ color: "var(--ember)" }}>Same half-second. One is a hotel you can picture sleeping in. The other is a postcard.</p>

      <div className="longform mt-2">
        <p>Cosiness is warmth you can <em>see</em>: light, texture, intimacy, character. Our AI scores it on every hotel&apos;s real photos — and before a single image counts, it has to pass a test for whether it even shows the hotel, warmly. Most don&apos;t. Here&apos;s what we throw out, in order of how often we see it, straight from the data.</p>
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Stop leading with these</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>The six image types we reject most. Real examples — anonymised, because the lesson is the <em>type</em> of photo, not the hotel.</p>
      <div className="not-prose mt-5 grid gap-4 sm:grid-cols-2">
        {DONT.map((x) => <ExampleCard key={x.src} {...x} kind="dont" />)}
      </div>

      <h2 className="mt-12 font-display text-2xl font-semibold">Lead with these instead</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>The images that consistently read as cosy — warm, intimate, characterful. Every one is a real hotel that scores well with us.</p>
      <div className="not-prose mt-5 grid gap-4 sm:grid-cols-2">
        {DO.map((x) => <ExampleCard key={x.src} {...x} kind="do" />)}
      </div>

      <div className="longform mt-12">
        <h2>One rule above all</h2>
        <p>If a photo could belong to any hotel in any city — a logo, a lobby that gleams, a landmark, a stock smile — it isn&apos;t selling yours. The warmest, most <em>specific</em> image you have should always come first: the room, the fire, the nook, the glow. That single frame is your whole pitch. Make it the one a tired traveller wants to fall into.</p>
      </div>

      <div className="mt-10 rounded-2xl border p-6 text-center" style={{ borderColor: "color-mix(in srgb, var(--ember) 35%, transparent)", background: "color-mix(in srgb, var(--ember) 6%, var(--card))" }}>
        <p className="font-display text-xl font-semibold">Want to know how cosy your hotel looks?</p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Get your hotel&apos;s Cosy Score — and see exactly which of your photos work, and which we&apos;d reject.</p>
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          <a href={`/${L}/for-hotels`} className="rounded-xl px-5 py-2.5 font-medium no-underline text-sm" style={{ background: "var(--ember)", color: "#16201C" }}>Get your Cosy Score →</a>
          <a href={`/${L}/what-makes-a-hotel-cosy`} className="rounded-xl px-5 py-2.5 font-medium no-underline text-sm" style={{ border: "1px solid var(--line)", color: "var(--foreground)" }}>The full data study</a>
        </div>
      </div>
    </article>
  );
}
