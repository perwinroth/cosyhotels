import en from "./en.json";
import fr from "./fr.json";
import de from "./de.json";
import es from "./es.json";
import it from "./it.json";
import pt from "./pt.json";
import type { Locale } from "@/i18n/locales";

export const messages: Record<Locale, any> = { en, fr, de, es, it, pt } as const;

