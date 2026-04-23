import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

// Creates a typed Supabase client. Call once per app at startup and reuse.
// Auth persistence is platform-specific and handled by the caller:
// - Next.js: default (browser localStorage) or @supabase/ssr for server components
// - Expo: pass { auth: { storage: AsyncStorage } } in options
export function createClient(
  url: string,
  publishableKey: string,
  options: Parameters<typeof createSupabaseClient>[2] = {},
): TypedSupabaseClient {
  return createSupabaseClient<Database>(url, publishableKey, options);
}
