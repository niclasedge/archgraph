import yaml from 'js-yaml';
import { z } from 'zod';
import type { Diagram, Resource, Perspective, Relation } from './types.js';

/**
 * Minimal Zod schema for the Ilograph YAML subset that the spike supports.
 * Extending to the full spec is incremental: add fields here, propagate through
 * layout + renderer.
 *
 * Permissive on input (Ilograph allows many shorthands), strict on the IR.
 */

const RawResourceSchema: z.ZodType<RawResource> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    name: z.string(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    style: z.enum(['default', 'plural']).optional(),
    icon: z.string().optional(),
    children: z.array(RawResourceSchema).optional(),
  }),
);

const RawRelationSchema = z.object({
  from: z.string(),
  to: z.string(), // may be comma-separated
  label: z.string().optional(),
  description: z.string().optional(),
});

const RawPerspectiveSchema = z.object({
  name: z.string(),
  notes: z.string().optional(),
  relations: z.array(RawRelationSchema).optional(),
});

const RawDiagramSchema = z.object({
  description: z.string().optional(),
  resources: z.array(RawResourceSchema),
  perspectives: z.array(RawPerspectiveSchema).optional(),
});

interface RawResource {
  id?: string;
  name: string;
  subtitle?: string;
  description?: string;
  color?: string;
  style?: 'default' | 'plural';
  icon?: string;
  children?: RawResource[];
}

/** Slugify a resource name into a stable id. */
function slug(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '');
}

/** Recursively normalise a raw resource into the IR shape. */
function normalise(raw: RawResource, parentId?: string): Resource {
  const id = raw.id ?? slug(raw.name);
  const fullId = parentId ? `${parentId}.${id}` : id;
  const children = (raw.children ?? []).map((c) => normalise(c, fullId));
  return {
    id: fullId,
    name: raw.name,
    subtitle: raw.subtitle,
    description: raw.description,
    color: raw.color,
    style: raw.style,
    icon: raw.icon,
    parentId,
    children,
  };
}

/** Build a flat lookup of all resources by both full-id and short name. */
function buildIndex(roots: Resource[]): Map<string, Resource> {
  const idx = new Map<string, Resource>();
  function visit(r: Resource): void {
    idx.set(r.id, r);
    // Also index by leaf name for Ilograph-style "from: ServiceA" references.
    // If two resources share a name, the first wins; the user can disambiguate
    // via full path.
    if (!idx.has(r.name)) idx.set(r.name, r);
    for (const c of r.children) visit(c);
  }
  for (const r of roots) visit(r);
  return idx;
}

/**
 * Expand `to: "Service A, Service B"` into multiple Relation objects, one per
 * target. Resolve names against the index.
 */
function expandRelations(
  raw: z.infer<typeof RawRelationSchema>[],
  index: Map<string, Resource>,
  perspectiveName: string,
): Relation[] {
  const out: Relation[] = [];
  for (const r of raw) {
    const targets = r.to.split(',').map((s) => s.trim()).filter(Boolean);
    const fromResource = index.get(r.from.trim());
    if (!fromResource) {
      throw new Error(
        `Perspective "${perspectiveName}": unknown 'from' resource "${r.from}"`,
      );
    }
    for (const t of targets) {
      const toResource = index.get(t);
      if (!toResource) {
        throw new Error(
          `Perspective "${perspectiveName}": unknown 'to' resource "${t}"`,
        );
      }
      out.push({
        from: fromResource.id,
        to: toResource.id,
        label: r.label,
        description: r.description,
      });
    }
  }
  return out;
}

/** Parse a YAML string into a normalised Diagram IR. */
export function parseDiagram(source: string): Diagram {
  const raw = yaml.load(source);
  const parsed = RawDiagramSchema.parse(raw);
  const resources = parsed.resources.map((r) => normalise(r));
  const index = buildIndex(resources);
  const perspectives: Perspective[] = (parsed.perspectives ?? []).map((p) => ({
    name: p.name,
    notes: p.notes,
    relations: expandRelations(p.relations ?? [], index, p.name),
  }));
  return {
    description: parsed.description,
    resources,
    perspectives,
  };
}
