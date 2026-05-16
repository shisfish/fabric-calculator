import { Point, Path } from '../geometry/index.js';
import { CubicBezier, QuadraticBezier } from '../geometry/Bezier.js';
import { createLogger } from '../utils/CADLogger.js';

const logger = createLogger('SEAM-ALLOWANCE');

export interface SeamAllowanceRule {
  segment: string;
  distance: number;
}

export class SeamAllowanceGenerator {
  /**
   * 工业级分段缝份生成器
   * 
   * 1. 基于 path segment 标识进行分段处理
   * 2. 采样离散化 (Flatten)
   * 3. 计算法线方向并平移
   * 4. 重新构建路径
   */
  static generate(outline: Path, rules: SeamAllowanceRule[]): Path {
    if (!rules || rules.length === 0) {
      return outline.clone();
    }

    const resultPath = new Path();
    let currentPoint: Point | null = null;
    let startPoint: Point | null = null;

    // 存储所有生成的离散点，最后统一重建
    const allOffsetPoints: Point[] = [];

    for (const op of outline.ops) {
      const rule = rules.find(r => r.segment === op.segmentName);
      const distance = rule ? rule.distance : 0;

      switch (op.type) {
        case 'move':
          if (op.to) {
            currentPoint = op.to.copy();
            startPoint = currentPoint.copy();
          }
          break;

        case 'line':
          if (op.to && currentPoint) {
            const segmentPoints = this.offsetLine(currentPoint, op.to, distance);
            allOffsetPoints.push(...segmentPoints);
            currentPoint = op.to.copy();
          }
          break;

        case 'curve':
          if (op.cp1 && op.cp2 && op.to && currentPoint) {
            const segmentPoints = this.offsetCubicBezier(currentPoint, op.cp1, op.cp2, op.to, distance);
            allOffsetPoints.push(...segmentPoints);
            currentPoint = op.to.copy();
          }
          break;

        case 'quad':
          if (op.cp1 && op.to && currentPoint) {
            const segmentPoints = this.offsetQuadraticBezier(currentPoint, op.cp1, op.to, distance);
            allOffsetPoints.push(...segmentPoints);
            currentPoint = op.to.copy();
          }
          break;

        case 'close':
          if (currentPoint && startPoint) {
            // 闭合处暂不特殊处理，交给 rebuildPath 统一封闭
          }
          break;
      }
    }

    if (allOffsetPoints.length < 2) {
      return outline.clone();
    }

    // 简单平滑并重建路径
    resultPath.move(allOffsetPoints[0]);
    for (let i = 1; i < allOffsetPoints.length; i++) {
      resultPath.line(allOffsetPoints[i]);
    }
    resultPath.close();

    return resultPath;
  }

  private static offsetLine(p0: Point, p1: Point, distance: number): Point[] {
    if (distance === 0) return [p0.copy(), p1.copy()];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len < 1e-6) return [p0.copy()];

    // 法线方向 (顺时针方向 90 度，对于闭合路径通常是向外)
    // 假设路径是顺时针，法线指向左侧 (dy, -dx) 是向外
    const nx = dy / len;
    const ny = -dx / len;

    return [
      new Point(p0.x + nx * distance, p0.y + ny * distance),
      new Point(p1.x + nx * distance, p1.y + ny * distance)
    ];
  }

  private static offsetCubicBezier(p0: Point, cp1: Point, cp2: Point, p3: Point, distance: number, steps: number = 20): Point[] {
    const bezier = new CubicBezier(p0, cp1, cp2, p3);
    const points: Point[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = bezier.getPoint(t);
      if (distance === 0) {
        points.push(pt);
        continue;
      }
      const normal = bezier.getNormal(t);
      // 工业规则：需要根据路径走向判断法线方向，这里默认向外
      points.push(new Point(
        pt.x + normal.x * distance,
        pt.y + normal.y * distance
      ));
    }
    return points;
  }

  private static offsetQuadraticBezier(p0: Point, cp: Point, p1: Point, distance: number, steps: number = 20): Point[] {
    const quad = new QuadraticBezier(p0, cp, p1);
    const cubic = quad.toCubic();
    return this.offsetCubicBezier(cubic.p0, cubic.p1, cubic.p2, cubic.p3, distance, steps);
  }
}
