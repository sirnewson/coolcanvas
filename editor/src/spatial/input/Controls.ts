/**
 * Pointer handling for a tablet first, a desktop second.
 *
 * The rules are the ones a Procreate user already has in their hands:
 * one finger or the pen draws, two fingers move the world, two- and
 * three-finger taps are undo and redo. A pen anywhere on the glass means every
 * touch is a palm and gets ignored.
 */

export interface PointerSample {
  x: number;
  y: number;
  pressure: number;
  tilt: number;
  /** Radians; 0 points right. */
  azimuth: number;
  t: number;
  pen: boolean;
}

export interface ControlHandlers {
  begin(p: PointerSample): void;
  move(p: PointerSample): void;
  end(p: PointerSample, heldStill: number): void;
  cancel(): void;
  orbit(dx: number, dy: number): void;
  pan(dx: number, dy: number): void;
  dolly(factor: number): void;
  tap(fingers: number): void;
  hover(x: number, y: number): void;
  adjustSize(delta: number): void;
  adjustDepth(delta: number): void;
}

export interface ControlOptions {
  stabilizer: number;
  pressureCurve: number;
  gestureUndo: boolean;
  invertScroll: boolean;
  /** False while a modal tool (like the plane gizmo) owns the surface. */
  drawEnabled: boolean;
}

interface Live {
  id: number;
  type: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  startX: number;
  startY: number;
  startT: number;
  moved: number;
}

type Mode = "idle" | "draw" | "orbit" | "pan" | "pinch" | "dead";

const TAP_MS = 260;
const TAP_SLOP = 14;

export class Controls {
  private el: HTMLElement | null = null;
  private pointers = new Map<number, Live>();
  private mode: Mode = "idle";
  private drawId = -1;
  private penActive = false;
  private lastDist = 0;
  private lastMid = { x: 0, y: 0 };
  private lastMoveT = 0;
  private stillSince = 0;
  private speed = 0;
  private synthPressure = 1;
  private spaceHeld = false;
  private gestureFingers = 0;

  opts: ControlOptions = {
    stabilizer: 0.4,
    pressureCurve: 0.5,
    gestureUndo: true,
    invertScroll: false,
    drawEnabled: true,
  };

  constructor(private h: ControlHandlers) {}

  attach(el: HTMLElement) {
    this.detach();
    this.el = el;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("pointerleave", this.onLeave);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("contextmenu", this.onContext);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
  }

  detach() {
    const el = this.el;
    if (!el) return;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.removeEventListener("pointerleave", this.onLeave);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("contextmenu", this.onContext);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    this.el = null;
  }

  /* ------------------------------------------------------------- helpers */

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.el!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private curve(p: number): number {
    // 0.5 is linear; below softens the low end, above makes it snappier.
    const k = 0.4 + this.opts.pressureCurve * 1.8;
    return Math.pow(Math.max(0, Math.min(1, p)), k);
  }

  private sample(e: PointerEvent, live: Live): PointerSample {
    const pen = e.pointerType === "pen";
    let pressure = pen ? e.pressure : this.synthPressure;
    if (pen && pressure <= 0) pressure = 0.5; // some pens report 0 on the first event
    const tiltX = (e.tiltX ?? 0) * (Math.PI / 180);
    const tiltY = (e.tiltY ?? 0) * (Math.PI / 180);
    return {
      x: live.sx,
      y: live.sy,
      pressure: this.curve(pressure),
      tilt: Math.min(1, Math.hypot(tiltX, tiltY) / (Math.PI / 2)),
      azimuth: Math.atan2(tiltY, tiltX),
      t: e.timeStamp,
      pen,
    };
  }

  /** Exponential smoothing. This is the difference between a shaky line and a confident one. */
  private stabilize(live: Live, x: number, y: number) {
    const a = 1 - 0.86 * Math.max(0, Math.min(1, this.opts.stabilizer));
    live.sx += (x - live.sx) * a;
    live.sy += (y - live.sy) * a;
  }

  private touchCount(): number {
    let n = 0;
    this.pointers.forEach((p) => {
      if (p.type === "touch") n++;
    });
    return n;
  }

  private twoFinger(): [Live, Live] | null {
    const all = Array.from(this.pointers.values()).filter((p) => p.type === "touch");
    return all.length >= 2 ? [all[0], all[1]] : null;
  }

  /* -------------------------------------------------------------- events */

  private onDown = (e: PointerEvent) => {
    if (!this.el) return;
    const { x, y } = this.local(e);

    if (e.pointerType === "pen") this.penActive = true;
    // Palm rejection: once a pen is on the glass, touches are not input.
    if (e.pointerType === "touch" && this.penActive) return;

    const live: Live = {
      id: e.pointerId, type: e.pointerType, x, y, sx: x, sy: y,
      startX: x, startY: y, startT: e.timeStamp, moved: 0,
    };
    this.pointers.set(e.pointerId, live);
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Capture is an optimisation, not a requirement; never let it stop a stroke.
    }
    this.gestureFingers = Math.max(this.gestureFingers, this.touchCount());

    const touches = this.touchCount();

    if (e.pointerType === "touch" && touches >= 2) {
      // A second finger during a stroke means the user wants to navigate, not draw.
      if (this.mode === "draw") {
        this.h.cancel();
        this.drawId = -1;
      }
      this.mode = touches >= 3 ? "pan" : "pinch";
      const pair = this.twoFinger();
      if (pair) {
        this.lastDist = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        this.lastMid = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
      }
      return;
    }

