import { Point, Path } from '../geometry/index.js';
import { createLogger } from '../utils/CADLogger.js';

const logger = createLogger('SLEEVE-CAP');

type ArmholeSegment =
  | { type: 'curve'; start: Point; cp1: Point; cp2: Point; end: Point }
  | { type: 'line'; start: Point; end: Point };

interface SleeveCapResult {
  capPath: Path;
  points: Record<string, Point>;
  frontCapLength: number;
  backCapLength: number;
  totalCapLength: number;
  frontArmholeLength: number;
  backArmholeLength: number;
  ease: number;
}

/**
 * 工业袖山生成器 v10.0 — 直接控制点法
 *
 * 核心理念：
 * 不用切线角度+张力系统，而是直接按工业纸样经验放置控制点。
 * 控制点位置来自真实服装CAD（Gerber/Optitex/Lectra）的比例规则。
 *
 * 约束：
 * 1. 单峰：capTop是唯一最高点，向左右单调下降
 * 2. 顶部水平展开：capTop附近切线接近水平
 * 3. 前后非对称：前袖更陡，后袖更饱满
 * 4. 控制杆长度：span × 0.18~0.24
 * 5. 侧缝垂直：axilla→cuff接近垂直
 * 6. 无折肩、无波浪、无S型反曲
 *
 * 袖山拓扑（4段cubic Bezier）：
 * M(capTop)
 * → C(capTop→frontPitch)        前袖山上段
 * → C(frontPitch→frontAxilla)   前袖山下段
 * → L(frontAxilla→frontCuff)    前侧缝
 * → L(frontCuff→backCuff)       袖口
 * → L(backCuff→backAxilla)      后侧缝
 * → C(backAxilla→backPitch)     后袖山下段
 * → C(backPitch→capTop)         后袖山上段
 * → Z
 */
export class SleeveCapGenerator {

  static generateFromArmhole(
    frontArmholeOps: Array<{ type: string; to?: { x: number; y: number }; cp1?: { x: number; y: number }; cp2?: { x: number; y: number } }>,
    backArmholeOps: Array<{ type: string; to?: { x: number; y: number }; cp1?: { x: number; y: number }; cp2?: { x: number; y: number } }>,
    sleeveParams: {
      bicepsWidth: number;
      sleeveCapHeight: number;
      sleeveLength: number;
      cuffWidth: number;
    },
    ease: number = 1.5,
    armholeDepth?: number
  ): SleeveCapResult {

    const sL = sleeveParams.sleeveLength;
    const cuW = sleeveParams.cuffWidth;

    const frontSegments = this.extractArmholeSegments(frontArmholeOps);
    const backSegments = this.extractArmholeSegments(backArmholeOps);

    const frontArmholeLength = this.calculateTotalArmholeLength(frontSegments);
    const backArmholeLength = this.calculateTotalArmholeLength(backSegments);
    const totalArmholeLen = frontArmholeLength + backArmholeLength;

    logger.info(`\n🏭 ===== 工业袖山生成器 v11.0 (版师直接放置法) =====`);
    logger.info(`   前袖窿长度: ${frontArmholeLength.toFixed(2)} cm`);
    logger.info(`   后袖窿长度: ${backArmholeLength.toFixed(2)} cm`);
    logger.info(`   袖窿总长: ${totalArmholeLen.toFixed(2)} cm`);
    logger.info(`   ease: ${ease} cm`);

    const cH = this.calculateCapHeight(totalArmholeLen, armholeDepth);
    const bW = this.calculateBicepsWidth(totalArmholeLen, cH, ease);

    logger.info(`   袖山高度(cH): ${cH.toFixed(2)} cm`);
    logger.info(`   bicepsWidth(bW): ${bW.toFixed(2)} cm`);

    const result = this.generateSleeveCap(
      bW, cH, sL, cuW,
      frontArmholeLength, backArmholeLength, ease
    );

    return result;
  }

