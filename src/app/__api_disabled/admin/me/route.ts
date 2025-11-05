import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!isAdminAuthed()) return NextResponse.json({ authed: false }, { status: 401 });
  return NextResponse.json({ authed: true });
}
