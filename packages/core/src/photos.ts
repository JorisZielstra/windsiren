import type { SessionPhotoRow, TypedSupabaseClient } from "@windsiren/supabase";

const BUCKET = "session-photos";
export const MAX_PHOTOS_PER_SESSION = 4;

export type UploadFile = Blob | ArrayBuffer | File;

export type UploadResult =
  | { ok: true; row: SessionPhotoRow }
  | { ok: false; reason: "validation" | "storage" | "db"; message: string };

// Uploads a single photo to the session-photos bucket and writes the
// session_photos row that points at it. Path layout:
//   <userId>/<sessionId>/<random-uuid>.<ext>
// (the leading <userId> is enforced by storage RLS)
export async function uploadSessionPhoto(
  supabase: TypedSupabaseClient,
  userId: string,
  sessionId: string,
  file: UploadFile,
  options: { ordinal: number; ext: string; contentType?: string },
): Promise<UploadResult> {
  if (options.ordinal < 0 || options.ordinal >= MAX_PHOTOS_PER_SESSION) {
    return {
      ok: false,
      reason: "validation",
      message: `ordinal must be 0..${MAX_PHOTOS_PER_SESSION - 1}`,
    };
  }
  const ext = options.ext.replace(/^\./, "").toLowerCase();
  if (!/^(jpe?g|png|webp|heic|heif)$/.test(ext)) {
    return { ok: false, reason: "validation", message: `unsupported extension: ${ext}` };
  }

  const photoId = randomUuid();
  const path = `${userId}/${sessionId}/${photoId}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: options.contentType,
    upsert: false,
  });
  if (uploadErr) return { ok: false, reason: "storage", message: uploadErr.message };

  const { data: row, error: dbErr } = await supabase
    .from("session_photos")
    .insert({ session_id: sessionId, storage_path: path, ordinal: options.ordinal })
    .select("*")
    .single();
  if (dbErr || !row) {
    // Best-effort cleanup of the orphaned object.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    return { ok: false, reason: "db", message: dbErr?.message ?? "insert failed" };
  }
  return { ok: true, row };
}

export async function listPhotosForSession(
  supabase: TypedSupabaseClient,
  sessionId: string,
): Promise<SessionPhotoRow[]> {
  const { data } = await supabase
    .from("session_photos")
    .select("*")
    .eq("session_id", sessionId)
    .order("ordinal", { ascending: true });
  return data ?? [];
}

export async function getPhotosForSessions(
  supabase: TypedSupabaseClient,
  sessionIds: string[],
): Promise<Map<string, SessionPhotoRow[]>> {
  if (sessionIds.length === 0) return new Map();
  const { data } = await supabase
    .from("session_photos")
    .select("*")
    .in("session_id", sessionIds)
    .order("ordinal", { ascending: true });
  const map = new Map<string, SessionPhotoRow[]>();
  for (const row of data ?? []) {
    const list = map.get(row.session_id);
    if (list) list.push(row);
    else map.set(row.session_id, [row]);
  }
  return map;
}

export function getPhotoPublicUrl(supabase: TypedSupabaseClient, storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export async function deletePhoto(
  supabase: TypedSupabaseClient,
  photoId: string,
  storagePath: string,
): Promise<{ ok: boolean; message?: string }> {
  // Delete row first; storage cleanup follows (best-effort).
  const { error: dbErr } = await supabase.from("session_photos").delete().eq("id", photoId);
  if (dbErr) return { ok: false, message: dbErr.message };
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
  return { ok: true };
}

// crypto.randomUUID is available in Node 19+, modern browsers, and RN
// (Hermes 0.74+). All targets we ship to support it; no polyfill needed.
function randomUuid(): string {
  return crypto.randomUUID();
}

// =============================================================================
// Avatars
// =============================================================================
//
// Avatars live in their own bucket (created in 20260426030000_avatars_bucket.sql).
// Path layout: <userId>/<uuid>.<ext>. The first segment is the owner's
// user_id, enforced by storage RLS on insert/update/delete. The public URL
// gets stored on users.avatar_url so consumers can render an <img>
// directly without re-resolving.

const AVATAR_BUCKET = "avatars";

export type AvatarUploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: "validation" | "storage" | "db"; message: string };

export async function uploadAvatar(
  supabase: TypedSupabaseClient,
  userId: string,
  file: UploadFile,
  options: { ext: string; contentType?: string },
): Promise<AvatarUploadResult> {
  const ext = options.ext.replace(/^\./, "").toLowerCase();
  if (!/^(jpe?g|png|webp|heic|heif)$/.test(ext)) {
    return { ok: false, reason: "validation", message: `unsupported extension: ${ext}` };
  }

  const path = `${userId}/${randomUuid()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: options.contentType, upsert: false });
  if (uploadErr) return { ok: false, reason: "storage", message: uploadErr.message };

  const url = getAvatarPublicUrl(supabase, path);
  const { error: dbErr } = await supabase
    .from("users")
    .update({ avatar_url: url })
    .eq("id", userId);
  if (dbErr) {
    // Best-effort cleanup of the orphaned object.
    await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => undefined);
    return { ok: false, reason: "db", message: dbErr.message };
  }
  return { ok: true, url };
}

export function getAvatarPublicUrl(
  supabase: TypedSupabaseClient,
  storagePath: string,
): string {
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
