import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const reqUrl = new URL(req.url);
    const rawEmail = reqUrl.searchParams.get("email");
    const email = rawEmail?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ exists: null });
    }

    // Use GoTrue Admin REST API for email lookup (supabase-js SDK lacks this helper)
    const adminUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
    const resp = await fetch(adminUrl, { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } });
    if (resp.status === 404) return NextResponse.json({ exists: false });
    if (!resp.ok) return NextResponse.json({ exists: null, error: `HTTP ${resp.status}` });
    const j = await resp.json().catch(() => null);
    const user = j?.user || j?.users?.[0] || (j?.id ? j : null);
    if (!user) return NextResponse.json({ exists: false });

    const meta = (user as any).app_metadata || {};
    let providers: string[] = [];
    if (Array.isArray(meta.providers)) providers = meta.providers as string[];
    else if (typeof meta.provider === "string") providers = [meta.provider];
    if (!providers.length && Array.isArray((user as any).identities)) {
      providers = (user as any).identities.map((i: any) => i.provider).filter(Boolean);
    }
    return NextResponse.json({ exists: true, providers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 500 });
  }
}
