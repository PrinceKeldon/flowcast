"use client";

import { useEffect, useRef } from "react";

interface CoverGlowProps {
  coverUrl: string | null;
  className?: string;
}

/**
 * Samples the cover art's average hue in the browser and tints the card
 * behind it — a translucent colour wash plus a soft outer glow — so each
 * card picks up the dominant colour of its own image. Presentation only:
 * nothing runs on the server, and a missing cover (or a failed sample)
 * simply leaves the default surface background in place. See the notes
 * in TitleCard.tsx.
 */
export function CoverGlow({ coverUrl, className = "" }: CoverGlowProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !coverUrl) return;

    let cancelled = false;
    const img = new Image();
    // Required for canvas read-back; the cover CDN sends
    // Access-Control-Allow-Origin: * (verified), so getImageData won't
    // throw on taint. If it ever does, the catch below keeps the
    // default background rather than breaking the card.
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = 24;
        const h = Math.round((w * 16) / 9); // cards are 9:16 portrait
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue; // skip fully transparent pixels
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n += 1;
        }
        if (n === 0) return;

        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        el.style.background = `linear-gradient(180deg, rgba(${r},${g},${b},0.45), rgba(${r},${g},${b},0.22))`;
        el.style.boxShadow = `0 0 48px -8px rgba(${r},${g},${b},0.55)`;
      } catch {
        // Sampling failed — leave the default background in place.
      }
    };
    img.onerror = () => {
      // Cover failed to load — leave the default background in place.
    };
    img.src = coverUrl;

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
