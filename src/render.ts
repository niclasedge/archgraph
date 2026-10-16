import type {
  PositionedEdge,
  PositionedPerspective,
  PositionedResource,
} from './types.js';
import { iconSvg } from './icons.js';
import { resolveColor, tint } from './colors.js';

/** Escape XML special characters in user-supplied text. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Escape multi-line text and break into <tspan> rows for SVG <text>. */
function tspanLines(
  text: string,
  x: number,
  dy: number,
  className: string,
  maxWidth: number,
  fontSize: number,
): string {
  // Naive char-based wrapping; sufficient for short subtitles/descriptions.
  const charWidth = fontSize * 0.55;
  const maxChars = Math.max(8, Math.floor(maxWidth / charWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines
    .map(
      (line, i) =>
        `<tspan x="${x}" dy="${i === 0 ? dy : fontSize * 1.15}" class="${className}">${esc(line)}</tspan>`,
    )
    .join('');
}

/** A leaf resource block: solid colour band on the left, name, subtitle, icon. */
function renderLeaf(r: PositionedResource): string {
  const fill = resolveColor(r.color);
  const lightFill = tint(fill, 0.92);
  const stripeWidth = 8;
  const iconSize = 36;
  const padding = 14;
  const isPlural = r.style === 'plural';

  // For plural-style: stack two extra rectangles behind the main one.
  const pluralLayers = isPlural
    ? `<rect class="plural-layer" x="${r.x + 6}" y="${r.y - 6}" width="${r.width}" height="${r.height}" rx="4" ry="4" />
       <rect class="plural-layer" x="${r.x + 3}" y="${r.y - 3}" width="${r.width}" height="${r.height}" rx="4" ry="4" />`
    : '';

  // Title bar with white text on the colour.
  const titleBarHeight = 32;

  const titleY = r.y + 21;
  const subtitleY = r.y + titleBarHeight + 18;
  const descY = r.y + titleBarHeight + 38;

  const iconBlock = r.icon
    ? `<g transform="translate(${r.x + r.width - iconSize - padding},${r.y + (titleBarHeight - iconSize) / 2 + 0})">${iconSvg(r.icon, iconSize, '#FFFFFF')}</g>`
    : '';

  const subtitleBlock = r.subtitle
    ? `<text class="resource-subtitle" x="${r.x + padding}" y="${subtitleY}">${esc(r.subtitle)}</text>`
    : '';

  const descBlock = r.description
    ? `<text class="resource-description" x="${r.x + padding}" y="${descY}">${tspanLines(r.description, r.x + padding, 0, 'resource-description-line', r.width - padding * 2, 11)}</text>`
    : '';

  return `
    <g class="resource leaf" data-id="${esc(r.id)}" data-color="${esc(r.color ?? '')}">
      ${pluralLayers}
      <rect class="resource-bg" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="4" ry="4" fill="#FFFFFF" />
      <rect class="resource-titlebar" x="${r.x}" y="${r.y}" width="${r.width}" height="${titleBarHeight}" rx="4" ry="4" fill="${fill}" />
      <rect class="resource-titlebar-bottom" x="${r.x}" y="${r.y + titleBarHeight - 4}" width="${r.width}" height="4" fill="${fill}" />
      <text class="resource-title" x="${r.x + padding}" y="${titleY}">${esc(r.name)}</text>
      ${iconBlock}
      ${subtitleBlock}
      ${descBlock}
      <rect class="resource-stripe" x="${r.x}" y="${r.y + titleBarHeight}" width="${stripeWidth}" height="${r.height - titleBarHeight}" fill="${fill}" opacity="0.35" />
      <rect class="resource-border" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="4" ry="4" fill="none" stroke="${tint(fill, 0.5)}" stroke-width="1" />
    </g>
  `;
}

/** A compound resource: large container with a header and recursively rendered children. */
function renderCompound(r: PositionedResource): string {
  const fill = resolveColor(r.color);
  const headerHeight = 44;
  const padding = 14;

  return `
    <g class="resource compound" data-id="${esc(r.id)}" data-color="${esc(r.color ?? '')}">
      <rect class="compound-bg" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="6" ry="6" fill="${tint(fill, 0.93)}" />
      <rect class="compound-header" x="${r.x}" y="${r.y}" width="${r.width}" height="${headerHeight}" rx="6" ry="6" fill="${fill}" />
      <rect class="compound-header-bottom" x="${r.x}" y="${r.y + headerHeight - 6}" width="${r.width}" height="6" fill="${fill}" />
      <text class="compound-title" x="${r.x + padding}" y="${r.y + 22}">${esc(r.name)}</text>
      ${r.subtitle ? `<text class="compound-subtitle" x="${r.x + padding}" y="${r.y + 37}">${esc(r.subtitle)}</text>` : ''}
      <rect class="compound-border" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="6" ry="6" fill="none" stroke="${fill}" stroke-width="1.5" opacity="0.6" />
      ${r.children.map(renderResource).join('')}
    </g>
  `;
}

function renderResource(r: PositionedResource): string {
  if (r.children.length === 0) return renderLeaf(r);
  return renderCompound(r);
}

/** Convert ELK's bend-points into an SVG path with rounded corners. */
function edgePath(e: PositionedEdge): string {
  const pts = [e.source, ...e.bendPoints, e.target];
  if (pts.length < 2) return '';
  // Simple polyline; ELK's ORTHOGONAL routing produces enough segments that
  // a sharp polyline is already legible. Round corners at bend points.
  const r = 6;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const dx1 = Math.sign(cur.x - prev.x);
    const dy1 = Math.sign(cur.y - prev.y);
    const dx2 = Math.sign(next.x - cur.x);
    const dy2 = Math.sign(next.y - cur.y);
    // approach point r before the bend
    const ax = cur.x - dx1 * r;
    const ay = cur.y - dy1 * r;
    // exit point r after the bend
    const bx = cur.x + dx2 * r;
    const by = cur.y + dy2 * r;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)}`;
    d += ` Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${pts[pts.length - 1].y.toFixed(1)}`;
  return d;
}

function renderEdge(e: PositionedEdge): string {
  const path = edgePath(e);
  const labelBlock =
    e.label && e.labelPosition
      ? `
      <g class="edge-label" data-from="${esc(e.from)}" data-to="${esc(e.to)}">
        <rect class="edge-label-bg"
              x="${e.labelPosition.x - 4}" y="${e.labelPosition.y - 12}"
              width="${e.label.length * 6.5 + 8}" height="18" rx="3" ry="3" />
        <text class="edge-label-text"
              x="${e.labelPosition.x}" y="${e.labelPosition.y + 1}">${esc(e.label)}</text>
      </g>`
      : '';
  return `
    <g class="edge" data-from="${esc(e.from)}" data-to="${esc(e.to)}">
      <path class="edge-line" d="${path}" fill="none" marker-end="url(#arrowhead)" />
      ${labelBlock}
    </g>
  `;
}

const ARROW_DEFS = `
  <defs>
    <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
    </marker>
  </defs>
`;

/** Render one perspective into a free-standing SVG fragment. */
export function renderPerspective(p: PositionedPerspective): string {
  const margin = 20;
  const width = p.width + margin * 2;
  const height = p.height + margin * 2;
  return `
    <svg class="ag-perspective" data-perspective="${esc(p.name)}"
         viewBox="0 0 ${width} ${height}"
         preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg">
      ${ARROW_DEFS}
      <g class="ag-viewport" transform="translate(${margin},${margin})">
        <g class="ag-resources">${p.resources.map(renderResource).join('')}</g>
        <g class="ag-edges">${p.edges.map(renderEdge).join('')}</g>
      </g>
    </svg>
  `;
}

/** Standalone SVG (for PNG export): no panes, no chrome, full diagram. */
export function renderPerspectiveStandalone(p: PositionedPerspective): string {
  const margin = 20;
  const width = p.width + margin * 2;
  const height = p.height + margin * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}" height="${height}"
     viewBox="0 0 ${width} ${height}">
  <style>${EMBEDDED_SVG_STYLES}</style>
  ${ARROW_DEFS}
  <rect width="100%" height="100%" fill="#F4F4F4" />
  <g transform="translate(${margin},${margin})">
    <g class="ag-resources">${p.resources.map(renderResource).join('')}</g>
    <g class="ag-edges">${p.edges.map(renderEdge).join('')}</g>
  </g>
</svg>`;
}

