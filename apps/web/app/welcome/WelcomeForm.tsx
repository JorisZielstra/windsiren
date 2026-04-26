"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addHomeSpot,
  markOnboarded,
  SUGGESTED_HOME_SPOT_MAX,
  updateOwnProfile,
  uploadAvatar,
} from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  userId: string;
  spots: Spot[];
  defaultDisplayName: string;
  defaultBio: string;
  defaultAvatarUrl: string | null;
};

export function WelcomeForm({
  userId,
  spots,
  defaultDisplayName,
  defaultBio,
  defaultAvatarUrl,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [bio, setBio] = useState(defaultBio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(defaultAvatarUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSpot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    setPendingPreview(file ? URL.createObjectURL(file) : null);
    setError(null);
  }

  async function finish(skip: boolean) {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    if (!skip) {
      // Avatar first (its own update of users.avatar_url).
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop() ?? "jpg";
        const upload = await uploadAvatar(supabase, userId, pendingFile, {
          ext,
          contentType: pendingFile.type,
        });
        if (!upload.ok) {
          setBusy(false);
          setError(`Avatar upload failed: ${upload.message}`);
          return;
        }
        setAvatarUrl(upload.url);
      }

      // Display name + bio.
      const profileResult = await updateOwnProfile(supabase, userId, {
        displayName,
        bio,
      });
      if (!profileResult.ok) {
        setBusy(false);
        setError(profileResult.message);
        return;
      }

      // Home spots — sequential to keep position ordering deterministic.
      for (const spotId of selected) {
        const r = await addHomeSpot(supabase, userId, spotId);
        if (!r.ok) {
          setBusy(false);
          setError(`Couldn't add a home spot: ${r.message}`);
          return;
        }
      }
    }

    const stamp = await markOnboarded(supabase, userId);
    setBusy(false);
    if (!stamp.ok) {
      setError(stamp.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const previewSrc = pendingPreview ?? avatarUrl;
  const overSuggested = selected.size > SUGGESTED_HOME_SPOT_MAX;

  return (
    <div className="mt-10 space-y-12">
      {/* Section 1: Home spots */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          🏠 Home spots
        </h2>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Pick the spots you actually drive to. Your dashboard score will be
          calculated only from these. Suggested 1–3 — you can change them
          later from any spot page.
        </p>
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {spots.map((spot) => {
            const isSelected = selected.has(spot.id);
            return (
              <li key={spot.id}>
                <label
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSpot(spot.id)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{spot.name}</div>
                    {spot.region ? (
                      <div className="text-xs text-zinc-500">
                        {regionLabel(spot.region)}
                      </div>
                    ) : null}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          {selected.size === 0
            ? "None selected — your score will cover all NL spots."
            : `${selected.size} selected${
                overSuggested
                  ? ` — we suggest 1–${SUGGESTED_HOME_SPOT_MAX} for a focused score.`
                  : ""
              }`}
        </p>
      </section>

      {/* Section 2: Profile */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          👤 Your profile
        </h2>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          A name and photo so other kiters know who's posting.
        </p>

        <div className="mt-5 flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-400">
                {(displayName || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <label className="block flex-1">
            <span className="text-sm font-medium">Profile photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-zinc-900"
            />
          </label>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            placeholder="How others see you"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Bio (optional)</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={240}
            rows={3}
            placeholder="A line or two about your kiting"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </section>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="flex items-center gap-4 border-t border-zinc-100 pt-6 dark:border-zinc-900">
        <button
          type="button"
          onClick={() => finish(false)}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Setting up…" : "Get started"}
        </button>
        <button
          type="button"
          onClick={() => finish(true)}
          disabled={busy}
          className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function regionLabel(region: string): string {
  return (
    {
      wadden: "Wadden",
      north_holland: "North Holland",
      south_holland: "South Holland",
      zeeland: "Zeeland",
      ijsselmeer: "IJsselmeer",
    } as Record<string, string>
  )[region] ?? region;
}
