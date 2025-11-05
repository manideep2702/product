#!/usr/bin/env node
/**
 * Seed or update the admin user in Supabase based on .env.local
 * - Creates the user with email/password if missing
 * - Updates password if user exists
 */
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(`.env.local not found at ${envPath}`);
  process.exit(1);
}

// Minimal .env parser (ignores export, comments, quotes)
const rawEnv = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of rawEnv.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = env.ADMIN_EMAIL;
const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env.local");
  process.exit(1);
}

const authAdminBase = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin`;

/** @param {string} u */
function maskEmail(u) {
  try {
    const [name, domain] = u.split("@");
    return `${name?.slice(0, 2) || ""}***@${domain || ""}`;
  } catch {
    return u;
  }
}

async function main() {
  console.log("Checking admin user:", maskEmail(ADMIN_EMAIL));
  const headers = {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    "Content-Type": "application/json",
  };

  // Fetch by email
  const listUrl = `${authAdminBase}/users?email=${encodeURIComponent(ADMIN_EMAIL)}`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) {
    const t = await listRes.text();
    throw new Error(`Failed to query users (${listRes.status}): ${t}`);
  }
  const listJson = await listRes.json();
  const users = Array.isArray(listJson?.users) ? listJson.users : [];
  const existing = users.find((u) => (u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase());

  if (!existing) {
    console.log("No existing admin; creating user...");
    const createRes = await fetch(`${authAdminBase}/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        app_metadata: { role: "admin" },
      }),
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      throw new Error(`Create failed (${createRes.status}): ${t}`);
    }
    console.log("Admin user created.");
  } else {
    console.log("Admin exists; updating password to match .env.local...");
    const updRes = await fetch(`${authAdminBase}/users/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });
    if (!updRes.ok) {
      const t = await updRes.text();
      throw new Error(`Update failed (${updRes.status}): ${t}`);
    }
    console.log("Admin password updated.");
  }

  // Optional: suggest setting NEXT_PUBLIC_ADMIN_EMAIL for frontend restriction
  if (!env.NEXT_PUBLIC_ADMIN_EMAIL) {
    console.log("\nTip: Add NEXT_PUBLIC_ADMIN_EMAIL to .env.local to restrict /admin access to this account:");
    console.log(`NEXT_PUBLIC_ADMIN_EMAIL=${ADMIN_EMAIL}`);
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

