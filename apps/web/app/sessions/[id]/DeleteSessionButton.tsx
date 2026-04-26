"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSession } from "@windsiren/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  sessionId: string;
  // Where to send the user after a successful delete. The session detail
  // page is gone after deletion, so the back nav target is the most
  // sensible landing — typically the spot page or "/".
  returnTo: string;
};

// Owner-only delete button on the session detail page. Confirms via
// window.confirm to keep dependency-free; can graduate to a Headless UI
// dialog if we add the dep elsewhere.
export function DeleteSessionButton({ sessionId, returnTo }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (busy) return;
    const ok = window.confirm(
      "Delete this session? This cannot be undone — comments, likes, and photos go with it.",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const result = await deleteSession(supabase, sessionId);
    if (!result.ok) {
      setBusy(false);
      setError(result.message ?? "Couldn't delete this session.");
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="text-xs text-zinc-500 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
      >
        {busy ? "Deleting…" : "Delete session"}
      </button>
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