  private static calculateCapHeight(
    totalArmholeLen: number,
    armholeDepth?: number
  ): number {
    if (armholeDepth) {
      const cH = armholeDepth * 0.48;
      return Math.max(cH, 8);
    }
    const estimatedDepth = totalArmholeLen * 0.50;
    const cH = estimatedDepth * 0.48;
    return Math.max(cH, 8);
  }

  private static calculateBicepsWidth(
    totalArmholeLen: number,
    cH: number,
    ease: number
  ): number {
    const targetCapLen = totalArmholeLen + ease;
    const bW = targetCapLen * 0.78;
    return Math.max(bW, cH * 2.6);
  }

  /**
   * 核心算法：工业版师直接放置法 v11.0
   *
   * 坐标系：SVG标准（Y向下）
   * capTop在原点(0,0)
   * 前袖在右侧（X正方向）
   * 后袖在左侧（X负方向）
   *
   * 工业纸样原则：
   *
   * 1. 顶部宽圆弧
   *    - CP1/CP2的Y≈0，X远伸
   *    - 圆弧占袖山宽度60%+
   *    - 禁止尖峰、帐篷结构
   *
   * 2. pitch不是折点
   *    - pitch只是4段Bezier的分段标记
   *    - 曲率在pitch处必须平滑过渡
   *    - 前后pitch的进出切线方向一致
   *
   * 3. 前后非对称
   *    - 前袖：更短、更陡、下段有hollow
   *    - 后袖：更长、更圆、更平、全程外凸
   *
   * 4. 曲率分散
   *    - 禁止曲率集中在pitch附近
   *    - 每段曲线均匀承担曲率变化
   *
   * 5. 控制杆长度
   *    - 下段：span × 0.18~0.24
   *    - 上段（圆弧区）：允许更长以形成宽圆弧
   */
  private static generateSleeveCap(
      bW: number,
      cH: number,
      sL: number,
      cuW: number,
      frontArmholeLen: number,
      backArmholeLen: number,
      ease: number
    ): SleeveCapResult {

      const halfBicep = bW / 2;

      // =========================================================
      // 关键点
      // =========================================================

      const capTop = new Point(0, 0);

      const frontAxilla = new Point(
        halfBicep,
        cH
      );

      const backAxilla = new Point(
        -halfBicep,
        cH
      );

      const frontCuff = new Point(
        cuW / 2,
        cH + sL
      );

      const backCuff = new Point(
        -cuW / 2,
        cH + sL
      );

      // =========================================================
      // Pitch 点
      // =========================================================

      const frontPitch = new Point(
        halfBicep * 0.42,
        cH * 0.42
      );

      const backPitch = new Point(
        -halfBicep * 0.48,
        cH * 0.32
      );

      // =========================================================
      // 核心修复：
      // 不再水平拉平顶部
      // 所有控制点必须保持：
      //
      // 1. Y值单调递增
      // 2. 不允许局部回拉
      // 3. 不允许控制杆反向
      // 4. 整体保持 outward convex
      // =========================================================

      // ---------------------------------------------------------
      // 前上段 capTop → frontPitch
      // ---------------------------------------------------------

      const ufCp1 = new Point(
        halfBicep * 0.16,
        cH * 0.05
      );

      const ufCp2 = new Point(
        halfBicep * 0.34,
        cH * 0.22
      );

      // ---------------------------------------------------------
      // 前下段 frontPitch → frontAxilla
      // ---------------------------------------------------------

      const lfCp1 = new Point(
        halfBicep * 0.50,
        cH * 0.56
      );

      const lfCp2 = new Point(
        halfBicep * 0.92,
        cH * 0.86
      );

      // ---------------------------------------------------------
      // 后下段 backAxilla → backPitch
      // 后袖更饱满
      // ---------------------------------------------------------

      const lbCp1 = new Point(
        -halfBicep * 0.95,
        cH * 0.82
      );

      const lbCp2 = new Point(
        -halfBicep * 0.72,
        cH * 0.48
      );

      // ---------------------------------------------------------
      // 后上段 backPitch → capTop
      // 注意：
      // 不再做水平顶部平台
      // ---------------------------------------------------------

      const ubCp1 = new Point(
        -halfBicep * 0.32,
        cH * 0.14
      );

      const ubCp2 = new Point(
        -halfBicep * 0.14,
        cH * 0.04
      );

      // =========================================================
      // Notch
      // =========================================================

      const frontNotch = this.evaluateCubicBezier(
        frontPitch,
        lfCp1,
        lfCp2,
        frontAxilla,
        0.4
      );

      const backNotch = this.evaluateCubicBezier(
        backAxilla,
        lbCp1,
        lbCp2,
        backPitch,
        0.4
      );

      // =========================================================
      // 长度
      // =========================================================

      const lenUpperFront = this.calculateBezierLength(
        capTop,
        ufCp1,
        ufCp2,
        frontPitch
      );

      const lenLowerFront = this.calculateBezierLength(
        frontPitch,
        lfCp1,
        lfCp2,
        frontAxilla
      );

      const lenLowerBack = this.calculateBezierLength(
        backAxilla,
        lbCp1,
        lbCp2,
        backPitch
      );

      const lenUpperBack = this.calculateBezierLength(
        backPitch,
        ubCp1,
        ubCp2,
        capTop
      );

      const actualFrontLen =
        lenUpperFront + lenLowerFront;

      const actualBackLen =
        lenLowerBack + lenUpperBack;

      const actualTotalLen =
        actualFrontLen + actualBackLen;

      // =========================================================
      // Path
      // =========================================================

      const capPath = new Path()
        .move(capTop)

        // 前袖山
        .curve(ufCp1, ufCp2, frontPitch)
        .curve(lfCp1, lfCp2, frontAxilla)

        // 前侧缝
        .line(frontCuff)

        // 袖口
        .line(backCuff)

        // 后侧缝
        .line(backAxilla)

        // 后袖山
        .curve(lbCp1, lbCp2, backPitch)
        .curve(ubCp1, ubCp2, capTop)

        .close();

      // =========================================================
      // points
      // =========================================================

      const points: Record<string, Point> = {
        capTop,
        frontPitch,
        frontAxilla,
        backPitch,
        backAxilla,

        frontCuff,
        backCuff,

        upperFrontCp1: ufCp1,
        upperFrontCp2: ufCp2,

        lowerFrontCp1: lfCp1,
        lowerFrontCp2: lfCp2,

        lowerBackCp1: lbCp1,
        lowerBackCp2: lbCp2,

        upperBackCp1: ubCp1,
        upperBackCp2: ubCp2,

        frontNotch,
        backNotch,

        grainlineStart: new Point(
          0,
          cH * 0.3
        ),

        grainlineEnd: new Point(
          0,
          cH + sL * 0.8
        )
      };

      return {
        capPath,
        points,

        frontCapLength: actualFrontLen,
        backCapLength: actualBackLen,
        totalCapLength: actualTotalLen,

        frontArmholeLength: frontArmholeLen,
        backArmholeLength: backArmholeLen,

        ease
      };
    }

