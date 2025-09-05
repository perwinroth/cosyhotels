"use client";
import { useEffect, useState } from "react";

type Toast = {
  id: number;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  type?: "info" | "success" | "error";
};

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let idSeq = 1;
    type ToastDetail = { message?: string; actionUrl?: string; actionLabel?: string; type?: "info" | "success" | "error" };
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail || {};
      const t: Toast = { id: idSeq++, message: String(detail.message || ""), actionUrl: detail.actionUrl, actionLabel: detail.actionLabel, type: detail.type || "info" };
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    window.addEventListener("toast", onToast as EventListener);
    return () => window.removeEventListener("toast", onToast as EventListener);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[1000] flex justify-center pointer-events-none">
      <div className="flex flex-col gap-2 max-w-sm w-full px-2">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-lg border px-3 py-2 shadow bg-white ${t.type === 'error' ? 'border-red-300' : t.type === 'success' ? 'border-emerald-300' : 'border-zinc-200'}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>{t.message}</div>
              {t.actionUrl && (
                <a href={t.actionUrl} className="underline text-zinc-900 whitespace-nowrap">{t.actionLabel || 'Open'}</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
