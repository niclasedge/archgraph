import type { Diagram, PositionedPerspective } from './types.js';
import { renderPerspective } from './render.js';
import { EMBEDDED_SVG_STYLES } from './render.js';

/** CSS theme for the HTML viewer. Inspired by Ilograph (transition timings,
 * neutral background, white resource cards) but written from scratch. */
const CSS = `
  :root {
    --ag-bg: #F4F4F4;
    --ag-bg-alt: #FAFAFA;
    --ag-text: #2E2E2E;
    --ag-muted: #707070;
    --ag-border: #DADADA;
    --ag-accent: #3A6FB5;
    --ag-arrow-opacity: 0.65;
    --ag-arrow-opacity-faded: 0.12;
    --ag-transition-time: 0.45s;
    --ag-transition-time-fast: 0.2s;
    --ag-tray-h: 44px;
    --ag-topbar-h: 48px;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    color: var(--ag-text);
    background: var(--ag-bg);
    overflow: hidden;
  }

  /* ============== Topbar ============== */
  .ag-topbar {
    height: var(--ag-topbar-h);
    background: #FFFFFF;
    border-bottom: 1px solid var(--ag-border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 16px;
    position: relative;
    z-index: 10;
  }
  .ag-title {
    font-weight: 600;
    font-size: 15px;
    flex-shrink: 0;
  }
  .ag-description {
    font-size: 12px;
    color: var(--ag-muted);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ag-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .ag-button {
    background: var(--ag-bg-alt);
    border: 1px solid var(--ag-border);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    transition: background var(--ag-transition-time-fast);
  }
  .ag-button:hover { background: #EEEEEE; }
  .ag-button.active { background: var(--ag-accent); color: white; border-color: var(--ag-accent); }

  /* ============== Main canvas ============== */
  .ag-main {
    position: absolute;
    top: var(--ag-topbar-h);
    bottom: var(--ag-tray-h);
    left: 0;
    right: 0;
    overflow: hidden;
    background: var(--ag-bg);
  }
  .ag-canvas {
    width: 100%;
    height: 100%;
    cursor: grab;
    overflow: hidden;
    position: relative;
  }
  .ag-canvas.dragging { cursor: grabbing; }

  .ag-perspective {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity var(--ag-transition-time), visibility 0s var(--ag-transition-time);
  }
  .ag-perspective.active {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition: opacity var(--ag-transition-time);
  }

  /* ============== Resources ============== */
  .resource { transition: opacity var(--ag-transition-time); cursor: default; }
  .resource-title { font: 600 14px -apple-system, sans-serif; fill: #FFFFFF; dominant-baseline: middle; }
  .compound-title { font: 600 16px -apple-system, sans-serif; fill: #FFFFFF; dominant-baseline: middle; }
  .compound-subtitle { font: 400 11px -apple-system, sans-serif; fill: rgba(255,255,255,0.85); }
  .resource-subtitle { font: 400 11px -apple-system, sans-serif; fill: #555; }
  .resource-description { font: 400 11px -apple-system, sans-serif; fill: #777; }
  .resource-description-line { font: 400 11px -apple-system, sans-serif; fill: #777; }
  .plural-layer { fill: #FFFFFF; stroke: #BBB; stroke-width: 0.8; opacity: 0.9; }
  .resource-icon { color: #FFFFFF; }

  .resource:hover .resource-bg,
  .resource:hover .compound-bg {
    filter: brightness(1.02);
  }

  /* Highlight when hovering a related edge */
  body.has-hover .resource:not(.related) {
    opacity: 0.25;
  }
  body.has-hover .edge:not(.active) .edge-line {
    opacity: var(--ag-arrow-opacity-faded);
  }
  body.has-hover .edge:not(.active) .edge-label {
    opacity: 0.15;
  }

  /* ============== Edges ============== */
  .edge { transition: opacity var(--ag-transition-time-fast); }
  .edge-line {
    stroke: #555555;
    stroke-width: 1.6;
    opacity: var(--ag-arrow-opacity);
    color: #555555;
    transition: opacity var(--ag-transition-time-fast), stroke-width var(--ag-transition-time-fast);
  }
  .edge.active .edge-line {
    stroke: #1F4F8B;
    stroke-width: 2.2;
    opacity: 1;
    color: #1F4F8B;
  }
  .edge-label-bg { fill: var(--ag-bg-alt); stroke: var(--ag-border); stroke-width: 0.5; }
  .edge-label-text { font: 500 11px -apple-system, sans-serif; fill: #333; dominant-baseline: middle; }

  /* ============== Perspective tray ============== */
  .ag-tray {
    position: absolute;
    bottom: 0;
    left: 0; right: 0;
    height: var(--ag-tray-h);
    background: #FFFFFF;
    border-top: 1px solid var(--ag-border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 6px;
    z-index: 10;
  }
  .ag-tray-label {
    font-size: 11px;
    color: var(--ag-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-right: 8px;
  }
  .ag-tab {
    padding: 6px 14px;
    border: 1px solid var(--ag-border);
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    background: var(--ag-bg-alt);
    transition: all var(--ag-transition-time-fast);
  }
  .ag-tab:hover { background: #EEEEEE; }
  .ag-tab.active {
    background: var(--ag-accent);
    color: white;
    border-color: var(--ag-accent);
  }

  /* ============== Notes panel ============== */
  .ag-notes {
    position: absolute;
    top: 16px;
    right: 16px;
    max-width: 320px;
    background: #FFFFFF;
    border: 1px solid var(--ag-border);
    border-radius: 6px;
    padding: 12px 14px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--ag-text);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    z-index: 5;
    opacity: 0;
    visibility: hidden;
    transition: opacity var(--ag-transition-time-fast), visibility 0s var(--ag-transition-time-fast);
    white-space: pre-wrap;
  }
  .ag-notes.visible {
    opacity: 1;
    visibility: visible;
    transition: opacity var(--ag-transition-time-fast);
  }
  .ag-notes-toggle {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    background: #FFFFFF;
    border: 1px solid var(--ag-border);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    color: var(--ag-muted);
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    z-index: 6;
  }
  .ag-notes-toggle:hover { background: var(--ag-bg-alt); }

  ${EMBEDDED_SVG_STYLES}

  /* ============== Footer credit ============== */
  .ag-credit {
    position: absolute;
    bottom: calc(var(--ag-tray-h) + 4px);
    left: 8px;
    font-size: 10px;
    color: var(--ag-muted);
    opacity: 0.6;
  }
  .ag-credit a { color: inherit; }

  @media print {
    .ag-topbar, .ag-tray, .ag-notes, .ag-notes-toggle, .ag-credit { display: none; }
    .ag-main { position: static; }
    .ag-canvas { overflow: visible; }
    .ag-perspective { position: static; opacity: 1 !important; visibility: visible !important; }
  }
`;

