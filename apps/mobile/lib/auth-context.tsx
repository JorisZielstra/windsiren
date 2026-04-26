import type { Session, User } from "@windsiren/supabase";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // Null while we don't yet know (initial render, or unauthed). True/false
  // once the users.onboarded_at column has been read for the signed-in user.
  // The root layout uses this to gate redirects to /welcome.
  onboarded: boolean | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshOnboarded: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    // Hydrate initial session from AsyncStorage.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for sign-in / sign-out / token refresh events.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Reset onboarded state on sign-out so the next sign-in re-fetches.
      if (!newSession) setOnboarded(null);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  // Whenever the signed-in user changes, re-read users.onboarded_at.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setOnboarded(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("users")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOnboarded(data?.onboarded_at != null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const refreshOnboarded = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setOnboarded(null);
      return;
    }
    const { data } = await supabase
      .from("users")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    setOnboarded(data?.onboarded_at != null);
  }, [session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsConfirmation: false };
    // If dashboard has "Confirm email" disabled, data.session is set immediately.
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        onboarded,
        signIn,
        signUp,
        signOut,
        refreshOnboarded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
