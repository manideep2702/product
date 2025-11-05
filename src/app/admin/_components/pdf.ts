export type PdfColumn = { key: string; label: string; w: number; align?: "left" | "right" | "center" };

export async function createTablePDF(
  title: string,
  subtitle: string | undefined,
  columns: PdfColumn[],
  rows: any[],
  filename: string
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  let curPage = pdf.addPage();
  const { width, height } = curPage.getSize();
  const margin = 36;
  const titleSize = 22;
  const metaSize = 10;
  const headerSize = 11;
  const cellSize = 10;
  const rowHeight = 22;
  const headerHeight = 28;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  function fit(text: unknown, w: number, f = font, size = cellSize) {
    const s = (text ?? "").toString();
    const ell = "…";
    if (f.widthOfTextAtSize(s, size) <= w - 8) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      const part = s.slice(0, mid) + ell;
      if (f.widthOfTextAtSize(part, size) <= w - 8) lo = mid; else hi = mid - 1;
    }
    return s.slice(0, lo) + ell;
  }

  function drawHeader(p: typeof curPage, y: number) {
    const fullTitle = subtitle ? `${title} — ${subtitle}` : title;
    p.drawText(fullTitle, { x: margin, y: y - titleSize, size: titleSize, font: fontBold, color: rgb(0, 0, 0) });
    let ty = y - titleSize - 8;
    const exported = `Exported: ${new Date().toLocaleString()} | Total: ${rows.length} records`;
    p.drawText(exported, { x: margin, y: ty - metaSize, size: metaSize, font, color: rgb(0.2, 0.2, 0.2) });
    ty -= metaSize + 8;
    // Header row background - use actual column widths
    const totalColWidth = columns.reduce((s, c) => s + c.w, 0);
    p.drawRectangle({ x: margin, y: ty - headerHeight + 6, width: totalColWidth, height: headerHeight, color: rgb(0.15, 0.15, 0.15) });
    // Column titles
    let x = margin;
    for (const c of columns) {
      const w = c.w;
      let drawX = x + 4;
      if (c.align === "center") {
        const tW = fontBold.widthOfTextAtSize(c.label, headerSize);
        drawX = x + (w - tW) / 2;
      } else if (c.align === "right") {
        const tW = fontBold.widthOfTextAtSize(c.label, headerSize);
        drawX = x + w - tW - 4;
      }
      p.drawText(c.label, { x: drawX, y: ty, size: headerSize, font: fontBold, color: rgb(1, 1, 1) });
      // vertical line before this column
      p.drawLine({ start: { x, y: ty - headerHeight + 6 }, end: { x, y: ty + 6 }, thickness: 0.5, color: rgb(0, 0, 0) });
      x += w;
    }
    // rightmost vertical line
    p.drawLine({ start: { x, y: ty - headerHeight + 6 }, end: { x, y: ty + 6 }, thickness: 0.5, color: rgb(0, 0, 0) });
    // Bottom border
    p.drawLine({ start: { x: margin, y: ty - headerHeight + 4 }, end: { x, y: ty - headerHeight + 4 }, thickness: 0.6, color: rgb(0, 0, 0) });
    return ty - headerHeight - 2;
  }

  let y = drawHeader(curPage, height - margin);
  for (const r of rows) {
    if (y < margin + rowHeight) {
      const np = pdf.addPage([width, height]);
      y = drawHeader(np, height - margin);
      curPage = np;
    }
    let x = margin;
    for (const c of columns) {
      const w = c.w;
      const content = fit((r as any)[c.key], w, font, cellSize);
      let drawX = x + 4;
      if (c.align === "center") {
        const tW = font.widthOfTextAtSize(content, cellSize);
        drawX = x + (w - tW) / 2;
      } else if (c.align === "right") {
        const tW = font.widthOfTextAtSize(content, cellSize);
        drawX = x + w - tW - 4;
      }
      curPage.drawText(content, { x: drawX, y, size: cellSize, font, color: rgb(0, 0, 0) });
      // vertical separator per row
      curPage.drawLine({ start: { x, y: y - 8 }, end: { x, y: y + 14 }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) });
      x += w;
    }
    // rightmost vertical line
    curPage.drawLine({ start: { x, y: y - 8 }, end: { x, y: y + 14 }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) });
    // Row separator
    curPage.drawLine({ start: { x: margin, y: y - 8 }, end: { x, y: y - 8 }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) });
    y -= rowHeight;
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


