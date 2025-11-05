import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GALLERY_DIR = path.join(process.cwd(), "gallery");

function contentTypeForExt(ext: string): string | null {
  switch (ext.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return null;
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ name: string[] }> }
) {
  try {
    const { name } = await ctx.params;
    const raw = (name || []).join("/");
    const file = path.basename(raw); // prevent directory traversal
    const filePath = path.join(GALLERY_DIR, file);
    const ext = path.extname(filePath);
    const type = contentTypeForExt(ext);
    if (!type) {
      return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
    }
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
