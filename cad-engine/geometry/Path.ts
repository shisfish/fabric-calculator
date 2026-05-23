import { Point, Attributes } from './Point.js';
import { CubicBezier, QuadraticBezier } from './Bezier.js';

export type PathOperationType = 'move' | 'line' | 'curve' | 'quad' | 'close';

export interface PathOperation {
  type: PathOperationType;
  to?: Point;
  cp1?: Point;
  cp2?: Point;
  segmentName?: string;
  segmentType?: string;
}

export class Path {
  ops: PathOperation[] = [];
  attributes: Attributes;
  hidden: boolean = false;
  name?: string;

  constructor() {
    this.attributes = new Attributes();
  }

  /**
   * 给最近的一个操作标记段名称和类型
   */
  segment(name: string, type?: string): this {
    if (this.ops.length > 0) {
      const lastOp = this.ops[this.ops.length - 1];
      lastOp.segmentName = name;
      lastOp.segmentType = type || name;
    }
    return this;
  }

  move(to: Point): this {
    this.ops.push({ type: 'move', to: to.copy() });
    return this;
  }

  line(to: Point): this {
    this.ops.push({ type: 'line', to: to.copy() });
    return this;
  }

  curve(cp1: Point, cp2: Point, to: Point): this {
    this.ops.push({ type: 'curve', cp1: cp1.copy(), cp2: cp2.copy(), to: to.copy() });
    return this;
  }

  curve_(cp2: Point, to: Point): this {
    if (this.ops.length === 0) {
      throw new Error('Cannot use curve_ without a previous operation');
    }
    const lastOp = this.ops[this.ops.length - 1];
    if (!lastOp.to) {
      throw new Error('Previous operation has no endpoint');
    }
    this.ops.push({ type: 'curve', cp1: lastOp.to.copy(), cp2: cp2.copy(), to: to.copy() });
    return this;
  }

  _curve(cp2: Point, to: Point): this {
    if (this.ops.length === 0) {
      throw new Error('Cannot use _curve without a previous operation');
    }
    const lastOp = this.ops[this.ops.length - 1];
    if (!lastOp.to) {
      throw new Error('Previous operation has no endpoint');
    }
    this.ops.push({ type: 'curve', cp1: lastOp.to.copy(), cp2: cp2.copy(), to: to.copy() });
    return this;
  }

  quad(cp: Point, to: Point): this {
    this.ops.push({ type: 'quad', cp1: cp.copy(), to: to.copy() });
    return this;
  }

  close(): this {
    this.ops.push({ type: 'close' });
    return this;
  }

  attr(name: string, value: string | number, overwrite: boolean = false): this {
    if (overwrite) {
      this.attributes.set(name, value);
    } else {
      this.attributes.add(name, value);
    }
    return this;
  }

  addClass(className: string): this {
    this.attributes.add('class', className);
    return this;
  }

  addText(text: string, className?: string): this {
    this.attributes.add('data-text', text);
    if (className) {
      this.attributes.add('data-text-class', className);
    }
    return this;
  }

  hide(): this {
    this.hidden = true;
    return this;
  }

  show(): this {
    this.hidden = false;
    return this;
  }

  getStart(): Point | null {
    for (const op of this.ops) {
      if (op.type === 'move' && op.to) {
        return op.to;
      }
    }
    return null;
  }

  getEnd(): Point | null {
    for (let i = this.ops.length - 1; i >= 0; i--) {
      if (this.ops[i].to) {
        return this.ops[i].to!;
      }
    }
    return null;
  }

