"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function ImagesMasonry({ images }: { images: string[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const srcFor = (name: string) => `/gallery/${encodeURIComponent(name)}`;

  return (
    <>
      <div className="columns-1 sm:columns-2 md:columns-3 gap-4">
        {images.map((name, idx) => (
          <figure
            key={name}
            className="mb-4 break-inside-avoid rounded-lg overflow-hidden border border-white/10 bg-white/5 cursor-zoom-in"
            onClick={() => {
              setActive(idx);
              setOpen(true);
            }}
          >
            <img
              className="block w-full h-auto object-contain"
              src={srcFor(name)}
              alt={name}
              loading="lazy"
            />
          </figure>
        ))}
      </div>

      {open && active !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-2 text-white/90 hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="h-full w-full p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={srcFor(images[active])}
              alt={images[active]}
              className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg border border-white/10 shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
