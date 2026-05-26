export class Point {
  constructor(public x: number, public y: number) {}

  clone(): Point {
    return new Point(this.x, this.y);
  }

  add(p: Point): Point {
    return new Point(this.x + p.x, this.y + p.y);
  }

  subtract(p: Point): Point {
    return new Point(this.x - p.x, this.y - p.y);
  }

  multiply(scalar: number): Point {
    return new Point(this.x * scalar, this.y * scalar);
  }

  distanceTo(p: Point): number {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  midpoint(p: Point): Point {
    return new Point((this.x + p.x) / 2, (this.y + p.y) / 2);
  }

  mirror(lineStart: Point, lineEnd: Point): Point {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const t = ((this.x - lineStart.x) * dx + (this.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    const closestX = lineStart.x + t * dx;
    const closestY = lineStart.y + t * dy;
    return new Point(2 * closestX - this.x, 2 * closestY - this.y);
  }

  rotate(angle: number, center: Point = new Point(0, 0)): Point {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = this.x - center.x;
    const dy = this.y - center.y;
    return new Point(
      center.x + dx * cos - dy * sin,
      center.y + dx * sin + dy * cos
    );
  }

  translate(dx: number, dy: number): Point {
    return new Point(this.x + dx, this.y + dy);
  }
}