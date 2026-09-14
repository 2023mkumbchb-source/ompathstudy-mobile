import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

/** Canonical public origin used for OAuth redirects (production must be the .com domain). */
export function canonicalOrigin(): string {
  if (typeof window === "undefined") return "https://www.ompathstudy.com";
  const host = window.location.hostname;
  if (host.endsWith("ompathstudy.com")) return "https://www.ompathstudy.com";
  return window.location.origin;
}

/** Accept only an internal path after OAuth; never preserve an external URL. */
export function safePostLoginPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

/**
 * Google sign-in for students, so subscriptions can be tied to an account.
 * In native Capacitor APK: uses in-app browser sheet and custom app scheme.
 * On web: uses standard redirect.
 */
export async function signInWithGoogle(): Promise<{ redirected?: boolean; error?: string }> {
  try {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // Use whitelisted canonical redirect that returns through our web handler back to ompathstudy://
      const redirectTo = `${canonicalOrigin()}/auth/callback?app_return=1`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) return { error: error.message };
      if (data?.url) {
        await Browser.open({ url: data.url, windowName: "_self" });
        return { redirected: true };
      }
      return { error: "Could not generate sign-in link." };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${canonicalOrigin()}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) return { error: error.message };
    return { redirected: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Google sign-in failed" };
  }
}
