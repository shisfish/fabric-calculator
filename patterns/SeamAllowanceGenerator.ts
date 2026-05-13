import { Point, Path } from '../geometry/index.js';

export class SeamAllowanceGenerator {

  static generate(outline: Path, distance: number): Path {
    if (distance <= 0) {
      return outline.clone();
    }

    const sampledPoints = this.flattenBezier(outline, 50);

    if (sampledPoints.length < 3) {
      return outline.clone();
    }

    const tangents = this.computeTangents(sampledPoints);
    let normals = this.computeNormals(tangents);
    
    const pathDirection = this.getPathDirection(sampledPoints);
    
    if (pathDirection < 0) {
      normals = normals.map(n => new Point(-n.x, -n.y));
    }

    const offsetPoints = this.offsetPoints(sampledPoints, normals, distance);
    const smoothedPoints = this.smoothCorners(offsetPoints, tangents, distance);
    const offsetPath = this.rebuildPath(smoothedPoints);

    return offsetPath;
  }

  private static getPathDirection(points: Point[]): number {
    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    return area / 2;
  }

  private static flattenBezier(path: Path, segmentsPerCurve: number = 50): Point[] {
    const points: Point[] = [];
    let current: Point | null = null;

    for (const op of path.ops) {
      switch (op.type) {
        case 'move':
          if (op.to) {
            current = op.to.copy();
            points.push(current);
          }
          break;

        case 'line':
          if (op.to && current) {
            const lineSegments = Math.max(1, Math.ceil(current.dist(op.to) / 0.5));
            for (let i = 1; i <= lineSegments; i++) {
              const t = i / lineSegments;
              const point = new Point(
                current.x + (op.to.x - current.x) * t,
                current.y + (op.to.y - current.y) * t
              );
              points.push(point);
            }
            current = op.to;
          }
          break;

        case 'curve':
          if (op.cp1 && op.cp2 && op.to && current) {
            for (let i = 1; i <= segmentsPerCurve; i++) {
              const t = i / segmentsPerCurve;
              const mt = 1 - t;
              const mt2 = mt * mt;
              const mt3 = mt2 * mt;
              const t2 = t * t;
              const t3 = t2 * t;

              const x = mt3 * current.x + 3 * mt2 * t * op.cp1.x + 3 * mt * t2 * op.cp2.x + t3 * op.to.x;
              const y = mt3 * current.y + 3 * mt2 * t * op.cp1.y + 3 * mt * t2 * op.cp2.y + t3 * op.to.y;

              points.push(new Point(x, y));
            }
            current = op.to;
          }
          break;

        case 'quad':
          if (op.cp1 && op.to && current) {
            for (let i = 1; i <= segmentsPerCurve; i++) {
              const t = i / segmentsPerCurve;
              const mt = 1 - t;
              const mt2 = mt * mt;
              const t2 = t * t;

              const x = mt2 * current.x + 2 * mt * t * op.cp1.x + t2 * op.to.x;
              const y = mt2 * current.y + 2 * mt * t * op.cp1.y + t2 * op.to.y;

              points.push(new Point(x, y));
            }
            current = op.to;
          }
          break;

        case 'close':
          break;
      }
    }

    return points;
  }

  private static computeTangents(points: Point[]): Point[] {
    const tangents: Point[] = [];
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];

      let tx = 0, ty = 0;

      if (i === 0 && n > 1) {
        tx = next.x - curr.x;
        ty = next.y - curr.y;
      } else if (i === n - 1 && n > 1) {
        tx = curr.x - prev.x;
        ty = curr.y - prev.y;
      } else {
        tx = next.x - prev.x;
        ty = next.y - prev.y;
      }

      const len = Math.sqrt(tx * tx + ty * ty);
      if (len > 1e-10) {
        tangents.push(new Point(tx / len, ty / len));
      } else {
        tangents.push(new Point(1, 0));
      }
    }

    return tangents;
  }

  private static computeNormals(tangents: Point[]): Point[] {
    return tangents.map(t => new Point(t.y, -t.x));
  }

  private static offsetPoints(points: Point[], normals: Point[], distance: number): Point[] {
    return points.map((p, i) => new Point(
      p.x + normals[i].x * distance,
      p.y + normals[i].y * distance
    ));
  }

  private static smoothCorners(offsetPoints: Point[], tangents: Point[], distance: number): Point[] {
    const smoothed: Point[] = [];
    const n = offsetPoints.length;
    const cornerThreshold = Math.cos(Math.PI / 6);

    for (let i = 0; i < n; i++) {
      const prev = tangents[(i - 1 + n) % n];
      const curr = tangents[i];

      const dot = prev.x * curr.x + prev.y * curr.y;

      if (dot < cornerThreshold && i > 0 && i < n - 1) {
        const pPrev = offsetPoints[(i - 1 + n) % n];
        const pCurr = offsetPoints[i];
        const pNext = offsetPoints[(i + 1) % n];

        const d1 = distance * 0.8;
        const d2 = distance * 0.8;

        const interp1 = new Point(
          pCurr.x + (pPrev.x - pCurr.x) * (d1 / pCurr.dist(pPrev)),
          pCurr.y + (pPrev.y - pCurr.y) * (d1 / pCurr.dist(pPrev))
        );

        const interp2 = new Point(
          pCurr.x + (pNext.x - pCurr.x) * (d2 / pCurr.dist(pNext)),
          pCurr.y + (pNext.y - pCurr.y) * (d2 / pCurr.dist(pNext))
        );

        if (!isNaN(interp1.x) && !isNaN(interp1.y)) {
          smoothed.push(interp1);
        }
        if (!isNaN(interp2.x) && !isNaN(interp2.y)) {
          smoothed.push(interp2);
        }
      } else {
        smoothed.push(offsetPoints[i]);
      }
    }

    return smoothed.length >= 3 ? smoothed : offsetPoints;
  }

  private static rebuildPath(points: Point[]): Path {
    if (points.length < 3) {
      return Path.fromPoints(points, true);
    }

    const path = new Path();
    path.move(points[0]);

    for (let i = 1; i < points.length; i++) {
      path.line(points[i]);
    }

    path.close();

    return path;
  }

  static generateWithVisualData(outline: Path, distance: number): {
    offsetPath: Path;
    originalPoints: Point[];
    offsetPoints: Point[];
    sampleCount: number;
  } {
    const originalPoints = this.flattenBezier(outline, 50);

    if (originalPoints.length < 3 || distance <= 0) {
      return {
        offsetPath: outline.clone(),
        originalPoints,
        offsetPoints: originalPoints.map(p => p.copy()),
        sampleCount: originalPoints.length
      };
    }

    const tangents = this.computeTangents(originalPoints);
    const normals = this.computeNormals(tangents);
    const offsetPts = this.offsetPoints(originalPoints, normals, distance);
    const smoothedPoints = this.smoothCorners(offsetPts, tangents, distance);
    const offsetPath = this.rebuildPath(smoothedPoints);

    return {
      offsetPath,
      originalPoints,
      offsetPoints: smoothedPoints,
      sampleCount: originalPoints.length
    };
  }
}
