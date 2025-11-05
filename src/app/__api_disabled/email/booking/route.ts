yimport { NextRequest, NextResponse } from "next/server";
import { sendBookingConfirmation, type BookingType } from "@/lib/email/booking-confirmation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const bookingType = String(body?.bookingType || "").trim() as BookingType;
    const date = String(body?.date || "").trim();
    const slot = String(body?.slot || "").trim();
    const bookingId = String(body?.bookingId || "").trim();
    if (!name || !email || !bookingType || !date || !slot || !bookingId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const out = await sendBookingConfirmation({ name, email, bookingType, date, slot, bookingId });
    if (!out.ok) return NextResponse.json({ error: out.error || "Send failed" }, { status: 502 });
    return NextResponse.json({ ok: true, id: out.id || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}



