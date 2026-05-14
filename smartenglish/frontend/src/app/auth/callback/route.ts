import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getPublicAppUrl } from "@/lib/app-url";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = getPublicAppUrl(requestUrl);
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  const providerErrorDescription = requestUrl.searchParams.get("error_description");

  if (providerError) {
    console.error("Supabase OAuth provider error", {
      error: providerError,
      description: providerErrorDescription,
    });
    return NextResponse.redirect(`${origin}/login?error=provider`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Supabase OAuth code exchange failed", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });
    const reason =
      error.code === "bad_code_verifier" ||
      error.message.toLowerCase().includes("code verifier")
        ? "pkce"
        : "oauth";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("Supabase OAuth callback exchanged code but no user was found");
    return NextResponse.redirect(`${origin}/login?error=session`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const destination = profile?.onboarding_completed
    ? `${origin}/dashboard`
    : `${origin}/onboarding`;
  return NextResponse.redirect(destination);
}
