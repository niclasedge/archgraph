/**
 * Color resolver. Ilograph accepts CSS named colors, hex codes, and a small
 * named palette. We reproduce the common ones and fall back to a neutral.
 */

const named: Record<string, string> = {
  // Standard CSS named colors used in the reference YAMLs
  navy: '#001F5C',
  firebrick: '#B22222',
  purple: '#6A0DAD',
  gray: '#7A7A7A',
  grey: '#7A7A7A',
  red: '#C0392B',
  green: '#27AE60',
  blue: '#2E70C7',
  orange: '#E67E22',
  teal: '#16A085',
  black: '#222222',
  white: '#FFFFFF',
};

const DEFAULT_COLOR = '#3A6FB5';

export function resolveColor(input: string | undefined): string {
  if (!input) return DEFAULT_COLOR;
  const k = input.trim().toLowerCase();
  if (named[k]) return named[k];
  if (k.startsWith('#')) return input.trim();
  // Some Ilograph colors come as CSS rgb(...) or hsl(...) — pass through.
  if (k.startsWith('rgb') || k.startsWith('hsl')) return input.trim();
  return DEFAULT_COLOR;
}

/** Lighter background tint for the title strip of a leaf resource. */
export function tint(hex: string, amount = 0.15): string {
  // Cheap mix-with-white. Accepts #rrggbb only; pass-through otherwise.
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number): number =>
    Math.round(c + (255 - c) * amount);
  const toHex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
