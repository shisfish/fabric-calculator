import { Point, Path } from '../geometry/index.js';

interface FrontPanelParams {
  width: number;
  length: number;
  neckWidth: number;
  neckDepth: number;
  shoulderWidth: number;
  armholeDepth: number;
  shoulderSlope?: number;
}

interface PatternPiece {
  name: string;
  path: Path;
  points: Record<string, Point>;
  seamAllowance: number;
  grainline: { start: Point; end: Point };
  notches: Point[];
  cutCount: number;
  onFold?: boolean;
}

export class TshirtTemplateGenerator {
  
  /**
   * 生成前片裁片（工业T恤模板）
   */
  static generateFront(fp: FrontPanelParams, seamAllowance: number = 1.0): PatternPiece {
    return this.generateFrontPanel(fp, seamAllowance);
  }
  
  private static generateFrontPanel(
    fp: FrontPanelParams,
    seamAllowance: number
  ): PatternPiece {

  const points: Record<string, Point> = {};

  /**
   * =========================
   * 基础参数
   * =========================
   */

  const W = fp.width;                 // 半胸宽
  const L = fp.length;                // 衣长

  const neckW = fp.neckWidth;
  const neckD = fp.neckDepth;

  const shoulderW = fp.shoulderWidth;

  const armholeD = fp.armholeDepth;

  /**
   * 工业T恤肩斜
   * 2.5 ~ 4cm 比较合理
   */

  const shoulderDrop = fp.shoulderSlope ?? 3;

  /**
   * =========================
   * 前中线（Fold）
   * =========================
   */

  points.cfNeck = new Point(0, 0);

  points.cfHem = new Point(0, L);

  /**
   * =========================
   * 前领口
   * =========================
   */

  points.neck = new Point(
    neckW,
    neckD
  );

  /**
   * 领口Bezier控制
   * 保持圆顺
   */

  points.neckCp = new Point(
    neckW * 0.42,
    0
  );

  /**
   * =========================
   * 肩点
   * =========================
   */

  points.shoulder = new Point(
    shoulderW,
    shoulderDrop
  );

  /**
   * =========================
   * 袖窿结构
   * =========================
   *
   * 采用：
   *
   * shoulder
   *   ↓
   * armholePitch
   *   ↓
   * armholeHollow
   *   ↓
   * underarm
   *
   * 两段Bezier
   */

  /**
   * 袖窿Pitch点
   * 接近前袖窿上部转折
   */

  points.armholePitch = new Point(
    shoulderW + (W - shoulderW) * 0.28,
    armholeD * 0.34
  );

  /**
   * 袖窿凹点
   * 前片通常比后片更凹
   */

  points.armholeHollow = new Point(
    W * 0.88,
    armholeD * 0.72
  );

  /**
   * 腋下点
   */

  points.underarm = new Point(
    W,
    armholeD
  );

  /**
   * =========================
   * 袖窿Bezier控制点
   * =========================
   */

  /**
   * 肩 → Pitch
   */

  points.armholeCp1 = new Point(
    shoulderW + (points.armholePitch.x - shoulderW) * 0.35,
    shoulderDrop + (points.armholePitch.y - shoulderDrop) * 0.12
  );

  points.armholeCp2 = new Point(
    points.armholePitch.x - 2,
    points.armholePitch.y * 0.92
  );

  /**
   * Pitch → Hollow
   */

  points.armholeCp3 = new Point(
    points.armholePitch.x + 2,
    points.armholePitch.y + (points.armholeHollow.y - points.armholePitch.y) * 0.38
  );

  points.armholeCp4 = new Point(
    points.armholeHollow.x - 1.5,
    points.armholeHollow.y - 2
  );

  /**
   * Hollow → Underarm
   */

  points.armholeCp5 = new Point(
    points.armholeHollow.x + 1,
    points.armholeHollow.y + 4
  );

  points.armholeCp6 = new Point(
    W - (W * 0.04),
    armholeD - 1
  );

  /**
   * =========================
   * 侧缝
   * =========================
   */

  points.sideBottom = new Point(
    W,
    L
  );

  /**
   * =========================
   * 下摆轻微弧度
   * =========================
   */

  points.hemCp = new Point(
    W * 0.45,
    L + 1
  );

  /**
   * =========================
   * Path
   * =========================
   */

  const path = new Path()

    // 前中领口
    .move(points.cfNeck)

    // 前领口
    .quad(
      points.neckCp,
      points.neck
    )

    // 肩线
    .line(points.shoulder)

    // 肩 → Pitch
    .curve(
      points.armholeCp1,
      points.armholeCp2,
      points.armholePitch
    )

    // Pitch → Hollow
    .curve(
      points.armholeCp3,
      points.armholeCp4,
      points.armholeHollow
    )

    // Hollow → Underarm
    .curve(
      points.armholeCp5,
      points.armholeCp6,
      points.underarm
    )

    // 侧缝
    .line(points.sideBottom)

    // 下摆
    .quad(
      points.hemCp,
      points.cfHem
    )

    // 闭合
    .close();

  path.attr('class', 'fabric front');

  return {
    name: 'front',

    path,

    points,

    seamAllowance,

    grainline: {
      start: new Point(0, 10),
      end: new Point(0, L - 10),
    },

    /**
     * 前袖窿 notch
     */

    notches: [
      points.armholePitch
    ],

    /**
     * 对折裁
     */

    cutCount: 1,

    onFold: true,
  };
}
}