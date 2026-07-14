import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';

const PROTECTED_TERMS = [
  'Seal of Approval',
];

function protect(text: string) {
  let out = text;
  PROTECTED_TERMS.forEach((term, i) => {
    const token = `__PROTECT_${i}__`;
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    out = out.replace(re, token);
  });
  return out;
}

function unprotect(text: string) {
  let out = text;
  PROTECTED_TERMS.forEach((term, i) => {
    const token = `__PROTECT_${i}__`;
    const re = new RegExp(token, 'g');
    out = out.replace(re, term);
  });
  return out;
}

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export async function translate(text: string, targetLocale: string): Promise<string> {
  const target = (targetLocale || 'en').split('-')[0].toLowerCase();
  if (!text || target === 'en') return text;
  // KILL SWITCH (founder, 2026-07-14): machine translation quality was rejected by a native
  // speaker ("absolutely bad Swedish"). Serve the SOURCE (English) on every locale until a
  // native-quality path ships (native-written templates + a review pass). The wiring stays
  // intact; set TRANSLATE_MT_ENABLED=1 to re-enable once quality is proven per-locale.
  if (process.env.TRANSLATE_MT_ENABLED !== '1') return text;
  const db = getServerSupabase();
  const src = `v1|${target}|${text}`; // versioned cache key
  const key = sha256(src);
  try {
    if (db) {
      const { data } = await db.from('translations').select('translated_text').eq('lang', target).eq('src_hash', key).maybeSingle();
      if (data?.translated_text) return data.translated_text as string;
    }
  } catch {}

  const protectedText = protect(text);
  let translated = protectedText;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const deeplKey = process.env.DEEPL_API_KEY;
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  // Claude first (key already provisioned for scoring; better register control than MT, and the
  // glossary below keeps brand vocabulary stable — founder decision 2026-07-12). Haiku: this is
  // volume translation, cached forever per string in the translations table.
  if (anthropicKey) {
    try {
      const glossary =
        target === 'sv'
          ? ' Render "cosy" and its forms as "mysig/mysigt/mysiga" (never "gemytlig" or "hemtrevlig").'
          : '';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system:
            `Translate the user's text into the language with ISO code "${target}" for a hotel-discovery website. ` +
            'Natural, idiomatic marketing register, not literal. Never translate: brand names (Got Cosy), hotel names, ' +
            'city names beyond their standard exonym, placeholder tokens like __PROTECT_0__ or {city}, URLs, or numbers.' +
            glossary +
            ' Reply with ONLY the translation, no quotes, no commentary.',
          messages: [{ role: 'user', content: protectedText }],
        }),
        signal: AbortSignal.timeout(20000),
      });
      const json = await res.json();
      const out = Array.isArray(json?.content) ? json.content.map((b: { text?: string }) => b?.text || '').join('').trim() : '';
      if (res.ok && out) translated = out;
    } catch {}
  }
  // Try DeepL next
  if (deeplKey) {
    try {
      const form = new URLSearchParams();
      form.set('auth_key', deeplKey);
      form.set('text', protectedText);
      form.set('target_lang', target.toUpperCase());
      form.set('tag_handling', 'xml'); // helps preserve tokens
      const res = await fetch('https://api.deepl.com/v2/translate', { method: 'POST', body: form });
      const json = await res.json();
      const out = json?.translations?.[0]?.text as string | undefined;
      if (out) translated = out;
    } catch {}
  }
  // Fallback to Google Translate v2 (only if neither Claude nor DeepL produced output)
  if (translated === protectedText && googleKey) {
    try {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${googleKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: protectedText, target, format: 'text' }),
      });
      const json = await res.json();
      const out = json?.data?.translations?.[0]?.translatedText as string | undefined;
      if (out) translated = out;
    } catch {}
  }

  translated = unprotect(translated);
  try {
    if (db) await db.from('translations').upsert({ lang: target, src_hash: key, src_text: text, translated_text: translated }, { onConflict: 'lang,src_hash' });
  } catch {}
  return translated;
}

// Batch-translate a list of strings with bounded concurrency. Each string is cached individually by
// translate() (so hotel descriptions are translated at most once, ever), but a page can show dozens
// of hotels — this caps the parallel fan-out on a cold cache so we never open 60 Claude requests at
// once. Order is preserved; en is a no-op that returns the input array unchanged.
export async function translateMany(texts: string[], targetLocale: string, concurrency = 8): Promise<string[]> {
  const target = (targetLocale || 'en').split('-')[0].toLowerCase();
  if (target === 'en') return texts;
  const out = new Array<string>(texts.length);
  let next = 0;
  async function worker() {
    while (next < texts.length) {
      const i = next++;
      out[i] = await translate(texts[i], target);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), texts.length || 1) }, worker));
  return out;
}

