export type HotelFeatures = {
  rating?: number;
  reviewsCount?: number;
  roomsCount?: number;
  amenities?: string[];
  description?: string;
  imagesWarmthHint?: number; // 0..1, if you have a vision model later
};

const AMENITY_WEIGHTS: Record<string, number> = {
  fireplace: 2.0,
  "fire place": 2.0,
  bathtub: 1.5,
  spa: 1.2,
  sauna: 1.2,
  rooftop: 0.6,
  garden: 0.8,
  bar: 0.3,
  restaurant: 0.3,
  "room service": 0.2,
  "pet-friendly": 0.4,
  pool: 0.3,
  gym: -0.1,
};

const COSY_KEYWORDS = [
  "cosy", "cozy", "snug", "warm", "intimate", "charming", "boutique", "hygge",
  "quiet", "peaceful", "comfy", "romantic", "character", "fireplace", "bath", "bathtub",
];

export function keywordSentiment(text?: string) {
  if (!text) return 0;
  const t = text.toLowerCase();
  let score = 0;
  for (const k of COSY_KEYWORDS) if (t.includes(k)) score += 1;
  return Math.min(score / 8, 1); // cap
}

export function amenitiesScore(am?: string[]) {
  if (!am || !am.length) return 0;
  let s = 0;
  for (const a of am) {
    const k = a.toLowerCase();
    if (k in AMENITY_WEIGHTS) s += AMENITY_WEIGHTS[k];
  }
  return Math.max(0, Math.min(3, s));
}

export function scalePenalty(roomsCount?: number) {
  if (!roomsCount) return 0;
  if (roomsCount <= 20) return 0;          // boutique
  if (roomsCount <= 50) return -0.2;
  if (roomsCount <= 100) return -0.5;
  return -1.0; // large hotels feel less cosy
}

export function cosyScore(features: HotelFeatures) {
  const base = (features.rating ?? 8) / 10; // normalize to 0..1
  const amen = amenitiesScore(features.amenities);
  const desc = keywordSentiment(features.description);
  const img = features.imagesWarmthHint ?? 0; // later fill with vision model
  const scale = scalePenalty(features.roomsCount);

  // Weighted blend → 0..10
  const blended =
    base * 5 +           // overall quality
    amen * 1.2 +
    desc * 2 +
    img * 1 +
    scale; // penalty negative

  return Math.max(0, Math.min(10, blended));
}

// Helper for UI: map cosy score to brand color classes
export function cosyBadgeClass(score: number) {
  if (score >= 7.5) return "bg-emerald-100 text-emerald-800"; // green
  if (score >= 6.5) return "bg-amber-100 text-amber-900"; // yellow
  if (score >= 5.0) return "bg-orange-100 text-orange-800"; // orange
  return "bg-zinc-100 text-zinc-700"; // neutral
}

// Helper for UI: map cosy score to rank label
export function cosyRankLabel(score: number) {
  if (score >= 7.5) return "High";
  if (score >= 6.5) return "Mid";
  return "Low";
}

// Ad-hoc cosy score for Google Places results without persistence
export function adhocCosyScore({
  rating,
  summary,
  name,
}: {
  rating?: number; // 0..5 from Places
  summary?: string;
  name?: string;
}) {
  const base = ((rating ?? 4) / 5); // normalize 0..1
  const desc = keywordSentiment(`${name || ""}. ${summary || ""}`);
  // Blend with stronger emphasis on rating for lack of amenities/rooms
  const blended = base * 7 + desc * 3; // 0..10 scale
  return Math.max(0, Math.min(10, blended));
}
