import { Point, Path } from '../geometry/index.js';
import { CubicBezier, QuadraticBezier } from '../geometry/Bezier.js';

export interface SeamAllowanceRule {
  segment: string;
  distance: number;
}

interface SourceSegment {
  segmentName: string;
  segmentType: string;
  distance: number;
  start: Point;
  end: Point;
  cp1?: Point;
  cp2?: Point;
  opType: 'line' | 'curve' | 'quad';
}

interface SampledSegment {
  segmentName: string;
  distance: number;
  outlinePoints: Point[];
  offsetPoints: Point[];
  startTangent: Point;
  endTangent: Point;
  startOffset: Point;
  endOffset: Point;
}

export class SeamAllowanceGenerator {
  static generate(outline: Path, rules: SeamAllowanceRule[]): Path {
    if (!rules.length) {
      return outline.clone();
    }

    const segments = this.extractSegments(outline, rules);
    if (!segments.length) {
      return outline.clone();
    }

    const orientation = this.getOutlineOrientation(outline);
    const sampledSegments = segments.map((segment) =>
      this.sampleAndOffsetSegment(segment, orientation)
    );

    const joinedPoints = this.joinOffsetSegments(sampledSegments);
    if (joinedPoints.length < 3) {
      return outline.clone();
    }

    return Path.fromPoints(joinedPoints, true);
  }

  private static extractSegments(outline: Path, rules: SeamAllowanceRule[]): SourceSegment[] {
    const segments: SourceSegment[] = [];
    const ruleMap = new Map(rules.map((rule) => [rule.segment, rule.distance]));
    let current: Point | null = null;
    let start: Point | null = null;

    for (const op of outline.ops) {
      switch (op.type) {
        case 'move':
          if (op.to) {
            current = op.to.copy();
            start = op.to.copy();
          }
          break;
        case 'line':
        case 'curve':
        case 'quad':
          if (!current || !op.to) {
            break;
          }
          segments.push({
            segmentName: op.segmentName || 'unclassified',
            segmentType: op.segmentType || op.segmentName || op.type,
            distance: ruleMap.get(op.segmentName || '') ?? 0,
            start: current.copy(),
            end: op.to.copy(),
            cp1: op.cp1?.copy(),
            cp2: op.cp2?.copy(),
            opType: op.type
          });
          current = op.to.copy();
          break;
        case 'close':
          if (current && start && !current.equals(start)) {
            segments.push({
              segmentName: 'closure',
              segmentType: 'closure',
              distance: 0,
              start: current.copy(),
              end: start.copy(),
              opType: 'line'
            });
          }
          break;
      }
    }

    return segments;
  }

  private static sampleAndOffsetSegment(segment: SourceSegment, orientation: number): SampledSegment {
    const { outlinePoints, tangents } = this.flattenSegment(segment);
    const offsetPoints = outlinePoints.map((point, index) => {
      const normal = this.getOutwardNormal(tangents[index], orientation);
      return new Point(
        point.x + normal.x * segment.distance,
        point.y + normal.y * segment.distance
      );
    });

    return {
      segmentName: segment.segmentName,
      distance: segment.distance,
      outlinePoints,
      offsetPoints,
      startTangent: tangents[0],
      endTangent: tangents[tangents.length - 1],
      startOffset: offsetPoints[0],
      endOffset: offsetPoints[offsetPoints.length - 1]
    };
  }

  private static flattenSegment(segment: SourceSegment): { outlinePoints: Point[]; tangents: Point[] } {
    if (segment.opType === 'line') {
      const tangent = this.normalize({
        x: segment.end.x - segment.start.x,
        y: segment.end.y - segment.start.y
      });

      return {
        outlinePoints: [segment.start.copy(), segment.end.copy()],
        tangents: [new Point(tangent.x, tangent.y), new Point(tangent.x, tangent.y)]
      };
    }

    if (segment.opType === 'quad' && segment.cp1) {
      const quad = new QuadraticBezier(segment.start, segment.cp1, segment.end);
      const cubic = quad.toCubic();
      return this.flattenCubic(cubic);
    }

    if (segment.opType === 'curve' && segment.cp1 && segment.cp2) {
      return this.flattenCubic(new CubicBezier(segment.start, segment.cp1, segment.cp2, segment.end));
    }

    return {
      outlinePoints: [segment.start.copy(), segment.end.copy()],
      tangents: [new Point(1, 0), new Point(1, 0)]
    };
  }

  private static flattenCubic(bezier: CubicBezier): { outlinePoints: Point[]; tangents: Point[] } {
    const approxLength = bezier.getLength();
    const steps = Math.max(12, Math.min(80, Math.ceil(approxLength / 0.35)));
    const outlinePoints: Point[] = [];
    const tangents: Point[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      outlinePoints.push(bezier.getPoint(t));
      tangents.push(bezier.getTangent(t));
    }

    return { outlinePoints, tangents };
  }

  private static joinOffsetSegments(segments: SampledSegment[]): Point[] {
    if (segments.length === 1) {
      return this.deduplicateSequentialPoints(segments[0].offsetPoints);
    }

    const joined: Point[] = [];

    for (let i = 0; i < segments.length; i++) {
      const current = segments[i];
      const next = segments[(i + 1) % segments.length];

      const bodyPoints =
        i === 0
          ? current.offsetPoints.slice(0, -1)
          : current.offsetPoints.slice(1, -1);

      joined.push(...bodyPoints);
      joined.push(...this.createCornerJoin(current, next));
    }

    return this.deduplicateSequentialPoints(joined, true);
  }

  private static createCornerJoin(current: SampledSegment, next: SampledSegment): Point[] {
    const intersection = this.intersectOffsetRays(
      current.endOffset,
      current.endTangent,
      next.startOffset,
      next.startTangent
    );

    if (intersection) {
      const maxDistance = Math.max(current.distance, next.distance, 0.01) * 6;
      if (
        intersection.dist(current.endOffset) <= maxDistance &&
        intersection.dist(next.startOffset) <= maxDistance
      ) {
        return [intersection];
      }
    }

    return [current.endOffset, next.startOffset];
  }

  private static intersectOffsetRays(
    p1: Point,
    d1: Point,
    p2: Point,
    d2: Point
  ): Point | null {
    const cross = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cross) < 1e-8) {
      return null;
    }

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const t = (dx * d2.y - dy * d2.x) / cross;

    return new Point(
      p1.x + d1.x * t,
      p1.y + d1.y * t
    );
  }

  private static getOutlineOrientation(outline: Path): number {
    const points = outline.toPoints(80);
    if (points.length < 3) {
      return 1;
    }

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length];
      area += points[i].x * next.y - next.x * points[i].y;
    }

    return area >= 0 ? 1 : -1;
  }

  private static getOutwardNormal(tangent: Point, orientation: number): Point {
    const unit = this.normalize({ x: tangent.x, y: tangent.y });
    if (orientation >= 0) {
      return new Point(unit.y, -unit.x);
    }
    return new Point(-unit.y, unit.x);
  }

  private static normalize(vector: { x: number; y: number }): { x: number; y: number } {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    if (length < 1e-8) {
      return { x: 1, y: 0 };
    }

    return {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  private static deduplicateSequentialPoints(points: Point[], closed: boolean = false): Point[] {
    const result: Point[] = [];

    for (const point of points) {
      const previous = result[result.length - 1];
      if (!previous || !previous.equals(point, 0.0001)) {
        result.push(point);
      }
    }

    if (closed && result.length > 1 && result[0].equals(result[result.length - 1], 0.0001)) {
      result.pop();
    }

    return result;
  }
}