  getBoundingBox(): { topLeft: Point; bottomRight: Point } | null {
    const points = this.toPoints();
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
      topLeft: new Point(minX, minY),
      bottomRight: new Point(maxX, maxY)
    };
  }

  toPoints(stepsPerCurve: number = 20): Point[] {
    const points: Point[] = [];
    let current: Point | null = null;

    for (const op of this.ops) {
      switch (op.type) {
        case 'move':
          if (op.to) {
            current = op.to;
            points.push(current.copy());
          }
          break;
        case 'line':
          if (op.to && current) {
            current = op.to;
            points.push(current.copy());
          }
          break;
        case 'curve':
          if (op.cp1 && op.cp2 && op.to && current) {
            const bezier = new CubicBezier(current, op.cp1, op.cp2, op.to);
            for (let i = 1; i <= stepsPerCurve; i++) {
              points.push(bezier.getPoint(i / stepsPerCurve));
            }
            current = op.to;
          }
          break;
        case 'quad':
          if (op.cp1 && op.to && current) {
            const quad = new QuadraticBezier(current, op.cp1, op.to);
            const cubic = quad.toCubic();
            for (let i = 1; i <= stepsPerCurve; i++) {
              points.push(cubic.getPoint(i / stepsPerCurve));
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

  toPolygon(): Point[] {
    return this.toPoints(50);
  }

  getLength(stepsPerCurve: number = 100): number {
    let length = 0;
    let current: Point | null = null;

    for (const op of this.ops) {
      switch (op.type) {
        case 'move':
          if (op.to) current = op.to;
          break;
        case 'line':
          if (op.to && current) {
            length += current.dist(op.to);
            current = op.to;
          }
          break;
        case 'curve':
          if (op.cp1 && op.cp2 && op.to && current) {
            const bezier = new CubicBezier(current, op.cp1, op.cp2, op.to);
            length += bezier.getLength(stepsPerCurve);
            current = op.to;
          }
          break;
        case 'quad':
          if (op.cp1 && op.to && current) {
            const quad = new QuadraticBezier(current, op.cp1, op.to);
            length += quad.toCubic().getLength(stepsPerCurve);
            current = op.to;
          }
          break;
        case 'close':
          break;
      }
    }

    return length;
  }

  offset(distance: number): Path {
    const result = new Path();
    let current: Point | null = null;

    for (const op of this.ops) {
      switch (op.type) {
        case 'move':
          if (op.to) {
            current = op.to;
            result.move(current);
          }
          break;
        case 'line':
          if (op.to && current) {
            const normal = this.getLineNormal(current, op.to);
            const offsetEnd = new Point(
              op.to.x + normal.x * distance,
              op.to.y + normal.y * distance
            );
            result.line(offsetEnd);
            current = op.to;
          }
          break;
        case 'curve':
          if (op.cp1 && op.cp2 && op.to && current) {
            const bezier = new CubicBezier(current, op.cp1, op.cp2, op.to);
            const offsetBezier = bezier.offset(distance);
            result.curve(offsetBezier.p1, offsetBezier.p2, offsetBezier.p3);
            current = op.to;
          }
          break;
        case 'quad':
          if (op.cp1 && op.to && current) {
            const quad = new QuadraticBezier(current, op.cp1, op.to);
            const offsetBezier = quad.toCubic().offset(distance);
            result.curve(offsetBezier.p1, offsetBezier.p2, offsetBezier.p3);
            current = op.to;
          }
          break;
        case 'close':
          result.close();
          break;
      }
    }

    return result;
  }

  private getLineNormal(from: Point, to: Point): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) return new Point(0, 1);
    return new Point(-dy / len, dx / len);
  }

  reverse(): Path {
    const result = new Path();
    const points = this.toPoints(50);
    
    if (points.length === 0) return result;
    
    result.move(points[points.length - 1]);
    for (let i = points.length - 2; i >= 0; i--) {
      result.line(points[i]);
    }
    
    if (this.ops[this.ops.length - 1]?.type === 'close') {
      result.close();
    }
    
    return result;
  }

  join(other: Path): Path {
    for (const op of other.ops) {
      this.ops.push({ ...op });
    }
    return this;
  }

  splitAtPoint(point: Point, tolerance: number = 0.01): Path[] {
    const result: Path[] = [];
    let current: Point | null = null;
    let currentPath = new Path();
    let found = false;

    for (const op of this.ops) {
      if (found) {
        currentPath.ops.push({ ...op });
        continue;
      }

      switch (op.type) {
        case 'move':
          if (op.to) {
            current = op.to;
            currentPath.move(current);
          }
          break;
        case 'line':
          if (op.to && current) {
            if (point.isOnLine(current, op.to, tolerance)) {
              result.push(currentPath);
              currentPath = new Path();
              currentPath.move(point);
              found = true;
            }
            currentPath.line(op.to);
            current = op.to;
          }
          break;
        case 'curve':
          if (op.cp1 && op.cp2 && op.to && current) {
            const bezier = new CubicBezier(current, op.cp1, op.cp2, op.to);
            const t = bezier.findTForPoint(point, tolerance);
            if (t !== null) {
              const [left, right] = bezier.split(t);
              currentPath.curve(left.p1, left.p2, left.p3);
              result.push(currentPath);
              currentPath = new Path();
              currentPath.move(right.p0);
              currentPath.curve(right.p1, right.p2, right.p3);
              found = true;
            } else {
              currentPath.curve(op.cp1, op.cp2, op.to);
            }
            current = op.to;
          }
          break;
        default:
          currentPath.ops.push({ ...op });
      }
    }

    if (currentPath.ops.length > 0) {
      result.push(currentPath);
    }

    return result;
  }

  toSVGPath(): string {
    let d = '';
    for (const op of this.ops) {
      switch (op.type) {
        case 'move':
          if (op.to) {
            d += `M ${op.to.x.toFixed(4)},${op.to.y.toFixed(4)} `;
          }
          break;
        case 'line':
          if (op.to) {
            d += `L ${op.to.x.toFixed(4)},${op.to.y.toFixed(4)} `;
          }
          break;
        case 'curve':
          if (op.cp1 && op.cp2 && op.to) {
            d += `C ${op.cp1.x.toFixed(4)},${op.cp1.y.toFixed(4)} ${op.cp2.x.toFixed(4)},${op.cp2.y.toFixed(4)} ${op.to.x.toFixed(4)},${op.to.y.toFixed(4)} `;
          }
          break;
        case 'quad':
          if (op.cp1 && op.to) {
            d += `Q ${op.cp1.x.toFixed(4)},${op.cp1.y.toFixed(4)} ${op.to.x.toFixed(4)},${op.to.y.toFixed(4)} `;
          }
          break;
        case 'close':
          d += 'Z ';
          break;
      }
    }
    return d.trim();
  }

  toSVGElement(): string {
    const d = this.toSVGPath();
    const attrs = this.attributes.toObject();
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    
    return `<path d="${d}" ${attrStr}/>`;
  }

  clone(): Path {
    const cloned = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { 
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) newOp.to = op.to.copy();
      if (op.cp1) newOp.cp1 = op.cp1.copy();
      if (op.cp2) newOp.cp2 = op.cp2.copy();
      cloned.ops.push(newOp);
    }
    cloned.attributes = this.attributes.clone();
    cloned.hidden = this.hidden;
    cloned.name = this.name;
    return cloned;
  }

  translate(dx: number, dy: number): Path {
    const result = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { 
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) newOp.to = op.to.translate(dx, dy);
      if (op.cp1) newOp.cp1 = op.cp1.translate(dx, dy);
      if (op.cp2) newOp.cp2 = op.cp2.translate(dx, dy);
      result.ops.push(newOp);
    }
    result.attributes = this.attributes.clone();
    result.hidden = this.hidden;
    result.name = this.name;
    return result;
  }

  rotate(angleDegrees: number, center: Point = new Point(0, 0)): Path {
    const result = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { 
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) newOp.to = op.to.rotate(angleDegrees, center);
      if (op.cp1) newOp.cp1 = op.cp1.rotate(angleDegrees, center);
      if (op.cp2) newOp.cp2 = op.cp2.rotate(angleDegrees, center);
      result.ops.push(newOp);
    }
    result.attributes = this.attributes.clone();
    result.hidden = this.hidden;
    result.name = this.name;
    return result;
  }

  scale(factor: number, center: Point = new Point(0, 0)): Path {
    const result = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { 
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) newOp.to = op.to.scale(factor, center);
      if (op.cp1) newOp.cp1 = op.cp1.scale(factor, center);
      if (op.cp2) newOp.cp2 = op.cp2.scale(factor, center);
      result.ops.push(newOp);
    }
    result.attributes = this.attributes.clone();
    result.hidden = this.hidden;
    result.name = this.name;
    return result;
  }

  mirror(lineStart: Point, lineEnd: Point): Path {
    const result = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { 
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) newOp.to = op.to.mirror(lineStart, lineEnd);
      if (op.cp1) newOp.cp1 = op.cp1.mirror(lineStart, lineEnd);
      if (op.cp2) newOp.cp2 = op.cp2.mirror(lineStart, lineEnd);
      result.ops.push(newOp);
    }
    result.attributes = this.attributes.clone();
    result.hidden = this.hidden;
    result.name = this.name;
    return result;
  }

  flipX(axis: Point = new Point(0, 0)): Path {
    const result = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { 
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) newOp.to = op.to.flipX(axis);
      if (op.cp1) newOp.cp1 = op.cp1.flipX(axis);
      if (op.cp2) newOp.cp2 = op.cp2.flipX(axis);
      result.ops.push(newOp);
    }
    result.attributes = this.attributes.clone();
    result.hidden = this.hidden;
    result.name = this.name;
    return result;
  }

  flipY(axis: Point = new Point(0, 0)): Path {
    const result = new Path();
    for (const op of this.ops) {
      const newOp: PathOperation = { 
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) newOp.to = op.to.flipY(axis);
      if (op.cp1) newOp.cp1 = op.cp1.flipY(axis);
      if (op.cp2) newOp.cp2 = op.cp2.flipY(axis);
      result.ops.push(newOp);
    }
    result.attributes = this.attributes.clone();
    result.hidden = this.hidden;
    result.name = this.name;
    return result;
  }

  static rectangle(width: number, height: number, origin: Point = new Point(0, 0)): Path {
    return new Path()
      .move(origin)
      .line(new Point(origin.x + width, origin.y))
      .line(new Point(origin.x + width, origin.y + height))
      .line(new Point(origin.x, origin.y + height))
      .close();
  }

  static circle(radius: number, center: Point = new Point(0, 0)): Path {
    const curves = CubicBezier.arc(center, radius, 0, 360);
    const path = new Path();
    path.move(curves[0].p0);
    for (const curve of curves) {
      path.curve(curve.p1, curve.p2, curve.p3);
    }
    path.close();
    return path;
  }

  static fromPoints(points: Point[], closed: boolean = false): Path {
    if (points.length === 0) return new Path();
    
    const path = new Path();
    path.move(points[0]);
    
    for (let i = 1; i < points.length; i++) {
      path.line(points[i]);
    }
    
    if (closed) {
      path.close();
    }
    
    return path;
  }

  static fromSVGPath(d: string): Path {
    const path = new Path();
    const commands = d.match(/[MLQCZ][^MLQCZ]*/gi) || [];
    
    for (const cmd of commands) {
      const type = cmd[0].toUpperCase();
      const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
      
      switch (type) {
        case 'M':
          path.move(new Point(coords[0], coords[1]));
          break;
        case 'L':
          path.line(new Point(coords[0], coords[1]));
          break;
        case 'C':
          path.curve(
            new Point(coords[0], coords[1]),
            new Point(coords[2], coords[3]),
            new Point(coords[4], coords[5])
          );
          break;
        case 'Q':
          path.quad(
            new Point(coords[0], coords[1]),
            new Point(coords[2], coords[3])
          );
          break;
        case 'Z':
          path.close();
          break;
      }
    }
    
    return path;
  }
}
