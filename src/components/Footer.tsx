import Link from "next/link";
import { site } from "@/config/site";

export default function Footer({ locale = "en" }: { locale?: string }) {
  return (
    <footer className="border-t brand-border">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row md:items-start md:justify-between gap-6 text-sm text-black">
        <div className="flex-1">
          <div>
            <strong className="text-black">{site.name}</strong> · {site.description}
          </div>
          <nav aria-label="Footer" className="mt-3">
            <div className="flex flex-col space-y-1">
              <Link href={`/${locale}/cosy-score`} className="hover:underline">Cosy score</Link>
              <Link href={`/${locale}/disclosure`} className="hover:underline">Affiliate disclosure</Link>
              <Link href={`/${locale}/privacy`} className="hover:underline">Privacy</Link>
              <Link href={`/${locale}/about`} className="hover:underline">About</Link>
              <Link href={`/${locale}/contact`} className="hover:underline">Contact</Link>
            </div>
          </nav>
        </div>
        <div className="md:text-right">© {new Date().getFullYear()} {site.name}</div>
      </div>
    </footer>
  );
}