    if (e.pointerType === "mouse") {
      if (e.button === 1 || (e.button === 0 && this.spaceHeld)) { this.mode = "pan"; return; }
      if (e.button === 2 || (e.button === 0 && e.altKey)) { this.mode = "orbit"; return; }
      if (e.button !== 0) { this.mode = "dead"; return; }
    }

    if (!this.opts.drawEnabled) { this.mode = "dead"; return; }

    this.mode = "draw";
    this.drawId = e.pointerId;
    this.synthPressure = 1;
    this.speed = 0;
    this.stillSince = e.timeStamp;
    this.lastMoveT = e.timeStamp;
    this.h.begin(this.sample(e, live));
  };

  private onMove = (e: PointerEvent) => {
    if (!this.el) return;
    const live = this.pointers.get(e.pointerId);
    const { x, y } = this.local(e);

    if (!live) {
      if (this.mode === "idle") this.h.hover(x, y);
      return;
    }
    if (e.pointerType === "touch" && this.penActive) return;

    const dx = x - live.x;
    const dy = y - live.y;
    live.x = x;
    live.y = y;
    live.moved += Math.hypot(dx, dy);

    switch (this.mode) {
      case "draw": {
        if (e.pointerId !== this.drawId) return;
        // Coalesced events give the full input rate rather than one sample per
        // frame. Not every browser or event has them, so fall back to the event.
        let events: PointerEvent[] = [e];
        if (typeof e.getCoalescedEvents === "function") {
          const c = e.getCoalescedEvents();
          if (c.length) events = c as PointerEvent[];
        }
        const dt = Math.max(1, e.timeStamp - this.lastMoveT);
        this.lastMoveT = e.timeStamp;
        const inst = Math.hypot(dx, dy) / dt;
        this.speed += (inst - this.speed) * 0.3;
        if (e.pointerType !== "pen") {
          // Without a pen, speed stands in for pressure: fast is light.
          const target = 1 - Math.min(0.5, this.speed * 0.32);
          this.synthPressure += (target - this.synthPressure) * 0.25;
        }
        if (Math.hypot(x - live.startX, y - live.startY) > TAP_SLOP) live.startT = -1;
        if (Math.hypot(dx, dy) > 1.2) this.stillSince = e.timeStamp;

        for (const ce of events) {
          const p = this.local(ce as PointerEvent);
          this.stabilize(live, p.x, p.y);
          this.h.move(this.sample(ce as PointerEvent, live));
        }
        break;
      }
      case "orbit":
        this.h.orbit(dx, dy);
        break;
      case "pan":
        if (e.pointerType === "touch") {
          const all = Array.from(this.pointers.values()).filter((p) => p.type === "touch");
          const mid = all.reduce((a, p) => ({ x: a.x + p.x / all.length, y: a.y + p.y / all.length }), { x: 0, y: 0 });
          this.h.pan(mid.x - this.lastMid.x, mid.y - this.lastMid.y);
          this.lastMid = mid;
        } else {
          this.h.pan(dx, dy);
        }
        break;
      case "pinch": {
        const pair = this.twoFinger();
        if (!pair) break;
        const dist = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        const mid = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
        if (this.lastDist > 0 && Math.abs(dist - this.lastDist) > 0.5) {
          this.h.dolly(this.lastDist / dist);
        }
        // Two fingers dragging together orbit; spreading apart zooms.
        this.h.orbit(mid.x - this.lastMid.x, mid.y - this.lastMid.y);
        this.lastDist = dist;
        this.lastMid = mid;
        break;
      }
      default:
        break;
    }
  };

  private onUp = (e: PointerEvent) => {
    const live = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    try {
      this.el?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }

    if (live && this.mode === "draw" && e.pointerId === this.drawId) {
      const held = this.stillSince > 0 ? e.timeStamp - this.stillSince : 0;
      this.h.end(this.sample(e, live), live.moved > TAP_SLOP ? held : 0);
      this.drawId = -1;
    }

    if (this.pointers.size === 0) {
      // Multi-finger taps: quick, barely moved, never turned into a drag.
      if (this.opts.gestureUndo && live && this.gestureFingers >= 2 && live.type === "touch") {
        const quick = e.timeStamp - live.startT < TAP_MS && live.moved < TAP_SLOP;
        if (quick) this.h.tap(this.gestureFingers);
      }
      this.gestureFingers = 0;
      this.mode = "idle";
      this.lastDist = 0;
      if (e.pointerType === "pen") this.penActive = false;
    } else if (this.mode === "pinch" && this.touchCount() < 2) {
      this.mode = "dead";
    }
  };

  private onLeave = () => {
    if (this.mode === "idle") this.h.hover(-1, -1);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const sign = this.opts.invertScroll ? -1 : 1;
    const d = e.deltaY * sign;
    if (e.shiftKey) this.h.adjustSize(-d * 0.0012);
    else if (e.altKey || e.ctrlKey || e.metaKey) this.h.adjustDepth(-d * 0.01);
    else this.h.dolly(Math.pow(1.0016, d));
  };

  private onContext = (e: Event) => e.preventDefault();

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "Space") this.spaceHeld = e.type === "keydown";
  };
}
