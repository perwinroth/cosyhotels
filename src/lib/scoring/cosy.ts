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
  country?: string;
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
  pool: 0.3, // will be adjusted contextually
  gym: -0.1,
};

const COSY_KEYWORDS = [
  // English
  "cosy", "cozy", "snug", "warm", "intimate", "charming", "boutique", "hygge",
  "quiet", "peaceful", "comfy", "romantic", "character", "fireplace", "log fire", "wood stove",
  "bath", "bathtub", "soaking tub", "garden", "courtyard",
  // Nature/setting
  "forest", "woods", "woodland", "lake", "lakeside", "mountain", "alpine", "meadow", "countryside", "rural",
  "cabin", "cottage", "farmhouse", "barn", "stone walls", "timber", "wooden",
  // Room niceties
  "linen", "duvet", "rain shower", "balcony", "terrace",
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

type Climate = 'cold' | 'temperate' | 'warm';

function inferClimate(city?: string, country?: string): Climate {
  const v = `${(city || '').toLowerCase()} ${(country || '').toLowerCase()}`;
  const warmHints = [
    'spain','portugal','italy','greece','turkey','morocco','tunisia','egypt','mexico','brazil','argentina','chile','uruguay','peru','colombia','costa rica','panama','dominican','jamaica','uae','dubai','abu dhabi','israel','lebanon','saudi','india','sri lanka','thailand','vietnam','cambodia','laos','malaysia','singapore','indonesia','philippines','australia','new zealand','miami','los angeles','la','rio','lisbon','athens','marrakech','marrakesh','sicily','sardinia','andalusia','andalucía','mallorca','ibiza'
  ];
  const coldHints = ['sweden','norway','finland','iceland','denmark','poland','czech','austria','switzerland','scotland','ireland','england','uk','germany','netherlands','belgium','canada','alps','oslo','stockholm','helsinki','copenhagen','berlin'];
  if (warmHints.some(h => v.includes(h))) return 'warm';
  if (coldHints.some(h => v.includes(h))) return 'cold';
  return 'temperate';
}

function amenitiesScore(am: string[] | undefined, climate: Climate, chainActive: boolean) {
  if (!am || !am.length) return 0;
  let s = 0;
  for (const a of am) {
    const k = a.toLowerCase();
    let w = AMENITY_WEIGHTS[k] ?? 0;
    // Contextual tweaks
    if (k === 'pool') {
      w = climate === 'warm' ? 0.8 : climate === 'temperate' ? 0.3 : 0.0;
    }
    if (k === 'sauna') {
      w = climate === 'cold' ? 1.6 : climate === 'temperate' ? 1.2 : 0.8;
    }
    if (k === 'spa') {
      w = climate === 'cold' ? 1.2 : 1.0;
    }
    s += w;
  }
  // If it looks like a chain, dampen the amenity boost slightly so spa/sauna at big chains don't dominate
  if (chainActive) s *= 0.7;
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
    // sub-brands / phrasing
    "by hyatt","jdv by hyatt","joie de vivre","autograph collection","design hotels","marriott bonvoy","tribute portfolio","grand hyatt","park hyatt","story hotel",
  ];
  const domains = [
    "marriott.com","hyatt.com","hilton.com","accor.com","radissonhotels.com","ritzcarlton.com","ihg.com","sheraton.com","ibis.com","novotel.com","wyndhamhotels.com","bestwestern.com","premierinn.com","travelodge.co.uk",
  ];
  const hay = `${name || ''} ${website || ''}`.toLowerCase();
  if (chains.some((c) => hay.includes(c))) return -1.0;
  if (website && domains.some((d) => website.toLowerCase().includes(d))) return -1.0;
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

export type ContextSignals = { natureProximity?: number; nightlifeDensity?: number; walkability?: number };

export function cosyParts(features: HotelFeatures, ctx: ContextSignals = {}) {
  const base = (features.rating ?? 8) / 10; // normalize 0..1
  const climate = inferClimate(features.city, features.country);
  const chain = chainPenalty(features.name, features.website);
  const amen = amenitiesScore(features.amenities, climate, chain < 0);
  const desc = keywordSentiment(features.description);
  const img = features.imagesWarmthHint ?? 0; // later fill with vision model
  const scale = scalePenalty(features.roomsCount, features.city);
  const conf = reviewConfidence(features.reviewsCount);
  const sizeRev = sizePenaltyByReviews(features.reviewsCount);

  // Re-balanced blend: slightly downweight rating, upweight warmth + penalties
  // Contextual boosts: description gets a little more weight in cold/temperate where design/setting matters
  const descWeight = climate === 'warm' ? 2.0 : 2.4;
  let raw = base * 4.8 + amen * 1.9 + desc * descWeight + img * 0.8 + scale + chain + sizeRev + conf;
  // Context adjustments
  const natureBoost = Math.min(0.8, Math.max(0, (ctx.natureProximity ?? 0) * 0.8));
  const nightPenalty = -Math.min(0.5, Math.max(0, (ctx.nightlifeDensity ?? 0) * 0.5));
  const walkBoost = Math.min(0.3, Math.max(0, (ctx.walkability ?? 0) * 0.3));
  raw += natureBoost + nightPenalty + walkBoost;
  // Clamp to 0..10
  raw = Math.max(0, Math.min(10, raw));
  return { raw, parts: { rating_base: base, amenities: amen, keywords: desc, image_warmth: img, scale_penalty: scale, chain_penalty: chain, size_penalty_reviews: sizeRev, review_conf: conf, climate, natureBoost, nightPenalty, walkBoost } };
}

export function cosyScore(features: HotelFeatures, ctx: ContextSignals = {}) {
  return cosyParts(features, ctx).raw;
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
