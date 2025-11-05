import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUDIO_MAP: Record<string, string> = {
  "Sreekovil-Nada-Thurannu-Jayan-Jaya-Vijaya.mp3": path.join(process.cwd(), "Sreekovil-Nada-Thurannu-Jayan-Jaya-Vijaya.mp3"),
};

export async function GET(_req: NextRequest, { params }: { params: { name: string[] } }) {
  const raw = (params.name || []).join("/");
  const file = path.basename(raw);
  const filePath = AUDIO_MAP[file];
  if (!filePath) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }
  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to read audio" }, { status: 500 });
  }
}
