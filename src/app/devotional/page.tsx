"use client";

import RequireAuth from "@/components/auth/require-auth";
import { BookOpenText, Maximize2, Download } from "lucide-react";
import FlipBook from "@/components/devotional/FlipBook";

export default function DevotionalPage() {
  const pdfSrc = "/ayya.pdf";

  return (
    <RequireAuth>
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto w-full max-w-5xl px-6 pt-28 pb-14 space-y-6">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpenText size={20} />
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Devotional Book</h1>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={pdfSrc}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ring-1 ring-border text-foreground hover:bg-white/5"
                aria-label="Open full screen"
              >
                <Maximize2 size={14} /> Full Screen
              </a>
              <a
                href={`${pdfSrc}?download=1`}
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ring-1 ring-border text-foreground hover:bg-white/5"
                aria-label="Download PDF"
              >
                <Download size={14} /> Download
              </a>
            </div>
          </header>

          {/* FlipBook viewer */}
          <section className="rounded-2xl border border-border bg-card/70 shadow-sm overflow-hidden p-3">
            <FlipBook src={pdfSrc} />
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
