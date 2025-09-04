export const locales = ["en", "fr", "de", "es", "it", "pt"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en";

