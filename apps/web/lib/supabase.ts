import { createClient, type TypedSupabaseClient } from "@windsiren/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Check apps/web/.env.local.",
  );
}

export const supabase: TypedSupabaseClient = createClient(url, key);
