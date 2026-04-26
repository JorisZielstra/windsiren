import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request. Without this, a
// server-rendered page could see a stale session and render the wrong view
// after a token refresh.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: getUser() triggers a token refresh if needed. Do NOT put any
  // logic between createServerClient and getUser — the session rehydration
  // must happen first.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Onboarding guard: signed-in users with a null users.onboarded_at land
  // on /welcome until they finish (or skip) the flow. Auth and welcome
  // routes themselves are exempt so users can still sign in / sign out.
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/auth");
  const isWelcome = path === "/welcome";
  const isApiRoute = path.startsWith("/api");
  if (user && !isAuthRoute && !isApiRoute) {
    const { data: row } = await supabase
      .from("users")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle();
    const onboarded = row?.onboarded_at != null;
    if (!onboarded && !isWelcome) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/welcome";
      return NextResponse.redirect(dest);
    }
    if (onboarded && isWelcome) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/";
      return NextResponse.redirect(dest);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next internals + static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
