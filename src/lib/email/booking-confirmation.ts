import nodemailer from "nodemailer";

export type BookingType = "Annadanam" | "Pooja" | "Donation" | "Volunteer";

export interface BookingConfirmationInput {
  name: string;
  email: string;
  bookingType: BookingType;
  date: string; // YYYY-MM-DD or formatted
  slot: string; // e.g., "10:30 AM" or session label
  bookingId: string;
}

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = true; // Force SSL for port 465
  if (!host || !user || !pass) {
    throw new Error("Missing SMTP env vars. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT.");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
  } as any);
}

function buildHtml(input: BookingConfirmationInput) {
  const brand = process.env.FROM_NAME || "Sabari Sastha Seva Samithi";
  const headerColor = "#f97316"; // tailwind orange-500
  return (
    `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;line-height:1.6">
      <div style="background:${headerColor};color:white;padding:14px 16px;border-radius:10px 10px 0 0">
        <strong style="font-size:16px">${brand}</strong>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:16px">
        <h2 style="margin:0 0 10px;font-size:18px">Booking Confirmation - ${input.bookingType} #${input.bookingId}</h2>
        <p>Dear ${input.name || "Devotee"},</p>
        <p>Thank you for your ${input.bookingType} booking at ${brand}.</p>
        <table style="border-collapse:collapse;width:100%;margin:10px 0 14px">
          <tbody>
            <tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa;width:160px"><strong>Booking Type</strong></td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${input.bookingType}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Booking ID</strong></td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${input.bookingId}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Name</strong></td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${input.name}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Email</strong></td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${input.email}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Date</strong></td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${input.date}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Slot</strong></td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${input.slot}</td>
            </tr>
          </tbody>
        </table>
        <p>May Lord Ayyappa bless you abundantly!</p>
        <p>Regards,<br/>${brand}</p>
      </div>
    </div>
    `
  );
}

function buildText(input: BookingConfirmationInput) {
  return (
    `Booking Confirmation - ${input.bookingType} #${input.bookingId}\n\n` +
    `Dear ${input.name},\n\n` +
    `Thank you for your ${input.bookingType} booking at Sabari Sastha Seva Samithi.\n\n` +
    `Details:\n` +
    `- Date: ${input.date}\n` +
    `- Slot: ${input.slot}\n` +
    `- Booking ID: ${input.bookingId}\n\n` +
    `May Lord Ayyappa bless you abundantly!\n\n` +
    `Regards,\nSabari Sastha Seva Samithi\n`
  );
}

export async function sendBookingConfirmation(input: BookingConfirmationInput): Promise<{ ok: boolean; id?: string; error?: string; }> {
  const brand = process.env.FROM_NAME || "Sabari Sastha Seva Samithi";
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@example.com";
  const bcc = process.env.SMTP_BCC;
  const subject = `Booking Confirmation - ${input.bookingType} #${input.bookingId}`;
  // RFC5322 Message-ID: must be globally unique and enclosed in <>
  const hostPart = (fromEmail.split("@")[1] || "sabarisastha.org").trim();
  const messageId = `<${input.bookingId}.${Date.now()}@${hostPart}>`;

  try {
    const transporter = buildTransport();
    const info = await transporter.sendMail({
      from: `${brand} <${fromEmail}>`,
      to: input.email,
      subject,
      text: buildText(input),
      html: buildHtml(input),
      headers: { "Message-ID": messageId },
      bcc,
    } as any);
    // eslint-disable-next-line no-console
    console.log("Booking email sent:", { messageId: info?.messageId, bookingId: input.bookingId, type: input.bookingType });
    return { ok: true, id: info?.messageId };
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("Booking email failed:", { error: e?.message || String(e), bookingId: input.bookingId, type: input.bookingType });
    return { ok: false, error: e?.message || String(e) };
  }
}



