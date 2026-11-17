/** Ledger figures. Always en-US so server and phone render the same glyphs. */

const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatInt(n: number): string {
  return INT.format(Math.round(n));
}

export function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Signed inflation or similar rates, e.g. +6.2% or −1.4%. */
export function formatSignedPct(rate: number): string {
  if (Math.abs(rate) < 0.0005) return "0.0%";
  return `${rate > 0 ? "+" : "−"}${formatPct(Math.abs(rate))}`;
}

function signOf(n: number): string {
  return n > 0 ? "+" : "−";
}

export function formatSignedInt(n: number): string {
  if (Math.abs(n) < 0.5) return "0";
  return signOf(n) + formatInt(Math.abs(n));
}

export function formatSignedPp(deltaRate: number): string {
  const pp = deltaRate * 100;
  if (Math.abs(pp) < 0.05) return "0.0 pp";
  return `${signOf(pp)}${Math.abs(pp).toFixed(1)} pp`;
}

export function formatSignedPoints(n: number): string {
  if (Math.abs(n) < 0.5) return "0";
  return signOf(n) + formatInt(Math.abs(n));
}

/** Compact marks for revenue, reserve, and program cost. */
export function formatMarks(n: number): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(2)}b`;
  }
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const digits = millions >= 100 ? 0 : 1;
    return `${sign}${millions.toFixed(digits)}m`;
  }
  if (abs >= 10_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}k`;
  }
  return sign + formatInt(abs);
}

export function formatSignedMarks(n: number): string {
  if (Math.abs(n) < 50_000) return "0";
  const sign = n > 0 ? "+" : "−";
  return sign + formatMarks(Math.abs(n)).replace("−", "");
}

export function stabilityWord(n: number): string {
  if (n >= 80) return "Settled";
  if (n >= 65) return "Steady";
  if (n >= 50) return "Strained";
  if (n >= 35) return "Uneasy";
  if (n >= 20) return "Unrest";
  return "Crisis";
}
