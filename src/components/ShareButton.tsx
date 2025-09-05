"use client";
import { useState } from "react";

export default function ShareButton({ url, className = "" }: { url?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const href = url || (typeof window !== 'undefined' ? window.location.href : '');
  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Link copied', type: 'success' } })); } catch {}
      setTimeout(() => setCopied(false), 1500);
    } catch {
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Unable to copy link', type: 'error' } })); } catch {}
    }
  }
  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}

