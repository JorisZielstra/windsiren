import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type TypedSupabaseClient } from "@windsiren/supabase";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Check apps/mobile/.env.local.",
  );
}

export const supabase: TypedSupabaseClient = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no URL fragment auth on native
  },
});
