import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Build an Excel workbook with embedded images where possible
async function toExcelWithImages(dataByTable: Record<string, unknown[]>) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ayya-admin";
  workbook.created = new Date();

  // Helper: detect if a field name suggests an image URL
  const looksLikeImageField = (key: string) => {
    const k = key.toLowerCase();
    return (
      k.includes("image") ||
      k.endsWith("_url") ||
      k.includes("avatar") ||
      k.includes("photo")
    );
  };

  // Helper: detect image URL by suffix
  const looksLikeImageUrl = (val: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(val);

  // Fetch image as Buffer and derive extension
  async function fetchImage(url: string): Promise<{ buf: Buffer; ext: string } | null> {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      const ctype = r.headers.get("content-type") || "";
      if (!ctype.startsWith("image/")) {
        // Not an image; skip
        return null;
      }
      const ab = await r.arrayBuffer();
      const buf = Buffer.from(ab);
      const ext = ctype.split("/")[1]?.split(";")[0] || "png";
      return { buf, ext };
    } catch {
      return null;
    }
  }

  for (const [table, items] of Object.entries(dataByTable)) {
    const rows = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
    const sheet = workbook.addWorksheet(table.slice(0, 31));

    if (!rows.length) continue;

    // Build column list from union of keys
    const columns = Array.from(
      rows.reduce((set, r) => {
        Object.keys(r || {}).forEach((k) => set.add(k));
        return set;
      }, new Set<string>())
    );

    // Configure columns with friendly widths
    sheet.columns = columns.map((k) => ({ header: k, key: k, width: looksLikeImageField(k) ? 20 : 24 }));

    // Add data rows (as text for non-images; stringify objects/arrays)
    const toCellValue = (v: unknown) => {
      if (v == null) return "";
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    };

    rows.forEach((r) => {
      const row: Record<string, string> = {};
      for (const k of columns) row[k] = toCellValue((r as any)[k]);
      sheet.addRow(row);
    });

    // Try to embed images for image-like columns
    // Limit total images per sheet to avoid huge files
    const MAX_IMAGES = 200;
    let added = 0;
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const key = columns[colIdx];
      if (!looksLikeImageField(key)) continue;

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        if (added >= MAX_IMAGES) break;
        const val = rows[rowIdx]?.[key];
        if (!val || typeof val !== "string") continue;
        const url = val.trim();
        if (!url) continue;
        if (!looksLikeImageUrl(url)) continue;

        const fetched = await fetchImage(url);
        if (!fetched) continue;
        const imageId = workbook.addImage({ buffer: fetched.buf, extension: fetched.ext as any });

        // Row/column indices for exceljs image anchors are 0-based
        const tlCol = colIdx; // zero-based
        const tlRow = rowIdx + 1; // +1 to account for header row above data

        // Make row taller to show thumbnail
        const excelRow = sheet.getRow(rowIdx + 2); // +2 => header + 1-based row
        if (excelRow.height == null || excelRow.height < 60) excelRow.height = 60;

        // Anchor the image roughly inside the cell
        sheet.addImage(imageId, {
          tl: { col: tlCol, row: tlRow },
          ext: { width: 60, height: 60 },
          editAs: "oneCell",
        } as any);
        added++;
      }
    }
  }

  const buf = Buffer.from(await workbook.xlsx.writeBuffer());
  return buf;
}

