"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlert } from "@/components/ui/alert-provider";
import { sendEmail } from "@/lib/email";

// Session label now represents a fixed time range (e.g., "12:45 PM - 1:30 PM")
type Session = string;

export interface Slot {
  id: string;
  date: string; // YYYY-MM-DD
  session: Session;
  capacity: number;
  booked_count: number;
  status: "open" | "closed";
}

export interface Booking {
  id: string;
  created_at: string;
  slot_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  qty: number;
  status: "confirmed" | "cancelled";
}

function seasonForNow(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  // If between Nov 5 and Jan 7 (spanning years), return that window.
  const nov5 = new Date(y, 10, 5);
  const jan7Next = new Date(y + 1, 0, 7);
  const jan7 = new Date(y, 0, 7);
  if (m === 11 || m === 12 || (m === 1 && d <= 7)) {
    // Current season: Nov 5 (this year) to Jan 7 (next year) or Jan 7 of current year if Jan
    const start = new Date(y, 10, 5);
    const end = new Date(y + (m === 1 ? 0 : 1), 0, 7);
    return { start, end };
  }
  // Before Nov 5: upcoming season this year → next year's Jan 7
  if (now < nov5) {
    return { start: nov5, end: jan7Next };
  }
  // After Jan 7 and before Nov 5: upcoming season is this year's Nov 5 → next Jan 7
  return { start: nov5, end: jan7Next };
}

// Extra one-off booking dates allowed outside regular season
const EXTRA_DATES: string[] = [
  "2025-10-31",
  "2025-11-04",
];

