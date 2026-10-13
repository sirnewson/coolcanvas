import { useEffect, useState } from "react";

/**
 * The launch screen. A grid ground, and one shape that keeps becoming another —
 * circle, square, solid — which is the whole product in four seconds.
 */

export const APP_AUTHOR = "Sir Newson";
export const APP_SITE = "yxmdigital.com";

export function Splash({ onDone, minMs = 1700 }: { onDone?: () => void; minMs?: number }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setLeaving(true), minMs);
    return () => window.clearTimeout(t);
  }, [minMs]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => onDone?.(), 460);
    return () => window.clearTimeout(t);
  }, [leaving, onDone]);

  return (
    <div className={`splash${leaving ? " is-leaving" : ""}`} role="status" aria-label="Loading CoolCanvas">
      <div className="splash-grid" aria-hidden="true" />
      <div className="splash-glow" aria-hidden="true" />

      <div className="splash-stage" aria-hidden="true">
        <div className="splash-shape">
          <span className="face f-front" />
          <span className="face f-back" />
          <span className="face f-right" />
          <span className="face f-left" />
          <span className="face f-top" />
          <span className="face f-bottom" />
        </div>
        <div className="splash-shadow" />
      </div>

      <div className="splash-copy">
        <span className="wordmark">
          Cool<span>CANVAS</span>
        </span>
        <p>Think in space.</p>
      </div>

      <footer className="splash-foot">
        Created by {APP_AUTHOR} · a product of{" "}
        <a href={`https://${APP_SITE}`} target="_blank" rel="noopener noreferrer">
          {APP_SITE}
        </a>
      </footer>
    </div>
  );
}
