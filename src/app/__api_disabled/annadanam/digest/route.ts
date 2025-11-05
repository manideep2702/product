import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Window = "afternoon" | "evening";

const AFTERNOON_SESSIONS = [
  "1:00 PM - 1:30 PM",
  "1:30 PM - 2:00 PM",
  "2:00 PM - 2:30 PM",
  "2:30 PM - 3:00 PM",
] as const;

const EVENING_SESSIONS = [
  "8:00 PM - 8:30 PM",
  "8:30 PM - 9:00 PM",
  "9:00 PM - 9:30 PM",
  "9:30 PM - 10:00 PM",
] as const;

function todayInIST(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA gives YYYY-MM-DD
  return fmt.format(new Date());
}

function formatIST(ts: string | number | Date): string {
  try {
    const d = new Date(ts);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return `${date} ${time} IST`;
  } catch {
    return String(ts);
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

function buildDigestHTML(opts: {
  date: string;
  window: Window;
  rows: Array<{ name: string; email: string; phone: string | null; qty: number; session: string; created_at: string }>;
}) {
  const { date, window, rows } = opts;
  const title = `Annadanam Bookings — ${date} — ${window === "afternoon" ? "Afternoon" : "Evening"}`;
  const order = window === "afternoon" ? [...AFTERNOON_SESSIONS] : [...EVENING_SESSIONS];
  const bySession = new Map<string, typeof rows>();
  for (const s of order) bySession.set(s, []);
  for (const r of rows) {
    const list = bySession.get(r.session) || [];
    list.push(r);
    bySession.set(r.session, list);
  }
  const totalQty = rows.reduce((a, b) => a + (b.qty || 0), 0);

  // Build HTML table
  const sectionTables = order.map((s) => {
    const list = (bySession.get(s) || []).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const sectionTotal = list.reduce((a, b) => a + (b.qty || 0), 0);
    const rowsHtml = list
      .map((r, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${htmlEscape(r.name || "")}</td>
          <td>${htmlEscape(r.email || "")}</td>
          <td>${r.phone ? htmlEscape(r.phone) : ""}</td>
          <td class="num">${r.qty}</td>
          <td class="muted">${formatIST(r.created_at)}</td>
        </tr>
      `)
      .join("");
    return `
      <h3 class="section">${s}</h3>
      <table class="grid">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th class="num">Qty</th>
            <th>Booked At</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="6" class="muted">No bookings</td></tr>`}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="right"><strong>Subtotal</strong></td>
            <td class="num"><strong>${sectionTotal}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }).join("\n");

  return `
  <div class="wrap">
    <h2>${title}</h2>
    <p class="muted">This is an automated digest. Totals reflect confirmed bookings in the Bookings table.</p>
    ${sectionTables}
    <p class="total">Grand Total Qty: <strong>${totalQty}</strong></p>
  </div>
  <style>
    .wrap { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; }
    h2 { margin: 0 0 12px; }
    .section { margin: 18px 0 8px; font-size: 14px; }
    .grid { border-collapse: collapse; width: 100%; font-size: 13px; }
    .grid th, .grid td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
    .grid th.num, .grid td.num { text-align: right; width: 60px; }
    .grid thead th { background: #f8fafc; }
    .muted { color: #6b7280; }
    .right { text-align: right; }
    .total { margin-top: 16px; }
  </style>
  `;
}

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

  // Lazy import nodemailer to keep edge-compat elsewhere
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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

async function buildDigestPDF(opts: {
  date: string;
  window: Window;
  rows: Array<{ name: string; email: string; phone: string | null; qty: number; session: string; created_at: string }>;
}) {
  const { date, window, rows } = opts;
  const title = `Annadanam Bookings — ${date} — ${window === "afternoon" ? "Afternoon" : "Evening"}`;
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const margin = 40;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const baseSize = 10;
  const headerSize = 11;
  const rowPaddingX = 6;
  const rowPaddingY = 6;

  const innerWidth = 595.28 - margin * 2; // A4 width - margins
  const columns = [
    { key: "session", label: "Session", width: 135 },
    { key: "name", label: "Name", width: 150 },
    { key: "email", label: "Email", width: 150 },
    { key: "phone", label: "Phone", width: 70 },
    { key: "qty", label: "Qty", width: 30 },
    { key: "created_at", label: "Booked At (IST)", width: 100 },
  ];
  // Normalize widths to fit page
  const sum = columns.reduce((s, c) => s + c.width, 0);
  const scale = innerWidth / sum;
  if (Math.abs(1 - scale) > 0.01) columns.forEach((c) => (c.width = Math.floor(c.width * scale)));

  function wrap(text: string, width: number) {
    if (!text) return [""];
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const cand = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(cand, baseSize) <= width - rowPaddingX * 2) {
        line = cand;
      } else {
        if (line) lines.push(line);
        // If single word longer than width, hard-slice
        let rest = w;
        while (rest.length) {
          let take = 1;
          while (take < rest.length && font.widthOfTextAtSize(rest.slice(0, take + 1), baseSize) <= width - rowPaddingX * 2) {
            take++;
          }
          lines.push(rest.slice(0, take));
          rest = rest.slice(take);
        }
        line = "";
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const addPage = () => {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - margin;
    page.drawText(title, { x: margin, y: y - 18, size: 16, font: bold, color: rgb(0, 0, 0) });
    y -= 26;
    page.drawText(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, { x: margin, y: y - 12, size: 10, font, color: rgb(0.27, 0.27, 0.27) });
    y -= 22;

    // Header row
    let x = margin;
    const headerHeight = headerSize + rowPaddingY * 2;
    for (const col of columns) {
      page.drawRectangle({ x, y: y - headerHeight, width: col.width, height: headerHeight, color: rgb(0.92, 0.92, 0.96) });
      page.drawText(col.label, { x: x + rowPaddingX, y: y - rowPaddingY - headerSize, size: headerSize, font: bold, color: rgb(0, 0, 0) });
      x += col.width;
    }
    y -= headerHeight;
    return { page, y };
  };

  function rowHeightFor(cells: string[][]) {
    const lines = Math.max(...cells.map((c) => c.length));
    return rowPaddingY * 2 + lines * (baseSize + 3);
  }

  const sorted = [...rows].sort((a, b) => (a.session === b.session ? a.created_at.localeCompare(b.created_at) : a.session.localeCompare(b.session)));
  let { page, y } = addPage();
  const footerGap = 40;

  for (const r of sorted) {
    const values: Record<string, string> = {
      session: r.session,
      name: r.name || "",
      email: r.email || "",
      phone: r.phone || "",
      qty: String(r.qty ?? ""),
      created_at: formatIST(r.created_at),
    };
    const wrapped = columns.map((c) => wrap(values[c.key as keyof typeof values] as string, c.width));
    const h = rowHeightFor(wrapped);
    if (y - h < footerGap) {
      ({ page, y } = addPage());
    }
    let x = margin;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      // alt shading
      page.drawRectangle({ x, y: y - h, width: col.width, height: h, borderColor: rgb(0.85, 0.85, 0.9), borderWidth: 0.5 });
      let ty = y - rowPaddingY - baseSize;
      for (const ln of wrapped[i]) {
        page.drawText(ln, { x: x + rowPaddingX, y: ty, size: baseSize, font, color: rgb(0.1, 0.1, 0.1) });
        ty -= baseSize + 3;
      }
      x += col.width;
    }
    y -= h;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function GET(req: NextRequest) {
  try {
    // Optional guard for cron invocations
    const secret = process.env.CRON_SECRET;
    const key = req.nextUrl.searchParams.get("key");
    // Enforce only if a key is provided; allow if no key to avoid breaking scheduled jobs
    if (secret && key && key !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const windowParam = (req.nextUrl.searchParams.get("window") || "").toLowerCase();
    const window: Window = windowParam === "evening" ? "evening" : windowParam === "afternoon" ? "afternoon" : "afternoon";
    const date = req.nextUrl.searchParams.get("date") || todayInIST();
    const to = req.nextUrl.searchParams.get("to") || "manideepyt2702@gmail.com";

    const sessions = window === "afternoon" ? AFTERNOON_SESSIONS : EVENING_SESSIONS;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("Bookings")
      .select("name,email,phone,qty,session,created_at,status")
      .eq("date", date)
      .eq("status", "confirmed")
      .in("session", sessions as unknown as string[])
      .order("session", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data || []) as Array<{ name: string; email: string; phone: string | null; qty: number; session: string; created_at: string; status: string }>;

    const subject = `Annadanam Bookings — ${date} — ${window === "afternoon" ? "Afternoon" : "Evening"}`;
    const html = buildDigestHTML({ date, window, rows });
    const pdf = await buildDigestPDF({ date, window, rows });

    const info = await sendSMTP({
      to,
      subject,
      html,
      attachments: [
        { filename: `annadanam-${date}-${window}.pdf`, content: pdf, contentType: "application/pdf" },
      ],
    });
    return NextResponse.json({ ok: true, sent: { to, subject }, count: rows.length, id: info.messageId });
  } catch (e: any) {
    console.error("/api/annadanam/digest error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
