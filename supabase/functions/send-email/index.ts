// Supabase Edge Function (Deno) — Resend HTTP API sender (Supabase-only)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Local type hint for linters during development; Supabase provides Deno at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// Env:
// - RESEND_API_KEY (required)
// - FROM_EMAIL (e.g., no-reply@sabarisastha.org)
// - FROM_NAME (optional display name)
// - EMAIL_BCC (optional comma-separated)
// Note: SMTP/TCP is not supported in the Edge runtime. Use an HTTP email API like Resend.

type EmailBody = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string; // overrides FROM_EMAIL
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body: EmailBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL") || "no-reply@example.com";
  const fromName = Deno.env.get("FROM_NAME") || "";
  const bccEnv = (Deno.env.get("EMAIL_BCC") || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  if (!apiKey) return json({ error: "Missing RESEND_API_KEY" }, { status: 500 });

  const toList = Array.isArray(body.to) ? body.to : [body.to];
  const payload: Record<string, unknown> = {
    from: body.from || (fromName ? `${fromName} <${fromEmail}>` : fromEmail),
    to: toList,
    subject: body.subject,
  };
  if (body.html) payload["html"] = body.html;
  if (body.text) payload["text"] = body.text;
  if (bccEnv.length) payload["bcc"] = bccEnv;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: data?.message || data?.error || "Resend error" }, { status: 500 });
    }
    return json({ ok: true, id: data?.id || null });
  } catch (e) {
    return json({ error: (e as any)?.message || String(e) }, { status: 500 });
  }
});


