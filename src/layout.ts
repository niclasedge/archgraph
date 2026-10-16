import ELK from 'elkjs';
import type {
  Diagram,
  Perspective,
  PositionedEdge,
  PositionedPerspective,
  PositionedResource,
  Resource,
} from './types.js';

/**
 * Run elkjs over a perspective and produce absolute coordinates for every
 * resource and edge bend point.
 *
 * Sizing strategy (spike): leaf resources get a fixed-size box derived from
 * the longest text run; compound resources get padding that ELK uses for the
 * compound layout. ELK layered with `nodeNodeBetweenLayers` + `nodeNode`
 * spacing produces the rank-style hierarchy that closely resembles Ilograph.
 */

const elk = new ELK();

const LEAF_WIDTH = 200;
const LEAF_HEIGHT = 96;
const COMPOUND_PADDING = { top: 56, left: 16, right: 16, bottom: 16 };

interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  children?: ElkNode[];
  edges?: ElkEdge[];
  layoutOptions?: Record<string, string>;
  labels?: { text: string }[];
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
  labels?: { text: string; width?: number; height?: number }[];
}

interface ElkLaidOut {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkLaidOut[];
  edges?: ElkLaidOutEdge[];
}

interface ElkLaidOutEdge {
  id: string;
  sources: string[];
  targets: string[];
  container?: string;
  sections?: {
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    bendPoints?: { x: number; y: number }[];
  }[];
  labels?: { x: number; y: number; width?: number; height?: number; text: string }[];
}

function toElkResource(r: Resource): ElkNode {
  if (r.children.length === 0) {
    return {
      id: r.id,
      width: LEAF_WIDTH,
      height: LEAF_HEIGHT,
      labels: [{ text: r.name }],
    };
  }
  return {
    id: r.id,
    children: r.children.map(toElkResource),
    labels: [{ text: r.name }],
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.padding': `[top=${COMPOUND_PADDING.top},left=${COMPOUND_PADDING.left},right=${COMPOUND_PADDING.right},bottom=${COMPOUND_PADDING.bottom}]`,
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.spacing.nodeNode': '40',
    },
  };
}

/**
 * Keep only the resources a perspective actually uses, plus their ancestors, so
 * each perspective shows its own slice of the model instead of the whole tree.
 */
function pruneUnused(resources: Resource[], used: Set<string>): Resource[] {
  const out: Resource[] = [];
  for (const r of resources) {
    const children = pruneUnused(r.children, used);
    if (used.has(r.id) || children.length > 0) out.push({ ...r, children });
  }
  return out;
}

/** ELK only reserves room for an edge label when it is given a size. */
function edgeLabel(text: string): { text: string; width: number; height: number } {
  return { text, width: Math.ceil(text.length * 6.5) + 16, height: 18 };
}

/** Build a flat list of every leaf resource id in the tree. */
function leafIds(r: Resource): string[] {
  if (r.children.length === 0) return [r.id];
  return r.children.flatMap(leafIds);
}

/**
 * For an edge that targets a compound resource, ELK will route the arrow into
 * the compound's border. The user's intent is usually "talk to the group as a
 * whole", so we keep the relation as-is — ELK handles compound-as-target.
 *
 * However, edges between siblings inside a compound and resources outside the
 * compound need cross-hierarchy support. We enable this via
 * `elk.hierarchyHandling=INCLUDE_CHILDREN`.
 */
function buildElkGraph(diagram: Diagram, perspective: Perspective): ElkNode {
  const used = new Set<string>();
  for (const r of perspective.relations) {
    used.add(r.from);
    used.add(r.to);
  }
  const childrenNodes = pruneUnused(diagram.resources, used).map(toElkResource);

  const knownIds = new Set<string>();
  function collect(n: ElkNode): void {
    knownIds.add(n.id);
    for (const c of n.children ?? []) collect(c);
  }
  for (const n of childrenNodes) collect(n);

  const edges: ElkEdge[] = perspective.relations
    .filter((r) => knownIds.has(r.from) && knownIds.has(r.to))
    .map((r, i) => ({
      id: `e${i}`,
      sources: [r.from],
      targets: [r.to],
      labels: r.label ? [edgeLabel(r.label)] : undefined,
    }));

  return {
    id: 'root',
    children: childrenNodes,
    edges,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '50',
      'elk.spacing.edgeNode': '30',
      'elk.spacing.edgeEdge': '20',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': '[top=40,left=40,right=40,bottom=40]',
    },
  };
}

