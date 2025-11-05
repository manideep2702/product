"use client";

import { SignInPage, Testimonial } from "@/components/ui/sign-in";
import { useAlert } from "@/components/ui/alert-provider";

const sampleTestimonials: Testimonial[] = [];

export default function Page() {
  const { show } = useAlert();
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const adminEmailEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value?.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value;
    if (!email || !password) {
      show({ title: "Missing details", description: "Please enter email and password.", variant: "warning" });
      return;
    }
    // 1) If the email matches configured admin email, try admin login
    if (adminEmailEnv && email.toLowerCase() === adminEmailEnv) {
      try {
        const adminRes = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (adminRes.ok) {
          window.location.assign("/admin");
          return;
        }
        // If admin login fails with matching email, show error and stop here
        const msg = await adminRes.json().catch(() => ({} as any));
        show({ title: "Admin sign-in failed", description: msg?.error || "Invalid admin credentials", variant: "error" });
        return;
      } catch {}
    }
    // 2) Otherwise continue with normal user sign-in.
    // Check if this email belongs to a Google-only account (if server key configured)
    try {
      const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
      if (r.ok) {
        const j = await r.json();
        if (j?.exists === true) {
          const providers: string[] = Array.isArray(j.providers) ? j.providers : [];
          const hasGoogle = providers.includes("google");
          const hasEmail = providers.includes("email");
          if (hasGoogle && !hasEmail) {
            // Inform but do not block; allow password attempt in case password was set later
            show({ title: "Google-linked email", description: "This email was previously used with Google. If password sign-in fails, use 'Continue with Google' or set a password via Sign Up/OTP or Forgot Password.", variant: "info", durationMs: 5000 });
          }
        }
      }
    } catch {}
    if (!hasSupabaseEnv) {
      show({ title: "Auth not configured", description: "Contact admin to configure Supabase.", variant: "warning" });
      return;
    }
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Friendly hint if account exists with Google
      const hint = /invalid login|invalid credentials|email not confirmed/i.test(error.message)
        ? "\nIf you previously used Google with this email, please use 'Continue with Google'."
        : "";
      show({ title: "Sign-in failed", description: error.message + hint, variant: "error", durationMs: 5000 });
      return;
    }
    // Ensure profile exists and decide destination
    try {
      const user = data.user;
      if (user) {
        const params = new URLSearchParams(window.location.search);
        const nextParam = params.get("next");
        const fullName = (user.user_metadata?.full_name || user.user_metadata?.name || "").toString();
        const payloadOptions = [
          { user_id: user.id, email: user.email ?? email, name: fullName, full_name: fullName },
          { id: user.id, email: user.email ?? email, name: fullName, full_name: fullName },
        ];
        for (const p of payloadOptions) {
          const res = await supabase.from("Profile-Table").upsert(p, { onConflict: Object.keys(p)[0] as any }).select("*");
          if (!res.error) break;
        }

        // Fetch profile to check if new/incomplete
        let { data: row } = await supabase
          .from("Profile-Table")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!row) {
          const second = await supabase
            .from("Profile-Table")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          row = second.data ?? null;
        }
        const displayName = (row?.name || row?.full_name || fullName || user.email || email || "").toString();
        // New vs existing: if a profile row exists, treat as existing
        const needsCompletion = !row;
        show({ title: "Welcome", description: `${displayName}`, variant: "success" });
        if (needsCompletion) {
          window.location.assign("/profile/edit");
        } else if (nextParam) {
          window.location.assign(nextParam);
        } else {
          window.location.assign("/");
        }
        return;
      }
    } catch {}

    // Fallback
    window.location.assign("/");
  };

  const handleGoogleSignIn = async () => {
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/"; // default to home page
      try { sessionStorage.setItem("ayya.auth.next", next); } catch {}
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
      const redirectTo = `${siteUrl}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });
      if (error) show({ title: "Sign-in failed", description: error.message, variant: "error" });
    } catch (e: any) {
      const msg = e?.message || "Auth not configured";
      show({ title: "Google sign-in unavailable", description: String(msg), variant: "warning" });
    }
  };

  const handleResetPassword = async () => {
    if (!hasSupabaseEnv) {
      show({ title: "Auth not configured", description: "Password reset is unavailable.", variant: "warning" });
      return;
    }
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseBrowserClient();
    const inputEl = document.querySelector('input[name="email"]') as HTMLInputElement | null;
    const email = inputEl?.value?.trim() || window.prompt("Enter your email for password reset") || "";
    if (!email) return;
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/update-password` });
    if (error) show({ title: "Reset failed", description: error.message, variant: "error" });
    else show({ title: "Reset link sent", description: "Check your inbox.", variant: "success" });
  };

  const handleCreateAccount = () => {
    window.location.assign("/sign-up");
  };

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        title={<span className="tracking-tight">Sree Sabari Sastha Seva Samithi (SSSSS)</span>}
        description={
          <span className="block text-sm">
            Sign in to manage donations, volunteer slots, and save favorites.
            <span className="mt-2 block text-xs text-amber-500/90">
              By continuing, you agree to our <a className="underline underline-offset-4 hover:text-amber-400" href="/terms">Terms & Conditions</a>.
            </span>
          </span>
        }
        heroImageSrc="/signin.jpeg"
        testimonials={sampleTestimonials}
        onSignIn={handleSignIn}
        onGoogleSignIn={handleGoogleSignIn}
        onResetPassword={handleResetPassword}
        onCreateAccount={handleCreateAccount}
      />
    </div>
  );
}
