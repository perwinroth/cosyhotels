export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  body: string; // simple HTML string for MVP
};

export const guides: Guide[] = [];

export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug);
}
