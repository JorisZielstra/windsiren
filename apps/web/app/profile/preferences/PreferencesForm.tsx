"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateUserPrefs, type UserKitePrefs } from "@windsiren/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

// Edit form for the four user-tunable kite thresholds. The min-wind
// field has a placeholder of 15 so the user knows the default if they
// blank it. The other three render "Optional" — leaving them empty
// keeps the constraint off entirely.
export function PreferencesForm({ initial }: { initial: UserKitePrefs }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [minWind, setMinWind] = useState<string>(String(initial.minWindKn));
  const [maxGust, setMaxGust] = useState<string>(
    initial.maxGustKn !== null ? String(initial.maxGustKn) : "",
  );
  const [minAir, setMinAir] = useState<string>(
    initial.minAirTempC !== null ? String(initial.minAirTempC) : "",
  );
  const [minWater, setMinWater] = useState<string>(
    initial.minWaterTempC !== null ? String(initial.minWaterTempC) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedAt(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setError("Not signed in.");
      return;
    }

    const result = await updateUserPrefs(supabase, user.id, {
      minWindKn: parseOrDefault(minWind, 15),
      maxGustKn: parseOrNull(maxGust),
      minAirTempC: parseOrNull(minAir),
      minWaterTempC: parseOrNull(minWater),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field
        label="Minimum wind (kn)"
        hint="Days that don't reach this wind speed are NO GO. Defaults to 15 kn if blank."
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          step={1}
          value={minWind}
          onChange={(e) => setMinWind(e.target.value)}
          placeholder="15"
          className={inputCls}
        />
        <span className="text-sm text-zinc-500">kn</span>
      </Field>

      <Field
        label="Maximum gust (kn)"
        hint="Optional ceiling. Leave blank if you'll kite no matter how gusty."
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          step={1}
          value={maxGust}
          onChange={(e) => setMaxGust(e.target.value)}
          placeholder="Optional"
          className={inputCls}
        />
        <span className="text-sm text-zinc-500">kn</span>
      </Field>

      <Field
        label="Minimum air temp (°C)"
        hint="Optional. Below this, the day is NO GO."
      >
        <input
          type="number"
          inputMode="numeric"
          min={-20}
          max={50}
          step={1}
          value={minAir}
          onChange={(e) => setMinAir(e.target.value)}
          placeholder="Optional"
          className={inputCls}
        />
        <span className="text-sm text-zinc-500">°C</span>
      </Field>

      <Field
        label="Minimum water temp (°C)"
        hint="Optional. Pulls from the spot's tide / sea data when available."
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={35}
          step={1}
          value={minWater}
          onChange={(e) => setMinWater(e.target.value)}
          placeholder="Optional"
          className={inputCls}
        />
        <span className="text-sm text-zinc-500">°C</span>
      </Field>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save preferences"}
        </button>
        {savedAt ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            Saved · verdicts updated
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center gap-2">{children}</div>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

const inputCls =
  "w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900";

function parseOrDefault(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function parseOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
