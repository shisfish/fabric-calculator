import { Point } from './Point.js';

export class QuadraticBezier {
  constructor(
    public p0: Point,
    public p1: Point,
    public p2: Point
  ) {}

  evaluate(t: number): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    
    return new Point(
      mt2 * this.p0.x + 2 * mt * t * this.p1.x + t2 * this.p2.x,
      mt2 * this.p0.y + 2 * mt * t * this.p1.y + t2 * this.p2.y
    );
  }

  getLength(samples: number = 20): number {
    let length = 0;
    let prevPoint = this.evaluate(0);
    
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const point = this.evaluate(t);
      length += prevPoint.distanceTo(point);
      prevPoint = point;
    }
    
    return length;
  }
}

export class CubicBezier {
  constructor(
    public p0: Point,
    public p1: Point,
    public p2: Point,
    public p3: Point
  ) {}

  evaluate(t: number): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return new Point(
      mt3 * this.p0.x + 3 * mt2 * t * this.p1.x + 3 * mt * t2 * this.p2.x + t3 * this.p3.x,
      mt3 * this.p0.y + 3 * mt2 * t * this.p1.y + 3 * mt * t2 * this.p2.y + t3 * this.p3.y
    );
  }

  getLength(samples: number = 20): number {
    let length = 0;
    let prevPoint = this.evaluate(0);
    
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const point = this.evaluate(t);
      length += prevPoint.distanceTo(point);
      prevPoint = point;
    }
    
    return length;
  }

  getTangent(t: number): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    return new Point(
      3 * mt2 * (this.p1.x - this.p0.x) + 6 * mt * t * (this.p2.x - this.p1.x) + 3 * t2 * (this.p3.x - this.p2.x),
      3 * mt2 * (this.p1.y - this.p0.y) + 6 * mt * t * (this.p2.y - this.p1.y) + 3 * t2 * (this.p3.y - this.p2.y)
    );
  }

  flatten(tolerance: number = 0.5): Point[] {
    const points: Point[] = [this.evaluate(0)];
    
    const subdivide = (
      b: CubicBezier,
      depth: number
    ) => {
        if (depth > 10) return;
        
        const mid = b.evaluate(0.5);
        const start = b.evaluate(0);
        const end = b.evaluate(1);
        
        const chordLength = start.distanceTo(end);
        
        if (chordLength < tolerance || depth >= 8) {
          points.push(end);
          return;
        }
        
        const { left, right } = b.subdivideAt(0.5);
        
        subdivide(left, depth + 1);
        subdivide(right, depth + 1);
      };
    
    subdivide(this, 0);
    
    return points;
  }

  private subdivideAt(t: number): { left: CubicBezier; right: CubicBezier } {
    const p01 = this.p0.midpoint(this.p1);
    const p12 = this.p1.midpoint(this.p2);
    const p23 = this.p2.midpoint(this.p3);
    const p012 = p01.midpoint(p12);
    const p123 = p12.midpoint(p23);
    const p0123 = p012.midpoint(p123);

    return {
      left: new CubicBezier(this.p0.clone(), p01, p012, p0123),
      right: new CubicBezier(p0123.clone(), p123, p23, this.p3.clone())
    };
  }
}