  /**
   * 单峰验证：确保袖山从capTop向左右单调下降
   * 采样每段Bezier曲线，检查Y值单调递增（Y向下=高度递减）
   */
  private static validateSinglePeak(
    capTop: Point,
    frontPitch: Point, ufCp1: Point, ufCp2: Point,
    frontAxilla: Point, lfCp1: Point, lfCp2: Point,
    backAxilla: Point, lbCp1: Point, lbCp2: Point,
    backPitch: Point, ubCp1: Point, ubCp2: Point
  ): void {
    const samples = 20;

    const checkMonotone = (
      label: string,
      p0: Point, p1: Point, p2: Point, p3: Point,
      expectIncreasing: boolean
    ): boolean => {
      let prevY = p0.y;
      let violations = 0;
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const pt = this.evaluateCubicBezier(p0, p1, p2, p3, t);
        if (expectIncreasing && pt.y < prevY - 0.01) {
          violations++;
        } else if (!expectIncreasing && pt.y > prevY + 0.01) {
          violations++;
        }
        prevY = pt.y;
      }
      if (violations > 0) {
        logger.warn(`   ⚠️ ${label}: Y单调性违反 ${violations}次`);
      }
      return violations === 0;
    };

    logger.info(`\n🏔️ 单峰验证:`);

