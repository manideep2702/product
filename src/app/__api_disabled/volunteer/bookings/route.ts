import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionName = "Morning" | "Evening";

function seasonForNow(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const nov5 = new Date(y, 10, 5);
  const jan7Next = new Date(y + 1, 0, 7);
  if (m === 11 || m === 12 || (m === 1 && d <= 7)) {
    return { start: new Date(y, 10, 5), end: new Date(y + (m === 1 ? 0 : 1), 0, 7) };
  }
  if (now < nov5) return { start: nov5, end: jan7Next };
  return { start: nov5, end: jan7Next };
}

function parseISO(input: string) {
  // basic YYYY-MM-DD guard
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [y, m, d] = input.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

async function insertVolunteerBooking(row: Record<string, unknown>) {
  const admin = getSupabaseAdminClient();
  const tables = [
    // Prefer underscore table name if that is what exists in your DB
    "Volunteer_Bookings",
    // Other common variants (space or hyphen)
    "Volunteer Bookings",
    "Volunteer-Bookings",
    '"Volunteer Bookings"',
  ];
  let lastError: any = null;
  for (const t of tables) {
    try {
      const res = await admin.from(t as any).insert(row).select("*").single();
      if (!res.error) return res.data;
      lastError = res.error;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("Insert failed");
}

async function findExistingVolunteerBooking(dateStr: string, session: SessionName, user_id?: string, email?: string) {
  const admin = getSupabaseAdminClient();
  const tables = [
    "Volunteer_Bookings",
    "Volunteer Bookings",
    "Volunteer-Bookings",
    '"Volunteer Bookings"',
  ];
  for (const t of tables) {
    try {
      if (user_id) {
        const r1 = await admin
          .from(t as any)
          .select("id")
          .eq("date", dateStr)
          .eq("session", session)
          .eq("user_id", user_id)
          .limit(1)
          .maybeSingle();
        if (!r1.error && r1.data) return true;
      }
      if (email) {
        const r2 = await admin
          .from(t as any)
          .select("id")
          .eq("date", dateStr)
          .eq("session", session)
          .ilike("email", email)
          .limit(1)
          .maybeSingle();
        if (!r2.error && r2.data) return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function getSiteUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

async function sendVolunteerEmail(req: NextRequest, to: string, data: { name: string; date: string; session: SessionName; role: string }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const smtpSecure = (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
  const hasSMTP = Boolean(smtpHost && smtpUser && smtpPass);
  if (!hasSMTP) return { sent: false } as const;

  let nodemailer: any;
  try { nodemailer = await import("nodemailer").then((m) => (m as any).default || m); } catch { return { sent: false } as const; }

  const site = getSiteUrl(req) || "";
  const logoUrl = `${site}/logo.jpeg`;
  const brand = "Sree Sabari Sastha Seva Samithi";
  const subject = `Volunteer Request Received — ${data.date}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a; line-height:1.6">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img src="${logoUrl}" alt="${brand} logo" width="28" height="28" style="border-radius:50%; object-fit:cover; border:1px solid #e5e7eb" />
        <strong>${brand}</strong>
      </div>
      <h2 style="margin:14px 0 6px 0; font-size:18px;">Volunteer Request Received</h2>
      <p>Dear ${data.name || "Devotee"},</p>
      <p>Thank you for submitting your interest to volunteer. Here are your details:</p>
      <ul>
        <li><strong>Date:</strong> ${data.date}</li>
        <li><strong>Session:</strong> ${data.session}</li>
        <li><strong>Preferred Role:</strong> ${data.role}</li>
      </ul>
      <p>We appreciate your seva. Our team will get in touch if any further details are required.</p>
      <p>Swamiye Saranam Ayyappa</p>
    </div>
  `;

  const from = process.env.SMTP_FROM || smtpUser!;
  const build = (opts: any) => nodemailer.createTransport(opts);
  try {
    const transporter = build({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC });
    return { sent: true } as const;
  } catch {
    try {
      if (String(smtpHost).includes("smtp.gmail.com")) {
        const transporter2 = build({ host: smtpHost, port: 587, secure: false, requireTLS: true, auth: { user: smtpUser, pass: smtpPass }, tls: { minVersion: "TLSv1.2" } });
        await transporter2.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC });
        return { sent: true } as const;
      }
    } catch {}
    return { sent: false } as const;
  }
}

async function listVolunteerBookings(params: { limit?: number; from?: string; to?: string }) {
  const admin = getSupabaseAdminClient();
  const { limit = 50, from, to } = params;
  const tables = [
    "Volunteer_Bookings",
    "Volunteer Bookings",
    "Volunteer-Bookings",
    '"Volunteer Bookings"',
  ];
  let lastError: any = null;
  for (const t of tables) {
    try {
      let q = admin.from(t as any).select("*").order("timestamp", { ascending: false }).limit(limit);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const res = await q;
      if (!res.error) return res.data || [];
      lastError = res.error;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("Query failed");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body?.name || "").toString().trim();
    const email = (body?.email || "").toString().trim();
    const phone = (body?.phone || "").toString().trim();
    const dateStr = (body?.date || "").toString().trim();
    const session = (body?.session || "").toString().trim() as SessionName;
    const role = (body?.role || "Annadanam Service").toString().trim();
    const note = (body?.note || "").toString().trim();
    const user_id = body?.user_id ? (body.user_id as string) : undefined;

    if (!name || !email || !phone || !dateStr || !session) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (session !== "Morning" && session !== "Evening") {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
    const date = parseISO(dateStr);
    if (!date) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const { start, end } = seasonForNow(new Date());
    if (date < start || date > end) {
      return NextResponse.json({ error: "Date out of season (Nov 5 – Jan 7)" }, { status: 400 });
    }

    // Prevent duplicate booking for same date+session
    const dup = await findExistingVolunteerBooking(dateStr, session, user_id, email);
    if (dup) {
      return NextResponse.json({ error: "You have already booked this session." }, { status: 409 });
    }

    const payload: Record<string, unknown> = {
      name,
      email,
      phone,
      date: dateStr,
      session,
      role,
      note: note || null,
      user_id: user_id || null,
      timestamp: new Date().toISOString(),
    };

    const inserted = await insertVolunteerBooking(payload);
    try { await sendVolunteerEmail(req, email, { name, date: dateStr, session, role }); } catch {}
    return NextResponse.json({ ok: true, booking: inserted });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdminAuthed()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const from = searchParams.get("from") || undefined; // YYYY-MM-DD
    const to = searchParams.get("to") || undefined; // YYYY-MM-DD
    const data = await listVolunteerBookings({ limit, from, to });
    return NextResponse.json({ ok: true, items: data });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
