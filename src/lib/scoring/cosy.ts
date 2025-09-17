export type HotelFeatures = {
  rating?: number;
  reviewsCount?: number;
  roomsCount?: number;
  amenities?: string[];
  description?: string;
  imagesWarmthHint?: number; // 0..1, if you have a vision model later
  name?: string;
  website?: string;
  city?: string;
};

const AMENITY_WEIGHTS: Record<string, number> = {
  fireplace: 2.0,
  "fire place": 2.0,
  "fire pit": 1.2,
  bathtub: 1.5,
  "hot tub": 1.2,
  hammam: 1.0,
  spa: 1.2,
  sauna: 1.2,
  rooftop: 0.6,
  garden: 0.8,
  courtyard: 0.6,
  bar: 0.3,
  restaurant: 0.3,
  "room service": 0.2,
  "pet-friendly": 0.4,
  pool: 0.3,
  gym: -0.1,
};

const COSY_KEYWORDS = [
  // English
  "cosy", "cozy", "snug", "warm", "intimate", "charming", "boutique", "hygge",
  "quiet", "peaceful", "comfy", "romantic", "character", "fireplace", "log fire", "wood stove",
  "bath", "bathtub", "soaking tub", "garden", "courtyard",
  // Romance languages
  "accogliente", "intimo", "romantico", // IT
  "chaleureux", "charme", "intime", // FR
  "acogedor", "romántico", "con encanto", // ES
  // Germanic/Scandi/Dutch
  "gemütlich", // DE
  "mysig", // SV
  "hyggelig", // DA/NO
  "gezellig", "knus", // NL
  // Japanese/Asia specific cosy cues
  "旅館", "温泉", "町家", "畳", // ryokan, onsen, machiya, tatami
  "onsen", "ryokan", "machiya", "tatami", "hot spring",
  // Korean
  "아늑", "편안", "로맨틱", "벽난로",
  // Chinese
  "温馨", "舒适", "浪漫", "壁炉", "花园",
  // Polish
  "przytulny", "romantyczny", "kominek",
  // Turkish
  "samimi", "sıcak", "romantik",
];

const NEGATIVE_KEYWORDS = [
  "noisy", "busy", "corporate", "conference", "chain",
  "hostel", "dorm", "capsule", "capsule hotel", "party hostel",
  // Global languages negatives
  "ビジネスホテル", // business hotel (JP)
  "商务酒店", // business hotel (ZH)
  "비즈니스 호텔", // business hotel (KO)
  "konferencja", // conference (PL)
  "iş oteli", // business hotel (TR)
  "airport", "convention", "meeting rooms", "event centre", "event center",
];

export function keywordSentiment(text?: string) {
  if (!text) return 0;
  const t = text.toLowerCase();
  let score = 0;
  for (const k of COSY_KEYWORDS) if (t.includes(k)) score += 1;
  for (const k of NEGATIVE_KEYWORDS) if (t.includes(k)) score -= 1;
  // Stronger cap and smoothing
  // Scale: positive words add up to +1 max, negatives down to -1 max
  return Math.max(-1, Math.min(score / 8, 1));
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

const MAJOR_CITIES = new Set([
  "london","paris","new york","tokyo","rome","barcelona","madrid","berlin","amsterdam","copenhagen",
  "vienna","lisbon","istanbul","athens","seoul","bangkok","singapore","hong kong","sydney","melbourne",
]);

export function scalePenalty(roomsCount?: number, city?: string) {
  const isMajor = city ? MAJOR_CITIES.has(city.toLowerCase()) : false;
  if (!roomsCount) return isMajor ? -0.1 : 0; // light default in major cities
  if (roomsCount <= 20) return 0;          // boutique
  if (roomsCount <= 50) return isMajor ? -0.1 : -0.2;
  if (roomsCount <= 100) return isMajor ? -0.3 : -0.5;
  return isMajor ? -0.3 : -1.0; // reduce penalty in large markets
}

function chainPenalty(name?: string, website?: string) {
  const chains = [
    "marriott","hilton","hyatt","accor","radisson","kempinski","four seasons","ritz-carlton","intercontinental","sheraton","ibis","novotel","mercure","holiday inn","best western","wyndham","premier inn","travelodge","four points","courtyard","residence inn","springhill suites","fairfield inn","doubletree","embassy suites","waldorf astoria","conrad","sofitel","pullman","moxy","ac hotel","aloft","element","hampton","jw marriott","ritz",
  ];
  const domains = [
    "marriott.com","hyatt.com","hilton.com","accor.com","radissonhotels.com","ritzcarlton.com","ihg.com","sheraton.com","ibis.com","novotel.com","wyndhamhotels.com","bestwestern.com","premierinn.com","travelodge.co.uk",
  ];
  const hay = `${name || ''} ${website || ''}`.toLowerCase();
  if (chains.some((c) => hay.includes(c))) return -1.2;
  if (website && domains.some((d) => website.toLowerCase().includes(d))) return -1.2;
  return 0;
}

function sizePenaltyByReviews(reviews?: number) {
  if (!reviews || reviews <= 0) return 0;
  if (reviews > 50000) return -0.6;
  if (reviews > 20000) return -0.4;
  if (reviews > 10000) return -0.2;
  return 0;
}

function reviewConfidence(reviews?: number) {
  if (!reviews || reviews <= 0) return 0;
  // Diminishing returns; ~+0.12 @200, ~+0.2 @1000
  const bonus = Math.log10(1 + reviews) / 12; // 0..~0.25
  return Math.min(0.25, bonus);
}

export function cosyParts(features: HotelFeatures) {
  const base = (features.rating ?? 8) / 10; // normalize 0..1
  const amen = amenitiesScore(features.amenities);
  const desc = keywordSentiment(features.description);
  const img = features.imagesWarmthHint ?? 0; // later fill with vision model
  const scale = scalePenalty(features.roomsCount, features.city);
  const chain = chainPenalty(features.name, features.website);
  const conf = reviewConfidence(features.reviewsCount);
  const sizeRev = sizePenaltyByReviews(features.reviewsCount);

  // Re-balanced blend: slightly downweight rating, upweight warmth + penalties
  let raw = base * 5.0 + amen * 1.8 + desc * 2.2 + img * 0.8 + scale + chain + sizeRev + conf;
  // Clamp to 0..10
  raw = Math.max(0, Math.min(10, raw));
  return { raw, parts: { rating_base: base, amenities: amen, keywords: desc, image_warmth: img, scale_penalty: scale, chain_penalty: chain, size_penalty_reviews: sizeRev, review_conf: conf } };
}

export function cosyScore(features: HotelFeatures) {
  return cosyParts(features).raw;
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
  reviews
}: {
  rating?: number; // 0..5 from Places
  summary?: string;
  name?: string;
  reviews?: number;
}) {
  const base = ((rating ?? 4) / 5); // normalize 0..1
  const desc = keywordSentiment(`${name || ""}. ${summary || ""}`);
  const conf = reviewConfidence(reviews);
  // Blend with stronger emphasis on rating; add confidence
  const blended = base * 6.6 + desc * 3 + conf * 1.0; // 0..10 scale
  return Math.max(0, Math.min(10, blended));
}
