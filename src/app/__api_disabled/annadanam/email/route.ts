import { NextRequest, NextResponse } from "next/server";
// SMTP only (Gmail). nodemailer loaded dynamically when needed.

// Ensure Node.js runtime (resend SDK depends on Node APIs)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // SMTP config (required)
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
    const smtpSecure = (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
    const hasSMTP = Boolean(smtpHost && smtpUser && smtpPass);

    const { to, name, date, session, qty, phone } = await req.json();
    if (!to || !date || !session || !qty) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const from = process.env.SMTP_FROM || smtpUser || "no-reply@example.com";
    const subject = `Annadanam Booking Confirmed — ${date}`;
    const labels: Record<string, string> = {
      Morning: "Nitya Anna Samaradhana",
      Evening: "Nitya Alpahara Samaradhana",
    };
    const pretty = labels[session] || session;
    const html = `
      <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6; color: #111">
        <h2>Annadanam Booking Confirmation</h2>
        <p>Dear ${name || "Devotee"},</p>
        <p>Thank you for your booking. Here are your details:</p>
        <ul>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Timing:</strong> ${pretty}</li>
          <li><strong>Quantity:</strong> ${qty}</li>
          ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ""}
        </ul>
        <p>We look forward to your participation.</p>
        <p>Swamiye Saranam Ayyappa</p>
      </div>
    `;

    // SMTP (Gmail) only
    if (hasSMTP) {
      const smtpFrom = process.env.SMTP_FROM || smtpUser!;
      let nodemailer: any;
      try {
        nodemailer = await import("nodemailer").then((m) => (m as any).default || m);
      } catch (e: any) {
        // Clear message when nodemailer isn't installed on the host
        return NextResponse.json({ error: "SMTP library missing. Install 'nodemailer' on the server (npm i nodemailer)." }, { status: 500 });
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
        const info = await transporter.sendMail({ from: smtpFrom, to, subject, html, bcc: process.env.SMTP_BCC });
        return NextResponse.json({ ok: true, id: info.messageId, transport: "smtp", server: `${smtpHost}:${smtpPort}` });
      } catch (firstErr: any) {
        console.error("SMTP send error (primary)", firstErr?.message || firstErr);
        // Gmail-friendly fallback: try STARTTLS on 587 if primary (e.g., 465) fails
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
            const info2 = await transporter2.sendMail({ from: smtpFrom, to, subject, html, bcc: process.env.SMTP_BCC });
            return NextResponse.json({ ok: true, id: info2.messageId, transport: "smtp", server: `${smtpHost}:587` });
          } catch (secondErr: any) {
            console.error("SMTP send error (fallback)", secondErr?.message || secondErr);
          }
        }
      }
    }
    // If we got here, SMTP isn't configured or failed
    if (!hasSMTP) {
      return NextResponse.json({ error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optional SMTP_FROM)." }, { status: 500 });
    }
    return NextResponse.json({ error: "SMTP send failed" }, { status: 502 });
  } catch (e: any) {
    console.error("/api/annadanam/email handler error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
