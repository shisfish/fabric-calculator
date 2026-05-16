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

interface OffsetSegment {
  segmentName: string;
  segmentType: string;
  distance: number;
  kind: 'line' | 'curve';
  start: Point;
  end: Point;
  cp1?: Point;
  cp2?: Point;
  startTangent: Point;
  endTangent: Point;
}

interface RoundJoin {
  kind: 'round';
  curves: CubicBezier[];
}

interface DirectJoin {
  kind: 'direct';
}

type JoinGeometry = RoundJoin | DirectJoin;

export class SeamAllowanceGenerator {
  static generate(outline: Path, rules: SeamAllowanceRule[]): Path {
    if (!rules.length) {
      return outline.clone();
    }

    const sourceSegments = this.extractSegments(outline, rules);
    if (!sourceSegments.length) {
      return outline.clone();
    }

    const orientation = this.getOutlineOrientation(outline);
    const offsetSegments = sourceSegments.map((segment) =>
      this.createOffsetSegment(segment, orientation)
    );

    const joins = this.resolveJoins(offsetSegments, sourceSegments, orientation);
    return this.buildOffsetPath(offsetSegments, joins);
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

  private static createOffsetSegment(segment: SourceSegment, orientation: number): OffsetSegment {
    if (segment.opType === 'line') {
      return this.createParallelLineOffset(segment, orientation);
    }

    if (segment.opType === 'quad' && segment.cp1) {
      const cubic = new QuadraticBezier(segment.start, segment.cp1, segment.end).toCubic();
      return this.createOffsetCubicSegment(segment, cubic, orientation);
    }

    if (segment.opType === 'curve' && segment.cp1 && segment.cp2) {
      const cubic = new CubicBezier(segment.start, segment.cp1, segment.cp2, segment.end);
      return this.createOffsetCubicSegment(segment, cubic, orientation);
    }

    return this.createParallelLineOffset(segment, orientation);
  }

  private static createParallelLineOffset(segment: SourceSegment, orientation: number): OffsetSegment {
    const tangent = this.normalizePoint(new Point(
      segment.end.x - segment.start.x,
      segment.end.y - segment.start.y
    ));
    const normal = this.getOutwardNormal(tangent, orientation);
    const start = this.offsetPoint(segment.start, normal, segment.distance);
    const end = this.offsetPoint(segment.end, normal, segment.distance);

    return {
      segmentName: segment.segmentName,
      segmentType: segment.segmentType,
      distance: segment.distance,
      kind: 'line',
      start,
      end,
      startTangent: tangent.copy(),
      endTangent: tangent.copy()
    };
  }

  private static createOffsetCubicSegment(
    segment: SourceSegment,
    cubic: CubicBezier,
    orientation: number
  ): OffsetSegment {
    const startTangent = this.ensureTangent(cubic.getTangent(0), cubic.p0, cubic.p1);
    const endTangent = this.ensureTangent(cubic.getTangent(1), cubic.p2, cubic.p3);
    const startNormal = this.getOutwardNormal(startTangent, orientation);
    const endNormal = this.getOutwardNormal(endTangent, orientation);

    // 工业 offset: 起点控制系跟随起点法线，终点控制系跟随终点法线。
    const q0 = this.offsetPoint(cubic.p0, startNormal, segment.distance);
    const q1 = this.offsetPoint(cubic.p1, startNormal, segment.distance);
    const q2 = this.offsetPoint(cubic.p2, endNormal, segment.distance);
    const q3 = this.offsetPoint(cubic.p3, endNormal, segment.distance);

    return {
      segmentName: segment.segmentName,
      segmentType: segment.segmentType,
      distance: segment.distance,
      kind: 'curve',
      start: q0,
      cp1: q1,
      cp2: q2,
      end: q3,
      startTangent: this.ensureTangent(
        this.normalizePoint(new Point(q1.x - q0.x, q1.y - q0.y)),
        q0,
        q1
      ),
      endTangent: this.ensureTangent(
        this.normalizePoint(new Point(q3.x - q2.x, q3.y - q2.y)),
        q2,
        q3
      )
    };
  }

  private static resolveJoins(
    offsetSegments: OffsetSegment[],
    sourceSegments: SourceSegment[],
    orientation: number
  ): JoinGeometry[] {
    const joins: JoinGeometry[] = [];

    for (let i = 0; i < offsetSegments.length; i++) {
      const current = offsetSegments[i];
      const next = offsetSegments[(i + 1) % offsetSegments.length];
      const corner = sourceSegments[i].end.copy();
      const angle = this.getTurnAngle(current.endTangent, next.startTangent);
      const shouldUseDirect =
        current.distance === 0 ||
        next.distance === 0 ||
        angle < this.degToRad(18);

      if (shouldUseDirect) {
        const intersection = this.computeLineIntersection(
          current.end,
          current.endTangent,
          next.start,
          next.startTangent
        );
        const joinPoint = intersection || Point.midpoint(current.end, next.start);
        this.updateSegmentEnd(current, joinPoint);
        this.updateSegmentStart(next, joinPoint);
        joins.push({ kind: 'direct' });
        continue;
      }

      joins.push({
        kind: 'round',
        curves: this.createRoundJoinCurves(current, next, corner, orientation)
      });
    }

    return joins;
  }

  private static buildOffsetPath(segments: OffsetSegment[], joins: JoinGeometry[]): Path {
    const path = new Path();
    path.move(segments[0].start);

    for (let i = 0; i < segments.length; i++) {
      this.appendOffsetSegment(path, segments[i]);

      const join = joins[i];
      if (join.kind === 'round') {
        for (const curve of join.curves) {
          path.curve(curve.p1, curve.p2, curve.p3).segment('roundJoin', 'roundJoin');
        }
      }
    }

    path.close();
    return path;
  }

  private static appendOffsetSegment(path: Path, segment: OffsetSegment): void {
    if (segment.kind === 'line') {
      path.line(segment.end).segment(segment.segmentName, segment.segmentType);
      return;
    }

    if (segment.cp1 && segment.cp2) {
      path.curve(segment.cp1, segment.cp2, segment.end).segment(segment.segmentName, segment.segmentType);
    }
  }

  private static updateSegmentStart(segment: OffsetSegment, start: Point): void {
    if (segment.kind === 'line') {
      segment.start = start.copy();
      return;
    }

    const handleLength = segment.cp1 ? segment.start.dist(segment.cp1) : 0;
    segment.start = start.copy();
    segment.cp1 = new Point(
      start.x + segment.startTangent.x * handleLength,
      start.y + segment.startTangent.y * handleLength
    );
  }

  private static updateSegmentEnd(segment: OffsetSegment, end: Point): void {
    if (segment.kind === 'line') {
      segment.end = end.copy();
      return;
    }

    const handleLength = segment.cp2 ? segment.cp2.dist(segment.end) : 0;
    segment.end = end.copy();
    segment.cp2 = new Point(
      end.x - segment.endTangent.x * handleLength,
      end.y - segment.endTangent.y * handleLength
    );
  }

  private static createRoundJoinCurves(
    current: OffsetSegment,
    next: OffsetSegment,
    corner: Point,
    orientation: number
  ): CubicBezier[] {
    const start = current.end.copy();
    const end = next.start.copy();

    if (start.equals(end)) {
      return [];
    }

    const startRadius = start.dist(corner);
    const endRadius = end.dist(corner);
    const radiusDelta = Math.abs(startRadius - endRadius);

    if (radiusDelta < 0.02) {
      const startAngle = Math.atan2(start.y - corner.y, start.x - corner.x);
      const endAngle = this.normalizeArcEndAngle(
        startAngle,
        Math.atan2(end.y - corner.y, end.x - corner.x),
        orientation
      );
      return this.createCircularArcCurves(corner, (startRadius + endRadius) / 2, startAngle, endAngle);
    }

    return [
      this.createBlendJoinCurve(
        start,
        this.getArcTangent(corner, start, orientation),
        end,
        this.getArcTangent(corner, end, orientation)
      )
    ];
  }

  private static createBlendJoinCurve(
    start: Point,
    startTangent: Point,
    end: Point,
    endTangent: Point
  ): CubicBezier {
    const chord = start.dist(end);
    const handle = Math.max(chord * 0.35, 0.01);

    return new CubicBezier(
      start,
      new Point(
        start.x + startTangent.x * handle,
        start.y + startTangent.y * handle
      ),
      new Point(
        end.x - endTangent.x * handle,
        end.y - endTangent.y * handle
      ),
      end
    );
  }

  private static createCircularArcCurves(
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number
  ): CubicBezier[] {
    const sweep = endAngle - startAngle;
    const segmentCount = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const step = sweep / segmentCount;
    const curves: CubicBezier[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const a0 = startAngle + step * i;
      const a1 = a0 + step;
      const p0 = this.pointOnCircle(center, radius, a0);
      const p3 = this.pointOnCircle(center, radius, a1);
      const alpha = (4 / 3) * Math.tan((a1 - a0) / 4) * radius;
      const t0 = this.tangentForAngle(a0);
      const t1 = this.tangentForAngle(a1);

      curves.push(
        new CubicBezier(
          p0,
          new Point(p0.x + t0.x * alpha, p0.y + t0.y * alpha),
          new Point(p3.x - t1.x * alpha, p3.y - t1.y * alpha),
          p3
        )
      );
    }

    return curves;
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
    const unit = this.normalizePoint(tangent);
    if (orientation >= 0) {
      return new Point(unit.y, -unit.x);
    }
    return new Point(-unit.y, unit.x);
  }

  private static getArcTangent(center: Point, point: Point, orientation: number): Point {
    const radial = this.normalizePoint(new Point(point.x - center.x, point.y - center.y));
    if (orientation >= 0) {
      return new Point(radial.y, -radial.x);
    }
    return new Point(-radial.y, radial.x);
  }

  private static tangentForAngle(angle: number): Point {
    return new Point(-Math.sin(angle), Math.cos(angle));
  }

  private static pointOnCircle(center: Point, radius: number, angle: number): Point {
    return new Point(
      center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle)
    );
  }

