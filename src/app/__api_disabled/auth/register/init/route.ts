import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InitBody = {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  city?: string;
};

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function makeOTP(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
  return code;
}

function sha256(val: string) {
  return crypto.createHash("sha256").update(val).digest("hex");
}

async function sendOTPEmail(to: string, code: string) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const smtpSecure = (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
  const hasSMTP = Boolean(smtpHost && smtpUser && smtpPass);

  if (!hasSMTP) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM");
  }

  const subject = process.env.OTP_EMAIL_SUBJECT || "Your verification code";
  const from = process.env.SMTP_FROM || smtpUser!;
  const html = `
    <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6; color: #111">
      <h2>Verification Code</h2>
      <p>Your one-time code is:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 8px 0">${code}</div>
      <p>This code expires shortly. If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  let nodemailer: any;
  try {
    nodemailer = await import("nodemailer").then((m) => (m as any).default || m);
  } catch {
    throw new Error("SMTP library missing. Install 'nodemailer'.");
  }
  const build = (opts: any) => nodemailer.createTransport(opts);
  const primaryOpts = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  } as const;

  try {
    const transporter = build(primaryOpts);
    await transporter.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC });
    return { transport: "smtp", server: `${smtpHost}:${smtpPort}` };
  } catch (firstErr: any) {
    // Gmail-friendly fallback to STARTTLS 587
    if (String(smtpHost).includes("smtp.gmail.com")) {
      try {
        const fallbackOpts = {
          host: smtpHost,
          port: 587,
          secure: false,
          requireTLS: true,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { minVersion: "TLSv1.2" },
        };
        const transporter2 = build(fallbackOpts);
        await transporter2.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC });
        return { transport: "smtp", server: `${smtpHost}:587` };
      } catch (secondErr: any) {
        const msg = secondErr?.message || firstErr?.message || "SMTP send failed";
        throw new Error(msg);
      }
    }
    throw new Error(firstErr?.message || "SMTP send failed");
  }
}

async function getUserByEmailViaREST(email: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { ok: false, exists: null as boolean | null, error: "Supabase env missing" };
  const url = `${base.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
  if (res.status === 404) return { ok: true, exists: false };
  if (!res.ok) {
    return { ok: false, exists: null as boolean | null, error: `HTTP ${res.status}` };
  }
  // Some deployments return a single user object; others return {users:[...]}
  const j = await res.json().catch(() => null);
  const user = j?.user || j?.users?.[0] || (j?.id ? j : null);
  return { ok: true, exists: Boolean(user) };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InitBody;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    // We no longer block if email exists; verification proves ownership.
    // Duplicates are handled during verify by updating existing user.

    // Generate and persist OTP
    const otpLen = parseInt(process.env.OTP_LENGTH || "6", 10);
    const ttlSec = parseInt(process.env.OTP_TTL_SECONDS || "600", 10);
    const code = makeOTP(otpLen);
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = sha256(`${code}:${salt}`);
    const expires = new Date(Date.now() + ttlSec * 1000).toISOString();

    // Rate limit resend: ensure at least 60s between sends for same email
    const { data: existingPending } = await admin
      .from("pending_registrations")
      .select("email,last_sent_at")
      .eq("email", email)
      .maybeSingle();
    if (existingPending?.last_sent_at) {
      const last = new Date(existingPending.last_sent_at as unknown as string).getTime();
      if (Date.now() - last < 60_000) {
        return NextResponse.json({ error: "Please wait before requesting another code." }, { status: 429 });
      }
    }

    const { error: upsertErr } = await admin.from("pending_registrations").upsert(
      {
        email,
        otp_hash: hash,
        otp_salt: salt,
        expires_at: expires,
        attempts: 0,
        full_name: body.full_name || null,
        phone: body.phone || null,
        city: body.city || null,
        last_sent_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
    if (upsertErr) {
      return NextResponse.json({ error: `DB error: ${upsertErr.message}` }, { status: 500 });
    }

    // Send email
    const sendRes = await sendOTPEmail(email, code);

    return NextResponse.json({ ok: true, email, via: sendRes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
