import { Point, Path } from '../geometry/index.js';

export interface FrontPatternParams {
  chestWidth: number;
  bodyLength: number;
  shoulderWidth: number;
  neckWidth: number;
  armholeDepth?: number;
  frontNeckDepth?: number;
}

interface TemplatePoint {
  x: number;
  y: number;
}

interface ScaledPoints {
  neckLeft: Point;
  neckCurveControl: Point;
  neckCenter: Point;
  shoulderEnd: Point;
  armholeControl1: Point;
  armholeControl2: Point;
  armholeBottom: Point;
  sideBottom: Point;
  hemCurveControl: Point;
  hemCenter: Point;
  hemLeftControl: Point;
  leftBottom: Point;
}

const BASE_TEMPLATE = {
  chestWidth: 58,
  bodyLength: 72,
  shoulderWidth: 24,
  neckWidth: 18,
  armholeDepth: 26,
  frontNeckDepth: 8.5
};

const BASE_POINTS: Record<string, TemplatePoint> = {
  neckLeft: { x: 0, y: 8.5 },
  neckCurveControl: { x: 4.5, y: 4.2 },
  neckCenter: { x: 9, y: 5 },
  shoulderEnd: { x: 12, y: 3 },
  armholeControl1: { x: 16, y: 10 },
  armholeControl2: { x: 22, y: 18 },
  armholeBottom: { x: 29, y: 26 },
  sideBottom: { x: 29, y: 72 },
  hemCurveControl: { x: 22, y: 73.5 },
  hemCenter: { x: 15, y: 74 },
  hemLeftControl: { x: 7, y: 72.5 },
  leftBottom: { x: 0, y: 72 }
};

export class FrontPatternGenerator {
  static generate(params: FrontPatternParams): Path {
    const points = this.scalePoints(params);

    const path = new Path()
      .move(points.neckLeft)
      .quad(points.neckCurveControl, points.neckCenter)
      .line(points.shoulderEnd)
      .curve(points.armholeControl1, points.armholeControl2, points.armholeBottom)
      .line(points.sideBottom)
      .quad(points.hemCurveControl, points.hemCenter)
      .quad(points.hemLeftControl, points.leftBottom)
      .close();

    path.attr('class', 'fabric front-panel');
    return path;
  }

  private static scalePoints(params: FrontPatternParams): ScaledPoints {
    const {
      chestWidth = BASE_TEMPLATE.chestWidth,
      bodyLength = BASE_TEMPLATE.bodyLength,
      shoulderWidth = BASE_TEMPLATE.shoulderWidth,
      neckWidth = BASE_TEMPLATE.neckWidth,
      armholeDepth = BASE_TEMPLATE.armholeDepth,
      frontNeckDepth = BASE_TEMPLATE.frontNeckDepth
    } = params;

    const scaleX = chestWidth / BASE_TEMPLATE.chestWidth;
    const scaleY = bodyLength / BASE_TEMPLATE.bodyLength;
    const scaleShoulder = shoulderWidth / BASE_TEMPLATE.shoulderWidth;
    const scaleNeck = neckWidth / BASE_TEMPLATE.neckWidth;
    const scaleArmhole = armholeDepth / BASE_TEMPLATE.armholeDepth;
    const scaleNeckDepth = frontNeckDepth / BASE_TEMPLATE.frontNeckDepth;

    const halfChest = chestWidth / 2;
    const halfShoulder = shoulderWidth / 2;
    const halfNeck = neckWidth / 2;

    return {
      neckLeft: new Point(
        0,
        frontNeckDepth
      ),

      neckCurveControl: new Point(
        halfNeck * 0.5,
        frontNeckDepth - frontNeckDepth * 0.5
      ),

      neckCenter: new Point(
        halfNeck,
        frontNeckDepth * 0.6
      ),

      shoulderEnd: new Point(
        halfShoulder,
        Math.tan(3 * Math.PI / 180) * (halfShoulder - halfNeck)
      ),

      armholeControl1: new Point(
        halfNeck + (halfChest - halfNeck) * 0.35,
        Math.tan(3 * Math.PI / 180) * (halfShoulder - halfNeck) + armholeDepth * 0.28
      ),

      armholeControl2: new Point(
        halfChest - (halfChest - halfShoulder) * 0.15,
        Math.tan(3 * Math.PI / 180) * (halfShoulder - halfNeck) + armholeDepth * 0.62
      ),

      armholeBottom: new Point(
        halfChest,
        Math.tan(3 * Math.PI / 180) * (halfShoulder - halfNeck) + armholeDepth
      ),

      sideBottom: new Point(
        halfChest,
        bodyLength
      ),

      hemCurveControl: new Point(
        halfChest * 0.76,
        bodyLength + bodyLength * 0.02
      ),

      hemCenter: new Point(
        halfChest * 0.52,
        bodyLength + bodyLength * 0.028
      ),

      hemLeftControl: new Point(
        halfChest * 0.24,
        bodyLength + bodyLength * 0.007
      ),

      leftBottom: new Point(
        0,
        bodyLength
      )
    };
  }