function inSeason(date: Date, now = new Date()): boolean {
  const { start, end } = seasonForNow(now);
  if (date >= start && date <= end) return true;
  const iso = formatDate(date);
  return EXTRA_DATES.includes(iso);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function useSupabase() {
  const ref = useRef<any>(null);
  async function ensure() {
    if (!ref.current) {
      const mod = await import("@/lib/supabase/client");
      ref.current = mod.getSupabaseBrowserClient();
    }
    return ref.current as any;
  }
  return { ensure };
}

// Fixed session definitions
const AFTERNOON_SLOTS: { label: string; start: string; end: string }[] = [
  { label: "1:00 PM - 1:30 PM", start: "13:00", end: "13:30" },
  { label: "1:30 PM - 2:00 PM", start: "13:30", end: "14:00" },
  { label: "2:00 PM - 2:30 PM", start: "14:00", end: "14:30" },
  { label: "2:30 PM - 3:00 PM", start: "14:30", end: "15:00" },
];
const EVENING_SLOTS: { label: string; start: string; end: string }[] = [
  { label: "8:00 PM - 8:30 PM", start: "20:00", end: "20:30" },
  { label: "8:30 PM - 9:00 PM", start: "20:30", end: "21:00" },
  { label: "9:00 PM - 9:30 PM", start: "21:00", end: "21:30" },
  { label: "9:30 PM - 10:00 PM", start: "21:30", end: "22:00" },
];

function computeSlotTimes(date: Date, label: string): { start: Date; end: Date } | null {
  const map = new Map<string, { start: string; end: string }>();
  [...AFTERNOON_SLOTS, ...EVENING_SLOTS].forEach((s) => map.set(s.label, { start: s.start, end: s.end }));
  const e = map.get(label);
  if (!e) return null;
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const [sh, sm] = e.start.split(":").map((v) => parseInt(v, 10));
  const [eh, em] = e.end.split(":").map((v) => parseInt(v, 10));
  const start = new Date(y, m, d, sh, sm, 0, 0);
  const end = new Date(y, m, d, eh, em, 0, 0);
  return { start, end };
}

function isLastSession(label: string) {
  return label === "9:30 PM - 10:00 PM";
}

function isBookableNow(label: string, date: Date) {
  const t = computeSlotTimes(date, label);
  if (!t) return false;
  // Compute current time in IST regardless of user's local timezone
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const ist = new Date(utcMs + 5.5 * 60 * 60 * 1000);
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  const isAfternoon = AFTERNOON_SLOTS.some((a) => a.label === label);
  const [startMin, endMin] = isAfternoon ? [5 * 60, 11 * 60 + 30] : [15 * 60, 19 * 60 + 30];
  const withinWindow = minutes >= startMin && minutes <= endMin;
  if (!withinWindow) return false;
  // Close at session start (cannot book once session begins)
  if (now >= t.start) return false;
  return true;
}

function SessionPicker({
  slots,
  loading,
  onBook,
  date,
}: {
  slots: Slot[];
  loading: boolean;
  onBook: (slotId: string) => void;
  date: Date;
}) {
  const [aftChoice, setAftChoice] = useState<string>("");
  const [eveChoice, setEveChoice] = useState<string>("");
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  const byLabel = new Map(slots.map((s) => [s.session, s] as const));
  const aftOptions = AFTERNOON_SLOTS.map((s) => ({ label: s.label, slot: byLabel.get(s.label) || null }));
  const eveOptions = EVENING_SLOTS.map((s) => ({ label: s.label, slot: byLabel.get(s.label) || null }));
  const aftTotal = slots.filter((s) => AFTERNOON_SLOTS.some((a) => a.label === s.session)).reduce((sum, s) => sum + s.booked_count, 0);
  const eveTotal = slots.filter((s) => EVENING_SLOTS.some((a) => a.label === s.session)).reduce((sum, s) => sum + s.booked_count, 0);

  const pick = (label: string) => byLabel.get(label) || null;
  const canPick = (label: string) => {
    const slot = pick(label);
    if (!slot) return false;
    const isAfternoon = AFTERNOON_SLOTS.some((a) => a.label === label);
    const groupRemaining = (isAfternoon ? 150 - aftTotal : 150 - eveTotal);
    if (groupRemaining <= 0) return false;
    const remaining = Math.max(0, slot.capacity - slot.booked_count);
    const closedByCapacity = remaining <= 0 || slot.status === "closed";
    const nowBookable = isBookableNow(label, date);
    return !closedByCapacity && nowBookable;
  };
  const bookSelected = (label: string) => {
    const slot = pick(label);
    if (slot && canPick(label)) onBook(slot.id);
  };
  const renderCard = (title: string, options: { label: string; slot: Slot | null }[], value: string, setValue: (v: string) => void) => {
    const disabled = !(value && canPick(value));
    let infoText = "";
    if (value && !canPick(value)) {
      const isAfternoon = AFTERNOON_SLOTS.some((a) => a.label === value);
      const groupRemaining = isAfternoon ? 150 - aftTotal : 150 - eveTotal;
      if (groupRemaining <= 0) infoText = "Session full";
      else infoText = isAfternoon
        ? "Booking window: 5:00 AM–11:30 AM IST"
        : "Booking window: 3:00 PM–7:30 PM IST";
    }
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">{title}</h3>
          </div>
          <div className="space-y-3">
            <select
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">Select a time</option>
              {options.map((opt) => (
                <option key={opt.label} value={opt.label} disabled={!canPick(opt.label)}>
                  {opt.label}{!opt.slot ? " (unavailable)" : (!canPick(opt.label) ? " (unavailable)" : "")}
                </option>
              ))}
            </select>
            {infoText ? <div className="text-xs text-muted-foreground">{infoText}</div> : null}
            <Button className="w-full" size="sm" onClick={() => bookSelected(value)} disabled={disabled}>
              {disabled ? "Unavailable" : "Book"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {renderCard("Afternoon", aftOptions, aftChoice, setAftChoice)}
      {renderCard("Evening", eveOptions, eveChoice, setEveChoice)}
    </div>
  );
}

function BookingDialog({ open, onClose, slot, onConfirm }: {
  open: boolean;
  onClose: () => void;
  slot: Slot | null;
  onConfirm: (data: { qty: number; name: string; email: string; phone: string }) => void;
}) {
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (open) {
      setQty(1);
    }
  }, [open]);

  if (!slot) return null;
  const remaining = Math.max(0, slot.capacity - slot.booked_count);
  const maxQty = 1;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = 1;
    onConfirm({ qty: q, name: name.trim(), email: email.trim(), phone: phone.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book {slot.session} Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Persons field removed: single-person booking enforced server-side */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Confirm Booking</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AnnadanamBooking() {
  const now = new Date();
  const { start: SEASON_START, end: SEASON_END } = seasonForNow(now);
  const initialDate = now < SEASON_START ? SEASON_START : (now > SEASON_END ? SEASON_START : now);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const { ensure } = useSupabase();
  const { show } = useAlert();

  const selectedDateKey = useMemo(() => formatDate(selectedDate), [selectedDate]);

  // Expand calendar navigation range to include extra special dates
  const CAL_START = useMemo(() => {
    if (EXTRA_DATES.length === 0) return SEASON_START;
    const minExtra = new Date(EXTRA_DATES.slice().sort()[0]);
    return minExtra < SEASON_START ? minExtra : SEASON_START;
  }, [SEASON_START]);
  const CAL_END = useMemo(() => {
    if (EXTRA_DATES.length === 0) return SEASON_END;
    const maxExtra = new Date(EXTRA_DATES.slice().sort().reverse()[0]);
    return maxExtra > SEASON_END ? maxExtra : SEASON_END;
  }, [SEASON_END]);

  // Pick date from query param if provided and valid
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const qp = url.searchParams.get('date');
      if (!qp) return;
      // Expect YYYY-MM-DD
      const parts = qp.split('-');
      if (parts.length !== 3) return;
      const yyyy = parseInt(parts[0], 10), mm = parseInt(parts[1], 10), dd = parseInt(parts[2], 10);
      if (!yyyy || !mm || !dd) return;
      const dt = new Date(yyyy, mm - 1, dd);
      if (Number.isNaN(dt.getTime())) return;
      if (inSeason(dt, now)) setSelectedDate(dt);
    } catch {}
  }, []);

  async function fetchSlots(dateIso: string) {
    setLoading(true);
    try {
      const supabase = await ensure();
      // Prefer backend RPC that aggregates from Slots + Bookings
      const { data, error } = await supabase.rpc("get_annadanam_slots", { d: dateIso });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      setSlots(
        rows.map((r: any) => ({
          id: `${r.date}-${r.session}`,
          date: r.date,
          session: r.session,
          capacity: r.capacity,
          booked_count: r.booked_count,
          status: r.status,
        }))
      );
    } catch (err) {
      console.error('get_annadanam_slots failed', err);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyBookings() {
    try {
      const supabase = await ensure();
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return setMyBookings([]);
      const { data, error } = await supabase
        .from("Annadanam-Bookings")
        .select("id,created_at,slot_id,user_id,name,email,phone,qty,status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMyBookings((data || []) as Booking[]);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchSlots(selectedDateKey);
  }, [selectedDateKey]);

  // Refresh when tab regains focus
  useEffect(() => {
    const onFocus = () => fetchSlots(selectedDateKey);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [selectedDateKey]);

  // Realtime updates: refresh availability when Bookings or Slots change for the selected date
  useEffect(() => {
    let channel: any = null;
    (async () => {
      try {
        const supabase = await ensure();
        channel = supabase
          .channel(`annadanam:${selectedDateKey}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'Bookings',
            filter: `date=eq.${selectedDateKey}`,
          }, () => {
            fetchSlots(selectedDateKey);
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'Slots',
            filter: `date=eq.${selectedDateKey}`,
          }, () => {
            fetchSlots(selectedDateKey);
          })
          .subscribe();
      } catch {}
    })();
    return () => {
      try { channel?.unsubscribe?.(); } catch {}
    };
  }, [selectedDateKey]);

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const handleBook = (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId) || null;
    setSelectedSlot(slot);
    setDialogOpen(Boolean(slot));
  };

  const handleConfirmBooking = async (data: { qty: number; name: string; email: string; phone: string }) => {
    const slot = selectedSlot;
    if (!slot) return;
    const remaining = Math.max(0, slot.capacity - slot.booked_count);
    const qty = 1;
    if (!data.email) {
      show({ title: "Email required", description: "Please enter your email.", variant: "warning" });
      return;
    }
    try {
      const supabase = await ensure();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        show({ title: "Sign in required", description: "Please sign in to book.", variant: "warning" });
        try {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/sign-in?next=${encodeURIComponent(next)}`);
        } catch {}
        return;
      }
      // Prefer RPC if available
      const { error: rpcErr } = await supabase.rpc("reserve_annadanam_by_date", {
        d: selectedDateKey,
        s: slot.session,
        user_id: user.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        qty,
      });
      if (rpcErr) throw rpcErr;
      // Email sending is handled by backend automations (if configured). No client call here on static hosting.
      show({ title: "Booking confirmed", description: `${slot.session} • ${selectedDateKey}`, variant: "success" });
      // Best-effort confirmation email via Supabase Edge Function (SMTP)
      try {
        await sendEmail({
          to: data.email,
          subject: "Annadanam booking confirmed",
          text: `Your Annadanam booking for ${selectedDateKey} (${slot.session}) has been received.`,
          html: `<p>Your Annadanam booking for <strong>${selectedDateKey}</strong> (<strong>${slot.session}</strong>) has been received.</p>`,
        });
      } catch {}
      // Update UI
      await fetchSlots(selectedDateKey);
      await fetchMyBookings();
    } catch (err: any) {
      const msg = (err?.message || "Could not complete booking").toString();
      const hint = /duplicate key|unique/i.test(msg)
        ? "You already booked this session."
        : /capacity|full|closed/i.test(msg)
        ? "Slot is full or closed."
        : "";
      show({ title: "Booking failed", description: [msg, hint].filter(Boolean).join("\n"), variant: "error" });
    } finally {
      setDialogOpen(false);
      setSelectedSlot(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Annadanam Slot Booking</h2>
        <p className="text-muted-foreground">Choose a time below. Booking windows (IST): Morning 5:00 AM–11:30 AM, Evening 3:00 PM – 7:30 PM.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-1">
          <h3 className="text-base font-semibold mb-4">Select Date</h3>
          <Card className="w-full">
            <CardContent className="p-4">
              <Calendar
                selected={selectedDate}
                onSelect={(date) => date && inSeason(date, now) && setSelectedDate(date)}
                disabled={(date) => !inSeason(date, now)}
                className="rounded-lg border-0"
                fromDate={CAL_START}
                toDate={CAL_END}
              />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Select a Time — {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</h3>
            {myBookings.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowMyBookings((v) => !v)}>
                {showMyBookings ? "Hide" : "View"} My Bookings ({myBookings.length})
              </Button>
            )}
          </div>
          {showMyBookings ? (
            <div className="space-y-4">
              <h4 className="font-semibold">My Bookings</h4>
              {myBookings.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Qty: {b.qty}</p>
                        <p className="text-sm text-muted-foreground">{b.name} • {b.email}</p>
                        <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
                      </div>
                      <Badge>{b.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <SessionPicker slots={slots} loading={loading} onBook={handleBook} date={selectedDate} />
          )}
        </div>
      </div>
      <BookingDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedSlot(null);
        }}
        slot={selectedSlot}
        onConfirm={handleConfirmBooking}
      />
    </div>
  );
}
