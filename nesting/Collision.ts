import { Point } from '../geometry/index.js';
import { Polygon } from './Polygon.js';

export interface CollisionResult {
  collides: boolean;
  overlap: number;
  overlapAxis?: Point;
  minTranslation?: Point;
}

export class SATCollision {
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
