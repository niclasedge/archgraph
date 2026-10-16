/**
 * Inline SVG icon library — Ilograph-style stand-ins.
 * Keys are the same names Ilograph uses (e.g. "Networking/user.svg").
 * Each value is an SVG fragment WITHOUT the outer <svg>, so it can be embedded
 * as <symbol> or used directly. ViewBox is normalised to "0 0 24 24".
 *
 * These are hand-drawn from Lucide-inspired strokes so we can ship MIT.
 * If a YAML references an unknown icon name, fallbackIcon() returns a generic
 * box silhouette so layout still works.
 */

interface Icon {
  viewBox: string;
  paths: string;
}

const icons: Record<string, Icon> = {
  'Networking/user.svg': {
    viewBox: '0 0 24 24',
    paths: `
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    `,
  },
  'Networking/cloud-server.svg': {
    viewBox: '0 0 24 24',
    paths: `
      <path d="M6 16h12a4 4 0 0 0 .9-7.9 6 6 0 0 0-11.4-1.6A4.5 4.5 0 0 0 6 16Z" />
      <rect x="9" y="13" width="6" height="2" rx="0.5" />
      <circle cx="10.5" cy="14" r="0.4" />
    `,
  },
  'Networking/database.svg': {
    viewBox: '0 0 24 24',
    paths: `
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    `,
  },
  'Networking/internet.svg': {
    viewBox: '0 0 24 24',
    paths: `
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    `,
  },
  'Networking/router.svg': {
    viewBox: '0 0 24 24',
    paths: `
      <rect x="3" y="14" width="18" height="6" rx="1" />
      <circle cx="7" cy="17" r="0.6" />
      <circle cx="10" cy="17" r="0.6" />
      <path d="M12 11V8" />
      <path d="M9 8a3 3 0 0 1 6 0" />
      <path d="M6 8a6 6 0 0 1 12 0" />
    `,
  },
  'Networking/server.svg': {
    viewBox: '0 0 24 24',
    paths: `
      <rect x="3" y="4" width="18" height="6" rx="1" />
      <rect x="3" y="14" width="18" height="6" rx="1" />
      <circle cx="7" cy="7" r="0.6" />
      <circle cx="7" cy="17" r="0.6" />
    `,
  },
  'Networking/firewall.svg': {
    viewBox: '0 0 24 24',
    paths: `
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
      <path d="M12 7v10" />
      <path d="M8 12h8" />
    `,
  },
};

const fallback: Icon = {
  viewBox: '0 0 24 24',
  paths: `<rect x="4" y="4" width="16" height="16" rx="2" />`,
};

/** Resolve an icon name to an inline SVG body. */
function getIcon(name: string | undefined): Icon {
  if (!name) return fallback;
  return icons[name] ?? fallback;
}

/**
 * Emit the icon as an inline `<svg>` element ready for embedding inside a
 * resource block. White stroke + transparent fill matches Ilographs Networking
 * icon style.
 */
export function iconSvg(
  name: string | undefined,
  size: number,
  stroke = '#FFFFFF',
): string {
  const ic = getIcon(name);
  return (
    `<svg width="${size}" height="${size}" viewBox="${ic.viewBox}" ` +
    `fill="none" stroke="${stroke}" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round" ` +
    `class="resource-icon">${ic.paths}</svg>`
  );
}
