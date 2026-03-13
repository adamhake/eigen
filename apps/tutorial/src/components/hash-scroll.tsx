"use client";

import { useEffect } from "react";

export function HashScroll() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const raw = decodeURIComponent(hash.slice(1));
    // Try the hash as-is first, then try slugified version
    const el = document.getElementById(raw) ?? document.getElementById(raw.replace(/\s+/g, "-"));
    if (el) {
      el.scrollIntoView();
    }
  }, []);

  return null;
}
