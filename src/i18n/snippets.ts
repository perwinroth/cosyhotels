type Parts = {
  city: string;
  name: string;
  rating?: number;
  reviewsCount?: number;
  cues: string[]; // canonical cue keys
  idealLevel?: 'budget' | 'mid-range' | 'upscale' | 'luxury' | 'warm';
};

const cueMap: Record<string, Record<string, string>> = {
  en: {
    spa: 'a soothing spa',
    sauna: 'a calming sauna',
    tubs: 'soaking tubs',
    fireplace: 'fireside warmth',
    garden: 'a quiet garden',
    rooftop: 'a rooftop view',
    tranquil: 'a tranquil vibe',
    romantic: 'a romantic feel',
  },
  fr: {
    spa: 'un spa apaisant',
    sauna: 'un sauna relaxant',
    tubs: 'des baignoires profondes',
    fireplace: 'la chaleur d’une cheminée',
    garden: 'un jardin calme',
    rooftop: 'un rooftop avec vue',
    tranquil: 'une atmosphère paisible',
    romantic: 'une ambiance romantique',
  },
  de: {
    spa: 'ein wohltuendes Spa',
    sauna: 'eine beruhigende Sauna',
    tubs: 'freistehende Wannen',
    fireplace: 'Kaminwärme',
    garden: 'ein ruhiger Garten',
    rooftop: 'eine Dachterrasse',
    tranquil: 'eine ruhige Atmosphäre',
    romantic: 'ein romantisches Flair',
  },
  es: {
    spa: 'un spa relajante',
    sauna: 'una sauna calmante',
    tubs: 'bañeras de inmersión',
    fireplace: 'calidez de chimenea',
    garden: 'un jardín tranquilo',
    rooftop: 'una azotea con vistas',
    tranquil: 'un ambiente tranquilo',
    romantic: 'un aire romántico',
  },
  it: {
    spa: 'una spa rilassante',
    sauna: 'una sauna distensiva',
    tubs: 'vasche da bagno',
    fireplace: 'calore del camino',
    garden: 'un giardino tranquillo',
    rooftop: 'una terrazza panoramica',
    tranquil: 'un’atmosfera tranquilla',
    romantic: 'un tocco romantico',
  },
  pt: {
    spa: 'um spa relaxante',
    sauna: 'uma sauna calmante',
    tubs: 'banheiras de imersão',
    fireplace: 'calor de lareira',
    garden: 'um jardim tranquilo',
    rooftop: 'um rooftop com vista',
    tranquil: 'um ambiente tranquilo',
    romantic: 'um clima romântico',
  },
  nl: {
    spa: 'een rustgevende spa',
    sauna: 'een kalmerende sauna',
    tubs: 'ligbaden',
    fireplace: 'haardvuurwarmte',
    garden: 'een stille tuin',
    rooftop: 'een dakterras met uitzicht',
    tranquil: 'een rustige sfeer',
    romantic: 'een romantische sfeer',
  },
  da: {
    spa: 'et beroligende spa',
    sauna: 'en afslappende sauna',
    tubs: 'karbade',
    fireplace: 'pejsehygge',
    garden: 'en stille have',
    rooftop: 'en tagterrasse',
    tranquil: 'en rolig stemning',
    romantic: 'en romantisk stemning',
  },
  sv: {
    spa: 'ett rogivande spa',
    sauna: 'en lugnande bastu',
    tubs: 'djupa badkar',
    fireplace: 'braskaminvärme',
    garden: 'en stilla trädgård',
    rooftop: 'en takterrass med utsikt',
    tranquil: 'en stillsam känsla',
    romantic: 'en romantisk känsla',
  },
  no: {
    spa: 'et beroligende spa',
    sauna: 'en avslappende badstue',
    tubs: 'dype badekar',
    fireplace: 'peiskos',
    garden: 'en stille hage',
    rooftop: 'en takterrasse',
    tranquil: 'en rolig stemning',
    romantic: 'en romantisk følelse',
  },
  ja: {
    spa: '心地よいスパ',
    sauna: '落ち着くサウナ',
    tubs: '深めのバスタブ',
    fireplace: '暖炉のぬくもり',
    garden: '静かな庭',
    rooftop: '屋上テラス',
    tranquil: '静かな雰囲気',
    romantic: 'ロマンチックな雰囲気',
  },
  ko: {
    spa: '편안한 스파',
    sauna: '차분한 사우나',
    tubs: '넉넉한 욕조',
    fireplace: '벽난로의 따뜻함',
    garden: '고요한 정원',
    rooftop: '루프탑 전망',
    tranquil: '아늑한 분위기',
    romantic: '로맨틱한 분위기',
  },
  zh: {
    spa: '舒缓的水疗',
    sauna: '宁静的桑拿',
    tubs: '浸泡浴缸',
    fireplace: '壁炉的温暖',
    garden: '安静的花园',
    rooftop: '屋顶景观',
    tranquil: '安静的氛围',
    romantic: '浪漫的气息',
  },
};

