import { Point } from './Point.js';

export interface PathOperation {
  type: 'move' | 'line' | 'curve' | 'quad' | 'close';
  to?: Point;
  cp1?: Point;
  cp2?: Point;
  segmentName?: string;
  segmentType?: string;
}

export class Path {
  ops: PathOperation[] = [];

  static rectangle(width: number, height: number): Path {
    return new Path()
      .move(new Point(0, 0))
      .line(new Point(width, 0))
      .line(new Point(width, height))
      .line(new Point(0, height))
      .close();
  }

  move(to: Point): this {
    this.ops.push({ type: 'move', to });
    return this;
  }

  line(to: Point): this {
    this.ops.push({ type: 'line', to });
    return this;
  }

  curve(cp1: Point, cp2: Point, to: Point): this {
    this.ops.push({ type: 'curve', cp1, cp2, to });
    return this;
  }

  quad(cp: Point, to: Point): this {
    this.ops.push({ type: 'quad', cp1: cp, to });
    return this;
  }

  close(): this {
    this.ops.push({ type: 'close' });
    return this;
  }

  segment(name: string): this {
    const lastOp = this.ops[this.ops.length - 1];
    if (lastOp) {
      lastOp.segmentName = name;
    }
    return this;
  }

  getPoints(): Point[] {
    const points: Point[] = [];
    for (const op of this.ops) {
      if (op.to) points.push(op.to);
    }
    return points;
  }

  getBoundingBox(): { min: Point; max: Point } | null {
    const allPoints: Point[] = [];
    for (const op of this.ops) {
      if (op.to) allPoints.push(op.to);
      if (op.cp1) allPoints.push(op.cp1);
      if (op.cp2) allPoints.push(op.cp2);
    }
    
    if (allPoints.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of allPoints) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return { min: new Point(minX, minY), max: new Point(maxX, maxY) };
  }

  translate(dx: number, dy: number): Path {
    const newPath = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { type: op.type, segmentName: op.segmentName, segmentType: op.segmentType };
      if (op.to) newOp.to = op.to.translate(dx, dy);
      if (op.cp1) newOp.cp1 = op.cp1.translate(dx, dy);
      if (op.cp2) newOp.cp2 = op.cp2.translate(dx, dy);
      newPath.ops.push(newOp);
    }
    return newPath;
  }

  rotate(angle: number, center: Point = new Point(0, 0)): Path {
    const newPath = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { type: op.type, segmentName: op.segmentName, segmentType: op.segmentType };
      if (op.to) newOp.to = op.to.rotate(angle, center);
      if (op.cp1) newOp.cp1 = op.cp1.rotate(angle, center);
      if (op.cp2) newOp.cp2 = op.cp2.rotate(angle, center);
      newPath.ops.push(newOp);
    }
    return newPath;
  }

  clone(): Path {
    const newPath = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { type: op.type, segmentName: op.segmentName, segmentType: op.segmentType };
      if (op.to) newOp.to = op.to.clone();
      if (op.cp1) newOp.cp1 = op.cp1.clone();
      if (op.cp2) newOp.cp2 = op.cp2.clone();
      newPath.ops.push(newOp);
    }
    return newPath;
  }
}