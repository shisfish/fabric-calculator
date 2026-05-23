export class Attributes {
  private data: Map<string, string[]> = new Map();

  add(name: string, value: string | number): this {
    if (!this.data.has(name)) {
      this.data.set(name, []);
    }
    this.data.get(name)!.push(String(value));
    return this;
  }

  set(name: string, value: string | number): this {
    this.data.set(name, [String(value)]);
    return this;
  }

  get(name: string): string | undefined {
    const values = this.data.get(name);
    return values ? values.join(' ') : undefined;
  }

  getValues(name: string): string[] {
    return this.data.get(name) || [];
  }

  has(name: string): boolean {
    return this.data.has(name);
  }

  remove(name: string): this {
    this.data.delete(name);
    return this;
  }

  clone(): Attributes {
    const cloned = new Attributes();
    this.data.forEach((values, key) => {
      cloned.data.set(key, [...values]);
    });
    return cloned;
  }

  toObject(): Record<string, string> {
    const result: Record<string, string> = {};
    this.data.forEach((values, key) => {
      result[key] = values.join(' ');
    });
    return result;
  }
}

export class Point {
  x: number;
  y: number;
  attributes: Attributes;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.attributes = new Attributes();
  }

  clone(): Point {
    const cloned = new Point(this.x, this.y);
    cloned.attributes = this.attributes.clone();
    return cloned;
  }

  copy(): Point {
    return new Point(this.x, this.y);
  }

  dist(that: Point): number {
    const dx = this.x - that.x;
    const dy = this.y - that.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  dx(that: Point): number {
    return that.x - this.x;
  }

  dy(that: Point): number {
    return that.y - this.y;
  }

  angle(that: Point): number {
    const rad = Math.atan2(-this.dy(that), this.dx(that));
    return rad < 0 ? (rad + 2 * Math.PI) * (180 / Math.PI) : rad * (180 / Math.PI);
  }

  angleRadians(that: Point): number {
    const rad = Math.atan2(-this.dy(that), this.dx(that));
    return rad < 0 ? rad + 2 * Math.PI : rad;
  }

  shift(angleDegrees: number, distance: number): Point {
    const rad = angleDegrees * (Math.PI / 180);
    return new Point(
      this.x + distance * Math.cos(rad),
      this.y - distance * Math.sin(rad)
    );
  }

  shiftRadians(angleRadians: number, distance: number): Point {
    return new Point(
      this.x + distance * Math.cos(angleRadians),
      this.y - distance * Math.sin(angleRadians)
    );
  }

  shiftTowards(target: Point, distance: number): Point {
    const angle = this.angleRadians(target);
    return this.shiftRadians(angle, distance);
  }

  shiftFractionTowards(target: Point, fraction: number): Point {
    return new Point(
      this.x + this.dx(target) * fraction,
      this.y + this.dy(target) * fraction
    );
  }

  rotate(angleDegrees: number, center: Point = new Point(0, 0)): Point {
    const rad = angleDegrees * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = this.x - center.x;
    const dy = this.y - center.y;
    return new Point(
      center.x + dx * cos - dy * sin,
      center.y + dx * sin + dy * cos
    );
  }

  rotateRadians(angleRadians: number, center: Point = new Point(0, 0)): Point {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    const dx = this.x - center.x;
    const dy = this.y - center.y;
    return new Point(
      center.x + dx * cos - dy * sin,
      center.y + dx * sin + dy * cos
    );
  }

  flipX(axis: Point = new Point(0, 0)): Point {
    return new Point(axis.x + axis.dx(this), this.y);
  }

  flipY(axis: Point = new Point(0, 0)): Point {
    return new Point(this.x, axis.y + axis.dy(this));
  }

  mirror(lineStart: Point, lineEnd: Point): Point {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const a = (dx * dx - dy * dy) / (dx * dx + dy * dy);
    const b = 2 * dx * dy / (dx * dx + dy * dy);
    return new Point(
      lineStart.x + a * (this.x - lineStart.x) + b * (this.y - lineStart.y),
      lineStart.y + b * (this.x - lineStart.x) - a * (this.y - lineStart.y)
    );
  }

  scale(factor: number, center: Point = new Point(0, 0)): Point {
    return new Point(
      center.x + (this.x - center.x) * factor,
      center.y + (this.y - center.y) * factor
    );
  }

  translate(dx: number, dy: number): Point {
    return new Point(this.x + dx, this.y + dy);
  }

  attr(name: string, value: string | number, overwrite: boolean = false): this {
    if (overwrite) {
      this.attributes.set(name, value);
    } else {
      this.attributes.add(name, value);
    }
    return this;
  }

  addText(text: string, className?: string): this {
    this.attributes.add('data-text', text);
    if (className) {
      this.attributes.add('data-text-class', className);
    }
    return this;
  }

  addCircle(radius: number, className?: string): this {
    this.attributes.add('data-circle', String(radius));
    if (className) {
      this.attributes.add('data-circle-class', className);
    }
    return this;
  }

  equals(that: Point, tolerance: number = 0.001): boolean {
    return Math.abs(this.x - that.x) < tolerance && Math.abs(this.y - that.y) < tolerance;
  }

  isOnLine(start: Point, end: Point, tolerance: number = 0.001): boolean {
    const crossProduct = (this.y - start.y) * (end.x - start.x) - (this.x - start.x) * (end.y - start.y);
    if (Math.abs(crossProduct) > tolerance) return false;
    const dotProduct = (this.x - start.x) * (end.x - start.x) + (this.y - start.y) * (end.y - start.y);
    if (dotProduct < 0) return false;
    const squaredLength = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
    if (dotProduct > squaredLength) return false;
    return true;
  }

  toString(): string {
    return `Point(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }

  toSVG(): string {
    return `${this.x.toFixed(4)},${this.y.toFixed(4)}`;
  }

  static fromPolar(angleRadians: number, radius: number): Point {
    return new Point(
      radius * Math.cos(angleRadians),
      radius * Math.sin(angleRadians)
    );
  }

  static midpoint(a: Point, b: Point): Point {
    return new Point((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  static centroid(points: Point[]): Point {
    if (points.length === 0) return new Point(0, 0);
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return new Point(sum.x / points.length, sum.y / points.length);
  }
}

export function deg2rad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function rad2deg(radians: number): number {
  return radians * (180 / Math.PI);
}

export const GOLDEN_RATIO = 1.618034;

export const CBQC = 0.55191502449351;
