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
 * 工业袖山生成器 v9.0
 *
 * 核心原则：
 * 1. 袖山形状由工业几何约束决定，不是暴力调参
 * 2. 袖山高度 = armholeDepth × ratio（工业经验）
 * 3. bicepsWidth = 袖窿总长 × ratio（保证曲线有空间展开）
 * 4. 前袖山更陡，后袖山更饱满
 * 5. ease: 1~4cm（工业规范）
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

    logger.info(`\n🏭 ===== 工业袖山生成器 v9.0 =====`);
    logger.info(`   前袖窿长度: ${frontArmholeLength.toFixed(2)} cm`);
    logger.info(`   后袖窿长度: ${backArmholeLength.toFixed(2)} cm`);
    logger.info(`   袖窿总长: ${totalArmholeLen.toFixed(2)} cm`);
    logger.info(`   ease: ${ease} cm`);
    if (armholeDepth) {
      logger.info(`   armholeDepth: ${armholeDepth} cm`);
    }

    const cH = this.calculateCapHeight(totalArmholeLen, frontArmholeLength, backArmholeLength, armholeDepth);

    const bW = this.calculateBicepsWidth(totalArmholeLen, cH, ease);

    logger.info(`   计算袖山高度(cH): ${cH.toFixed(2)} cm`);
    logger.info(`   计算bicepsWidth(bW): ${bW.toFixed(2)} cm`);
    logger.info(`   袖长(sL): ${sL} cm`);
    logger.info(`   袖口宽(cuW): ${cuW} cm`);

    const result = this.generateIndustrialSleeveCap(
      bW, cH, sL, cuW,
      frontArmholeLength, backArmholeLength, ease
    );

    return result;
  }

  /**
   * 工业袖山高度计算
   *
   * 原理：袖山高度与袖窿深度正相关
   * 袖窿越深 → 袖山越高 → 袖子越合体
   *
   * 工业经验：
   * - 修身款：cH / armholeDepth ≈ 0.50~0.55
   * - 常规款：cH / armholeDepth ≈ 0.42~0.48
   * - 宽松款：cH / armholeDepth ≈ 0.35~0.40
   *
   * 从袖窿长度推导armholeDepth：
   * armholeDepth ≈ totalArmholeLen × 0.30（经验比例）
   */
  private static calculateCapHeight(
    totalArmholeLen: number,
    _frontArmholeLen: number,
    _backArmholeLen: number,
    armholeDepth?: number
  ): number {
    if (armholeDepth) {
      const ratio = 0.48;
      return Math.max(armholeDepth * ratio, 8);
    }
    const estimatedArmholeDepth = totalArmholeLen * 0.50;
    const ratio = 0.48;
    const cH = estimatedArmholeDepth * ratio;
    return Math.max(cH, 8);
  }

  /**
   * 工业bicepsWidth计算
   *
   * 原理：袖山曲线需要足够宽度来展开到目标长度
   * bicepsWidth太小 → 袖山被迫拉高 → 形状畸形
   * bicepsWidth太大 → 袖山太平 → 不像袖子
   *
   * 工业经验：
   * bW ≈ (totalArmholeLen + ease) × 0.38 ~ 0.42
   */
  private static calculateBicepsWidth(
    totalArmholeLen: number,
    cH: number,
    ease: number
  ): number {
    const targetCapLen = totalArmholeLen + ease;
    const bW = targetCapLen * 0.78;
    return Math.max(bW, cH * 2.5);
  }

  /**
   * 工业袖山核心生成算法
   *
   * 坐标系：SVG标准（Y向下）
   * capTop在原点(0,0)
   * 前袖在右侧（X正方向）
   * 后袖在左侧（X负方向）
   *
   * 关键点：
   * - capTop: 袖山顶点
   * - frontPitch: 前袖山特征点（前陡）
   * - backPitch: 后袖山特征点（后缓）
   * - frontAxilla: 前腋下
   * - backAxilla: 后腋下
   *
   * 工业比例：
   * - frontPitch位置：X = halfBicep × 0.36, Y = cH × 0.40
   * - backPitch位置：X = -halfBicep × 0.44, Y = cH × 0.40
   * - 前后不对称：后pitch更靠外（0.44 vs 0.36）
   */
  private static generateIndustrialSleeveCap(
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
    const frontCuff = new Point(cuW / 2, cH + sL);
    const backCuff = new Point(-cuW / 2, cH + sL);

    // Pitch点：前陡后缓
    const frontPitch = new Point(halfBicep * 0.36, cH * 0.40);
    const backPitch = new Point(-halfBicep * 0.44, cH * 0.40);

    // ========== 控制点生成：工业切线系统 ==========
    //
    // 每段Bezier的控制点由3个要素决定：
    // 1. 起点切线方向（outgoingAngle）
    // 2. 终点切线方向（incomingAngle）
    // 3. 控制杆长度（span × tension）
    //
    // 切线方向（SVG坐标：Y向下，0°=右，90°=下）：
    // - capTop→front: 15°（接近水平，顶部圆润展开）
    // - capTop←back:  165°（接近水平，顶部圆润展开）
    // - frontPitch:   45°（前袖特征：中等陡峭）
    // - backPitch:    138°（后袖特征：平缓饱满）
    // - frontAxilla:  80°（接近垂直进入侧缝）
    // - backAxilla:   100°（接近垂直进入侧缝）
    //
    // G1连续：pitch点incoming=outgoing → 自动共线
    // G2连续：pitch点杆比≈1.0 → 曲率连续

    const tangents = {
      capTop: { outgoing: 15, incoming: 165 },
      frontPitch: { outgoing: 45, incoming: 45 },
      frontAxilla: { outgoing: 80, incoming: 80 },
      backAxilla: { outgoing: 200, incoming: 270 },
      backPitch: { outgoing: 330, incoming: 330 }
    };

    // 张力参数：控制杆长度 = span × tension
    // 工业范围：0.28~0.38（不能太大，否则曲率过冲）
    const tensions = {
      capTopOut: 0.33,
      frontPitchIn: 0.33,
      frontPitchOut: 0.33,
      frontAxillaIn: 0.30,
      backAxillaOut: 0.30,
      backPitchIn: 0.33,
      backPitchOut: 0.33,
      capTopIn: 0.33
    };

    // ========== 生成控制点 ==========

    const { cp1: ufCp1, cp2: ufCp2 } = this.makeControlPoints(
      capTop, frontPitch,
      tangents.capTop.outgoing, tangents.frontPitch.incoming,
      tensions.capTopOut, tensions.frontPitchIn
    );

    const { cp1: lfCp1, cp2: lfCp2 } = this.makeControlPoints(
      frontPitch, frontAxilla,
      tangents.frontPitch.outgoing, tangents.frontAxilla.incoming,
      tensions.frontPitchOut, tensions.frontAxillaIn
    );

    const { cp1: lbCp1, cp2: lbCp2 } = this.makeControlPoints(
      backAxilla, backPitch,
      tangents.backAxilla.outgoing, tangents.backPitch.incoming,
      tensions.backAxillaOut, tensions.backPitchIn
    );

    const { cp1: ubCp1, cp2: ubCp2 } = this.makeControlPoints(
      backPitch, capTop,
      tangents.backPitch.outgoing, tangents.capTop.incoming,
      tensions.backPitchOut, tensions.capTopIn
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

    // ========== G1验证 ==========
    this.validateG1([
      { name: 'frontPitch', p2: ufCp2, p3: frontPitch, q1: lfCp1 },
      { name: 'backPitch', p2: lbCp2, p3: backPitch, q1: ubCp1 }
    ]);

    // ========== 日志 ==========
    logger.info(`\n📐 袖山关键点:`);
    logger.info(`   capTop: (${capTop.x.toFixed(2)}, ${capTop.y.toFixed(2)})`);
    logger.info(`   frontPitch: (${frontPitch.x.toFixed(2)}, ${frontPitch.y.toFixed(2)})`);
    logger.info(`   frontAxilla: (${frontAxilla.x.toFixed(2)}, ${frontAxilla.y.toFixed(2)})`);
    logger.info(`   backPitch: (${backPitch.x.toFixed(2)}, ${backPitch.y.toFixed(2)})`);
    logger.info(`   backAxilla: (${backAxilla.x.toFixed(2)}, ${backAxilla.y.toFixed(2)})`);

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
   * 基于切线方向和张力生成一对控制点
   *
   * CP1: 从fromPoint沿outgoingAngle方向偏移 span × fromTension
   * CP2: 从toPoint沿incomingAngle反方向偏移 span × toTension
   *
   * G1连续保证：
   * - pitch点的incoming = outgoing → 同一切线 → 自动共线
   */
  private static makeControlPoints(
    fromPoint: Point,
    toPoint: Point,
    fromOutgoingAngleDeg: number,
    toIncomingAngleDeg: number,
    fromTension: number,
    toTension: number
  ): { cp1: Point; cp2: Point } {

    const span = Math.sqrt(
      (toPoint.x - fromPoint.x) ** 2 +
      (toPoint.y - fromPoint.y) ** 2
    );

    const fromRad = fromOutgoingAngleDeg * Math.PI / 180;
    const cp1 = new Point(
      fromPoint.x + Math.cos(fromRad) * span * fromTension,
      fromPoint.y + Math.sin(fromRad) * span * fromTension
    );

    const toReverseRad = (toIncomingAngleDeg + 180) * Math.PI / 180;
    const cp2 = new Point(
      toPoint.x + Math.cos(toReverseRad) * span * toTension,
      toPoint.y + Math.sin(toReverseRad) * span * toTension
    );

    return { cp1, cp2 };
  }

  /**
   * G1连续性验证
   */
  private static validateG1(joints: Array<{
    name: string;
    p2: Point;
    p3: Point;
    q1: Point;
  }>): void {
    for (const joint of joints) {
      const vec1 = { x: joint.p3.x - joint.p2.x, y: joint.p3.y - joint.p2.y };
      const vec2 = { x: joint.q1.x - joint.p3.x, y: joint.q1.y - joint.p3.y };
      const dot = vec1.x * vec2.x + vec1.y * vec2.y;
      const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      let angleDeg = 0;
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = dot / (mag1 * mag2);
        angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
      }

      if (angleDeg < 1 || angleDeg > 179) {
        const rodRatio = mag1 > 0 ? mag2 / mag1 : 0;
        const g2Status = rodRatio >= 0.7 && rodRatio <= 1.4 ? '接近G2' : 'G2偏差大';
        logger.info(`   ✅ ${joint.name}: G1连续 ✓ (夹角${angleDeg.toFixed(2)}°, 杆比${rodRatio.toFixed(2)} ${g2Status})`);
      } else {
        logger.error(`   ❌ ${joint.name}: G1不连续！(夹角${angleDeg.toFixed(2)}°)`);
      }
    }
  }

  /**
   * 从Path操作中提取袖窿段
   */
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

  /**
   * 计算袖窿总长度
   */
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

  /**
   * 三次Bezier曲线近似长度
   */
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

  /**
   * 三次Bezier曲线上的点
   */
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
