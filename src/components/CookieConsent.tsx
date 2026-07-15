"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/consent";
import { locales } from "@/i18n/locales";

type Labels = { message: string; accept: string; reject: string; privacy: string };

export default function CookieConsent({ labels }: { labels: Labels }) {
  // Server render is always null (no cookie visible yet) to avoid a hydration mismatch; reveal
  // after mount once we know whether a choice was already made.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    setVisible(getConsent() === null);
  }, []);

  if (!mounted || !visible) return null;

  const seg = pathname?.split("/")[1] || "";
  const locale = (locales as readonly string[]).includes(seg) ? seg : "en";

  function choose(v: "accepted" | "rejected") {
    setConsent(v);
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[1100] border-t bg-card"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="mx-auto max-w-4xl px-4 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <p className="text-sm text-foreground flex-1 text-center sm:text-left">
          {labels.message}{" "}
          <Link href={`/${locale}/privacy`} className="underline underline-offset-2">
            {labels.privacy}
          </Link>
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded-lg px-5 py-2.5 font-medium border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-[1px]"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
          >
            {labels.reject}
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-lg px-5 py-2.5 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-[1px]"
            style={{ background: "var(--ember)" }}
          >
            {labels.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
