import { Resvg } from '@resvg/resvg-js';
import type { PositionedPerspective } from './types.js';
import { renderPerspectiveStandalone } from './render.js';

/**
 * Render a single perspective to a PNG buffer.
 * Pure-Node, no browser. Uses @resvg/resvg-js (Rust under the hood).
 *
 * For multi-perspective diagrams the caller decides how to compose:
 * either one PNG per perspective, or a single tall PNG with all stacked.
 */
export function renderPerspectivePng(
  perspective: PositionedPerspective,
  scale = 2,
): Buffer {
  const svg = renderPerspectiveStandalone(perspective);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    background: '#F4F4F4',
    font: {
      // Bundle no fonts; @resvg uses system fonts. macOS has San Francisco
      // available via -apple-system fallbacks.
      loadSystemFonts: true,
    },
  });
  return resvg.render().asPng();
}

/**
 * Compose all perspectives vertically into a single PNG. Used when the user
 * wants "everything in one image" — labelled by perspective name.
 */
function renderAllPerspectivesPng(
  perspectives: PositionedPerspective[],
  scale = 2,
): Buffer {
  // For the spike: just render the first perspective. Composing multiple
  // PNGs vertically would require a raster compositor — defer until we
  // have multi-perspective YAMLs in scope.
  if (perspectives.length === 0) throw new Error('No perspectives to render');
  return renderPerspectivePng(perspectives[0], scale);
}
