import { Point, Path } from '../geometry/index.js';

export interface FrontPatternParams {
  chestWidth: number;       // 成衣平铺胸宽
  bodyLength: number;       // 衣长
  shoulderWidth: number;    // 单边肩宽（半肩）
  neckWidth: number;        // 领宽
  armholeDepth?: number;    // 袖窿深
  frontNeckDepth?: number;  // 前领深
}

/**
 * 工业T恤前片（半片）
 *
 * 结构：
 *
 * 前中领口
 *   ↓
 * 领口Bezier
 *   ↓
 * 肩线
 *   ↓
 * 袖窿Bezier
 *   ↓
 * 侧缝
 *   ↓
 * 下摆
 *   ↓
 * 前中线
 *   ↓
 * 闭合
 *
 * 固定拓扑：
 *
 * M Q L C L L Z
 *
 * 注意：
 * - 这是“半片”
 * - x=0 永远是前中折线(FOLD)
 * - 不允许左右对称乱闭合
 */

export class FrontPatternGenerator {

  static generate(params: FrontPatternParams): Path {

    const {
      chestWidth,
      bodyLength,
      shoulderWidth,
      neckWidth,
      armholeDepth = chestWidth * 0.45,
      frontNeckDepth = neckWidth * 0.45
    } = params;

    /**
     * 半胸宽
     */
    const halfChest = chestWidth / 2;

    /**
     * 肩斜
     * 工业T恤常见：2cm ~ 4cm
     */
    const shoulderDrop = 3;

    /**
     * =========================
     * 关键点
     * =========================
     */

    // 前中领点
    const neckStart = new Point(0, 0);

    // 领口Bezier控制点
    const neckCp = new Point(
      neckWidth * 0.45,
      0
    );

    // 领肩点
    const neckEnd = new Point(
      neckWidth,
      frontNeckDepth
    );

    // 肩点
    const shoulderEnd = new Point(
      shoulderWidth,
      shoulderDrop
    );

    /**
     * 袖窿
     *
     * 核心：
     * - 先外扩
     * - 再下收
     */

    const armholeCp1 = new Point(
      shoulderWidth + (halfChest - shoulderWidth) * 0.15,
      armholeDepth * 0.18
    );

    const armholeCp2 = new Point(
      halfChest + 1.5,
      armholeDepth * 0.72
    );

    // 腋下点
    const armholeBottom = new Point(
      halfChest,
      armholeDepth
    );

    // 侧缝底部
    const sideBottom = new Point(
      halfChest,
      bodyLength
    );

    // 前中下摆
    const hemFold = new Point(
      0,
      bodyLength
    );

    /**
     * =========================
     * Path
     * =========================
     */

    const path = new Path()
      // 前中领口
      .move(neckStart)

      // 前领口Bezier
      .quad(neckCp, neckEnd)

      // 肩线
      .line(shoulderEnd)

      // 袖窿Bezier
      .curve(
        armholeCp1,
        armholeCp2,
        armholeBottom
      )

      // 侧缝
      .line(sideBottom)

      // 下摆
      .line(hemFold)

      // 闭合
      .close();

    path.attr('class', 'fabric front-panel');

    return path;
  }

  static generateSVG(params: FrontPatternParams): string {

    const path = this.generate(params);

    let d = '';

    for (const op of path.ops) {

      switch (op.type) {

        case 'move':
          d += `M ${op.to!.x} ${op.to!.y} `;
          break;

        case 'line':
          d += `L ${op.to!.x} ${op.to!.y} `;
          break;

        case 'quad':
          d += `Q ${op.cp1!.x} ${op.cp1!.y} ${op.to!.x} ${op.to!.y} `;
          break;

        case 'curve':
          d += `C ${op.cp1!.x} ${op.cp1!.y},
                  ${op.cp2!.x} ${op.cp2!.y},
                  ${op.to!.x} ${op.to!.y} `;
          break;

        case 'close':
          d += `Z`;
          break;
      }
    }

    /**
     * 留白
     */
    const width = params.chestWidth;
    const height = params.bodyLength + 10;

    return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="-5 -5 ${width + 15} ${height + 15}"
>
  <!-- 网格 -->
  <defs>
    <pattern
      id="grid"
      width="5"
      height="5"
      patternUnits="userSpaceOnUse"
    >
      <path
        d="M 5 0 L 0 0 0 5"
        fill="none"
        stroke="#eee"
        stroke-width="0.2"
      />
    </pattern>
  </defs>

  <rect
    width="100%"
    height="100%"
    fill="url(#grid)"
  />

  <!-- 前中折线 -->
  <line
    x1="0"
    y1="0"
    x2="0"
    y2="${params.bodyLength}"
    stroke="#999"
    stroke-dasharray="2 2"
    stroke-width="0.5"
  />

  <!-- 裁片 -->
  <path
    d="${d}"
    fill="rgba(0,120,255,0.08)"
    stroke="#0066cc"
    stroke-width="0.8"
  />

</svg>
    `;
  }
}