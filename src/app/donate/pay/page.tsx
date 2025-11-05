"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/auth/require-auth";
import { GradientButton } from "@/components/ui/gradient-button";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendEmail } from "@/lib/email";

type Donor = { name: string; email: string; phone: string; address?: string } | null;

export default function DonatePayPage() {
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentShot, setPaymentShot] = useState<File | null>(null);
  const [panShot, setPanShot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [donor, setDonor] = useState<Donor>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem("donation:donor") : null;
      if (raw) setDonor(JSON.parse(raw));
      const panRaw = typeof window !== "undefined" ? sessionStorage.getItem("donation:pan") : null;
      if (panRaw) {
        const meta = JSON.parse(panRaw) as { name: string; type: string; dataUrl: string };
        if (meta?.dataUrl && meta?.name) {
          fetch(meta.dataUrl)
            .then((r) => r.blob())
            .then((blob) => setPanShot(new File([blob], meta.name, { type: meta.type || blob.type || "image/png" })))
            .catch(() => {});
        }
      }
    } catch {}
  }, []);

  async function submitDonation() {
    const amt = parseInt(paidAmount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Please enter the amount you paid.");
      return;
    }
    if (!donor?.email || !donor?.name || !donor?.phone) {
      alert("Donor details missing. Please go back and fill the form.");
      return;
    }
    if (!paymentShot) {
      alert("Please upload the payment screenshot.");
      return;
    }
    if (!panShot) {
      alert("Please upload the PAN card.");
      return;
    }
    if (paymentShot.size > 5 * 1024 * 1024) {
      alert("Screenshot is too large. Maximum allowed size is 5MB.");
      return;
    }
    if (panShot.size > 5 * 1024 * 1024) {
      alert("PAN file is too large. Maximum allowed size is 5MB.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      // Ensure user session (RequireAuth already wraps this page)
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user?.id) throw new Error("Please sign in again.");

      // Upload files to 'donations' bucket
      const bucket = "donations";
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9_.-]+/g, "-");
      const base = `${user.id}-${Date.now()}`;
      const screenshotPath = `screenshots/${base}-${safe(paymentShot.name)}`;
      const panPath = `pan/${base}-${safe(panShot.name)}`;
      const up1 = await supabase.storage.from(bucket).upload(screenshotPath, paymentShot, { upsert: false, cacheControl: "3600", contentType: paymentShot.type || "image/png" });
      if (up1.error) throw up1.error;
      const up2 = await supabase.storage.from(bucket).upload(panPath, panShot, { upsert: false, cacheControl: "3600", contentType: panShot.type || "application/octet-stream" });
      if (up2.error) throw up2.error;

      // Insert donation row
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const { error } = await supabase.from("donations").insert({
        name: donor.name,
        email: donor.email,
        phone: donor.phone,
        address: donor.address || null,
        amount: amt,
        storage_bucket: bucket,
        storage_path: screenshotPath,
        pan_bucket: bucket,
        pan_path: panPath,
        user_agent: ua,
      });
      if (error) throw error;

      alert(`Thank you, ${donor.name}! We received your donation details for ₹${amt}. Invoice will be shared in 3–5 days.`);
      try {
        await sendEmail({
          to: donor.email.trim(),
          subject: "Donation received",
          text: `Dear ${donor.name}, we have received your donation of ₹${amt.toLocaleString("en-IN")}. A GST-compliant invoice will be emailed within 3–5 working days.`,
          html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;line-height:1.6">
            <h2 style="margin:0 0 10px">Thank you for your donation!</h2>
            <p>Dear ${donor.name},</p>
            <p>We have received your donation details.</p>
            <ul>
              <li><strong>Amount:</strong> ₹${amt.toLocaleString("en-IN")}</li>
              <li><strong>Email:</strong> ${donor.email}</li>
              <li><strong>Phone:</strong> ${donor.phone}</li>
              ${donor.address ? `<li><strong>Address:</strong> ${donor.address}</li>` : ""}
            </ul>
            <p>We will verify the payment and share a GST-compliant invoice to your email within 3–5 working days.</p>
            <p>Warm regards,<br/>Sree Sabari Sastha Seva Samithi</p>
          </div>`,
        });
      } catch {}
      setPaidAmount("");
      setPaymentShot(null);
    } catch (err: any) {
      alert(err?.message || "Failed to submit donation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background text-foreground">
        <section className="mx-auto w-full max-w-4xl px-6 pt-10 pb-10">
          <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h1 className="text-xl md:text-2xl font-semibold">Pay via QR</h1>
              <Link href="/donate" className="text-sm underline underline-offset-2">Back to Donor Details</Link>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Scan the QR with your UPI app to complete the payment. After paying, enter the paid amount and upload the payment screenshot.</p>

            <div className="mt-5 flex flex-col items-center gap-3">
              <img src="/payment.png" alt="Payment QR" className="w-[260px] h-[260px] rounded-lg ring-1 ring-border bg-white object-contain" />
              <span className="text-xs text-muted-foreground">Accepted on major UPI apps</span>
            </div>

            {donor ? (
              <div className="mt-3 text-sm text-muted-foreground">
                <div>Donor: <span className="text-foreground font-medium">{donor.name}</span></div>
                <div>Email: {donor.email} • Phone: {donor.phone}</div>
                {donor.address ? <div>Address: {donor.address}</div> : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-red-500">Donor details not found. <Link className="underline underline-offset-2" href="/donate">Back to Donor Details</Link></div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-left">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Donation Amount *</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter amount paid"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:ring-2 focus:outline-none"
                />
              </label>

              <FileInput
                label="Payment Screenshot (required)"
                file={paymentShot}
                onChange={setPaymentShot}
                required
                accept="image/*"
              />
              <FileInput
                label="PAN Card (required)"
                file={panShot}
                onChange={setPanShot}
                required
                accept="image/*,application/pdf"
              />
            </div>

            <div className="mt-6 flex justify-center">
              <GradientButton onClick={submitDonation} disabled={submitting}>
                Submit Donation Details
              </GradientButton>
            </div>
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}

function FileInput({ label, file, onChange, required = false, accept = "*/*" }: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  required?: boolean;
  accept?: string;
}) {
  const id = `file-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="text-left">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required ? " *" : ""}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        required={required}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="w-full cursor-pointer rounded-xl bg-white/5 px-4 py-2.5 text-sm ring-1 ring-border file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-foreground hover:file:bg-white/20 focus:ring-2 focus:outline-none"
      />
      {file && (
        <p className="mt-1 text-xs text-muted-foreground truncate">Selected: {file.name}</p>
      )}
    </div>
  );
}
