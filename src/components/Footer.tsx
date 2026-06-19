import Link from "next/link";
import { site } from "@/config/site";
import { messages } from "@/i18n/messages";

export default function Footer({ locale = "en" }: { locale?: string }) {
  const m = messages[locale as keyof typeof messages] ?? messages.en;
  return (
    <footer className="border-t mt-16" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-7">
        <div className="grid md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
          <div>
            <Link href={`/${locale}`} className="flex items-center gap-2.5 no-underline">
              <span aria-hidden className="flex items-center justify-center rounded-[11px] font-display font-bold" style={{ width: 34, height: 34, background: "linear-gradient(135deg, var(--ember), var(--gold))", color: "#16201C", fontSize: 16 }}>c</span>
              <span className="font-display text-lg font-semibold">{site.name}</span>
            </Link>
            <p className="mt-3.5 text-sm max-w-xs" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              The web&apos;s cosiest hotels, scored by AI for warmth, character and intimacy — so you book a place with soul, not just stars.
            </p>
          </div>
          <FooterCol title="Explore">
            <FLink href={`/${locale}/guides`}>City guides</FLink>
            <FLink href={`/${locale}/cosy-score`}>{m.footer?.cosy_score || "How we score"}</FLink>
          </FooterCol>
          <FooterCol title="For hotels">
            <FLink href={`/${locale}/for-hotels`}>Get your cosy score</FLink>
          </FooterCol>
          <FooterCol title="Company">
            <FLink href={`/${locale}/about`}>{m.footer?.about || "About"}</FLink>
            <FLink href={`/${locale}/contact`}>{m.footer?.contact || "Contact"}</FLink>
            <FLink href={`/${locale}/privacy`}>{m.footer?.privacy || "Privacy"}</FLink>
            <FLink href={`/${locale}/disclosure`}>{m.footer?.disclosure || "Affiliate disclosure"}</FLink>
          </FooterCol>
        </div>
        <div className="mt-11 pt-5 flex flex-col sm:flex-row justify-between gap-2 text-[13px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
          <div>© {new Date().getFullYear()} {site.name}</div>
          <div>Bookings via partner sites — we may earn a commission.</div>
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
