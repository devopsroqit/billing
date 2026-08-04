"use client";

import { useEffect, useRef, useState } from "react";

// Renders the ROQIT logo, swapping by theme: the standard mark on light
// backgrounds and the white-wordmark variant on dark ones. The swap is pure
// CSS (`dark:` variants keyed off the `.dark` class on <html>), so there's no
// flash or hydration mismatch. If an image is missing it falls back to a clean
// "ROQIT" wordmark (which is theme-aware) instead of a broken-image icon — we
// check both onError and the load state on mount.
export function BrandLogo({ className = "h-6 w-auto" }: { className?: string }) {
  const [errored, setErrored] = useState(false);
  const lightRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = lightRef.current;
    if (img && img.complete && img.naturalWidth === 0) setErrored(true);
  }, []);

  if (errored) {
    return <span className="text-lg font-extrabold tracking-tight text-fg">ROQIT</span>;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={lightRef}
        src="/roqit-logo.png"
        alt="ROQIT"
        className={`${className} block dark:hidden`}
        onError={() => setErrored(true)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ROQIT_solid_white_blue_horizontal.png"
        alt="ROQIT"
        className={`${className} hidden dark:block`}
        onError={() => setErrored(true)}
      />
    </>
  );
}
