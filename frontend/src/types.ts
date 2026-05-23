export interface Point {
  x: number;
  y: number;
}

export interface PathOperation {
  type: 'move' | 'line' | 'curve' | 'quad' | 'close';
  to?: Point;
  cp1?: Point;
  cp2?: Point;
}

export interface PatternPiece {
  name: string;
  points: Array<{ key: string; x: number; y: number }>;
  pathOps: PathOperation[];
  cutCount: number;
  onFold: boolean;
  seamAllowance?: number;
  grainline?: { start: Point; end: Point };
  notches?: Point[];
}

export interface PlacedPiece {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  rotation: number;
}

export interface NestingResult {
  pieces: PlacedPiece[];
  positions: Array<{ name: string; x: number; y: number; rotation: number }>;
  utilization: number;
  bounds: { width: number; height: number };
  totalArea: number;
  usedArea: number;
}

export interface DimensionLine {
  start: Point;
  end: Point;
  label: string;
  offset: number;
}