async function toGenericPDF(title: string, dataByTable: Record<string, unknown[]>) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const margin = 40;
  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const baseSize = 9;
  const headerSize = 12;
  const sectionGap = 16;
  const lineGap = 3;
  const rowPaddingX = 5;
  const rowPaddingY = 5;
  const innerWidth = pageSize[0] - margin * 2;

  const addPage = () => {
    const page = pdfDoc.addPage(pageSize);
    const { width, height } = page.getSize();
    let y = height - margin;
    page.drawText(title, { x: margin, y: y - 18, size: 16, font: bold, color: rgb(0, 0, 0) });
    y -= 26;
    page.drawText(`Generated: ${new Date().toLocaleString()}`,
      { x: margin, y: y - 10, size: 10, font, color: rgb(0.27, 0.27, 0.27) });
    y -= 20;
    return { page, width, height, y };
  };

  function wrapText(text: string, maxWidth: number) {
    if (!text) return [""];
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const candidate = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(candidate, baseSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      // Break long word into multiple chunks that fit
      let rest = w;
      while (rest.length) {
        let slice = "";
        let i = 0;
        while (i < rest.length) {
          const next = slice + rest[i];
          if (font.widthOfTextAtSize(next, baseSize) > maxWidth) break;
          slice = next;
          i++;
        }
        if (!slice) {
          // Extremely narrow column fallback
          slice = rest[0];
          i = 1;
        }
        lines.push(slice);
        rest = rest.slice(i);
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  let { page, width, height, y } = addPage();
  const entries = Object.entries(dataByTable);
  const rowLineHeight = baseSize + lineGap;
  const maxColumns = 8;

  for (let t = 0; t < entries.length; t++) {
    const [tableName, items] = entries[t];
    const rows = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
    if (!rows.length) continue;

    // Section header
    const sectionTitle = `${tableName} (${rows.length})`;
    if (y - 24 < margin) { ({ page, width, height, y } = addPage()); }
    page.drawText(sectionTitle, { x: margin, y: y - 14, size: 13, font: bold, color: rgb(0, 0, 0) });
    y -= 18;

    // Compute columns (union of keys, limited)
    const allKeys = Array.from(rows.reduce((set, r) => { Object.keys(r || {}).forEach((k) => set.add(k)); return set; }, new Set<string>()));
    const keys = allKeys.slice(0, maxColumns);
    const colWidth = Math.floor(innerWidth / keys.length);

    // Header row background
    let x = margin;
    const headerHeight = headerSize + rowPaddingY * 2 - 2;
    for (const _ of keys) {
      page.drawRectangle({ x, y: y - headerHeight, width: colWidth, height: headerHeight, color: rgb(0.92, 0.92, 0.96) });
      x += colWidth;
    }
    // Header row text
    x = margin;
    for (const key of keys) {
      page.drawText(key, { x: x + rowPaddingX, y: y - rowPaddingY - headerSize + 2, size: headerSize, font: bold, color: rgb(0, 0, 0) });
      x += colWidth;
    }
    y -= headerHeight;

    // Rows
    let rowIndex = 0;
    for (const r of rows) {
      // Convert to string values
      const vals = keys.map((k) => {
        const v = (r as any)[k];
        if (v == null) return "";
        if (v instanceof Date) return v.toISOString();
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      });
      // Wrap per cell
      const cellLines = vals.map((v) => wrapText(v, colWidth - rowPaddingX * 2));
      const maxLines = Math.max(...cellLines.map((ls) => ls.length), 1);
      const rowHeight = maxLines * rowLineHeight + rowPaddingY * 2;
      if (y - rowHeight < margin + 10) {
        ({ page, width, height, y } = addPage());
        // Re-draw section header for continuity
        page.drawText(sectionTitle, { x: margin, y: y - 14, size: 13, font: bold, color: rgb(0, 0, 0) });
        y -= 18;
        // Re-draw header row
        let xx = margin;
        for (const _ of keys) {
          page.drawRectangle({ x: xx, y: y - headerHeight, width: colWidth, height: headerHeight, color: rgb(0.92, 0.92, 0.96) });
          xx += colWidth;
        }
        xx = margin;
        for (const key of keys) {
          page.drawText(key, { x: xx + rowPaddingX, y: y - rowPaddingY - headerSize + 2, size: headerSize, font: bold, color: rgb(0, 0, 0) });
          xx += colWidth;
        }
        y -= headerHeight;
        rowIndex = 0;
      }

      if (rowIndex % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - rowHeight, width: innerWidth, height: rowHeight, color: rgb(0.98, 0.98, 0.995) });
      }
      // Borders + text
      let xx = margin;
      for (let i = 0; i < keys.length; i++) {
        page.drawRectangle({ x: xx, y: y - rowHeight, width: colWidth, height: rowHeight, borderColor: rgb(0.85, 0.85, 0.9), borderWidth: 0.5, color: undefined });
        let ty = y - rowPaddingY - baseSize;
        for (const ln of cellLines[i]) {
          page.drawText(ln, { x: xx + rowPaddingX, y: ty, size: baseSize, font, color: rgb(0.1, 0.1, 0.1) });
          ty -= rowLineHeight;
        }
        xx += colWidth;
      }
      y -= rowHeight;
      rowIndex++;
    }

    y -= sectionGap;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
async function toAnnadanamPDF(title: string, rows: any[]) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const margin = 40;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const baseSize = 10;
  const headerSize = 11;
  const lineGap = 3;
  const rowPaddingX = 6;
  const rowPaddingY = 6;

  const innerWidth = 595.28 - margin * 2; // A4 width - margins
  // Column layout tuned to fit innerWidth exactly
  const columns = [
    { key: "date", label: "Date", width: 60 },
    { key: "session", label: "Session", width: 140 },
    { key: "name", label: "Name", width: 145 },
    { key: "qty", label: "Qty", width: 35 },
    { key: "status", label: "Status", width: 65 },
    { key: "phone", label: "Phone", width: 70 },
  ];

  const sumWidths = columns.reduce((s, c) => s + c.width, 0);
  // Fallback: scale columns if widths drift
  const scale = innerWidth / sumWidths;
  if (Math.abs(1 - scale) > 0.01) columns.forEach((c) => (c.width = Math.floor(c.width * scale)));

  const addPage = () => {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - margin;
    // Title and meta
    page.drawText(title, { x: margin, y: y - 18, size: 16, font: bold, color: rgb(0, 0, 0) });
    y -= 26;
    page.drawText(`Generated: ${new Date().toLocaleString()}`,
      { x: margin, y: y - 12, size: 10, font, color: rgb(0.27, 0.27, 0.27) });
    y -= 22;

    // Header background
    let x = margin;
    const headerHeight = headerSize + rowPaddingY * 2;
    columns.forEach((col) => {
      page.drawRectangle({ x, y: y - headerHeight, width: col.width, height: headerHeight, color: rgb(0.92, 0.92, 0.96) });
      x += col.width;
    });
    // Header text
    x = margin;
    columns.forEach((col) => {
      page.drawText(col.label, { x: x + rowPaddingX, y: y - rowPaddingY - headerSize, size: headerSize, font: bold, color: rgb(0, 0, 0) });
      x += col.width;
    });
    // Header bottom line
    page.drawLine({ start: { x: margin, y: y - headerHeight }, end: { x: width - margin, y: y - headerHeight }, color: rgb(0.8, 0.8, 0.85) });
    y -= headerHeight;
    return { page, width, height, y };
  };

  function wrapText(text: string, maxWidth: number) {
    if (!text) return [""];
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const candidate = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(candidate, baseSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      // Break long word into multiple chunks that fit
      let rest = w;
      while (rest.length) {
        let slice = "";
        let i = 0;
        while (i < rest.length) {
          const next = slice + rest[i];
          if (font.widthOfTextAtSize(next, baseSize) > maxWidth) break;
          slice = next;
          i++;
        }
        if (!slice) {
          slice = rest[0];
          i = 1;
        }
        lines.push(slice);
        rest = rest.slice(i);
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const rowLineHeight = baseSize + lineGap; // per wrapped line
  let { page, width, height, y } = addPage();

  const safe = (v: any) => (v == null ? "" : String(v));
  const getRowValues = (r: any) => ({
    date: safe(r.date),
    session: safe(r.session),
    name: safe(r.name || r.full_name),
    qty: safe(r.qty),
    status: safe(r.status),
    phone: safe(r.phone),
  });

  let rowIndex = 0;
  for (const r of rows) {
    const vals = getRowValues(r);
    // Prepare wrapped lines per cell
    const cellLines = columns.map((c) => wrapText(vals[c.key as keyof typeof vals] as string, c.width - rowPaddingX * 2));
    const maxLines = Math.max(...cellLines.map((ls) => ls.length), 1);
    const rowHeight = maxLines * rowLineHeight + rowPaddingY * 2;

    // Page break if needed
    if (y - rowHeight < margin) {
      ({ page, width, height, y } = addPage());
    }

    // Row background (zebra)
    if (rowIndex % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: innerWidth, height: rowHeight, color: rgb(0.98, 0.98, 0.995) });
    }

    // Cell borders and text
    let x = margin;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      // Border
      page.drawRectangle({ x, y: y - rowHeight, width: col.width, height: rowHeight, borderColor: rgb(0.85, 0.85, 0.9), borderWidth: 0.5, color: undefined });
      // Text lines
      let ty = y - rowPaddingY - baseSize;
      const lines = cellLines[i];
      for (const ln of lines) {
        page.drawText(ln, { x: x + rowPaddingX, y: ty, size: baseSize, font, color: rgb(0.1, 0.1, 0.1) });
        ty -= rowLineHeight;
      }
      x += col.width;
    }

    y -= rowHeight;
    rowIndex++;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function GET(req: Request) {
  if (!isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const dataset = (url.searchParams.get("dataset") || "").toLowerCase();
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const date = url.searchParams.get("date");
  const session = url.searchParams.get("session");

  let startISO: string | undefined;
  let endISO: string | undefined;
  if (start) {
    const s = new Date(start);
    if (!isNaN(s.getTime())) startISO = s.toISOString();
  }
  if (end) {
    const e = new Date(end);
    if (!isNaN(e.getTime())) {
      // Include the full end day by adding almost one day
      const endOfDay = new Date(e);
      endOfDay.setHours(23, 59, 59, 999);
      endISO = endOfDay.toISOString();
    }
  }

  const admin = getSupabaseAdminClient();

  // Dedicated Annadanam dataset export (Bookings table with optional date/session filters)
  if (dataset === "annadanam") {
    // Try canonical table first
    const rows: any[] = [];
    const candidateTables = ["Bookings", "Annadanam-Bookings"];
    for (const table of candidateTables) {
      try {
        let q = admin.from(table).select("*");
        if (date) q = q.eq("date", date);
        if (session && session.toLowerCase() !== "all") q = q.eq("session", session);
        // still allow created_at range if present
        if (startISO) q = q.gte("created_at", startISO);
        if (endISO) q = q.lte("created_at", endISO);
        const { data, error } = await q;
        if (!error && Array.isArray(data)) {
          rows.push(...data);
          break; // use first existing table
        }
      } catch {}
    }

    const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const title = `Annadanam List${date ? ` — ${date}` : ""}${session && session.toLowerCase() !== "all" ? ` — ${session}` : ""}`;
    if (format === "excel" || format === "xlsx") {
      const dataByTable = { Annadanam: rows as unknown[] };
      const buf = await toExcelWithImages(dataByTable);
      return new Response(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=annadanam-${ts}.xlsx`,
          "Cache-Control": "no-store",
        },
      });
    }
    if (format === "pdf") {
      try {
        const buf = await toAnnadanamPDF(title, rows);
        return new Response(buf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=annadanam-${ts}.pdf`,
            "Cache-Control": "no-store",
          },
        });
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "PDF generation failed" }, { status: 500 });
      }
    }
    // default JSON
    return NextResponse.json(rows, {
      headers: { "Content-Disposition": `attachment; filename=annadanam-${ts}.json` },
    });
  }

  // Default multi-table export
  const tables = [
    "contact-us",
    "contact_us",
    "Profile-Table",
    "profile_photos",
  ];
  const dataByTable: Record<string, unknown[]> = {};
  for (const table of tables) {
    try {
      let query = admin.from(table).select("*");
      if (startISO) query = query.gte("created_at", startISO);
      if (endISO) query = query.lte("created_at", endISO);
      const { data, error } = await query;
      if (error) {
        if ((error as any)?.details?.includes?.("does not exist")) continue;
        continue;
      }
      if (Array.isArray(data) && data.length) dataByTable[table] = data;
    } catch {}
  }

  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  if (format === "excel" || format === "xlsx") {
    const buf = await toExcelWithImages(dataByTable);
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=ayya-export-${ts}.xlsx`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "pdf") {
    try {
      const buf = await toGenericPDF("Data Export", dataByTable);
      return new Response(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=ayya-export-${ts}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "PDF generation failed" }, { status: 500 });
    }
  }

  // default JSON
  return NextResponse.json(dataByTable, {
    headers: {
      "Content-Disposition": `attachment; filename=ayya-export-${ts}.json`,
    },
  });
}