const ideals: Record<string, Record<string, string>> = {
  en: { 'budget': 'budget comfort', 'mid-range': 'mid‑range comfort', 'upscale': 'upscale comfort', 'luxury': 'luxury comfort', warm: 'a warm, relaxed stay' },
  fr: { 'budget': 'un confort abordable', 'mid-range': 'un confort milieu de gamme', 'upscale': 'un confort haut de gamme', 'luxury': 'un confort de luxe', warm: 'une ambiance chaleureuse et détendue' },
  de: { 'budget': 'komfort zum kleinen Preis', 'mid-range': 'komfort der Mittelklasse', 'upscale': 'gehobenen Komfort', 'luxury': 'Luxuskomfort', warm: 'eine warme, entspannte Auszeit' },
  es: { 'budget': 'comodidad económica', 'mid-range': 'comodidad media', 'upscale': 'comodidad de alto nivel', 'luxury': 'comodidad de lujo', warm: 'una estancia cálida y relajada' },
  it: { 'budget': 'comfort economico', 'mid-range': 'comfort di fascia media', 'upscale': 'comfort superiore', 'luxury': 'comfort di lusso', warm: 'un soggiorno caldo e rilassato' },
  pt: { 'budget': 'conforto económico', 'mid-range': 'conforto intermédio', 'upscale': 'conforto superior', 'luxury': 'conforto de luxo', warm: 'uma estadia acolhedora e descontraída' },
  nl: { 'budget': 'betaalbaar comfort', 'mid-range': 'comfort in het middensegment', 'upscale': 'hoogwaardig comfort', 'luxury': 'luxe comfort', warm: 'een warme, relaxte overnachting' },
  da: { 'budget': 'budgetvenlig komfort', 'mid-range': 'mellemklasse-komfort', 'upscale': 'eksklusiv komfort', 'luxury': 'luksuskomfort', warm: 'et varmt, afslappet ophold' },
  sv: { 'budget': 'prisvärt komfort', 'mid-range': 'mellanklasskomfort', 'upscale': 'hög komfort', 'luxury': 'lyxig komfort', warm: 'en varm, avslappnad vistelse' },
  no: { 'budget': 'rimelig komfort', 'mid-range': 'komfort i mellomklassen', 'upscale': 'eksklusiv komfort', 'luxury': 'luksuskomfort', warm: 'et varmt og avslappet opphold' },
  ja: { 'budget': '手頃な快適さ', 'mid-range': '程よい快適さ', 'upscale': '上質な快適さ', 'luxury': '贅沢な快適さ', warm: '温かくリラックスできる滞在' },
  ko: { 'budget': '합리적 편안함', 'mid-range': '중간급 편안함', 'upscale': '고급스러운 편안함', 'luxury': '럭셔리한 편안함', warm: '따뜻하고 편안한 숙박' },
  zh: { 'budget': '经济舒适', 'mid-range': '中档舒适', 'upscale': '高档舒适', 'luxury': '奢华舒适', warm: '温馨放松的住宿' },
};

