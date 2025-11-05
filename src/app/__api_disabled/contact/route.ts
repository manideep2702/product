import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Payload = {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  user_id?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Payload>;
    const first_name = String(body.first_name || "").trim();
    const last_name = String(body.last_name || "").trim() || null;
    const email = String(body.email || "").trim().toLowerCase();
    const phone = (body.phone ? String(body.phone).trim() : "") || null;
    const subject = (body.subject ? String(body.subject).trim() : "") || null;
    const message = String(body.message || "").trim();

    if (!first_name || !email || !message) {
      return NextResponse.json(
        { error: "first_name, email and message are required" },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      return NextResponse.json(
        { error: "Missing Supabase configuration.", hint: "Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY." },
        { status: 500 },
      );
    }
    const client = createClient(supabaseUrl, serviceKey || anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-ayya-client": "api-contact" } },
    });

    const payload: Payload = { first_name, last_name: last_name || undefined, email, phone: phone || undefined, subject: subject || undefined, message };

    const insertInto = async (table: string) => client.from(table).insert(payload).select("*").single();

    // Try hyphenated table first
    let res = await insertInto('contact-us');
    if (res.error) {
      const msg = String(res.error.message || "");
      const code = (res.error as any).code || "";
      const notFoundHyphen = code === '42P01' || /relation ".*contact-us" does not exist/i.test(msg) || /not found/i.test(msg);
      if (!notFoundHyphen) {
        // Likely RLS not configured on DB. Provide actionable hint.
        const hint = /row-level security/i.test(msg)
          ? "Ensure you have applied supabase/contact-us.sql in your Supabase SQL Editor to create the INSERT policy."
          : undefined;
        return NextResponse.json({ error: res.error.message, hint }, { status: 400 });
      }
      // Try underscore table
      const res2 = await insertInto('contact_us');
      if (res2.error) {
        const msg2 = String(res2.error.message || "");
        const code2 = (res2.error as any).code || "";
        const notFoundUnderscore = code2 === '42P01' || /relation ".*contact_us" does not exist/i.test(msg2) || /not found/i.test(msg2);
        if (notFoundUnderscore) {
          return NextResponse.json({ error: 'Neither table "contact-us" nor "contact_us" exists in schema public. Create one using supabase/contact-us.sql.' }, { status: 400 });
        }
        return NextResponse.json({ error: res2.error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    
    // Success on hyphenated table
    return NextResponse.json({ ok: true }, { status: 201 });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 500 });
  }
}