    const ufOk = checkMonotone('前上(capTop→frontPitch)', capTop, ufCp1, ufCp2, frontPitch, true);
    const lfOk = checkMonotone('前下(frontPitch→frontAxilla)', frontPitch, lfCp1, lfCp2, frontAxilla, true);
    const lbOk = checkMonotone('后下(backAxilla→backPitch)', backAxilla, lbCp1, lbCp2, backPitch, false);
    const ubOk = checkMonotone('后上(backPitch→capTop)', backPitch, ubCp1, ubCp2, capTop, false);

    if (ufOk && lfOk && lbOk && ubOk) {
      logger.info(`   ✅ 单峰约束通过：所有段Y单调`);
    } else {
      logger.warn(`   ⚠️ 单峰约束未完全通过，需调整控制点`);
    }
  }

  private static extractArmholeSegments(ops: Array<{
    type: string;
    to?: { x: number; y: number };
    cp1?: { x: number; y: number };
    cp2?: { x: number; y: number }
  }>): ArmholeSegment[] {
    const segments: ArmholeSegment[] = [];
    let prevPoint: Point | null = null;

    for (const op of ops) {
      if (op.type === 'move' && op.to) {
        prevPoint = new Point(op.to.x, op.to.y);
      } else if (op.type === 'line' && op.to && !prevPoint) {
        prevPoint = new Point(op.to.x, op.to.y);
      } else if (op.type === 'curve' && op.to && op.cp1 && op.cp2) {
        if (!prevPoint) continue;
        segments.push({
          type: 'curve',
          start: prevPoint,
          cp1: new Point(op.cp1.x, op.cp1.y),
          cp2: new Point(op.cp2.x, op.cp2.y),
          end: new Point(op.to.x, op.to.y)
        });
        prevPoint = new Point(op.to.x, op.to.y);
      } else if (op.type === 'line' && op.to && prevPoint) {
        segments.push({
          type: 'line',
          start: prevPoint,
          end: new Point(op.to.x, op.to.y)
        });
        prevPoint = new Point(op.to.x, op.to.y);
      }
    }

    return segments;
  }

  private static calculateTotalArmholeLength(segments: ArmholeSegment[]): number {
    let totalLength = 0;
    for (const seg of segments) {
      if (seg.type === 'curve') {
        totalLength += this.calculateBezierLength(seg.start, seg.cp1, seg.cp2, seg.end);
      } else {
        const dx = seg.end.x - seg.start.x;
        const dy = seg.end.y - seg.start.y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
    }
    return totalLength;
  }

  private static calculateBezierLength(
    p0: Point, p1: Point, p2: Point, p3: Point,
    segments: number = 20
  ): number {
    let length = 0;
    let prevPoint = p0;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const currentPoint = this.evaluateCubicBezier(p0, p1, p2, p3, t);
      const dx = currentPoint.x - prevPoint.x;
      const dy = currentPoint.y - prevPoint.y;
      length += Math.sqrt(dx * dx + dy * dy);
      prevPoint = currentPoint;
    }
    return length;
  }

  private static evaluateCubicBezier(
    p0: Point, p1: Point, p2: Point, p3: Point, t: number
  ): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    return new Point(
      mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    );
  }
}