const JS = `
(function() {
  'use strict';

  const root = document.querySelector('.ag-canvas');
  if (!root) return;
  const perspectives = Array.from(root.querySelectorAll('.ag-perspective'));
  const tabs = Array.from(document.querySelectorAll('.ag-tab'));
  const body = document.body;

  // ============== Pan + zoom (per perspective via viewBox) ==============
  // We keep the SVG's viewBox as the single source of truth for the visible
  // window. preserveAspectRatio="xMidYMid meet" handles fit-on-load, then
  // pan/zoom mutate the viewBox.
  const state = perspectives.map(svg => {
    const vb = svg.viewBox.baseVal;
    return {
      svg,
      // initial = full content viewBox
      x: vb.x, y: vb.y, w: vb.width, h: vb.height,
      origW: vb.width, origH: vb.height,
    };
  });

  function apply(s) {
    s.svg.setAttribute('viewBox',
      s.x.toFixed(2) + ' ' + s.y.toFixed(2) + ' ' +
      s.w.toFixed(2) + ' ' + s.h.toFixed(2));
  }

  function activeState() {
    return state.find(s => s.svg.classList.contains('active'));
  }

  // pan: translate by (-dx, -dy) in viewBox space
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  root.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const s = activeState();
    if (!s) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    ox = s.x; oy = s.y;
    root.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const s = activeState();
    if (!s) return;
    const rect = root.getBoundingClientRect();
    // pixel→viewBox conversion factor
    const f = s.w / rect.width;
    s.x = ox - (e.clientX - sx) * f;
    s.y = oy - (e.clientY - sy) * f;
    apply(s);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    root.classList.remove('dragging');
  });

  // zoom: change viewBox size, anchored at cursor
  root.addEventListener('wheel', e => {
    e.preventDefault();
    const s = activeState();
    if (!s) return;
    const rect = root.getBoundingClientRect();
    const cxPx = e.clientX - rect.left;
    const cyPx = e.clientY - rect.top;
    // cursor in viewBox coords
    const cxVb = s.x + (cxPx / rect.width) * s.w;
    const cyVb = s.y + (cyPx / rect.height) * s.h;
    const factor = e.deltaY < 0 ? 1 / 1.15 : 1.15; // smaller w → zoom in
    const minW = s.origW / 50;
    const maxW = s.origW * 5;
    const newW = Math.min(maxW, Math.max(minW, s.w * factor));
    const newH = newW * (s.h / s.w);
    s.x = cxVb - (cxPx / rect.width) * newW;
    s.y = cyVb - (cyPx / rect.height) * newH;
    s.w = newW;
    s.h = newH;
    apply(s);
  }, { passive: false });

  function fitToView(s) {
    s.x = 0; s.y = 0; s.w = s.origW; s.h = s.origH;
    apply(s);
  }

  // ============== Hover highlight ==============
  function clearHighlight() {
    body.classList.remove('has-hover');
    document.querySelectorAll('.edge.active').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.resource.related').forEach(n => n.classList.remove('related'));
  }

  function highlightEdge(edge) {
    body.classList.add('has-hover');
    edge.classList.add('active');
    const from = edge.dataset.from;
    const to = edge.dataset.to;
    document.querySelectorAll('.resource[data-id="' + CSS.escape(from) + '"]').forEach(n => n.classList.add('related'));
    document.querySelectorAll('.resource[data-id="' + CSS.escape(to) + '"]').forEach(n => n.classList.add('related'));
  }

  function highlightResource(res) {
    body.classList.add('has-hover');
    res.classList.add('related');
    const id = res.dataset.id;
    document.querySelectorAll('.edge').forEach(e => {
      if (e.dataset.from === id || e.dataset.to === id) {
        e.classList.add('active');
        const other = e.dataset.from === id ? e.dataset.to : e.dataset.from;
        document.querySelectorAll('.resource[data-id="' + CSS.escape(other) + '"]').forEach(n => n.classList.add('related'));
      }
    });
  }

  document.querySelectorAll('.edge').forEach(e => {
    e.addEventListener('mouseenter', () => { clearHighlight(); highlightEdge(e); });
    e.addEventListener('mouseleave', clearHighlight);
  });
  document.querySelectorAll('.resource').forEach(r => {
    r.addEventListener('mouseenter', () => { clearHighlight(); highlightResource(r); });
    r.addEventListener('mouseleave', clearHighlight);
  });

  // ============== Perspective switching ==============
  function activatePerspective(name) {
    perspectives.forEach(p => {
      const isActive = p.dataset.perspective === name;
      p.classList.toggle('active', isActive);
    });
    tabs.forEach(t => t.classList.toggle('active', t.dataset.perspective === name));
    document.querySelectorAll('.ag-notes').forEach(n => n.classList.remove('visible'));
  }
  tabs.forEach(t => {
    t.addEventListener('click', () => activatePerspective(t.dataset.perspective));
  });

  // Fit button
  document.getElementById('ag-fit')?.addEventListener('click', () => {
    const s = activeState();
    if (s) fitToView(s);
  });

  // Notes toggle
  const notesToggle = document.querySelector('.ag-notes-toggle');
  if (notesToggle) {
    notesToggle.addEventListener('click', () => {
      const active = perspectives.find(p => p.classList.contains('active'));
      if (!active) return;
      const name = active.dataset.perspective;
      const notesEl = document.querySelector('.ag-notes[data-perspective="' + CSS.escape(name) + '"]');
      if (notesEl) notesEl.classList.toggle('visible');
    });
  }

  // ============== Init ==============
  // SVG's preserveAspectRatio handles initial fit-on-load; nothing to do.
  if (perspectives.length) {
    activatePerspective(perspectives[0].dataset.perspective);
  }
})();
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTitle(diagram: Diagram, perspectives: PositionedPerspective[]): string {
  // Pull a sensible title: first line of description (if any), otherwise
  // "archgraph diagram".
  if (diagram.description) {
    const firstLine = diagram.description.split(/\r?\n/, 1)[0]
      .replace(/[*_`#]/g, '').trim();
    if (firstLine) return firstLine.slice(0, 80);
  }
  return perspectives[0]?.name ?? 'archgraph diagram';
}

