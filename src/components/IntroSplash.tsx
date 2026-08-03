"use client";

import { useLayoutEffect, useState } from "react";

const SESSION_KEY = "kilig-intro-shown";
const TOTAL_DURATION_MS = 2500;
const OVERLAY_FADE_OUT_MS = 600;

/**
 * Starts visible on both the server-rendered HTML and the first
 * client render, on purpose — avoids a hydration mismatch and, more
 * importantly, avoids a flash of the real homepage before the splash
 * appears. useLayoutEffect (not useEffect) runs synchronously before
 * the browser paints, so a repeat view within the same session gets
 * suppressed with zero visible flash, rather than showing then
 * immediately hiding.
 */
export function IntroSplash() {
  const [visible, setVisible] = useState(true);
  const [textVisible, setTextVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useLayoutEffect(() => {
    // This can't move into a lazy useState initializer without
    // reintroducing the hydration mismatch this effect-based approach
    // exists to avoid (the server has no sessionStorage to agree with
    // the client on an initial value).
    //
    // sessionStorage can throw in private browsing and some in-app
    // mobile browsers; if it does we must still dismiss the overlay,
    // or it would cover the page forever.
    let alreadyShown = false;
    try {
      alreadyShown = !!sessionStorage.getItem(SESSION_KEY);
    } catch {
      alreadyShown = true;
    }
    if (alreadyShown) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate, see comment above
      setVisible(false);
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage unavailable — show the splash once this load only.
    }

    const frame = requestAnimationFrame(() => setTextVisible(true));
    const fadeOutTimer = setTimeout(() => setFadingOut(true), TOTAL_DURATION_MS - OVERLAY_FADE_OUT_MS);
    const hideTimer = setTimeout(() => setVisible(false), TOTAL_DURATION_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fadeOutTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] transition-opacity duration-[600ms] ease-out [animation:kilig-intro-dismiss_2500ms_ease-out_forwards] ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {/* Exact same classes as the "Kilig" eyebrow label on the
          homepage (src/app/page.tsx) — no design changes, just this
          one element on a full black screen. */}
      <p
        className={`font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] transition-opacity duration-[800ms] ${
          textVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        Kilig
      </p>
    </div>
  );
}
