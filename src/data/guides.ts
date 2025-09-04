export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  body: string; // simple HTML string for MVP
};

export const guides: Guide[] = [
  {
    slug: "how-to-choose-a-boutique-hotel",
    title: "How to choose a boutique hotel",
    excerpt: "A simple framework for picking a cosy, characterful stay.",
    body: `
      <p>Look for location that matches your plans, a style that resonates, and amenities you'll actually use. Prioritize sleep quality, room size, and honest photography.</p>
      <ul>
        <li>Neighborhood fit and walkability</li>
        <li>Quiet rooms and mattress quality</li>
        <li>Natural light and ventilation</li>
        <li>Breakfast and coffee options</li>
      </ul>
    `,
  },
  {
    slug: "when-to-book-for-the-best-rates",
    title: "When to book for the best rates",
    excerpt: "Timing tips to find value without stress.",
    body: `
      <p>For popular destinations, book early for peak months. Shoulder seasons offer excellent value. Watch free-cancellation rates and re-check prices closer to arrival.</p>
      <p>Sign up for price alerts and compare flexible vs. non-refundable options.</p>
    `,
  },
];

export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug);
}

