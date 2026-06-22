"use client";
// Light/dark toggle. Sets data-theme="light" on <html> (the palette swap lives in globals.css)
// and persists the choice in localStorage. Default is dark — the no-flash script in the root
// layout applies a saved "light" choice before paint so there's no flash.
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    const el = document.documentElement;
    if (next) el.setAttribute("data-theme", "light");
    else el.removeAttribute("data-theme");
    try { localStorage.setItem("theme", next ? "light" : "dark"); } catch {}
  };
  return (
    <button
      onClick={toggle}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark mode" : "Light mode"}
      className="flex items-center justify-center rounded-full shrink-0 hov"
      style={{ width: 36, height: 36, border: "1px solid var(--line)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}
    >
      {light ? "☾" : "☀"}
    </button>
  );
}