/**
 * Inline styles for the standalone SVG (used by PNG renderer which has no
 * external CSS support). Keep these minimal — same look as the HTML version.
 */
export const EMBEDDED_SVG_STYLES = `
  .resource-title { font: 600 14px -apple-system, "Segoe UI", Roboto, sans-serif; fill: #FFFFFF; dominant-baseline: middle; }
  .compound-title { font: 600 16px -apple-system, "Segoe UI", Roboto, sans-serif; fill: #FFFFFF; dominant-baseline: middle; }
  .compound-subtitle { font: 400 11px -apple-system, sans-serif; fill: rgba(255,255,255,0.85); }
  .resource-subtitle { font: 400 11px -apple-system, sans-serif; fill: #555; }
  .resource-description { font: 400 11px -apple-system, sans-serif; fill: #777; }
  .resource-description-line { font: 400 11px -apple-system, sans-serif; fill: #777; }
  .edge-line { stroke: #555555; stroke-width: 1.6; opacity: 0.65; color: #555555; }
  .edge-label-bg { fill: #FAFAFA; stroke: #DDD; stroke-width: 0.5; }
  .edge-label-text { font: 500 11px -apple-system, sans-serif; fill: #333; dominant-baseline: middle; }
  .plural-layer { fill: #FFFFFF; stroke: #BBB; stroke-width: 0.8; opacity: 0.9; }
`;