/** Walk the laid-out tree and produce IR-shaped positioned resources. */
function lift(
  laidOut: ElkLaidOut,
  origIndex: Map<string, Resource>,
  offsetX = 0,
  offsetY = 0,
): PositionedResource[] {
  const out: PositionedResource[] = [];
  for (const child of laidOut.children ?? []) {
    const orig = origIndex.get(child.id);
    if (!orig) continue;
    const x = (child.x ?? 0) + offsetX;
    const y = (child.y ?? 0) + offsetY;
    const positioned: PositionedResource = {
      ...orig,
      x,
      y,
      width: child.width ?? LEAF_WIDTH,
      height: child.height ?? LEAF_HEIGHT,
      children: lift(child, origIndex, x, y),
    };
    out.push(positioned);
  }
  return out;
}

/** Build id → absolute position map by walking the laid-out tree. */
function absPositions(laidOut: ElkLaidOut): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  map.set(laidOut.id, { x: 0, y: 0 });
  function visit(node: ElkLaidOut, ox: number, oy: number): void {
    for (const c of node.children ?? []) {
      const ax = (c.x ?? 0) + ox;
      const ay = (c.y ?? 0) + oy;
      map.set(c.id, { x: ax, y: ay });
      visit(c, ax, ay);
    }
  }
  visit(laidOut, 0, 0);
  return map;
}

function liftEdges(laidOut: ElkLaidOut): PositionedEdge[] {
  const positions = absPositions(laidOut);
  const edges: PositionedEdge[] = [];

  /**
   * ELK with `hierarchyHandling=INCLUDE_CHILDREN` flattens all edges into
   * `root.edges`, but tags each edge with a `container` field naming the LCA.
   * Edge coordinates (start/end/bend points and label position) are RELATIVE
   * to that container's origin — so we look up the container's absolute
   * position and offset everything by that.
   *
   * For safety we still recurse into children in case some edges land there
   * (older ELK versions, or non-INCLUDE_CHILDREN configs).
   */
  function processEdges(elkEdges: ElkLaidOutEdge[] | undefined, fallbackContainer: string): void {
    for (const e of elkEdges ?? []) {
      const containerId = e.container ?? fallbackContainer;
      const offset = positions.get(containerId) ?? { x: 0, y: 0 };
      const sec = e.sections?.[0];
      if (!sec) continue;
      const ox = offset.x;
      const oy = offset.y;
      const start = { x: sec.startPoint.x + ox, y: sec.startPoint.y + oy };
      const end = { x: sec.endPoint.x + ox, y: sec.endPoint.y + oy };
      const bends = (sec.bendPoints ?? []).map((b) => ({
        x: b.x + ox,
        y: b.y + oy,
      }));
      const lab = e.labels?.[0];
      edges.push({
        from: e.sources[0],
        to: e.targets[0],
        label: lab?.text,
        bendPoints: bends,
        source: start,
        target: end,
        labelPosition:
          lab && lab.x !== undefined && lab.y !== undefined
            ? { x: lab.x + ox, y: lab.y + oy }
            : undefined,
      });
    }
  }

  function visit(node: ElkLaidOut): void {
    processEdges(node.edges, node.id);
    for (const c of node.children ?? []) visit(c);
  }
  visit(laidOut);
  return edges;
}

function buildIndex(roots: Resource[]): Map<string, Resource> {
  const idx = new Map<string, Resource>();
  function visit(r: Resource): void {
    idx.set(r.id, r);
    for (const c of r.children) visit(c);
  }
  for (const r of roots) visit(r);
  return idx;
}

async function layoutPerspective(
  diagram: Diagram,
  perspective: Perspective,
): Promise<PositionedPerspective> {
  const elkGraph = buildElkGraph(diagram, perspective);
  const result = (await elk.layout(elkGraph)) as ElkLaidOut;
  const index = buildIndex(diagram.resources);
  const resources = lift(result, index, 0, 0);
  const edges = liftEdges(result);
  return {
    name: perspective.name,
    notes: perspective.notes,
    width: result.width ?? 800,
    height: result.height ?? 600,
    resources,
    edges,
  };
}

export async function layoutAll(
  diagram: Diagram,
): Promise<PositionedPerspective[]> {
  const out: PositionedPerspective[] = [];
  for (const p of diagram.perspectives) {
    out.push(await layoutPerspective(diagram, p));
  }
  return out;
}
