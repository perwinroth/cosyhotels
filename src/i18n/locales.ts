export const locales = ["en", "fr", "de", "es", "it", "pt", "sv"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en";

