import { Point, CBQC } from './Point.js';

export interface BezierPoint {
  x: number;
  y: number;
}

export class CubicBezier {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;

  constructor(p0: Point, p1: Point, p2: Point, p3: Point) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
  }

  getPoint(t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return new Point(
      mt3 * this.p0.x + 3 * mt2 * t * this.p1.x + 3 * mt * t2 * this.p2.x + t3 * this.p3.x,
      mt3 * this.p0.y + 3 * mt2 * t * this.p1.y + 3 * mt * t2 * this.p2.y + t3 * this.p3.y
    );
  }

  getDerivative(t: number): Point {
    const t2 = t * t;
    const mt = 1 - t;
    const mt2 = mt * mt;

    return new Point(
      3 * mt2 * (this.p1.x - this.p0.x) + 6 * mt * t * (this.p2.x - this.p1.x) + 3 * t2 * (this.p3.x - this.p2.x),
      3 * mt2 * (this.p1.y - this.p0.y) + 6 * mt * t * (this.p2.y - this.p1.y) + 3 * t2 * (this.p3.y - this.p2.y)
    );
  }

  getSecondDerivative(t: number): Point {
    const mt = 1 - t;

    return new Point(
      6 * mt * (this.p2.x - 2 * this.p1.x + this.p0.x) + 6 * t * (this.p3.x - 2 * this.p2.x + this.p1.x),
      6 * mt * (this.p2.y - 2 * this.p1.y + this.p0.y) + 6 * t * (this.p3.y - 2 * this.p2.y + this.p1.y)
    );
  }

  getNormal(t: number): Point {
    const derivative = this.getDerivative(t);
    const len = Math.sqrt(derivative.x ** 2 + derivative.y ** 2);
    if (len < 1e-10) return new Point(0, 1);
    return new Point(-derivative.y / len, derivative.x / len);
  }

  getTangent(t: number): Point {
    const derivative = this.getDerivative(t);
    const len = Math.sqrt(derivative.x ** 2 + derivative.y ** 2);
    if (len < 1e-10) return new Point(1, 0);
    return new Point(derivative.x / len, derivative.y / len);
  }

  getCurvature(t: number): number {
    const d = this.getDerivative(t);
    const dd = this.getSecondDerivative(t);
    const cross = d.x * dd.y - d.y * dd.x;
    const len = Math.sqrt(d.x ** 2 + d.y ** 2) ** 3;
    if (len < 1e-10) return 0;
    return cross / len;
  }

  getLength(steps: number = 200): number {
    let length = 0;
    let prev = this.getPoint(0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curr = this.getPoint(t);
      length += prev.dist(curr);
      prev = curr;
    }
    return length;
  }

  getBoundingBox(): { topLeft: Point; bottomRight: Point } {
    const points = this.extrema();
    points.push(this.p0, this.p3);
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    
    return {
      topLeft: new Point(minX, minY),
      bottomRight: new Point(maxX, maxY)
    };
  }

  extrema(): Point[] {
    const result: Point[] = [];
    const roots = this.extremaT();
    for (const t of roots) {
      if (t > 0 && t < 1) {
        result.push(this.getPoint(t));
      }
    }
    return result;
  }

  extremaT(): number[] {
    const result: number[] = [];
    
    const solveQuadratic = (a: number, b: number, c: number): number[] => {
      if (Math.abs(a) < 1e-10) {
        if (Math.abs(b) < 1e-10) return [];
        return [-c / b];
      }
      const disc = b * b - 4 * a * c;
      if (disc < 0) return [];
      if (Math.abs(disc) < 1e-10) return [-b / (2 * a)];
      const sqrtDisc = Math.sqrt(disc);
      return [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)];
    };

    const ax = -this.p0.x + 3 * this.p1.x - 3 * this.p2.x + this.p3.x;
    const bx = 3 * this.p0.x - 6 * this.p1.x + 3 * this.p2.x;
    const cx = -3 * this.p0.x + 3 * this.p1.x;

    for (const t of solveQuadratic(ax, bx, cx)) {
      if (t > 0 && t < 1) result.push(t);
    }

    const ay = -this.p0.y + 3 * this.p1.y - 3 * this.p2.y + this.p3.y;
    const by = 3 * this.p0.y - 6 * this.p1.y + 3 * this.p2.y;
    const cy = -3 * this.p0.y + 3 * this.p1.y;

    for (const t of solveQuadratic(ay, by, cy)) {
      if (t > 0 && t < 1) result.push(t);
    }

    return [...new Set(result)].sort((a, b) => a - b);
  }

  split(t: number): [CubicBezier, CubicBezier] {
    const p0 = this.p0;
    const p1 = this.p1;
    const p2 = this.p2;
    const p3 = this.p3;

    const p01 = p0.shiftFractionTowards(p1, t);
    const p12 = p1.shiftFractionTowards(p2, t);
    const p23 = p2.shiftFractionTowards(p3, t);

    const p012 = p01.shiftFractionTowards(p12, t);
    const p123 = p12.shiftFractionTowards(p23, t);

    const p0123 = p012.shiftFractionTowards(p123, t);

    return [
      new CubicBezier(p0, p01, p012, p0123),
      new CubicBezier(p0123, p123, p23, p3)
    ];
  }

  splitAtPoints(points: Point[], tolerance: number = 0.01): CubicBezier[] {
    const result: CubicBezier[] = [];
    let current: CubicBezier = this;
    const tValues: number[] = [];

    for (const pt of points) {
      const t = this.findTForPoint(pt, tolerance);
      if (t !== null) tValues.push(t);
    }

    tValues.sort((a, b) => a - b);

    for (const t of tValues) {
      const [left, right] = current.split(t);
      result.push(left);
      current = right;
    }
    result.push(current);

    return result;
  }

  findTForPoint(point: Point, tolerance: number = 0.01, steps: number = 100): number | null {
    let bestT: number | null = null;
    let bestDist = tolerance;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = this.getPoint(t);
      const dist = pt.dist(point);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }

    if (bestT !== null) {
      for (let iter = 0; iter < 10; iter++) {
        const pt = this.getPoint(bestT);
        const d = this.getDerivative(bestT);
        const diff = new Point(point.x - pt.x, point.y - pt.y);
        const dt = (diff.x * d.x + diff.y * d.y) / (d.x ** 2 + d.y ** 2);
        bestT += dt;
        if (bestT < 0) bestT = 0;
        if (bestT > 1) bestT = 1;
        if (Math.abs(dt) < 1e-6) break;
      }
    }

    return bestT;
  }

  offset(distance: number): CubicBezier {
    const samples = 20;
    const offsetPoints: Point[] = [];
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pt = this.getPoint(t);
      const normal = this.getNormal(t);
      offsetPoints.push(new Point(
        pt.x + normal.x * distance,
        pt.y + normal.y * distance
      ));
    }

    return CubicBezier.fitPoints(offsetPoints);
  }

  reverse(): CubicBezier {
    return new CubicBezier(this.p3, this.p2, this.p1, this.p0);
  }

  toSVGPath(): string {
    return `C ${this.p1.x.toFixed(4)},${this.p1.y.toFixed(4)} ${this.p2.x.toFixed(4)},${this.p2.y.toFixed(4)} ${this.p3.x.toFixed(4)},${this.p3.y.toFixed(4)}`;
  }

  static fromPoints(start: Point, end: Point, curvature: number = 0.5): CubicBezier {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offset = dist * curvature * CBQC;
    
    return new CubicBezier(
      start,
      new Point(start.x + offset, start.y),
      new Point(end.x - offset, end.y),
      end
    );
  }

  static fitPoints(points: Point[]): CubicBezier {
    if (points.length < 2) {
      throw new Error('Need at least 2 points to fit a bezier curve');
    }
    
    const p0 = points[0];
    const p3 = points[points.length - 1];
    
    if (points.length === 2) {
      const dx = p3.x - p0.x;
      const dy = p3.y - p0.y;
      const dist = Math.sqrt(dx * dx + dy * dy) / 3;
      return new CubicBezier(
        p0,
        new Point(p0.x + dist, p0.y + dist * 0.5),
        new Point(p3.x - dist, p3.y - dist * 0.5),
        p3
      );
    }

    const n = points.length;
    let sumX = 0, sumY = 0;
    for (let i = 1; i < n - 1; i++) {
      sumX += points[i].x;
      sumY += points[i].y;
    }
    const avgX = sumX / (n - 2);
    const avgY = sumY / (n - 2);

    const t1 = 1 / 3;
    const t2 = 2 / 3;
    
    const p1 = new Point(
      (avgX - (1 - t1) ** 3 * p0.x - t1 ** 3 * p3.x) / (3 * (1 - t1) ** 2 * t1),
      (avgY - (1 - t1) ** 3 * p0.y - t1 ** 3 * p3.y) / (3 * (1 - t1) ** 2 * t1)
    );
    
    const p2 = new Point(
      (avgX - (1 - t2) ** 3 * p0.x - t2 ** 3 * p3.x) / (3 * (1 - t2) * t2 ** 2),
      (avgY - (1 - t2) ** 3 * p0.y - t2 ** 3 * p3.y) / (3 * (1 - t2) * t2 ** 2)
    );

    return new CubicBezier(p0, p1, p2, p3);
  }

  static quarterCircle(center: Point, radius: number, startAngle: number = 0): CubicBezier {
    const start = center.shift(startAngle, radius);
    const end = center.shift(startAngle + 90, radius);
    const offset = radius * CBQC;
    
    const cp1 = start.shift(startAngle + 90, offset);
    const cp2 = end.shift(startAngle + 180, offset);
    
    return new CubicBezier(start, cp1, cp2, end);
  }

  static arc(center: Point, radius: number, startAngle: number, endAngle: number): CubicBezier[] {
    const curves: CubicBezier[] = [];
    let currentAngle = startAngle;
    
    while (currentAngle < endAngle) {
      const sweep = Math.min(90, endAngle - currentAngle);
      const ratio = sweep / 90;
      const offset = radius * CBQC * ratio;
      
      const start = center.shift(currentAngle, radius);
      const end = center.shift(currentAngle + sweep, radius);
      
      const cp1 = start.shift(currentAngle + 90, offset);
      const cp2 = end.shift(currentAngle + sweep - 90, offset);
      
      curves.push(new CubicBezier(start, cp1, cp2, end));
      currentAngle += sweep;
    }
    
    return curves;
  }
}

