import { Point, Path, CubicBezier } from '../geometry/index.js';
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
 * 工业袖山生成器 v12.0 — 比例驱动与长度迭代法
 * 
 * 遵循 .trae/rules/rule-match.md 规则:
 * 1. 前后非对称 (前陡深，后平长)
 * 2. 比例控制点 (spanX * ratio)
 * 3. 长度匹配 (sleeveCapLength = frontArmhole + backArmhole + ease)
 * 4. 包含工业 Notch
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
    ease: number = 2.0, // 工业标准 1-4cm，默认取2.0
    armholeDepth?: number
  ): SleeveCapResult {

    const sL = sleeveParams.sleeveLength;
    const cuW = sleeveParams.cuffWidth;

    const frontSegments = this.extractArmholeSegments(frontArmholeOps);
    const backSegments = this.extractArmholeSegments(backArmholeOps);

    const frontArmholeLength = this.calculateTotalArmholeLength(frontSegments);
    const backArmholeLength = this.calculateTotalArmholeLength(backSegments);
    const totalArmholeLen = frontArmholeLength + backArmholeLength;
    const targetCapLen = totalArmholeLen + ease;

    logger.info(`\n🏭 ===== 工业袖山生成器 v12.0 (迭代匹配法) =====`);
    logger.info(`   前袖窿长度: ${frontArmholeLength.toFixed(2)} cm`);
    logger.info(`   后袖窿长度: ${backArmholeLength.toFixed(2)} cm`);
    logger.info(`   目标总长 (含ease): ${targetCapLen.toFixed(2)} cm`);

    // 初始参数
    const userProvidedBiceps = sleeveParams.bicepsWidth && sleeveParams.bicepsWidth > 0;
    const userProvidedCapHeight = sleeveParams.sleeveCapHeight && sleeveParams.sleeveCapHeight > 0;

    let cH: number;
    let bW: number;

    if (userProvidedCapHeight) {
      cH = sleeveParams.sleeveCapHeight!;
      logger.info(`   袖山高度(cH): ${cH.toFixed(2)} cm (来自用户输入)`);
    } else {
      cH = this.calculateCapHeight(totalArmholeLen, armholeDepth);
      logger.info(`   袖山高度(cH): ${cH.toFixed(2)} cm (自动计算)`);
    }

    if (userProvidedBiceps) {
      bW = sleeveParams.bicepsWidth!;
      logger.info(`   腋下半围(bW): ${bW.toFixed(2)} cm (来自用户输入，不进行迭代调整)`);
    } else {
      bW = this.calculateBicepsWidth(totalArmholeLen, cH, ease);
      logger.info(`   腋下半围(bW): ${bW.toFixed(2)} cm (自动计算)`);

      // 仅在自动计算时才进行迭代调整以匹配袖窿长度
      let bestResult: SleeveCapResult | null = null;
      let minDiff = Infinity;

      for (let iter = 0; iter < 10; iter++) {
        const result = this.generateSleeveCap(
          bW, cH, sL, cuW,
          frontArmholeLength, backArmholeLength, ease
        );

        const diff = result.totalCapLength - targetCapLen;

        if (Math.abs(diff) < 0.1) {
          bestResult = result;
          break;
        }

        if (Math.abs(diff) < minDiff) {
          minDiff = Math.abs(diff);
          bestResult = result;
        }

        // 简单的比例调整：如果太短，增加bW；如果太长，减少bW
        bW -= diff * 1.1;
      }

      if (!bestResult) {
        throw new Error('Failed to generate matching sleeve cap');
      }

      logger.info(`   迭代后腋下半围(bW): ${bW.toFixed(2)} cm`);
      logger.info(`   最终袖山高度: ${cH.toFixed(2)} cm`);
      logger.info(`   最终腋下宽度: ${bW.toFixed(2)} cm`);
      logger.info(`   最终袖山长度: ${bestResult.totalCapLength.toFixed(2)} cm (误差: ${(bestResult.totalCapLength - targetCapLen).toFixed(3)} cm)`);

      return bestResult;
    }

    // 用户提供了bW，直接生成（不迭代）
    const result = this.generateSleeveCap(
      bW, cH, sL, cuW,
      frontArmholeLength, backArmholeLength, ease
    );

    logger.info(`   最终袖山高度: ${cH.toFixed(2)} cm`);
    logger.info(`   最终腋下宽度: ${bW.toFixed(2)} cm`);
    logger.info(`   最终袖山长度: ${result.totalCapLength.toFixed(2)} cm (误差: ${(result.totalCapLength - targetCapLen).toFixed(3)} cm)`);

    return result;
  }

  private static calculateCapHeight(totalArmholeLen: number, armholeDepth?: number): number {
    if (armholeDepth) return Math.max(armholeDepth * 0.75, 12); // T恤袖山高度通常较高
    return totalArmholeLen * 0.32;
  }

  private static calculateBicepsWidth(totalArmholeLen: number, cH: number, ease: number): number {
    // 经验公式: 计算全围后除以2得到半围
    const targetLen = totalArmholeLen + ease;
    const fullBicep = Math.sqrt(Math.pow(targetLen, 2) - Math.pow(cH, 2)) * 0.9;
    return fullBicep / 2; // 返回半围
  }

  /**
   * 核心几何算法：工业比例法
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

    const halfBicep = bW;

    // =========================
    // 关键点
    // =========================

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
      cuW,
      cH + sL
    );

    const backCuff = new Point(
      -cuW,
      cH + sL
    );

    // =========================
    // 工业控制点
    // 真正工业版
    // =========================

    // 顶部宽度控制
    const topSpread = halfBicep * 0.42;

    // 前袖：更短、更陡
    const frontCp1 = new Point(
      topSpread,
      cH * 0.04
    );

    const frontCp2 = new Point(
      halfBicep * 0.92,
      cH * 0.72
    );

    // 后袖：更长、更平、更饱满
    const backCp1 = new Point(
      -halfBicep * 0.92,
      cH * 0.62
    );

    const backCp2 = new Point(
      -topSpread,
      cH * 0.02
    );

    // =========================
    // Bezier
    // =========================

    const frontCurve = new CubicBezier(
      capTop,
      frontCp1,
      frontCp2,
      frontAxilla
    );

    const backCurve = new CubicBezier(
      backAxilla,
      backCp1,
      backCp2,
      capTop
    );

    // =========================
    // 长度
    // =========================

    const frontLen = frontCurve.getLength();
    const backLen = backCurve.getLength();
    const totalLen = frontLen + backLen;

    // =========================
    // Notch
    // =========================

    const frontNotch = frontCurve.getPoint(0.72);

    const backNotch = backCurve.getPoint(0.38);

    // =========================
    // Path
    // =========================

    const capPath = new Path()
      .move(capTop)

      // 前袖
      .curve(
        frontCp1,
        frontCp2,
        frontAxilla
      )
      .segment('armhole')

      // 前侧缝
      .line(frontCuff)
      .segment('sideSeam')

      // 袖口
      .line(backCuff)
      .segment('sleeveHem')

      // 后侧缝
      .line(backAxilla)
      .segment('sideSeam')

      // 后袖
      .curve(
        backCp1,
        backCp2,
        capTop
      )
      .segment('armhole')

      .close();

    logger.info(`\n🏭 工业袖山生成完成`);
    logger.info(`   前袖长: ${frontLen.toFixed(2)} cm`);
    logger.info(`   后袖长: ${backLen.toFixed(2)} cm`);
    logger.info(`   总长: ${totalLen.toFixed(2)} cm`);

    return {
      capPath,

      points: {
        capTop,
        frontAxilla,
        backAxilla,
        frontCuff,
        backCuff,

        frontCp1,
        frontCp2,
        backCp1,
        backCp2,

        frontNotch,
        backNotch
      },

      frontCapLength: frontLen,
      backCapLength: backLen,
      totalCapLength: totalLen,

      frontArmholeLength: frontArmholeLen,
      backArmholeLength: backArmholeLen,

      ease
    };
  }

  private static extractArmholeSegments(ops: Array<{ type: string; to?: { x: number; y: number }; cp1?: { x: number; y: number }; cp2?: { x: number; y: number } }>): ArmholeSegment[] {
    const segments: ArmholeSegment[] = [];
    let prevPoint: Point | null = null;

    for (const op of ops) {
      if (op.type === 'move' && op.to) {
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
        const bez = new CubicBezier(seg.start, seg.cp1, seg.cp2, seg.end);
        totalLength += bez.getLength();
      } else {
        totalLength += seg.start.dist(seg.end);
      }
    }
    return totalLength;
  }
}

