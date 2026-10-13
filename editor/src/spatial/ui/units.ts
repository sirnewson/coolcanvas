import type { UnitSystem } from "../types";

/** One world unit is one metre. Units are only a matter of display. */
const FACTOR: Record<UnitSystem, number> = { m: 1, cm: 100, mm: 1000, ft: 3.28084, in: 39.3701 };

export const UNITS: UnitSystem[] = ["mm", "cm", "m", "in", "ft"];

export function formatLength(metres: number, unit: UnitSystem): string {
  const v = metres * (FACTOR[unit] ?? 100);
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${unit}`;
}
