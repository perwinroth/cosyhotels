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
            <ul className="list-disc pl-5 space-y-1">
              <li><Link href={`/${locale}/cosy-score`} className="hover:underline">Cosy score</Link></li>
              <li><Link href={`/${locale}/disclosure`} className="hover:underline">Affiliate disclosure</Link></li>
              <li><Link href={`/${locale}/privacy`} className="hover:underline">Privacy</Link></li>
              <li><Link href={`/${locale}/about`} className="hover:underline">About</Link></li>
              <li><Link href={`/${locale}/contact`} className="hover:underline">Contact</Link></li>
            </ul>
          </nav>
        </div>
        <div className="md:text-right">© {new Date().getFullYear()} {site.name}</div>
      </div>
    </footer>
  );
}
