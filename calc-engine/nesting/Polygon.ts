import { Point } from './geometry/index.js';

export class Polygon {
  points: Point[];
  id: string;
  rotation: number = 0;
  x: number = 0;
  y: number = 0;

  constructor(points: Point[], id: string = '') {
    if (points.length < 3) {
      throw new Error('Polygon must have at least 3 points');
    }
    this.points = this.ensureClockwise(points);
    this.id = id;
  }

  private ensureClockwise(points: Point[]): Point[] {
    if (this.calculateSignedArea(points) > 0) {
      return [...points].reverse();
    }
    return [...points];
  }

  private calculateSignedArea(points: Point[]): number {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return area / 2;
  }

  getArea(): number {
    return Math.abs(this.calculateSignedArea(this.points));
  }

  getPerimeter(): number {
    let perimeter = 0;
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      perimeter += this.points[i].dist(this.points[j]);
    }
    return perimeter;
  }

  getBoundingBox(): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  getCentroid(): Point {
    let cx = 0, cy = 0;
    const n = this.points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const factor = (this.points[i].x * this.points[j].y - this.points[j].x * this.points[i].y);
      cx += (this.points[i].x + this.points[j].x) * factor;
      cy += (this.points[i].y + this.points[j].y) * factor;
    }

    const signedArea = this.calculateSignedArea(this.points);
    return new Point(cx / (6 * signedArea), cy / (6 * signedArea));
  }

  translate(dx: number, dy: number): Polygon {
    const translated = this.points.map(p => p.translate(dx, dy));
    const polygon = new Polygon(translated, this.id);
    polygon.rotation = this.rotation;
    return polygon;
  }

  rotate(angleDegrees: number, center?: Point): Polygon {
    const c = center || this.getCentroid();
    const rotated = this.points.map(p => p.rotate(angleDegrees, c));
    const polygon = new Polygon(rotated, this.id);
    polygon.rotation = this.rotation + angleDegrees;
    polygon.x = this.x;
    polygon.y = this.y;
    return polygon;
  }

  scale(factor: number, center?: Point): Polygon {
    const c = center || this.getCentroid();
    const scaled = this.points.map(p => p.scale(factor, c));
    const polygon = new Polygon(scaled, this.id);
    polygon.rotation = this.rotation;
    return polygon;
  }

  offset(distance: number): Polygon {
    const result: Point[] = [];
    const n = this.points.length;

    for (let i = 0; i < n; i++) {
      const prev = this.points[(i - 1 + n) % n];
      const curr = this.points[i];
      const next = this.points[(i + 1) % n];

      const v1 = new Point(curr.x - prev.x, curr.y - prev.y);
      const v2 = new Point(next.x - curr.x, next.y - curr.y);

      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

      const n1 = new Point(-v1.y / len1, v1.x / len1);
      const n2 = new Point(-v2.y / len2, v2.x / len2);

      const bisector = new Point(n1.x + n2.x, n1.y + n2.y);
      const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      const dot = n1.x * n2.x + n1.y * n2.y;
      const sinAngle = Math.sqrt((1 - dot) / 2);
      const offsetFactor = distance / sinAngle;

      const offsetPoint = new Point(
        curr.x + (bisector.x / bisectorLen) * offsetFactor,
        curr.y + (bisector.y / bisectorLen) * offsetFactor
      );

      result.push(offsetPoint);
    }

    return new Polygon(result, this.id);
  }

  clone(): Polygon {
    const polygon = new Polygon(this.points.map(p => p.copy()), this.id);
    polygon.rotation = this.rotation;
    polygon.x = this.x;
    polygon.y = this.y;
    return polygon;
  }

  toSVGPath(): string {
    let d = `M ${this.points[0].x.toFixed(4)},${this.points[0].y.toFixed(4)}`;
    for (let i = 1; i < this.points.length; i++) {
      d += ` L ${this.points[i].x.toFixed(4)},${this.points[i].y.toFixed(4)}`;
    }
    d += ' Z';
    return d;
  }

  static fromPoints(points: Array<{ x: number; y: number }>, id: string = ''): Polygon {
    return new Polygon(points.map(p => new Point(p.x, p.y)), id);
  }

  static rectangle(width: number, height: number, id: string = ''): Polygon {
    return new Polygon([
      new Point(0, 0),
      new Point(width, 0),
      new Point(width, height),
      new Point(0, height),
    ], id);
  }
}

export function polygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}
