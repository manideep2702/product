"use client";

import RequireAuth from "@/components/auth/require-auth";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { useEffect, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAlert } from "@/components/ui/alert-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendEmail } from "@/lib/email";

const START = new Date(2025, 10, 5); // Nov 5, 2025 local
const END = new Date(2026, 0, 7); // Jan 7, 2026 local

export default function PoojaBookingPage() {
  const router = useRouter();
  const { show } = useAlert();
  const [selectedDate, setSelectedDate] = useState<Date>(START);
  const [session, setSession] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [childrenNames, setChildrenNames] = useState("");
  const [nakshatram, setNakshatram] = useState("");
  const [gothram, setGothram] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [utr, setUtr] = useState("");

  useEffect(() => { setSelectedDate(START); }, []);

  const dateIso = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const book = async () => {
    try {
      const amountNumber = Number(amount);
      if (
        !name.trim() ||
        !email.trim() ||
        !session ||
        !phone.trim() ||
        !spouseName.trim() ||
        !nakshatram.trim() ||
        !gothram.trim() ||
        !utr.trim() ||
        !Number.isFinite(amountNumber) ||
        amountNumber <= 0
      ) {
        show({ title: "Missing info", description: "Please fill all details, enter a valid amount and UTR, and select a session.", variant: "warning" });
        return;
      }
      setSubmitting(true);
      const supabase = getSupabaseBrowserClient();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user?.id) {
        show({ title: "Sign-in required", description: "Please sign in to book a pooja.", variant: "warning" });
        return;
      }
      const payload = {
        date: dateIso,
        session,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        spouse_name: spouseName.trim(),
        children_names: (childrenNames.trim() || null) as string | null,
        nakshatram: nakshatram.trim(),
        gothram: gothram.trim(),
        amount: amountNumber,
        utr: utr.trim(),
        user_id: user.id,
      } as const;
      const { error } = await supabase.from("Pooja-Bookings").insert(payload);
      if (error) {
        show({ title: "Booking failed", description: error.message, variant: "error" });
        return;
      }
      show({ title: "Pooja booked", description: `${dateIso} • ${session}`, variant: "success" });
      // Best-effort confirmation email
      try {
        await sendEmail({
          to: email.trim(),
          subject: "Pooja booking confirmed",
          text: `Your booking for ${dateIso} (${session}) has been received.`,
          html: `<p>Your booking for <strong>${dateIso}</strong> (<strong>${session}</strong>) has been received.</p>`,
        });
      } catch {}
      setSession("");
      setAmount("");
      setUtr("");
    } catch (e: any) {
      show({ title: "Booking failed", description: e?.message || "Unexpected error", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAuth>
      <main className="min-h-[60vh] w-full flex items-start justify-center px-6 pt-24 pb-16">
        <div className="w-full max-w-4xl space-y-8">
          <header className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold">Pooja Booking</h1>
            <p className="mt-2 text-muted-foreground">Booking window: 5 Nov 2025 – 7 Jan 2026. Sessions: 10:30 AM and 6:30 PM.</p>
          </header>

          <section className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <h2 className="text-lg font-semibold mb-3">Select Date</h2>
                <Card>
                  <CardContent className="p-4">
                    <div className="max-h-[360px] overflow-y-auto sm:max-h-none">
                      <Calendar
                        selected={selectedDate}
                        onSelect={(d) => d && d >= START && d <= END && setSelectedDate(d)}
                        disabled={(d) => d < START || d > END}
                        className="rounded-lg border-0"
                        fromDate={START}
                        toDate={END}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-3">Your Details</h2>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required autoComplete="name" autoCapitalize="words" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" inputMode="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number" required autoComplete="tel" inputMode="tel" pattern="^\+?[0-9]{10,15}$" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="spouse">Spouse Name</Label>
                    <Input id="spouse" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} placeholder="Spouse name" autoCapitalize="words" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="children">Children Names (optional)</Label>
                    <Textarea id="children" value={childrenNames} onChange={(e) => setChildrenNames(e.target.value)} placeholder="Comma separated or one per line" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="nakshatram">Nakshatram</Label>
                      <Input id="nakshatram" value={nakshatram} onChange={(e) => setNakshatram(e.target.value)} placeholder="e.g., Rohini" autoCapitalize="words" required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="gothram">Gothram</Label>
                      <Input id="gothram" value={gothram} onChange={(e) => setGothram(e.target.value)} placeholder="Your Gothram" autoCapitalize="words" required />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Session</Label>
                    <select className="w-full rounded-md border border-border bg-background h-9 px-3 py-1 text-base" value={session} onChange={(e) => setSession(e.target.value)} required aria-label="Select session">
                      <option value="">Select a session</option>
                      <option value="10:30 AM">Morning — 10:30 AM</option>
                      <option value="6:30 PM">Evening — 6:30 PM</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="amount">Amount (₹)</Label>
                      <Input id="amount" type="number" inputMode="decimal" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount paid" required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="utr">Transaction ID</Label>
                      <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Enter Transaction ID" required />
                    </div>
                  </div>
                  <div className="pt-4">
                    <GradientButton
                      variant="pooja"
                      onClick={book}
                      disabled={submitting}
                      aria-busy={submitting}
                      className="w-full sm:w-auto"
                    >
                      {submitting ? "Booking…" : "Book Now"}
                    </GradientButton>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-3">Payment</h2>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <img src="/payment.png" alt="Payment QR" className="w-full rounded-lg border" />
                        <p className="text-xs text-muted-foreground mt-2">Scan to pay. Enter amount and UTR in the form.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Note below booking form */}
          <p className="text-center text-sm text-muted-foreground">
            Note: Pooja and Panthulu garu fee is borne by the person taking the pooja.
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Misuse of this booking facility is strictly prohibited. If anyone misuses it, they will be completely terminated from all seva activities.
          </p>
        </div>
      </main>
    </RequireAuth>
  );
}
