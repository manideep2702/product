import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MailAttachment = { filename: string; content: Buffer; contentType?: string };

async function sendSMTP({ to, subject, html, attachments }: { to: string; subject: string; html: string; attachments?: MailAttachment[] }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const smtpSecure = (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS");
  }
  const from = process.env.SMTP_FROM || smtpUser;

  const nodemailer = (await import("nodemailer")).default as any;
  const primary = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  } as const;
  try {
    const transporter = nodemailer.createTransport(primary);
    return await transporter.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC, attachments });
  } catch (err) {
    if (String(smtpHost).includes("smtp.gmail.com")) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { minVersion: "TLSv1.2" },
      });
      return await transporter.sendMail({ from, to, subject, html, bcc: process.env.SMTP_BCC, attachments });
    }
    throw err;
  }
}

function htmlEscape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const address = String(form.get("address") || "").trim();
    const amountStr = String(form.get("amount") || "").trim();
    const screenshot = form.get("screenshot");
    const pan = form.get("pan");

    const amount = parseInt(amountStr, 10);
    if (!name || !email || !phone || !Number.isFinite(amount) || amount <= 0 || !(screenshot instanceof File) || !(pan instanceof File)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const shotArrayBuf = await (screenshot as File).arrayBuffer();
    const shotBuf = Buffer.from(shotArrayBuf);
    const panArrayBuf = await (pan as File).arrayBuffer();
    const panBuf = Buffer.from(panArrayBuf);
    const stamp = new Date();
    const whenIST = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(stamp);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    const userAgent = req.headers.get("user-agent") || "";

    // Build emails
    const orgName = process.env.ORG_NAME || "Sabari Sastha Samithi";
    const adminEmail = process.env.DONATION_ADMIN_EMAIL || "info@sabarisastha.org";

    const userSubject = `${orgName} — Donation Received`;
    const userHtml = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111;">
        <h2 style="margin: 0 0 12px;">Thank you for your donation!</h2>
        <p>Dear ${htmlEscape(name)},</p>
        <p>We have received your donation details.</p>
        <ul>
          <li><strong>Amount:</strong> ₹${amount.toLocaleString("en-IN")}</li>
          <li><strong>Date:</strong> ${whenIST} (IST)</li>
          <li><strong>Email:</strong> ${htmlEscape(email)}</li>
          <li><strong>Phone:</strong> ${htmlEscape(phone)}</li>
          ${address ? `<li><strong>Address:</strong> ${htmlEscape(address)}</li>` : ""}
        </ul>
        <p>We will verify the payment and share a GST-compliant invoice to your email within 3–5 working days.</p>
        <p>Warm regards,<br/>${orgName}</p>
      </div>
    `;

    const adminSubject = `${orgName} — New Donation: ₹${amount.toLocaleString("en-IN")} from ${name}`;
    const adminHtml = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111;">
        <h2 style="margin: 0 0 12px;">New Donation Submission</h2>
        <ul>
          <li><strong>Name:</strong> ${htmlEscape(name)}</li>
          <li><strong>Email:</strong> ${htmlEscape(email)}</li>
          <li><strong>Phone:</strong> ${htmlEscape(phone)}</li>
          <li><strong>Amount:</strong> ₹${amount.toLocaleString("en-IN")}</li>
          <li><strong>Date:</strong> ${whenIST} (IST)</li>
          ${address ? `<li><strong>Address:</strong> ${htmlEscape(address)}</li>` : ""}
        </ul>
        <p>Payment screenshot attached.</p>
      </div>
    `;

    const attachments: MailAttachment[] = [
      { filename: `payment_screenshot_${Date.now()}.png`, content: shotBuf, contentType: (screenshot as File).type || "image/png" },
      { filename: `pan_${Date.now()}.png`, content: panBuf, contentType: (pan as File).type || "image/png" },
    ];

    // Persist to Supabase: upload screenshot and insert donation row
    let storage_bucket: string | null = null;
    let storage_path: string | null = null;
    let pan_bucket_ref: string | null = null;
    let pan_path_ref: string | null = null;
    try {
      const admin = getSupabaseAdminClient();
      storage_bucket = "donations";
      // Ensure bucket exists (ignore if already exists)
      try {
        await admin.storage.createBucket(storage_bucket, { public: false, fileSizeLimit: "5242880" });
      } catch {}
      const origName = (screenshot as File).name || "screenshot.png";
      const safeExt = ((origName.split(".").pop() || "png").toLowerCase()).replace(/[^a-z0-9]/g, "");
      const fileExt = safeExt || ((screenshot as File).type?.split("/").pop() || "png");
      const key = `screenshots/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const up = await admin.storage.from(storage_bucket).upload(key, shotBuf, { contentType: (screenshot as File).type || "image/png", upsert: false });
      if (!up.error) storage_path = key;

      // Upload PAN to its dedicated bucket
      const pan_bucket = process.env.DONATION_PAN_BUCKET || "pan";
      try {
        await admin.storage.createBucket(pan_bucket, { public: false, fileSizeLimit: "5242880" });
      } catch {}
      const panKey = `uploads/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${Math.random().toString(36).slice(2)}.${(pan as File).type?.split("/").pop() || "png"}`;
      const upPan = await admin.storage.from(pan_bucket).upload(panKey, panBuf, { contentType: (pan as File).type || "image/png", upsert: false });
      if (!upPan.error) { pan_bucket_ref = pan_bucket; pan_path_ref = panKey; }

      // Insert row
      const insert = await admin
        .from("donations")
        .insert({
          name,
          email,
          phone,
          address,
          amount,
          storage_bucket,
          storage_path,
          pan_bucket: pan_bucket_ref,
          pan_path: pan_path_ref,
          submitted_ip: ip,
          user_agent: userAgent,
          status: "submitted",
        })
        .select("*")
        .single();
      if (insert.error) {
        // If table missing, return a helpful error
        if (/relation .* does not exist/i.test(insert.error.message)) {
          return NextResponse.json({
            error: "Missing donations table. Create it using supabase/donations.sql in your project.",
          }, { status: 400 });
        }
        // Non-fatal; continue with email send, but inform client
        console.error("Failed to insert donation row:", insert.error);
      }
    } catch (e) {
      // If Supabase is not configured, continue with email-only path
      console.warn("Supabase not configured or failed while saving donation:", (e as any)?.message || e);
    }

    await sendSMTP({ to: email, subject: userSubject, html: userHtml });
    await sendSMTP({ to: adminEmail, subject: adminSubject, html: adminHtml, attachments });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/donations/submit error", err);
    return new NextResponse(err?.message || "Internal error", { status: 500 });
  }
}
