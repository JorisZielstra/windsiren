"use client";

import Link from "next/link";
import { useState } from "react";
import {
  COMMENT_MAX_LENGTH,
  createComment,
  deleteComment,
  getPublicProfiles,
  listCommentsForSession,
  type PublicProfile,
} from "@windsiren/core";
import type { SessionCommentRow } from "@windsiren/supabase";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  sessionId: string;
  initialCount: number;
  viewerId: string | null;
};

export function CommentSection({ sessionId, initialCount, viewerId }: Props) {
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<SessionCommentRow[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadIfNeeded() {
    if (comments !== null) return;
    const supabase = createSupabaseBrowserClient();
    const list = await listCommentsForSession(supabase, sessionId);
    setComments(list);
    const authorIds = Array.from(new Set(list.map((c) => c.user_id)));
    setProfiles(await getPublicProfiles(supabase, authorIds));
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await loadIfNeeded();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!viewerId) return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const result = await createComment(supabase, viewerId, sessionId, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBody("");
    setComments((prev) => (prev ? [...prev, result.comment] : [result.comment]));
    setCount((c) => c + 1);
    // Lazy-fetch the new author's profile if we don't have it yet.
    if (!profiles.has(viewerId)) {
      const map = await getPublicProfiles(supabase, [viewerId]);
      setProfiles((prev) => new Map([...prev, ...map]));
    }
  }

  async function onDelete(commentId: string) {
    const supabase = createSupabaseBrowserClient();
    const r = await deleteComment(supabase, commentId);
    if (!r.ok) return;
    setComments((prev) => prev?.filter((c) => c.id !== commentId) ?? null);
    setCount((c) => Math.max(0, c - 1));
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <span>💬</span>
        <span className="font-mono">{count}</span>
        <span className="text-xs">{open ? " — hide" : count === 1 ? " comment" : " comments"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {comments === null ? (
            <p className="text-xs text-zinc-500">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-zinc-500">No comments yet.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => {
                const author = profiles.get(c.user_id);
                const isMine = viewerId === c.user_id;
                return (
                  <li key={c.id} className="rounded-md bg-white p-2 dark:bg-zinc-950">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/users/${c.user_id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {author?.display_name ?? "Someone"}
                      </Link>
                      <span className="text-xs text-zinc-500">{relativeTime(c.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                    {isMine ? (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        className="mt-1 text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        Delete
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {viewerId ? (
            <form onSubmit={onSubmit} className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                maxLength={COMMENT_MAX_LENGTH}
                placeholder="Add a comment…"
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {body.length}/{COMMENT_MAX_LENGTH}
                </span>
                <button
                  type="submit"
                  disabled={busy || body.trim().length === 0}
                  className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busy ? "Posting…" : "Post"}
                </button>
              </div>
            </form>
          ) : (
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <Link href="/auth/sign-in" className="text-xs underline">
                Sign in to comment
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-NL", { month: "short", day: "numeric" });
}
