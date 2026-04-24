import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@windsiren/supabase";

// Server-side Supabase client that reads/writes auth cookies via Next's
// request-scoped cookie store. Use from server components + route handlers
// + server actions that need to know who the current user is.
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component that can't set cookies; middleware
          // handles session refresh instead. Safe to swallow.
        }
      },
    },
  });
}
