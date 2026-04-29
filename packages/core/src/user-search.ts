import type { TypedSupabaseClient } from "@windsiren/supabase";
import type { PublicProfile } from "./follows";

export type UserSearchResult = Pick<
  PublicProfile,
  "id" | "display_name" | "avatar_url"
>;

const MAX_RESULTS = 10;

// Case-insensitive prefix-and-substring search over users.display_name.
// Returns up to 10 matches ordered by display_name. RLS allows any
// authenticated user to read the public columns; anonymous callers
// will see an empty list rather than an error.
export async function searchUsers(
  supabase: TypedSupabaseClient,
  query: string,
): Promise<UserSearchResult[]> {
  const cleaned = sanitizeQuery(query);
  if (cleaned.length < 2) return [];

  const { data } = await supabase
    .from("users")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${cleaned}%`)
    .order("display_name", { ascending: true })
    .limit(MAX_RESULTS);

  return (data ?? []).filter(
    (r): r is UserSearchResult => r.display_name !== null,
  );
}

// Strip PostgREST/ilike special chars so a user typing `_` or `%` can't
// turn the query into a wildcard, and so commas don't confuse the
// filter parser. Trims to a reasonable upper bound to keep the URL
// short on GET-style clients.
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[%_,()*]/g, "")
    .trim()
    .slice(0, 64);
}
