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

    logger.info(`\n🏭 ===== 工业袖山生成器 v10.0 (直接控制点法) =====`);
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
    const bW = targetCapLen * 0.80;
    return Math.max(bW, cH * 2.6);
  }

  /**
   * 核心算法：直接控制点法生成袖山
   *
   * 坐标系：SVG标准（Y向下）
   * capTop在原点(0,0)
   * 前袖在右侧（X正方向）
   * 后袖在左侧（X负方向）
   *
   * 工业纸样控制点规则（直接放置，不用角度系统）：
   *
   * 1. capTop附近控制点：
   *    - 前方向：水平偏右，极小Y偏移 → 顶部圆润展开
   *    - 后方向：水平偏左，极小Y偏移 → 顶部圆润展开
   *
   * 2. frontPitch控制点：
   *    - 上方CP：从前pitch向左上偏 → 形成前袖山外凸
   *    - 下方CP：从前pitch向右下偏 → 形成前袖山陡降
   *
   * 3. backPitch控制点：
   *    - 下方CP：从后pitch向左下偏 → 形成后袖山饱满外凸
   *    - 上方CP：从后pitch向右上偏 → 形成后袖山平缓回升
   *
   * 4. axilla控制点：
   *    - 接近垂直进入侧缝
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

    // ========== 关键点 ==========
    const capTop = new Point(0, 0);

    // 前后axilla：侧缝起点
    const frontAxilla = new Point(halfBicep, cH);
    const backAxilla = new Point(-halfBicep, cH);

    // 侧缝与袖口
    const frontCuff = new Point(cuW / 2, cH + sL);
    const backCuff = new Point(-cuW / 2, cH + sL);

    // Pitch点：前陡后缓
    // 前pitch更靠内（0.35），后pitch更靠外（0.42）→ 后袖更长更饱满
    // 前pitch更低（0.42），后pitch更高（0.35）→ 前袖更陡
    const frontPitch = new Point(halfBicep * 0.28, cH * 0.40);
    const backPitch = new Point(-halfBicep * 0.65, cH * 0.22);

    // ========== 控制点：直接放置法 ==========

    // --- 前袖山上段：capTop → frontPitch ---
    const ufCp1 = new Point(
      frontPitch.x * 0.60,
      cH * 0.00
    );
    const ufCp2 = new Point(
      frontPitch.x * 0.90,
      frontPitch.y * 0.65
    );

    // --- 前袖山下段：frontPitch → frontAxilla ---
    const lfCp1 = new Point(
      frontPitch.x + (frontAxilla.x - frontPitch.x) * 0.45,
      frontPitch.y + (frontAxilla.y - frontPitch.y) * 0.45
    );
    const lfCp2 = new Point(
      frontAxilla.x - (frontAxilla.x - frontPitch.x) * 0.05,
      frontAxilla.y - (frontAxilla.y - frontPitch.y) * 0.10
    );

    // --- 后袖山下段：backAxilla → backPitch ---
    // 后袖更饱满：CP1更向外凸，CP2更向外凸
    const lbCp1 = new Point(
      backAxilla.x + (backAxilla.x - backPitch.x) * 0.05,
      backAxilla.y - (backAxilla.y - backPitch.y) * 0.10
    );
    const lbCp2 = new Point(
      backPitch.x + (backAxilla.x - backPitch.x) * 0.50,
      backPitch.y + (backAxilla.y - backPitch.y) * 0.65
    );

    // --- 后袖山上段：backPitch → capTop ---
    // 后袖更饱满：CP1和CP2更向外凸
    const ubCp1 = new Point(
      backPitch.x * 0.85,
      backPitch.y * 0.70
    );
    const ubCp2 = new Point(
      backPitch.x * 0.60,
      cH * 0.00
    );

    // ========== Notch点 ==========
    const frontNotch = this.evaluateCubicBezier(frontPitch, lfCp1, lfCp2, frontAxilla, 0.4);
    const backNotch = this.evaluateCubicBezier(backAxilla, lbCp1, lbCp2, backPitch, 0.4);

    // ========== 计算长度 ==========
    const lenUpperFront = this.calculateBezierLength(capTop, ufCp1, ufCp2, frontPitch);
    const lenLowerFront = this.calculateBezierLength(frontPitch, lfCp1, lfCp2, frontAxilla);
    const lenLowerBack = this.calculateBezierLength(backAxilla, lbCp1, lbCp2, backPitch);
    const lenUpperBack = this.calculateBezierLength(backPitch, ubCp1, ubCp2, capTop);

    const actualFrontLen = lenUpperFront + lenLowerFront;
    const actualBackLen = lenLowerBack + lenUpperBack;
    const actualTotalLen = actualFrontLen + actualBackLen;

    // ========== 单峰验证 ==========
    this.validateSinglePeak(capTop, frontPitch, ufCp1, ufCp2, frontAxilla, lfCp1, lfCp2,
      backAxilla, lbCp1, lbCp2, backPitch, ubCp1, ubCp2);

    // ========== 日志 ==========
    logger.info(`\n📐 袖山关键点:`);
    logger.info(`   capTop: (${capTop.x.toFixed(2)}, ${capTop.y.toFixed(2)})`);
    logger.info(`   frontPitch: (${frontPitch.x.toFixed(2)}, ${frontPitch.y.toFixed(2)})`);
    logger.info(`   frontAxilla: (${frontAxilla.x.toFixed(2)}, ${frontAxilla.y.toFixed(2)})`);
    logger.info(`   backPitch: (${backPitch.x.toFixed(2)}, ${backPitch.y.toFixed(2)})`);
    logger.info(`   backAxilla: (${backAxilla.x.toFixed(2)}, ${backAxilla.y.toFixed(2)})`);

    logger.info(`\n🎨 控制点:`);
    logger.info(`   前上 CP1: (${ufCp1.x.toFixed(2)}, ${ufCp1.y.toFixed(2)})`);
    logger.info(`   前上 CP2: (${ufCp2.x.toFixed(2)}, ${ufCp2.y.toFixed(2)})`);
    logger.info(`   前下 CP1: (${lfCp1.x.toFixed(2)}, ${lfCp1.y.toFixed(2)})`);
    logger.info(`   前下 CP2: (${lfCp2.x.toFixed(2)}, ${lfCp2.y.toFixed(2)})`);
    logger.info(`   后下 CP1: (${lbCp1.x.toFixed(2)}, ${lbCp1.y.toFixed(2)})`);
    logger.info(`   后下 CP2: (${lbCp2.x.toFixed(2)}, ${lbCp2.y.toFixed(2)})`);
    logger.info(`   后上 CP1: (${ubCp1.x.toFixed(2)}, ${ubCp1.y.toFixed(2)})`);
    logger.info(`   后上 CP2: (${ubCp2.x.toFixed(2)}, ${ubCp2.y.toFixed(2)})`);

    logger.info(`\n📏 袖山长度:`);
    logger.info(`   前袖山上段: ${lenUpperFront.toFixed(2)} cm`);
    logger.info(`   前袖山下段: ${lenLowerFront.toFixed(2)} cm`);
    logger.info(`   后袖山下段: ${lenLowerBack.toFixed(2)} cm`);
    logger.info(`   后袖山上段: ${lenUpperBack.toFixed(2)} cm`);
    logger.info(`   前袖山总长: ${actualFrontLen.toFixed(2)} cm`);
    logger.info(`   后袖山总长: ${actualBackLen.toFixed(2)} cm`);
    logger.info(`   袖山总长: ${actualTotalLen.toFixed(2)} cm`);

    const targetLen = frontArmholeLen + backArmholeLen + ease;
    const error = actualTotalLen - targetLen;
    logger.info(`   目标长度: ${targetLen.toFixed(2)} cm`);
    logger.info(`   误差: ${error.toFixed(2)} cm`);

    const backFrontDiff = actualBackLen - actualFrontLen;
    if (backFrontDiff > 0) {
      logger.info(`   ✅ 后袖更长（差异${backFrontDiff.toFixed(2)}cm，符合工业规范）`);
    } else {
      logger.warn(`   ⚠️ 后袖应该更长！差异${backFrontDiff.toFixed(2)}cm`);
    }

    if (Math.abs(error) <= 0.5) {
      logger.info(`   ✅ 长度匹配成功！误差=${Math.abs(error).toFixed(2)}cm`);
    } else if (Math.abs(error) <= 2.0) {
      logger.warn(`   ⚠️ 长度误差可接受: ${Math.abs(error).toFixed(2)}cm`);
    } else {
      logger.warn(`   ⚠️ 长度差异较大: ${Math.abs(error).toFixed(2)}cm`);
    }

    // ========== 构建Path ==========
    const capPath = new Path()
      .move(capTop)
      .curve(ufCp1, ufCp2, frontPitch)
      .curve(lfCp1, lfCp2, frontAxilla)
      .line(frontCuff)
      .line(backCuff)
      .line(backAxilla)
      .curve(lbCp1, lbCp2, backPitch)
      .curve(ubCp1, ubCp2, capTop)
      .close();

    const points: Record<string, Point> = {
      capTop, frontPitch, frontAxilla, backPitch, backAxilla,
      frontCuff, backCuff,
      upperFrontCp1: ufCp1, upperFrontCp2: ufCp2,
      lowerFrontCp1: lfCp1, lowerFrontCp2: lfCp2,
      lowerBackCp1: lbCp1, lowerBackCp2: lbCp2,
      upperBackCp1: ubCp1, upperBackCp2: ubCp2,
      frontNotch, backNotch,
      grainlineStart: new Point(0, cH * 0.3),
      grainlineEnd: new Point(0, cH + sL * 0.8)
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
