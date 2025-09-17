"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { locales } from "@/i18n/locales";

const languageNames: Record<string, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
};

export default function LanguageSwitcher({ current }: { current: string }) {
  const pathname = usePathname();
  const rest = pathname?.split("/").slice(2).join("/") || "";
  return (
    <div className="relative">
      <details className="group">
        <summary className="cursor-pointer list-none text-sm text-zinc-700">{current.toUpperCase()}</summary>
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-zinc-200 bg-white shadow">
          <ul className="p-1 text-sm">
            {locales.map((l) => {
              const label = languageNames[l] || l.toUpperCase();
              const href = `/${l}${rest ? "/" + rest : ""}`;
              const isActive = l === current;
              return (
                <li key={l}>
                  {isActive ? (
                    <span className="block px-2 py-1 text-zinc-500 cursor-default">{label}</span>
                  ) : (
                    <Link className="block px-2 py-1 hover:bg-zinc-50" href={href} hrefLang={l} lang={l}>
                      {label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    </div>
  );
}
