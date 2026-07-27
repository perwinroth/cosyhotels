/**
 * translate-locale-descriptions.ts
 *
 * Warm the `translations` cache for one locale by pre-translating every live hotel
 * description (the string listing pages show as `snippet`, cityHotels.ts:91). This is
 * the bulk of a locale's translation cost; chrome (page titles/intros/labels) is small
 * and self-heals on first render, so it is intentionally NOT covered here.
 *
 * SAFE-MIGRATION posture:
 *  - DRY-RUN BY DEFAULT: prints missing count + cost estimate, translates nothing.
 *    Pass --execute to actually translate.
 *  - INSERT-ONLY: writes go through the app's own translate(), which upserts one cache
 *    row per (lang, src_hash). No updates/deletes of existing rows, no other tables.
 *  - REVERSIBLE: undo the whole run with  delete from translations where lang='<locale>'
 *    and src_hash in (...)  — or simply  where lang='<locale>' and created_at >= <start>.
 *  - IDEMPOTENT / RESUMABLE: translate() returns the cached value without an API call
 *    when a string is already translated, so re-running only fills gaps.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/translate-locale-descriptions.ts sv            # dry run
 *   node --env-file=.env.local --import tsx scripts/translate-locale-descriptions.ts sv --execute  # run
 */
import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { translate } from '@/lib/i18n/translate';

// This IS a translation job — make sure the app-level kill switch can't silently no-op it.
if (process.env.TRANSLATE_MT_DISABLED === '1') delete process.env.TRANSLATE_MT_DISABLED;

const locale = (process.argv[2] || '').toLowerCase();
const EXECUTE = process.argv.includes('--execute');
const CONCURRENCY = 8;

if (!locale || locale === 'en') {
  console.error('Pass a target locale, e.g.  ... translate-locale-descriptions.ts sv');
  process.exit(1);
}

// Same cache key translate() uses, so we can tell which descriptions are already done
// without an API call.
const cacheKey = (text: string) => crypto.createHash('sha256').update(`v3opus|${locale}|${text}`).digest('hex');

async function main() {
  const db = getServerSupabase();
  if (!db) { console.error('No Supabase (service-role env missing).'); process.exit(1); }

  // 1. The exact strings listing pages translate: distinct live-hotel descriptions.
  const descs: string[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('cosy_scores')
      .select('description, score, score_final')
      .not('description', 'is', null)
      // Stable order is REQUIRED for .range() pagination — PostgREST row order is otherwise
      // unspecified across pages, which can silently skip live descriptions.
      .order('hotel_id')
      .range(from, from + PAGE - 1);
    if (error) { console.error('fetch error', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ description: string | null; score: number | null; score_final: number | null }>) {
      const live = (r.score_final ?? r.score ?? 0) >= 5;
      const d = (r.description || '').trim();
      if (live && d) descs.push(d);
    }
    if (data.length < PAGE) break;
  }
  const distinct = Array.from(new Set(descs));

  // 2. Which are already cached for this locale (skip — no API call, no cost).
  // Paginate the locale's whole hash set rather than .in(<hundreds of sha256s>): that builds a
  // multi-KB GET URL PostgREST rejects, and the silently-dropped error made EVERY description look
  // missing (dry run reported 6,345 missing / ~$68 when sv was in fact 100% cached).
  const cached = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('translations')
      .select('src_hash')
      .eq('lang', locale)
      .order('src_hash')
      .range(from, from + PAGE - 1);
    if (error) { console.error('cache-check fetch error', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    (data as Array<{ src_hash: string }>).forEach((r) => cached.add(r.src_hash));
    if (data.length < PAGE) break;
  }
  const missing = distinct.filter((d) => !cached.has(cacheKey(d)));

  // 3. Cost estimate (Opus rates ~$15/M input, ~$75/M output; system prompt ~180 tok).
  const avgChars = missing.reduce((a, d) => a + d.length, 0) / (missing.length || 1);
  const inTok = missing.length * (avgChars / 4 + 180);
  const outTok = missing.length * (avgChars / 4 + 10);
  const est = (inTok * 15 + outTok * 75) / 1e6;

  console.log(`locale=${locale}  distinct live descriptions=${distinct.length}  already cached=${distinct.length - missing.length}  MISSING=${missing.length}`);
  console.log(`avg ${Math.round(avgChars)} chars  ~est cost $${est.toFixed(2)} (Opus)`);

  if (!EXECUTE) {
    console.log('\nDRY RUN — nothing translated. Re-run with --execute to translate the missing strings.');
    return;
  }

  // 4. Translate missing strings via the real translate() (glossary + em-dash strip +
  //    cache write happen inside). Bounded concurrency; progress every batch.
  console.log(`\nEXECUTE — translating ${missing.length} descriptions into ${locale} at concurrency ${CONCURRENCY}...`);
  let done = 0, failed = 0;
  const start = Date.now();
  let next = 0;
  async function worker() {
    while (next < missing.length) {
      const i = next++;
      try {
        const out = await translate(missing[i], locale);
        if (!out || out === missing[i]) failed++; // returned source = no translation produced
      } catch { failed++; }
      done++;
      if (done % 100 === 0 || done === missing.length) {
        const rate = done / ((Date.now() - start) / 1000);
        console.log(`  ${done}/${missing.length}  (${failed} unchanged/failed)  ${rate.toFixed(1)}/s`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone. translated≈${done - failed}, unchanged/failed=${failed}. Verify: select count(*) from translations where lang='${locale}';`);
}

main().catch((e) => { console.error(e); process.exit(1); });
