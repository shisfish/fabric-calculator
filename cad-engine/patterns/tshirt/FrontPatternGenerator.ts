import { Point, Path } from '../../geometry/index.js';

export interface FrontPatternParams {
  chestWidth: number;
  bodyLength: number;
  shoulderWidth: number;
  neckWidth: number;
  armholeDepth?: number;
  frontNeckDepth?: number;
}

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

    const halfChest = chestWidth / 2;
    const shoulderDrop = 3;

    const neckStart = new Point(0, 0);

    const neckCp = new Point(
      neckWidth * 0.45,
      0
    );

    const neckEnd = new Point(
      neckWidth,
      frontNeckDepth
    );

    const shoulderEnd = new Point(
      shoulderWidth,
      shoulderDrop
    );

    const armholeCp1 = new Point(
      shoulderWidth + (halfChest - shoulderWidth) * 0.15,
      armholeDepth * 0.18
    );

    const armholeCp2 = new Point(
      halfChest + 1.5,
      armholeDepth * 0.72
    );

    const armholeBottom = new Point(
      halfChest,
      armholeDepth
    );

    const sideBottom = new Point(
      halfChest,
      bodyLength
    );

    const hemFold = new Point(
      0,
      bodyLength
    );

    const path = new Path()
      .move(neckStart)
      .quad(neckCp, neckEnd)
      .line(shoulderEnd)
      .curve(armholeCp1, armholeCp2, armholeBottom)
      .line(sideBottom)
      .line(hemFold)
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

    const width = params.chestWidth;
    const height = params.bodyLength + 10;

    return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="-5 -5 ${width + 15} ${height + 15}"
>
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

  <line
    x1="0"
    y1="0"
    x2="0"
    y2="${params.bodyLength}"
    stroke="#999"
    stroke-dasharray="2 2"
    stroke-width="0.5"
  />

  <path
    d="${d}"
    fill="rgba(0,120,255,0.08)"
    stroke="#0066cc"
    stroke-width="0.8"
  />

</svg>
    `;
  }

  static getTemplateStructure(): string {
    return `
工业服装前片（半片结构）

固定拓扑: M Q L C L L Z (7段)

结构说明:
┌─────────────────────────────────────────────┐
│ [0] M neckStart         (前中领点)          │ ← x=0, 前中折线起点
│ [1] Q neckCp → neckEnd   (领口Bezier)       │ ← 二次曲线
│ [2] L shoulderEnd        (肩线)             │ ← 直线
│ [3] C cp1+cp2 → bottom   (袖窿三次Bezier)   │ ← 三次曲线
│ [4] L sideBottom         (侧缝)             │ ← 直线(垂直/微斜)
│ [5] L hemFold            (下摆)             │ ← 直线(回到x=0)
│ [6] Z                    (闭合)             │ ← 回到neckStart
└─────────────────────────────────────────────┘

半片规则:
- x=0 永远是前中折线(FOLD LINE)
- 下摆左侧必须在 x=0 (hemFold)
- 不允许下摆Bezier向中间收缩
- 只绘制右半边轮廓

参数缩放:
- chestWidth → 影响halfChest, armholeBottom.x, sideBottom.x
- bodyLength → 影响sideBottom.y, hemFold.y
- shoulderWidth → 影响shoulderEnd.x
- neckWidth → 影响neckEnd.x, neckCp.x
- armholeDepth → 影响袖窿Y坐标
- frontNeckDepth → 影响neckEnd.y

禁止:
- 左右混合结构
- 中间收缩下摆
- 对称假闭合
- 矩形模拟裁片
    `;
  }
}
