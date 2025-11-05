"use client";

import { useEffect, Suspense } from "react";
import { useAlert } from "@/components/ui/alert-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { show } = useAlert();

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      // Guard against React StrictMode double-invocation in dev by memoizing the handled code
      const guardKey = code ? `ayya.oauth.exchange:${code}` : null;
      if (guardKey) {
        try {
          if (sessionStorage.getItem(guardKey)) {
            // Already handled this authorization code; route based on existing session/profile
            const supa = getSupabaseBrowserClient();
            const { data: sess } = await supa.auth.getSession();
            if (sess?.session) {
              // Decide destination as usual
              const p = params.get("next") || "/";
              router.replace(p);
              return;
            }
          } else {
            sessionStorage.setItem(guardKey, "1");
          }
        } catch {}
      }
      const errFromIdP = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (errFromIdP) {
        const msg = String(errFromIdP);
        // Auto-retry once if flow state was lost (common in dev or after restarts)
        if (/flow state not found/i.test(msg)) {
          try {
            const retryKey = "ayya.oauth.retry";
            const alreadyRetried = sessionStorage.getItem(retryKey) === "1";
            if (!alreadyRetried) {
              sessionStorage.setItem(retryKey, "1");
              const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
              const redirectTo = `${siteUrl}/auth/callback`;
              await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } });
              return; // browser navigates away
            } else {
              sessionStorage.removeItem(retryKey);
            }
          } catch {}
        }
        console.error("IdP error:", errFromIdP);
        show({ title: "Sign-in failed", description: msg, variant: "error", durationMs: 4500 });
        router.replace("/sign-in");
        return;
      }
      // If there's no code and we already have a session, decide based on profile
      const { data: existing } = await supabase.auth.getSession();
      const decideDestWithExistingSession = async (fallbackNext: string) => {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) return "/sign-in";
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
        const needsCompletion = !row;
        return needsCompletion ? "/profile/edit" : (params.get("next") || fallbackNext);
      };
      if (!code) {
        if (existing?.session) {
          const dest = await decideDestWithExistingSession("/");
          router.replace(dest);
          return;
        }
        // No code – likely direct navigation or redirect mismatch
        router.replace("/sign-in");
        return;
      }
      // Avoid double-exchange in dev StrictMode: if session already exists, skip exchange
      if (existing?.session) {
        const dest = await decideDestWithExistingSession("/");
        router.replace(dest);
        return;
      }

      // Post-exchange handling: ensure profile row and route
      const runPostExchange = async () => {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        let next = params.get("next") || "/";
        try {
          const storedNext = sessionStorage.getItem("ayya.auth.next");
          if (storedNext) {
            next = storedNext;
            sessionStorage.removeItem("ayya.auth.next");
          }
        } catch {}
        if (!user) {
          router.replace("/sign-in");
          return;
        }

        let needsCompletion = false;
        try {
          const email = user.email ?? "";
          const fullName = (user.user_metadata?.full_name || user.user_metadata?.name || "").toString();
          const avatar = (user.user_metadata?.avatar_url || "").toString();

          const payloadOptions = [
            { user_id: user.id, email, name: fullName, full_name: fullName, avatar_url: avatar },
            { id: user.id, email, name: fullName, full_name: fullName, avatar_url: avatar },
          ];
          let upserted = false;
          for (const payload of payloadOptions) {
            const res = await supabase.from("Profile-Table").upsert(payload, { onConflict: Object.keys(payload)[0] as any }).select("*");
            if (!res.error) { upserted = true; break; }
          }
          if (!upserted) console.warn("Upsert into Profile-Table failed; check schema/policies.");

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
          try {
            const currentAvatar: string = (row?.avatar_url || row?.image_url || "") as string;
            const fromGoogle = avatar && /googleusercontent\.com/i.test(avatar);
            const alreadyUploaded = currentAvatar && /supabase\.co\//i.test(currentAvatar);
            if (fromGoogle && !alreadyUploaded) {
              const resp = await fetch(avatar);
              if (resp.ok) {
                const blob = await resp.blob();
                const ext = (blob.type?.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
                const path = `avatars/${user.id}-oauth-${Date.now()}.${ext}`;
                const up = await supabase.storage
                  .from("avatars")
                  .upload(path, blob, { upsert: false, contentType: blob.type || "image/jpeg", cacheControl: "3600" });
                if (!up.error) {
                  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
                  if (pub?.publicUrl) {
                    const key = row?.user_id ? "user_id" : "id";
                    await supabase
                      .from("Profile-Table")
                      .update({ avatar_url: pub.publicUrl, image_url: pub.publicUrl })
                      .eq(key as any, user.id);
                    try { await supabase.from("profile_photos").insert({ user_id: user.id, url: pub.publicUrl }); } catch {}
                  }
                }
              }
            }
          } catch (e) {
            console.warn("Avatar upload skipped:", (e as Error)?.message || e);
          }

          needsCompletion = !row;
        } catch (e) {
          console.warn("Profile upsert skipped:", e);
        }

        try {
          const displayName = (row?.name || row?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email || "").toString();
          show({ title: "Welcome", description: `${displayName}`, variant: "success" });
        } catch {}
        router.replace(needsCompletion ? "/profile/edit" : next);
      };
      // Rely on supabase-js auto exchange (detectSessionInUrl: true)
      // If session isn't ready yet, wait for auth state change
      const { data: after } = await supabase.auth.getSession();
      if (!after?.session) {
        const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
          if (sess?.user) {
            // kick the flow again now that we have a session
            runPostExchange();
          }
        });
        // Safety timeout: allow more time on first login (slow networks/new accounts)
        setTimeout(() => {
          try { sub.subscription.unsubscribe(); } catch {}
          router.replace("/sign-in");
        }, 30000);
        return;
      }
      await runPostExchange();
    };
    run();
  }, [router, params]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground">
      Completing sign-in…
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </main>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
