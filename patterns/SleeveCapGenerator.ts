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
 * 工业袖山生成器 v11.0 — 版师直接放置法
 *
 * 核心理念：
 * 禁止 angle/tangent/tension 自动控制系统。
 * 控制点直接基于工业版型经验放置。
 *
 * 遵循规则：
 * - sleeve cap 必须像真实服装纸样 (Gerber/Lectra/Optitex)
 * - pitch 点不能形成视觉折点
 * - 顶部必须是宽圆弧，不是尖峰
 * - 后袖：更长、更圆、更平
 * - 前袖：更短、更陡、略凹
 * - 曲率变化必须分散，禁止集中在pitch附近
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
   *    - 曲率在pitch处平滑过渡
   *
   * 3. 前后非对称
   *    - 前袖：更短、更陡、下段有hollow
   *    - 后袖：更长、更圆、更平、全程外凸
   *
   * 4. 曲率分散
   *    - 每段曲线均匀承担曲率变化
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
    const frontAxilla = new Point(halfBicep, cH);
    const backAxilla = new Point(-halfBicep, cH);
    // cuW 已经是半围，直接用作坐标偏移（与 bicepsWidth 处理方式一致）
    const frontCuff = new Point(cuW, cH + sL);
    const backCuff = new Point(-cuW, cH + sL);

    // Pitch点：工业版型经验位置
    // 前pitch：38%宽度，40%高度 → 前袖陡降区起点
    // 后pitch：70%宽度，28%高度 → 后袖平缓区起点（更靠外→后袖更长）
    const frontPitch = new Point(halfBicep * 0.38, cH * 0.40);
    const backPitch = new Point(-halfBicep * 0.70, cH * 0.28);

    // ========== 控制点：工业版师直接放置 ==========

    // --- 前袖山上段：capTop → frontPitch ---
    // 顶部宽圆弧：CP1水平远伸，Y≈0
    // CP2平滑过渡到pitch，无折点
    const ufCp1 = new Point(halfBicep * 0.30, cH * 0.00);
    const ufCp2 = new Point(halfBicep * 0.36, cH * 0.20);

    // --- 前袖山下段：frontPitch → frontAxilla ---
    // 前袖更陡：控制杆较短
    // CP2轻微inward → 工业hollow效果
    const lfCp1 = new Point(halfBicep * 0.42, cH * 0.58);
    const lfCp2 = new Point(halfBicep * 0.86, cH * 0.84);

    // --- 后袖山下段：backAxilla → backPitch ---
    // 后袖更饱满：控制杆更长，全程外凸
    const lbCp1 = new Point(-halfBicep * 0.90, cH * 0.78);
    const lbCp2 = new Point(-halfBicep * 0.68, cH * 0.50);

    // --- 后袖山上段：backPitch → capTop ---
    // 后袖更平缓：CP1更向外凸
    // CP2水平远伸，Y≈0
    const ubCp1 = new Point(-halfBicep * 0.58, cH * 0.12);
    const ubCp2 = new Point(-halfBicep * 0.42, cH * 0.00);

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
