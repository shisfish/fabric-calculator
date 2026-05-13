import { Point, Path } from '../geometry/index.js';

export interface FrontPatternParams {
  chestWidth: number;
  bodyLength: number;
  neckWidth: number;
  armholeDepth: number;
  hemWidth?: number;
  frontNeckDepth?: number;
  shoulderWidth?: number;
  shoulderSlope?: number;
}

interface TemplatePoint {
  x: number;
  y: number;
  name: string;
  type: 'anchor' | 'control';
}

const FRONT_TEMPLATE: TemplatePoint[] = [
  { name: 'cfNeck', x: 0, y: 0, type: 'anchor' },
  { name: 'neckCp1', x: 0.43, y: -0.35, type: 'control' },
  { name: 'neckEnd', x: 0.43, y: -0.26, type: 'anchor' },
  { name: 'shoulderCp1', x: 0.78, y: -0.15, type: 'control' },
  { name: 'shoulderEnd', x: 0.41, y: 0.28, type: 'anchor' },
  { name: 'armholeCp', x: 0.27, y: 0.47, type: 'control' },
  { name: 'armholeBottom', x: 1.0, y: 2.5, type: 'anchor' },
  { name: 'sideBottom', x: 1.0, y: 7.78, type: 'anchor' },
  { name: 'hemCp1', x: 0.86, y: 8.05, type: 'control' },
  { name: 'hemMid', x: 0.52, y: 8.05, type: 'anchor' },
  { name: 'hemCp2', x: 0.17, y: 8.05, type: 'control' },
  { name: 'leftBottom', x: 0, y: 7.78, type: 'anchor' }
];

export class FrontPatternGenerator {
  static generate(params: FrontPatternParams): Path {
    const {
      chestWidth,
      bodyLength,
      neckWidth,
      armholeDepth,
      hemWidth = chestWidth,
      frontNeckDepth = neckWidth * 0.47,
      shoulderWidth = chestWidth * 0.41,
      shoulderSlope = 3
    } = params;

    const scaleX = chestWidth / 58;
    const scaleY = bodyLength / 72;
    const scaleNeck = neckWidth / 18;
    const scaleArmhole = armholeDepth / 26;

    const points = this.interpolateTemplate(FRONT_TEMPLATE, {
      scaleX,
      scaleY,
      scaleNeck,
      scaleArmhole,
      chestWidth,
      bodyLength,
      neckWidth,
      armholeDepth,
      hemWidth,
      frontNeckDepth,
      shoulderWidth,
      shoulderSlope
    });

    const path = new Path()
      .move(points.cfNeck)
      .quad(points.neckCp1, points.neckEnd)
      .quad(points.shoulderCp1, points.shoulderEnd)
      .quad(points.armholeCp, points.armholeBottom)
      .line(points.sideBottom)
      .quad(points.hemCp1, points.hemMid)
      .quad(points.hemCp2, points.leftBottom)
      .line(points.cfNeck)
      .close();

    path.attr('class', 'fabric front-panel');
    return path;
  }

  private static interpolateTemplate(
    template: TemplatePoint[],
    scales: {
      scaleX: number;
      scaleY: number;
      scaleNeck: number;
      scaleArmhole: number;
      chestWidth: number;
      bodyLength: number;
      neckWidth: number;
      armholeDepth: number;
      hemWidth: number;
      frontNeckDepth: number;
      shoulderWidth: number;
      shoulderSlope: number;
    }
  ): Record<string, Point> {
    const points: Record<string, Point> = {};
    const {
      scaleX,
      scaleY,
      scaleNeck,
      scaleArmhole,
      chestWidth,
      bodyLength,
      neckWidth,
      armholeDepth,
      hemWidth,
      frontNeckDepth,
      shoulderWidth,
      shoulderSlope
    } = scales;

    const halfChest = chestWidth / 2;
    const halfNeck = neckWidth / 2;
    const halfShoulder = shoulderWidth / 2;
    const halfHem = hemWidth / 2;

    const shoulderDrop = Math.tan(shoulderSlope * Math.PI / 180) * (halfShoulder - halfNeck);

    for (const tp of template) {
      let x: number, y: number;

      switch (tp.name) {
        case 'cfNeck':
          x = 0;
          y = frontNeckDepth;
          break;

        case 'neckCp1':
          x = halfNeck * 0.5;
          y = frontNeckDepth - frontNeckDepth * 0.35;
          break;

        case 'neckEnd':
          x = halfNeck;
          y = frontNeckDepth * 0.26;
          break;

        case 'shoulderCp1':
          x = halfNeck + (halfShoulder - halfNeck) * 0.7;
          y = frontNeckDepth * 0.15;
          break;

        case 'shoulderEnd':
          x = halfShoulder;
          y = shoulderDrop;
          break;

        case 'armholeCp':
          x = halfChest - (halfChest - halfShoulder) * 0.27;
          y = shoulderDrop + armholeDepth * 0.47;
          break;

        case 'armholeBottom':
          x = halfChest;
          y = shoulderDrop + armholeDepth;
          break;

        case 'sideBottom':
          x = halfChest;
          y = bodyLength;
          break;

        case 'hemCp1':
          x = halfHem * 0.86;
          y = bodyLength + bodyLength * 0.004;
          break;

        case 'hemMid':
          x = halfHem * 0.52;
          y = bodyLength + bodyLength * 0.004;
          break;

        case 'hemCp2':
          x = halfHem * 0.17;
          y = bodyLength + bodyLength * 0.004;
          break;

        case 'leftBottom':
          x = 0;
          y = bodyLength;
          break;

        default:
          x = tp.x * chestWidth * scaleX;
          y = tp.y * bodyLength * scaleY;
      }

      points[tp.name] = new Point(x, y);
    }

    return points;
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
前片模板结构 (5段):

1. 领口曲线 (neckLeft → neckCenter)
   Q neckCp1 neckEnd
   - 控制点在领口上方
   - 形成圆弧领口

2. 肩线过渡 (neckCenter → shoulderEnd)
   Q shoulderCp1 shoulderEnd
   - 从领宽点到肩点
   - 包含肩斜角度

3. 袖窿曲线 (shoulderEnd → armholeBottom)
   Q armholeCp armholeBottom
   - 外凸的袖窿弧线
   - 适配袖山曲线

4. 侧缝 (armholeBottom → sideBottom)
   L sideBottom
   - 垂直或微斜直线
   - 连接袖窿和下摆

5. 下摆曲线 (sideBottom → leftBottom)
   Q hemCp1 hemMid
   Q hemCp2 leftBottom
   - 微弧下摆
   - 自然过渡

禁止:
- rectangle
- random polygon
- fake path

必须:
- 基于模板点位
- 仅允许参数缩放
- 控制点微调
    `;
  }
}