  private static computeLineIntersection(
    p1: Point,
    d1: Point,
    p2: Point,
    d2: Point
  ): Point | null {
    const cross = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cross) < 1e-8) {
      return null;
    }

    const delta = new Point(p2.x - p1.x, p2.y - p1.y);
    const t = (delta.x * d2.y - delta.y * d2.x) / cross;

    return new Point(
      p1.x + d1.x * t,
      p1.y + d1.y * t
    );
  }

  private static normalizeArcEndAngle(startAngle: number, rawEndAngle: number, orientation: number): number {
    let endAngle = rawEndAngle;

    if (orientation >= 0) {
      while (endAngle >= startAngle) {
        endAngle -= Math.PI * 2;
      }
      if (Math.abs(endAngle - startAngle) > Math.PI) {
        endAngle += Math.PI * 2;
      }
    } else {
      while (endAngle <= startAngle) {
        endAngle += Math.PI * 2;
      }
      if (Math.abs(endAngle - startAngle) > Math.PI) {
        endAngle -= Math.PI * 2;
      }
    }

    return endAngle;
  }

  private static getTurnAngle(previous: Point, next: Point): number {
    const a = this.normalizePoint(previous);
    const b = this.normalizePoint(next);
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
    return Math.acos(dot);
  }

  private static ensureTangent(fallback: Point, from: Point, to: Point): Point {
    const vector = new Point(to.x - from.x, to.y - from.y);
    if (vector.dist(new Point(0, 0)) < 1e-8) {
      return this.normalizePoint(fallback);
    }
    return this.normalizePoint(vector);
  }

  private static offsetPoint(point: Point, normal: Point, distance: number): Point {
    return new Point(
      point.x + normal.x * distance,
      point.y + normal.y * distance
    );
  }

  private static normalizePoint(point: Point): Point {
    const length = Math.sqrt(point.x * point.x + point.y * point.y);
    if (length < 1e-8) {
      return new Point(1, 0);
    }
    return new Point(point.x / length, point.y / length);
  }

  private static degToRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }
}
