"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "auto";

const STORAGE_KEY = "windsiren.theme";

// Three-way segmented control for theme. "Auto" means "no localStorage
// entry — follow OS at script time AND react to OS changes during the
// session". Light / Dark force a class on <html> regardless of OS.
//
// Architecture invariant: <html> always has exactly one of theme-light
// or theme-dark applied. Auto resolves to one of them at FOUC-script
// time and is updated here when the OS preference changes.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    const stored = readStored();
    setTheme(stored);
    // When in auto mode, react to OS preference flips so the toggle
    // matches what's on screen. Forced modes ignore the system.
    if (stored !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyClass(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function applyClass(mode: "light" | "dark") {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(`theme-${mode}`);
  }

  function apply(next: Theme) {
    setTheme(next);
    if (next === "auto") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyClass(prefersDark ? "dark" : "light");
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyClass(next);
    }
  }

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
        Appearance
      </p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="inline-flex rounded-full border border-border bg-paper-2 p-0.5"
      >
        <Option label="Light" value="light" current={theme} onSelect={apply} />
        <Option label="Auto" value="auto" current={theme} onSelect={apply} />
        <Option label="Dark" value="dark" current={theme} onSelect={apply} />
      </div>
      <p className="mt-1.5 text-[11px] text-ink-mute">
        Auto follows your system's dark-mode setting.
      </p>
    </div>
  );
}

function Option({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: Theme;
  current: Theme;
  onSelect: (next: Theme) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
      className={
        active
          ? "rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
          : "rounded-full px-4 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
      }
    >
      {label}
    </button>
  );
}

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}
