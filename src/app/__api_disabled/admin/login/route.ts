import { NextResponse } from "next/server";
import { setAdminCookie, validateAdminLogin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const ok = validateAdminLogin(email, password);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    setAdminCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
