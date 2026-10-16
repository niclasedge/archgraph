/**
 * Internal Representation (IR) used after parsing + normalisation.
 * The YAML schema in Zod (parser.ts) coerces input into these shapes.
 */

export interface Resource {
  id: string; // synthesised from name if missing
  name: string;
  subtitle?: string;
  description?: string;
  color?: string;
  style?: 'default' | 'plural';
  icon?: string;
  children: Resource[];
  parentId?: string;
}

export interface Relation {
  from: string; // resource name or id (after expansion: a single resource)
  to: string;
  label?: string;
  description?: string;
}

export interface Perspective {
  name: string;
  notes?: string;
  relations: Relation[];
}

export interface Diagram {
  description?: string;
  resources: Resource[];
  perspectives: Perspective[];
}

/** After layout, every resource has its absolute coordinates in viewport space. */
export interface PositionedResource extends Resource {
  x: number;
  y: number;
  width: number;
  height: number;
  children: PositionedResource[];
}

export interface PositionedEdge {
  from: string;
  to: string;
  label?: string;
  bendPoints: { x: number; y: number }[];
  source: { x: number; y: number };
  target: { x: number; y: number };
  labelPosition?: { x: number; y: number };
}

export interface PositionedPerspective {
  name: string;
  notes?: string;
  width: number;
  height: number;
  resources: PositionedResource[];
  edges: PositionedEdge[];
}
