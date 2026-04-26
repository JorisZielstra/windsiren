"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOwnProfile, uploadAvatar } from "@windsiren/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  userId: string;
  initialDisplayName: string | null;
  initialBio: string | null;
  initialAvatarUrl: string | null;
};

export function EditProfileForm({
  userId,
  initialDisplayName,
  initialBio,
  initialAvatarUrl,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    setPendingPreview(file ? URL.createObjectURL(file) : null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    // Avatar first — uploadAvatar updates users.avatar_url itself, so the
    // text-field updateOwnProfile call afterward doesn't need to repeat it.
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
      setPendingFile(null);
      setPendingPreview(null);
    }

    const result = await updateOwnProfile(supabase, userId, { displayName, bio });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/profile");
    router.refresh();
  }

  const previewSrc = pendingPreview ?? avatarUrl;

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-400">
              {(displayName || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block">
            <span className="text-sm font-medium">Profile photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-zinc-900"
            />
          </label>
          {pendingFile ? (
            <p className="mt-1 text-xs text-zinc-500">
              New file selected — uploads on Save.
            </p>
          ) : null}
        </div>
      </div>

      <label className="block">
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

      <label className="block">
        <span className="text-sm font-medium">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={240}
          rows={4}
          placeholder="A line or two about your kiting — optional"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="mt-1 block text-xs text-zinc-500">{bio.length}/240</span>
      </label>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
