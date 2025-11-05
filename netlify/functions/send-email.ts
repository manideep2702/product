import type { Handler } from "@netlify/functions";

type EmailBody = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const body = JSON.parse(event.body || "{}") as EmailBody;
    const toList = Array.isArray(body.to) ? body.to : [body.to];
    if (!toList.length || !body.subject) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'to' or 'subject'" }) };
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
    const smtpSecure = (process.env.SMTP_SECURE ?? "true").toLowerCase() === "true";
    if (!smtpHost || !smtpUser || !smtpPass) {
      return { statusCode: 500, body: JSON.stringify({ error: "SMTP not configured" }) };
    }

    const fromEmail = process.env.FROM_EMAIL || smtpUser;
    const fromName = process.env.FROM_NAME || "";
    const from = body.from || (fromName ? `${fromName} <${fromEmail}>` : fromEmail);

    // Lazy import to keep cold start smaller
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    } as any);

    await transporter.sendMail({
      from,
      to: toList,
      subject: body.subject,
      text: body.text,
      html: body.html,
      bcc: process.env.SMTP_BCC,
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: e?.message || "Internal error" }),
    };
  }
};



