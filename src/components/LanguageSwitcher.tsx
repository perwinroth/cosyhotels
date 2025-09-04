"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { locales } from "@/i18n/locales";

export default function LanguageSwitcher({ current }: { current: string }) {
  const pathname = usePathname();
  const rest = pathname?.split("/").slice(2).join("/") || "";
  return (
    <div className="relative">
      <details className="group">
        <summary className="cursor-pointer list-none text-sm text-zinc-700">{current.toUpperCase()}</summary>
        <div className="absolute right-0 mt-2 w-32 rounded-lg border border-zinc-200 bg-white shadow">
          <ul className="p-1 text-sm">
            {locales.map((l) => (
              <li key={l}>
                <Link className="block px-2 py-1 hover:bg-zinc-50" href={`/${l}${rest ? "/" + rest : ""}`}>{l.toUpperCase()}</Link>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

