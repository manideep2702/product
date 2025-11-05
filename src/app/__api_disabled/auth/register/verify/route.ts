import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = {
  email: string;
  code: string;
  password: string; // resubmitted on verify to avoid storing plaintext
};

function sha256(val: string) {
  return crypto.createHash("sha256").update(val).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VerifyBody;
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const password = String(body.password || "");
    if (!email || !code || !password) {
      return NextResponse.json({ error: "email, code, and password required" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: pending, error: selErr } = await admin
      .from("pending_registrations")
      .select("email, otp_hash, otp_salt, expires_at, attempts, full_name, phone, city")
      .eq("email", email)
      .maybeSingle();
    if (selErr) {
      return NextResponse.json({ error: `DB error: ${selErr.message}` }, { status: 500 });
    }
    if (!pending) {
      return NextResponse.json({ error: "No pending registration found" }, { status: 404 });
    }

    // Check attempts and expiry
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);
    if ((pending.attempts as number) >= maxAttempts) {
      return NextResponse.json({ error: "Too many attempts. Please restart registration." }, { status: 429 });
    }
    const exp = new Date(pending.expires_at as unknown as string).getTime();
    if (Date.now() > exp) {
      // Clean up expired
      await admin.from("pending_registrations").delete().eq("email", email);
      return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 410 });
    }

    const expected = String(pending.otp_hash || "");
    const salt = String(pending.otp_salt || "");
    const got = sha256(`${code}:${salt}`);
    const ok = expected && got && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
    if (!ok) {
      await admin
        .from("pending_registrations")
        .update({ attempts: (pending.attempts as number) + 1 })
        .eq("email", email);
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    // Create user in Supabase (email confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: pending.full_name || undefined,
        phone: pending.phone || undefined,
        city: pending.city || undefined,
      },
    });
    let userId = created?.user?.id || null;
    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      const already = msg.includes("registered") || msg.includes("exists") || msg.includes("duplicate");
      if (!already) {
        return NextResponse.json({ error: createErr.message }, { status: 400 });
      }
      // If a user already exists for this email, fetch and update password + confirm email
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!base || !key) return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
      const url = `${base.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
      if (!resp.ok) return NextResponse.json({ error: `Lookup failed: HTTP ${resp.status}` }, { status: 500 });
      const j = await resp.json().catch(() => null);
      const user = j?.user || j?.users?.[0] || (j?.id ? j : null);
      const id = user?.id as string | undefined;
      if (!id) return NextResponse.json({ error: "Existing user not found by email" }, { status: 500 });
      const { error: updErr } = await admin.auth.admin.updateUserById(id, {
        password,
        email_confirm: true,
        user_metadata: {
          full_name: pending.full_name || undefined,
          phone: pending.phone || undefined,
          city: pending.city || undefined,
        },
      });
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
      userId = id;
    }

    await admin.from("pending_registrations").delete().eq("email", email);

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
