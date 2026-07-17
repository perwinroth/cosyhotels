import Link from "next/link";
import { site } from "@/config/site";
import { messages } from "@/i18n/messages";
import { translate } from "@/lib/i18n/translate";

export default async function Footer({ locale = "en" }: { locale?: string }) {
  const m = messages[locale as keyof typeof messages] ?? messages.en;
  // The five m.footer.* strings above already have hand-curated translations in
  // i18n/messages/*.json; everything else in this footer was still hardcoded English, so it's
  // wired here with the standard translate() short-circuit pattern (same as SiteHeader).
  const isEn = locale === "en";
  const S = {
    footerAria: "Footer",
    tagline: "The web's cosiest hotels, scored by AI for warmth, character and intimacy, so you book a place with soul, not just stars.",
    colExplore: "Explore",
    linkBrowse: "Browse by theme & country",
    linkCityGuides: "City guides",
    linkJournal: "The journal",
    linkCosyIndex: "The Cosy Index",
    linkPressKit: "Press kit",
    linkTowns: "Cosiest hotel towns (data)",
    linkWhatMakes: "What makes a hotel cosy",
    colForHotels: "For hotels",
    linkGetScore: "Get your cosy score",
    linkMakeCosy: "Make your hotel look cosy",
    colCompany: "Company",
    bottomNote: "Bookings via partner sites; we may earn a commission.",
  };
  let L = S;
  if (!isEn) {
    const keys = Object.keys(S) as (keyof typeof S)[];
    const vals = await Promise.all(keys.map((k) => translate(S[k], locale)));
    L = Object.fromEntries(keys.map((k, i) => [k, vals[i]])) as typeof S;
  }
  return (
    <footer className="border-t mt-16" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-7">
        <nav aria-label={L.footerAria} className="grid md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
          <div>
            <Link href={`/${locale}`} className="flex items-center gap-2.5 no-underline">
              <span aria-hidden className="flex items-center justify-center rounded-[11px] font-display font-bold" style={{ width: 34, height: 34, background: "linear-gradient(135deg, var(--ember), var(--gold))", color: "#16201C", fontSize: 16 }}>c</span>
              <span className="font-display text-lg font-semibold">{site.name}</span>
            </Link>
            <p className="mt-3.5 text-sm max-w-xs" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              {L.tagline}
            </p>
          </div>
          <FooterCol title={L.colExplore}>
            <FLink href={`/${locale}/cosy-hotels`}>{L.linkBrowse}</FLink>
            <FLink href={`/${locale}/guides`}>{L.linkCityGuides}</FLink>
            <FLink href={`/${locale}/blog`}>{L.linkJournal}</FLink>
            <FLink href={`/${locale}/cosy-index`}>{L.linkCosyIndex}</FLink>
            <FLink href={`/${locale}/press`}>{L.linkPressKit}</FLink>
            <FLink href={`/${locale}/data/cosiest-hotel-towns`}>{L.linkTowns}</FLink>
            <FLink href={`/${locale}/what-makes-a-hotel-cosy`}>{L.linkWhatMakes}</FLink>
            <FLink href={`/${locale}/cosy-score`}>{m.footer?.cosy_score || "How we score"}</FLink>
          </FooterCol>
          <FooterCol title={L.colForHotels}>
            <FLink href={`/${locale}/for-hotels`}>{L.linkGetScore}</FLink>
            <FLink href={`/${locale}/make-your-hotel-look-cosy`}>{L.linkMakeCosy}</FLink>
          </FooterCol>
          <FooterCol title={L.colCompany}>
            <FLink href={`/${locale}/about`}>{m.footer?.about || "About"}</FLink>
            <FLink href={`/${locale}/contact`}>{m.footer?.contact || "Contact"}</FLink>
            <FLink href={`/${locale}/privacy`}>{m.footer?.privacy || "Privacy"}</FLink>
            <FLink href={`/${locale}/disclosure`}>{m.footer?.disclosure || "Affiliate disclosure"}</FLink>
          </FooterCol>
        </nav>
        <div className="mt-11 pt-5 flex flex-col sm:flex-row justify-between gap-2 text-[13px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
          <div>© {new Date().getFullYear()} {site.name}</div>
          <div>{L.bottomNote}</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold mb-3.5" style={{ letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--muted)" }}>{title}</h4>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function FLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm no-underline hover:underline" style={{ color: "var(--foreground)", opacity: 0.85 }}>{children}</Link>;
}