const templates: Record<string, string[]> = {
  en: [
    `If you're looking for a cosy hotel in {city}, {name} is a top pick. We rate it {rating}{reviews} thanks to {cues}. Ideal if you want {ideal}.`,
    `Searching for a cosy hotel in {city}? {name} stands out. We rate it {rating}{reviews} thanks to {cues}. Ideal if you want {ideal}.`,
    `{name} is among the cosiest hotels in {city}. We rate it {rating}{reviews} thanks to {cues}. Ideal if you want {ideal}.`,
  ],
  fr: [
    `Si vous cherchez un hôtel chaleureux à {city}, {name} est un excellent choix. Nous lui attribuons {rating}{reviews} grâce à {cues}. Idéal si vous souhaitez {ideal}.`,
    `{name} compte parmi les hôtels les plus chaleureux de {city}. Nous le notons {rating}{reviews} grâce à {cues}. Idéal si vous souhaitez {ideal}.`,
  ],
  de: [
    `Wenn Sie ein gemütliches Hotel in {city} suchen, ist {name} eine Top‑Wahl. Wir bewerten es mit {rating}{reviews} dank {cues}. Ideal, wenn Sie {ideal} möchten.`,
    `{name} gehört zu den gemütlichsten Hotels in {city}. Unsere Bewertung: {rating}{reviews} dank {cues}. Ideal, wenn Sie {ideal} möchten.`,
  ],
  es: [
    `Si buscas un hotel acogedor en {city}, {name} es una gran opción. Lo valoramos {rating}{reviews} gracias a {cues}. Ideal si quieres {ideal}.`,
    `{name} está entre los hoteles más acogedores de {city}. Lo valoramos {rating}{reviews} gracias a {cues}. Ideal si quieres {ideal}.`,
  ],
  it: [
    `Se cerchi un hotel accogliente a {city}, {name} è una scelta top. Lo valutiamo {rating}{reviews} grazie a {cues}. Ideale se desideri {ideal}.`,
    `{name} è tra gli hotel più accoglienti di {city}. Lo valutiamo {rating}{reviews} grazie a {cues}. Ideale se desideri {ideal}.`,
  ],
  pt: [
    `Se procura um hotel acolhedor em {city}, o {name} é uma ótima escolha. Classificamo‑lo {rating}{reviews} graças a {cues}. Ideal para quem quer {ideal}.`,
  ],
  nl: [
    `Zoek je een gezellig hotel in {city}? {name} is een topper. We beoordelen het met {rating}{reviews} dankzij {cues}. Ideaal als je {ideal} wilt.`,
  ],
  da: [
    `Leder du efter et hyggeligt hotel i {city}, er {name} et topvalg. Vi bedømmer det til {rating}{reviews} takket være {cues}. Ideelt, hvis du vil {ideal}.`,
  ],
  sv: [
    `Letar du efter ett mysigt hotell i {city}? {name} är ett toppval. Vi sätter {rating}{reviews} tack vare {cues}. Perfekt om du vill {ideal}.`,
  ],
  no: [
    `Ser du etter et koselig hotell i {city}, er {name} et toppvalg. Vi gir {rating}{reviews} takket være {cues}. Ideelt hvis du vil {ideal}.`,
  ],
  ja: [
    `{city}でコージーなホテルをお探しなら、{name}はおすすめです。私たちの評価は{rating}{reviews}。{cues}が魅力です。{ideal}に最適。`,
    `{name}は{city}でもっともコージーなホテルの一つ。評価は{rating}{reviews}、{cues}が心地よさを高めます。{ideal}にぴったり。`,
  ],
  ko: [
    `{city}에서 아늑한 호텔을 찾는다면 {name}이(가) 최고의 선택입니다. 평점은 {rating}{reviews}, {cues}가 돋보입니다. {ideal}에 안성맞춤.`,
    `{name}은(는) {city}에서 가장 아늑한 호텔 중 하나입니다. 평점 {rating}{reviews}, {cues} 덕분에 더욱 포근합니다. {ideal}에 적합합니다.`,
  ],
  zh: [
    `如果你在{city}寻找温馨的酒店，{name}是不二之选。我们评分为{rating}{reviews}，得益于{cues}。非常适合{ideal}。`,
    `{name}是{city}最温馨的酒店之一。我们给出{rating}{reviews}，因为{cues}，适合{ideal}。`,
  ],
};

function fmtRating(locale: string, rating?: number, reviews?: number) {
  if (!rating) return '';
  const r = rating.toFixed(1).replace('.', locale === 'de' ? ',' : '.');
  const approx = reviews && reviews > 0 ? (reviews < 50 ? `${reviews}` : `${Math.floor(reviews / 10) * 10}+`) : '';
  const revText: Record<string, string> = {
    en: approx ? ` (based on ${approx} reviews)` : '',
    fr: approx ? ` (sur la base de ${approx} avis)` : '',
    de: approx ? ` (basierend auf ${approx} Bewertungen)` : '',
    es: approx ? ` (basado en ${approx} reseñas)` : '',
    it: approx ? ` (in base a ${approx} recensioni)` : '',
    pt: approx ? ` (com base em ${approx} avaliações)` : '',
    nl: approx ? ` (gebaseerd op ${approx} reviews)` : '',
    da: approx ? ` (baseret på ${approx} anmeldelser)` : '',
    sv: approx ? ` (baserat på ${approx} omdömen)` : '',
    no: approx ? ` (basert på ${approx} vurderinger)` : '',
  };
  const rLabel: Record<string, string> = {
    en: `${r}/5`, fr: `${r}/5`, de: `${r}/5`, es: `${r}/5`, it: `${r}/5`, pt: `${r}/5`, nl: `${r}/5`, da: `${r}/5`, sv: `${r}/5`, no: `${r}/5`,
  };
  return `${rLabel[locale] || rLabel.en}${revText[locale] || ''}`;
}

export function buildCosySnippet(locale: string, parts: Parts) {
  const loc = (locale || 'en').toLowerCase();
  const cuesLocMap = cueMap[loc] || cueMap.en;
  const idealLocMap = ideals[loc] || ideals.en;
  const cues = parts.cues.map((k) => cuesLocMap[k] || k).filter(Boolean).slice(0, 3);
  const cuesText = cues.length ? cues.join(', ') : (loc === 'en' ? 'its intimate scale and warm design' : undefined);
  const ideal = idealLocMap[parts.idealLevel || 'warm'];
  const rating = fmtRating(loc, parts.rating, parts.reviewsCount);
  const dict = { city: parts.city, name: parts.name, cues: cuesText || '', ideal, rating, reviews: '' } as Record<string, string>;
  const t = templates[loc] || templates.en;
  const idx = (parts.name.length + parts.city.length * 7) % t.length;
  return t[idx].replace(/\{(\w+)\}/g, (_, k) => dict[k] || '');
}

export const SUPPORTED_SNIPPET_LOCALES = new Set(Object.keys(cueMap));