  static generateSVG(params: FrontPatternParams): string {
    const path = this.generate(params);
    const ops = path.ops;

    let d = '';
    for (const op of ops) {
      switch (op.type) {
        case 'move':
          if (op.to) d += `M ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)} `;
          break;
        case 'line':
          if (op.to) d += `L ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)} `;
          break;
        case 'quad':
          if (op.cp1 && op.to) {
            d += `Q ${op.cp1.x.toFixed(2)} ${op.cp1.y.toFixed(2)} ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)} `;
          }
          break;
        case 'curve':
          if (op.cp1 && op.cp2 && op.to) {
            d += `C ${op.cp1.x.toFixed(2)} ${op.cp1.y.toFixed(2)} ${op.cp2.x.toFixed(2)} ${op.cp2.y.toFixed(2)} ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)} `;
          }
          break;
        case 'close':
          d += 'Z ';
          break;
      }
    }

    return `<svg viewBox="0 0 ${params.chestWidth * 2.5} ${params.bodyLength * 1.2}">
<path d="${d.trim()}" fill="none" stroke="blue" stroke-width="2"/>
</svg>`;
  }

  static getTemplateStructure(): string {
    return `
前片模板结构 (基于 example/front_template_point.ts):

固定拓扑: M Q L C L Q Q Z (8段)

关键点位 (12个):
┌─────────────────────────────────────────────┐
│ [0] M neckLeft                              │ ← 前中领点
│ [1] Q neckCurveControl → neckCenter         │ ← 领口Bezier (二次)
│ [2] L shoulderEnd                           │ ← 肩线 (直线)
│ [3] C armholeControl1+2 → armholeBottom     │ ← 袖窿Bezier (三次)
│ [4] L sideBottom                            │ ← 侧缝 (直线)
│ [5] Q hemCurveControl → hemCenter           │ ← 下摆Bezier (右)
│ [6] Q hemLeftControl → leftBottom           │ ← 下摆Bezier (左)
│ [7] Z                                       │ ← 闭合
└─────────────────────────────────────────────┘

参数缩放规则:
- chestWidth → 影响armholeBottom.x, sideBottom.x
- bodyLength → 影响sideBottom.y, hem*.y, leftBottom.y
- shoulderWidth → 影响shoulderEnd.x
- neckWidth → 影响neckCenter.x, neckCurveControl.x

禁止:
- 修改path拓扑 (M Q L C L Q Q Z不可变)
- 新增/删除path段
- 随机生成Bezier控制点
- 自由生成polygon
- 使用矩形模拟裁片

必须:
- 基于模板12个关键点
- 仅根据尺寸参数等比/比例缩放
- 保持工业CAD几何结构
    `;
  }
}
