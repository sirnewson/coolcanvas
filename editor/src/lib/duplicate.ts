/**
 * Remembers the last move/duplicate delta so repeated CMD+D keeps the same
 * spacing as the first alt-drag (blueprint §47).
 */
export const dupState = {
  dx: 24,
  dy: 24,
  set(dx: number, dy: number) {
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    this.dx = dx;
    this.dy = dy;
  },
  reset() {
    this.dx = 24;
    this.dy = 24;
  },
};
