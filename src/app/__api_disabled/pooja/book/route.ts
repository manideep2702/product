import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const START = new Date(Date.UTC(2025, 10, 6)); // 2025-11-06 UTC midnight
const END = new Date(Date.UTC(2026, 0, 7));    // 2026-01-07 UTC midnight

function parseISODate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function getSiteUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  try { const u = new URL(req.url); return `${u.protocol}//${u.host}`; } catch { return ""; }
}

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const smtpSecure = (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
  const hasSMTP = Boolean(smtpHost && smtpUser && smtpPass);
  if (!hasSMTP) return { sent: false } as const;
  const from = process.env.SMTP_FROM || smtpUser!;
  let nodemailer: any;
  try { nodemailer = await import("nodemailer").then((m) => (m as any).default || m); } catch { return { sent: false } as const; }
  const build = (opts: any) => nodemailer.createTransport(opts);
  try {
    const tx = build({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } });
    await tx.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC });
    return { sent: true } as const;
  } catch {
    try {
      if (String(smtpHost).includes("smtp.gmail.com")) {
        const tx2 = build({ host: smtpHost, port: 587, secure: false, requireTLS: true, auth: { user: smtpUser, pass: smtpPass }, tls: { minVersion: "TLSv1.2" } });
        await tx2.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC });
        return { sent: true } as const;
      }
    } catch {}
    return { sent: false } as const;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const spouse_name = String(body?.spouse_name || "").trim();
    const children_names = String(body?.children_names || "").trim() || null;
    const nakshatram = String(body?.nakshatram || "").trim();
    const gothram = String(body?.gothram || "").trim();
    const date = String(body?.date || "").trim(); // YYYY-MM-DD
    const session = String(body?.session || "").trim(); // '10:30 AM' | '6:30 PM'
    const user_id = String(body?.user_id || "").trim() || null;

    if (!name || !email || !date || !session || !phone || !spouse_name || !nakshatram || !gothram) {
      return NextResponse.json({ error: "Missing required fields (name, email, phone, spouse_name, nakshatram, gothram, date, session)" }, { status: 400 });
    }
    if (session !== "10:30 AM" && session !== "6:30 PM") {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
    const dt = parseISODate(date);
    if (!dt) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    if (dt < START || dt > END) {
      return NextResponse.json({ error: "Date out of window (Nov 6, 2025 – Jan 7, 2026)" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    // Ensure table exists in case SQL wasn't run yet
    try {
      await admin.rpc("noop");
    } catch {}
    let res = await admin
      .from("Pooja-Bookings" as any)
      .insert({ name, email, phone, date, session, user_id, spouse_name, children_names, nakshatram, gothram })
      .select("*")
      .single();
    if (res.error) {
      // Fallback if new columns are not present yet
      res = await admin
        .from("Pooja-Bookings" as any)
        .insert({ name, email, phone, date, session, user_id })
        .select("*")
        .single();
      if (res.error) throw res.error;
    }

    const site = getSiteUrl(req);
    const logoUrl = `${site}/logo.jpeg`;
    const brand = "Sree Sabari Sastha Seva Samithi";
    const subjectUser = `Pooja Booking Confirmed — ${date} • ${session}`;
    const htmlUser = `
      <div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;line-height:1.6\">
        <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:8px\">
          <img src=\"${logoUrl}\" alt=\"${brand} logo\" width=\"28\" height=\"28\" style=\"border-radius:50%;object-fit:cover;border:1px solid #e5e7eb\" />
          <strong>${brand}</strong>
        </div>
        <h2 style=\"margin:14px 0 6px 0;font-size:18px\">Pooja Booking Confirmed</h2>
        <p>Dear ${name || "Devotee"},</p>
        <p>Your pooja booking has been received.</p>
        <ul>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Session:</strong> ${session}</li>
          ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ""}
          ${spouse_name ? `<li><strong>Spouse:</strong> ${spouse_name}</li>` : ""}
          ${children_names ? `<li><strong>Children:</strong> ${children_names}</li>` : ""}
          ${nakshatram ? `<li><strong>Nakshatram:</strong> ${nakshatram}</li>` : ""}
          ${gothram ? `<li><strong>Gothram:</strong> ${gothram}</li>` : ""}
        </ul>
        <p>Swamiye Saranam Ayyappa</p>
      </div>`;

    const adminTo = process.env.SMTP_ADMIN_TO || process.env.SMTP_USER || process.env.SMTP_FROM || email;
    const subjectAdmin = `New Pooja Booking — ${date} • ${session}`;
    const htmlAdmin = `
      <div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;line-height:1.6\">
        <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:8px\">
          <img src=\"${logoUrl}\" alt=\"${brand} logo\" width=\"28\" height=\"28\" style=\"border-radius:50%;object-fit:cover;border:1px solid #e5e7eb\" />
          <strong>${brand}</strong>
        </div>
        <h2 style=\"margin:14px 0 6px 0;font-size:18px\">New Pooja Booking</h2>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ""}
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Session:</strong> ${session}</li>
          ${spouse_name ? `<li><strong>Spouse:</strong> ${spouse_name}</li>` : ""}
          ${children_names ? `<li><strong>Children:</strong> ${children_names}</li>` : ""}
          ${nakshatram ? `<li><strong>Nakshatram:</strong> ${nakshatram}</li>` : ""}
          ${gothram ? `<li><strong>Gothram:</strong> ${gothram}</li>` : ""}
        </ul>
      </div>`;

    try { await sendEmail({ to: email, subject: subjectUser, html: htmlUser }); } catch {}
    try { await sendEmail({ to: adminTo, subject: subjectAdmin, html: htmlAdmin }); } catch {}

    return NextResponse.json({ ok: true, booking: res.data });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
