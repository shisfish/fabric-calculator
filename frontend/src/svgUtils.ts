import { PathOperation, Point, PatternPiece, DimensionLine } from './types';

export function pathOpsToSVGPath(ops: PathOperation[]): string {
  let d = '';
  for (const op of ops) {
    switch (op.type) {
      case 'move':
        if (op.to) {
          d += `M ${op.to.x.toFixed(2)},${op.to.y.toFixed(2)} `;
        }
        break;
      case 'line':
        if (op.to) {
          d += `L ${op.to.x.toFixed(2)},${op.to.y.toFixed(2)} `;
        }
        break;
      case 'curve':
        if (op.cp1 && op.cp2 && op.to) {
          d += `C ${op.cp1.x.toFixed(2)},${op.cp1.y.toFixed(2)} ${op.cp2.x.toFixed(2)},${op.cp2.y.toFixed(2)} ${op.to.x.toFixed(2)},${op.to.y.toFixed(2)} `;
        }
        break;
      case 'quad':
        if (op.cp1 && op.to) {
          d += `Q ${op.cp1.x.toFixed(2)},${op.cp1.y.toFixed(2)} ${op.to.x.toFixed(2)},${op.to.y.toFixed(2)} `;
        }
        break;
      case 'close':
        d += 'Z ';
        break;
    }
  }
  return d.trim();
}

export function getBoundingBox(ops: PathOperation[]): { min: Point; max: Point } | null {
  const points: Point[] = [];
  
  for (const op of ops) {
    if (op.to) points.push(op.to);
    if (op.cp1) points.push(op.cp1);
    if (op.cp2) points.push(op.cp2);
  }
  
  if (points.length === 0) return null;
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY }
  };
}

export function getControlPoints(ops: PathOperation[]): Point[] {
  const points: Point[] = [];
  for (const op of ops) {
    if (op.to) points.push(op.to);
    if (op.cp1) points.push(op.cp1);
    if (op.cp2) points.push(op.cp2);
  }
  return points;
}

export function getNamedPoints(piece: PatternPiece): Array<{ key: string; point: Point }> {
  return piece.points.map(p => ({
    key: p.key,
    point: { x: p.x, y: p.y }
  }));
}

export function calculateDimensionLines(piece: PatternPiece): DimensionLine[] {
  const bbox = getBoundingBox(piece.pathOps);
  if (!bbox) return [];
  
  const dims: DimensionLine[] = [];
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  
  dims.push({
    start: { x: bbox.min.x, y: bbox.max.y + 15 },
    end: { x: bbox.max.x, y: bbox.max.y + 15 },
    label: `${width.toFixed(1)} cm`,
    offset: 15
  });
  
  dims.push({
    start: { x: bbox.max.x + 15, y: bbox.min.y },
    end: { x: bbox.max.x + 15, y: bbox.max.y },
    label: `${height.toFixed(1)} cm`,
    offset: 15
  });
  
  return dims;
}

export function rotatePoint(point: Point, angle: number, center: Point = { x: 0, y: 0 }): Point {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

export function rotatePathOps(ops: PathOperation[], angle: number, center: Point = { x: 0, y: 0 }): PathOperation[] {
  return ops.map(op => {
    const rotated: PathOperation = { type: op.type };
    if (op.to) rotated.to = rotatePoint(op.to, angle, center);
    if (op.cp1) rotated.cp1 = rotatePoint(op.cp1, angle, center);
    if (op.cp2) rotated.cp2 = rotatePoint(op.cp2, angle, center);
    return rotated;
  });
}

export function translatePathOps(ops: PathOperation[], dx: number, dy: number): PathOperation[] {
  return ops.map(op => {
    const translated: PathOperation = { type: op.type };
    if (op.to) translated.to = { x: op.to.x + dx, y: op.to.y + dy };
    if (op.cp1) translated.cp1 = { x: op.cp1.x + dx, y: op.cp1.y + dy };
    if (op.cp2) translated.cp2 = { x: op.cp2.x + dx, y: op.cp2.y + dy };
    return translated;
  });
}

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}
