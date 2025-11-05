"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        const adminEmailEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
        const ok = !!user && (!adminEmailEnv || (user.email || "").toLowerCase() === adminEmailEnv);
        if (!ok) {
          router.replace("/admin");
          return;
        }
        setChecking(false);
      } catch {
        router.replace("/admin");
      }
    })();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-sm text-muted-foreground">Verifying admin access…</p>
      </main>
    );
  }
  return <>{children}</>;
}


