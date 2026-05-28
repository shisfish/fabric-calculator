import { Point } from './geometry/index.js';
import { Polygon } from './Polygon.js';

export interface CollisionResult {
  collides: boolean;
  overlap: number;
  overlapAxis?: Point;
  minTranslation?: Point;
}

export class SATCollision {
  /**
   * 鲁棒的碰撞检测 - 同时适用于凸多边形和凹多边形
   *
   * 组合检测策略：
   * 1. 边界盒快速预检（剔除远距离对）
   * 2. 线段交叉检测（高精度）
   * 3. 点包含检测（处理完全包含场景）
   *
   * 服装裁片（前片/后片/袖子）的袖窿曲线形成凹形区域，
   * 纯SAT只对凸多边形保证正确，必须使用此方法避免漏检。
   */
  static testCollisionRobust(polyA: Polygon, polyB: Polygon): CollisionResult {
    // Step 1: Bounding box pre-check
    const bbA = polyA.getBoundingBox();
    const bbB = polyB.getBoundingBox();
    if (bbA.maxX < bbB.minX || bbA.minX > bbB.maxX ||
        bbA.maxY < bbB.minY || bbA.minY > bbB.maxY) {
      return { collides: false, overlap: 0 };
    }

    // Step 2: Edge intersection + proximity check
    const ptsA = polyA.points;
    const ptsB = polyB.points;
    const nA = ptsA.length;
    const nB = ptsB.length;

    for (let i = 0; i < nA; i++) {
      const a1 = ptsA[i];
      const a2 = ptsA[(i + 1) % nA];
      for (let j = 0; j < nB; j++) {
        const b1 = ptsB[j];
        const b2 = ptsB[(j + 1) % nB];
        if (this.segmentsIntersect(a1, a2, b1, b2)) {
          return { collides: true, overlap: 1 };
        }
        // Proximity check: vertex within 0.5mm of the other segment
        // Catches near-touching cases and concave interlocking where
        // edges pass close but don't cross
        if (this.pointToSegmentDistance(a1, b1, b2) < 0.05 ||
            this.pointToSegmentDistance(b1, a1, a2) < 0.05) {
          return { collides: true, overlap: 0 };
        }
      }
    }

    // Step 3: Point-in-polygon check (one entirely inside the other)
    for (const p of ptsA) {
      if (this.testPointInPolygon(p, polyB)) {
        return { collides: true, overlap: 1 };
      }
    }
    for (const p of ptsB) {
      if (this.testPointInPolygon(p, polyA)) {
        return { collides: true, overlap: 1 };
      }
    }

    return { collides: false, overlap: 0 };
  }

  /**
   * 判断两条线段是否相交
   * 使用方向叉积法，排除共线和平行情况
   */
  private static segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    const d1x = a2.x - a1.x;
    const d1y = a2.y - a1.y;
    const d2x = b2.x - b1.x;
    const d2y = b2.y - b1.y;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false; // parallel

    const dx = b1.x - a1.x;
    const dy = b1.y - a1.y;

    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  static testCollision(polyA: Polygon, polyB: Polygon): CollisionResult {
    const axesA = this.getAxes(polyA);
    const axesB = this.getAxes(polyB);
    const axes = [...axesA, ...axesB];

    let minOverlap = Infinity;
    let minAxis: Point | null = null;

    for (const axis of axes) {
      const projA = this.projectPolygon(polyA, axis);
      const projB = this.projectPolygon(polyB, axis);

      const overlap = this.getOverlap(projA, projB);

      if (overlap <= 0) {
        return { collides: false, overlap: 0 };
      }

      if (overlap < minOverlap) {
        minOverlap = overlap;
        minAxis = axis;
      }
    }

    if (!minAxis) {
      return { collides: false, overlap: 0 };
    }

    const d = new Point(
      polyB.getCentroid().x - polyA.getCentroid().x,
      polyB.getCentroid().y - polyA.getCentroid().y
    );

    const dot = d.x * minAxis.x + d.y * minAxis.y;
    if (dot < 0) {
      minAxis = new Point(-minAxis.x, -minAxis.y);
    }

    return {
      collides: true,
      overlap: minOverlap,
      overlapAxis: minAxis,
      minTranslation: new Point(minAxis.x * minOverlap, minAxis.y * minOverlap),
    };
  }

  static testPointInPolygon(point: Point, polygon: Polygon): boolean {
    const points = polygon.points;
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;

      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  static testPointOnEdge(point: Point, polygon: Polygon, tolerance: number = 0.1): boolean {
    const points = polygon.points;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];

      if (point.isOnLine(p1, p2, tolerance)) {
        return true;
      }
    }

    return false;
  }

  private static getAxes(polygon: Polygon): Point[] {
    const axes: Point[] = [];
    const points = polygon.points;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];

      const edge = new Point(p2.x - p1.x, p2.y - p1.y);
      const normal = new Point(-edge.y, edge.x);
      const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);

      if (len > 0) {
        axes.push(new Point(normal.x / len, normal.y / len));
      }
    }

    return axes;
  }

  private static projectPolygon(polygon: Polygon, axis: Point): { min: number; max: number } {
    const points = polygon.points;
    let min = Infinity;
    let max = -Infinity;

    for (const point of points) {
      const proj = point.x * axis.x + point.y * axis.y;
      min = Math.min(min, proj);
      max = Math.max(max, proj);
    }

    return { min, max };
  }

  private static getOverlap(
    projA: { min: number; max: number },
    projB: { min: number; max: number }
  ): number {
    const overlapMin = Math.max(projA.min, projB.min);
    const overlapMax = Math.min(projA.max, projB.max);
    return overlapMax - overlapMin;
  }

  static getDistance(polyA: Polygon, polyB: Polygon): number {
    const result = this.testCollision(polyA, polyB);
    if (result.collides) {
      return -result.overlap;
    }

    let minDist = Infinity;
    const pointsA = polyA.points;
    const pointsB = polyB.points;

    for (const pa of pointsA) {
      for (let i = 0; i < pointsB.length; i++) {
        const pb1 = pointsB[i];
        const pb2 = pointsB[(i + 1) % pointsB.length];
        const dist = this.pointToSegmentDistance(pa, pb1, pb2);
        minDist = Math.min(minDist, dist);
      }
    }

    for (const pb of pointsB) {
      for (let i = 0; i < pointsA.length; i++) {
        const pa1 = pointsA[i];
        const pa2 = pointsA[(i + 1) % pointsA.length];
        const dist = this.pointToSegmentDistance(pb, pa1, pa2);
        minDist = Math.min(minDist, dist);
      }
    }

    return minDist;
  }

  private static pointToSegmentDistance(point: Point, segStart: Point, segEnd: Point): number {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return point.dist(segStart);
    }

    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = segStart.x + t * dx;
    const closestY = segStart.y + t * dy;

    return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
  }
}
