"use client";

import { Hand } from "lucide-react";
import React from "react";
import { motion } from "framer-motion";

export default function AfterHeroCards() {
  return (
    <section className="relative w-full bg-black">
      <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-white/10">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 0.5 }} className="border-b md:border-b-0 md:border-r border-white/10">
            <PrayerCard />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <AnnadanamCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PrayerCard() {
  const [index, setIndex] = React.useState(0);
  const slides = [
    `അഖില ഭുവന ദീപം ഭക്ത ചിത്താ ദൂരം
സുരഗണ പരിസേവ്യം തത്ത്വമസ്യാദി ലക്ഷ്യം
ഹരിഹര സുതമീശം താരകബ്രഹ്മ രൂപം
ശബരിഗിരി നിവാസം ഭാവയേത് ഭൂതനാഥം.
अखिल भुवन दीपम भक्त चित्ताब्ज सूर
सुरगण परिसेव्यम तत्वमस्यादि लक्ष्यम
हरिहर सुतमीशम तारक ब्रह्म रूपम
शबरि गिरि निवासम भावयेत भूतनाथम |`,
    `ഭൂതനാഥ സദാനന്ദ സർവഭൂത ദയാപര
രക്ഷരക്ഷ മഹാബാഹോ ശാസ്ത്രേ തുഭ്യം നമോനമഃ
भूतनाथ: सदानंदा सर्व भूत दयापरा
रक्ष रक्ष महाबाहो शास्त्रे तुभ्यम नमो नमः`,
  ];

  // Swipe/drag detection (touch + mouse)
  const startPoint = React.useRef<number | null>(null);
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    startPoint.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (startPoint.current === null) return;
    const dx = e.clientX - startPoint.current;
    if (dx < -30) setIndex((i) => Math.min(i + 1, slides.length - 1));
    if (dx > 30) setIndex((i) => Math.max(i - 1, 0));
    startPoint.current = null;
  };

  return (
    <div className="w-full h-full bg-white p-6">
      <h3 className="text-center text-sm font-semibold tracking-widest text-amber-700">AYYAPPA PRAYER</h3>
      <div
        className="mt-4 whitespace-pre-line text-[13px] leading-6 text-neutral-800 select-text min-h-[180px] cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {slides[index]}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <audio
          className="w-full max-w-sm"
          controls
          preload="none"
          src="/Sreekovil-Nada-Thurannu-Jayan-Jaya-Vijaya.mp3"
        />
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-neutral-500">
        <span className="text-xs">Drag to next</span>
        <Hand className="h-4 w-4 animate-pulse" />
      </div>
    </div>
  );
}

function AnnadanamCard() {
  function getSeason(now: Date) {
    const y = now.getFullYear();
    const m = now.getMonth() + 1; // 1-12
    if (m < 11) return { start: new Date(y, 10, 5), end: new Date(y + 1, 0, 7) }; // Nov 5 to Jan 7 (next year)
    if (m === 11 || m === 12) return { start: new Date(y, 10, 5), end: new Date(y + 1, 0, 7) };
    // m === 1
    if (now.getDate() <= 7) return { start: new Date(y - 1, 10, 5), end: new Date(y, 0, 7) };
    return { start: new Date(y, 10, 5), end: new Date(y + 1, 0, 7) };
  }
  function getNextAnnadanamDate(now = new Date()) {
    const { start, end } = getSeason(now);
    if (now < start) return start;
    if (now <= end) return now;
    return new Date(now.getFullYear(), 10, 5); // next season start (Nov 5)
  }
  const nextDate = getNextAnnadanamDate();
  const nextDateLabel = nextDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const rows = [
    { session: "Morning", time: "12:30 – 2:30 pm" },
    { session: "Evening", time: "8:30 – 10:00 pm" },
  ];
  return (
    <div className="w-full h-full bg-white p-6">
      <h3 className="text-center text-sm font-semibold tracking-widest text-amber-700">UPCOMING ANNADANAM</h3>
      <p className="mt-3 text-sm text-neutral-700 text-center">Daily seva slots during Annadanam season</p>
      <p className="mt-1 text-xs text-neutral-600 text-center">Next date: <span className="font-medium text-indigo-900">{nextDateLabel}</span></p>
      <div className="mt-4 mx-auto w-full max-w-md overflow-hidden rounded-lg border border-amber-200">
        <table className="w-full text-sm">
          <thead className="bg-amber-50/70">
            <tr className="text-left text-indigo-900">
              <th className="py-2 px-4">Session</th>
              <th className="py-2 px-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.session} className={i % 2 ? "bg-white" : "bg-amber-50/30"}>
                <td className="py-2 px-4 font-medium text-indigo-900">{r.session}</td>
                <td className="py-2 px-4 text-neutral-700">{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex items-center justify-center gap-3">
        <a href="/calendar/annadanam" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ring-1 ring-amber-300 text-indigo-900 hover:bg-amber-50">
          Virtual Queue Booking
        </a>
        <a href="/volunteer" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ring-1 ring-amber-300 text-indigo-900 hover:bg-amber-50">
          Volunteer
        </a>
      </div>
    </div>
  );
}