export class QuadraticBezier {
  p0: Point;
  p1: Point;
  p2: Point;

  constructor(p0: Point, p1: Point, p2: Point) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
  }

  getPoint(t: number): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    return new Point(
      mt2 * this.p0.x + 2 * mt * t * this.p1.x + t2 * this.p2.x,
      mt2 * this.p0.y + 2 * mt * t * this.p1.y + t2 * this.p2.y
    );
  }

  toCubic(): CubicBezier {
    const cp1 = new Point(
      this.p0.x + 2 / 3 * (this.p1.x - this.p0.x),
      this.p0.y + 2 / 3 * (this.p1.y - this.p0.y)
    );
    const cp2 = new Point(
      this.p2.x + 2 / 3 * (this.p1.x - this.p2.x),
      this.p2.y + 2 / 3 * (this.p1.y - this.p2.y)
    );
    return new CubicBezier(this.p0, cp1, cp2, this.p2);
  }

  toSVGPath(): string {
    return `Q ${this.p1.x.toFixed(4)},${this.p1.y.toFixed(4)} ${this.p2.x.toFixed(4)},${this.p2.y.toFixed(4)}`;
  }
}

export function bezierLength(p0: Point, p1: Point, p2: Point, p3: Point, steps: number = 100): number {
  return new CubicBezier(p0, p1, p2, p3).getLength(steps);
}

export function bezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  return new CubicBezier(p0, p1, p2, p3).getPoint(t);
}
