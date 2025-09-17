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
  const deeplKey = process.env.DEEPL_API_KEY;
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  // Try DeepL first
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
  // Fallback to Google Translate v2
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