export interface RenderHtmlOptions {
  title?: string;
}

/** Render a complete HTML viewer for a diagram. */
export function renderHtml(
  diagram: Diagram,
  perspectives: PositionedPerspective[],
  opts: RenderHtmlOptions = {},
): string {
  const title = opts.title ?? renderTitle(diagram, perspectives);

  const tabsHtml = perspectives
    .map(
      (p, i) =>
        `<button class="ag-tab${i === 0 ? ' active' : ''}" data-perspective="${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>`,
    )
    .join('');

  const svgsHtml = perspectives
    .map((p, i) => {
      const svg = renderPerspective(p);
      // Inject the active class on first perspective by post-processing
      // (renderPerspective produces a neutral SVG without classes).
      return svg.replace(
        '<svg class="ag-perspective"',
        `<svg class="ag-perspective${i === 0 ? ' active' : ''}"`,
      );
    })
    .join('');

  const notesHtml = perspectives
    .filter((p) => p.notes)
    .map(
      (p) =>
        `<div class="ag-notes" data-perspective="${escapeHtml(p.name)}">${escapeHtml(p.notes ?? '')}</div>`,
    )
    .join('');

  const hasNotes = perspectives.some((p) => p.notes);

  const description = diagram.description
    ? `<div class="ag-description">${escapeHtml(diagram.description.split(/\r?\n/, 1)[0])}</div>`
    : `<div class="ag-description"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <header class="ag-topbar">
    <div class="ag-title">${escapeHtml(title)}</div>
    ${description}
    <div class="ag-controls">
      <span class="ag-button" id="ag-fit">Fit</span>
    </div>
  </header>
  <main class="ag-main">
    <div class="ag-canvas">
      ${svgsHtml}
    </div>
    ${notesHtml}
    ${hasNotes ? `<button class="ag-notes-toggle" title="Toggle notes">i</button>` : ''}
  </main>
  <footer class="ag-tray">
    <span class="ag-tray-label">Perspective</span>
    ${tabsHtml}
  </footer>
  <div class="ag-credit">Generated by <a href="https://github.com/niclasedge/archgraph" target="_blank" rel="noreferrer">archgraph</a></div>
  <script>${JS}</script>
</body>
</html>`;
}
