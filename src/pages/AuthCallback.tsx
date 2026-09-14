import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safePostLoginPath } from "@/lib/social-auth";

/** Public landing page Google/OAuth returns to. Waits for the session, then continues. */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing sign-in…");
  const [isAppReturn, setIsAppReturn] = useState(false);
  const [appDeepLink, setAppDeepLink] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hasAppFlag =
      searchParams.get("app_return") === "1" || searchParams.get("app") === "true";
    const hash = window.location.hash;
    const search = window.location.search;

    const deepLink = `ompathstudy://auth/callback${search}${hash}`;
    setAppDeepLink(deepLink);

    // If initiated from mobile app or mobile device callback
    if (hasAppFlag || (hash && /Android|iPhone|iPad/i.test(navigator.userAgent))) {
      setIsAppReturn(true);
      setMessage("Returning to OmpathStudy app…");

      // Auto-bounce to the Android APK
      try {
        window.location.href = deepLink;
      } catch {}
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (!hasAppFlag) {
        const back = safePostLoginPath(sessionStorage.getItem("post_login_redirect"));
        sessionStorage.removeItem("post_login_redirect");
        navigate(back, { replace: true });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });

    const timer = setTimeout(() => {
      if (!done && !hasAppFlag) {
        setMessage("Sign-in did not complete. Returning to sign in…");
        navigate("/login", { replace: true });
      }
    }, 8000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isAppReturn && appDeepLink) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 mb-4 shadow-sm">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="text-xl font-bold font-serif text-foreground">
          Sign-In Verified!
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs leading-relaxed">
          Your account is confirmed. Returning to the OmpathStudy app...
        </p>

        <a
          href={appDeepLink}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <span>Tap to Return to OmpathStudy App</span>
          <ArrowRight className="h-4 w-4" />
        </a>

        <p className="mt-4 text-[11px] text-muted-foreground">
          If your phone does not switch back automatically, tap the button above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
