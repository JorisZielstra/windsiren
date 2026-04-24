"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@windsiren/supabase";

// Client-side Supabase client. Use from "use client" components — sign-in
// forms, buttons that mutate user data, etc. Session is read from cookies
// that the middleware keeps in sync.
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createBrowserClient<Database>(url, key);
}
