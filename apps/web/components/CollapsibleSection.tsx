"use client";

import { useState, type ReactNode } from "react";

// Section wrapper with a clickable header bar that collapses its children.
// Used on the spot detail page so kiters can hide Live / Conditions /
// Forecast individually. Defaults to open. The chevron rotates when open.
//
// `flush` is for nested usage inside a parent rounded card — drops the
// outer border so internal `border-t` dividers handle separation.
export function CollapsibleSection({
  title,
  subtitle,
  rightAccessory,
  defaultOpen = true,
  flush = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  rightAccessory?: ReactNode;
  defaultOpen?: boolean;
  flush?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // The header is a div (not a single button) so that rightAccessory can
  // contain interactive controls without illegal button-in-button nesting.
  // The title area + chevron is the toggle target.
  return (
    <div className={flush ? "border-t border-border" : ""}>
      <div className="flex items-start justify-between gap-3 px-6 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="-mx-2 -my-1 flex min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-paper-sunk"
        >
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">
              {title}
            </p>
            {subtitle ? (
              <div className="mt-1 text-[11px] text-ink-mute">{subtitle}</div>
            ) : null}
          </div>
          <span
            aria-hidden
            className={`mt-0.5 shrink-0 select-none text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        {rightAccessory ? (
          <div className="flex shrink-0 items-center gap-2">{rightAccessory}</div>
        ) : null}
      </div>
      {open ? children : null}
    </div>
  );
}
