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
 * 工业袖山生成器 v13.0
 *
 * 目标：
 * - 非半圆
 * - 前袖窿更陡
 * - 后袖窿更平
 * - 顶部不是尖点
 * - 腋下不是直冲
 * - 整体接近真实成衣袖山
 *
 * 结构：
 *
 *        capTop
 *      /         \
 *  backPitch   frontPitch
 *    /               \
 * backAxilla     frontAxilla
 *
 * 前袖（右侧）：
 * - 更短
 * - 更陡
 * - 更深
 *
 * 后袖（左侧）：
 * - 更长
 * - 更圆
 * - 更平
 */
export class SleeveCapGenerator {

  static generateFromArmhole(
    frontArmholeOps: Array<{
      type: string;
      to?: { x: number; y: number };
      cp1?: { x: number; y: number };
      cp2?: { x: number; y: number };
    }>,
    backArmholeOps: Array<{
      type: string;
      to?: { x: number; y: number };
      cp1?: { x: number; y: number };
      cp2?: { x: number; y: number };
    }>,
    sleeveParams: {
      bicepsWidth: number;
      sleeveCapHeight: number;
      sleeveLength: number;
      cuffWidth: number;
    },
    ease: number = 2,
    armholeDepth?: number
  ): SleeveCapResult {

    const frontSegments = this.extractArmholeSegments(frontArmholeOps);
    const backSegments = this.extractArmholeSegments(backArmholeOps);

    const frontArmholeLength =
      this.calculateTotalArmholeLength(frontSegments);

    const backArmholeLength =
      this.calculateTotalArmholeLength(backSegments);

    const totalArmhole =
      frontArmholeLength + backArmholeLength;

    // =========================
    // 工业参数
    // =========================

    const capHeight =
      sleeveParams.sleeveCapHeight > 0
        ? sleeveParams.sleeveCapHeight
        : Math.max(totalArmhole * 0.28, 12);

    const halfBicep =
      sleeveParams.bicepsWidth > 0
        ? sleeveParams.bicepsWidth
        : totalArmhole * 0.36;

    const sleeveLength = sleeveParams.sleeveLength;
    const cuffHalf = sleeveParams.cuffWidth;

    logger.info(`\n🏭 Sleeve Cap v13`);
    logger.info(`front armhole = ${frontArmholeLength.toFixed(2)}`);
    logger.info(`back armhole  = ${backArmholeLength.toFixed(2)}`);
    logger.info(`cap height    = ${capHeight.toFixed(2)}`);
    logger.info(`half bicep    = ${halfBicep.toFixed(2)}`);

    return this.generateSleeveCap(
      halfBicep,
      capHeight,
      sleeveLength,
      cuffHalf,
      frontArmholeLength,
      backArmholeLength,
      ease
    );
  }

  /**
   * 真正工业袖山
   */
  private static generateSleeveCap(
    halfBicep: number,
    capHeight: number,
    sleeveLength: number,
    cuffHalf: number,
    frontArmholeLength: number,
    backArmholeLength: number,
    ease: number
  ): SleeveCapResult {

    // ======================================================
    // 关键点
    // ======================================================

    const capTop = new Point(0, 0);

    const frontAxilla = new Point(
      halfBicep,
      capHeight
    );

    const backAxilla = new Point(
      -halfBicep,
      capHeight
    );

    // 后袖 pitch 更靠外、更低（更平）
    const backPitch = new Point(
      -halfBicep * 0.58,
      capHeight * 0.34
    );

    // 前袖 pitch 更靠内、更高（更陡）
    const frontPitch = new Point(
      halfBicep * 0.42,
      capHeight * 0.46
    );

    // ======================================================
    // 工业控制点
    // ======================================================

    // ----------------------------------------
    // 后上：backPitch → capTop
    // 后袖必须圆、长、平
    // ----------------------------------------

    const ubCp1 = new Point(
      -halfBicep * 0.40,
      capHeight * 0.10
    );

    const ubCp2 = new Point(
      -halfBicep * 0.16,
      0
    );

    // ----------------------------------------
    // 前上：capTop → frontPitch
    // 前袖必须更快下降
    // ----------------------------------------

    const ufCp1 = new Point(
      halfBicep * 0.12,
      0
    );

    const ufCp2 = new Point(
      halfBicep * 0.30,
      capHeight * 0.18
    );

    // ----------------------------------------
    // 前下：frontPitch → frontAxilla
    // 前袖下段必须 inward
    // 形成工业 hollow
    // ----------------------------------------

    const lfCp1 = new Point(
      halfBicep * 0.58,
      capHeight * 0.62
    );

    const lfCp2 = new Point(
      halfBicep * 0.92,
      capHeight * 0.86
    );

    // ----------------------------------------
    // 后下：backAxilla → backPitch
    // 后袖必须更饱满
    // ----------------------------------------

    const lbCp1 = new Point(
      -halfBicep * 0.94,
      capHeight * 0.82
    );

    const lbCp2 = new Point(
      -halfBicep * 0.74,
      capHeight * 0.52
    );

    // ======================================================
    // 曲线
    // ======================================================

    const upperFront = new CubicBezier(
      capTop,
      ufCp1,
      ufCp2,
      frontPitch
    );

    const lowerFront = new CubicBezier(
      frontPitch,
      lfCp1,
      lfCp2,
      frontAxilla
    );

    const lowerBack = new CubicBezier(
      backAxilla,
      lbCp1,
      lbCp2,
      backPitch
    );

    const upperBack = new CubicBezier(
      backPitch,
      ubCp1,
      ubCp2,
      capTop
    );

    // ======================================================
    // 长度
    // ======================================================

    const frontCapLength =
      upperFront.getLength() +
      lowerFront.getLength();

    const backCapLength =
      upperBack.getLength() +
      lowerBack.getLength();

    const totalCapLength =
      frontCapLength +
      backCapLength;

    logger.info(`front cap = ${frontCapLength.toFixed(2)}`);
    logger.info(`back cap  = ${backCapLength.toFixed(2)}`);
    logger.info(`total cap = ${totalCapLength.toFixed(2)}`);

    // ======================================================
    // 袖口
    // ======================================================

    const frontCuff = new Point(
      cuffHalf,
      capHeight + sleeveLength
    );

    const backCuff = new Point(
      -cuffHalf,
      capHeight + sleeveLength
    );

    // ======================================================
    // Notch
    // ======================================================

    const frontNotch =
      lowerFront.getPoint(0.38);

    const backNotch =
      lowerBack.getPoint(0.42);

    // ======================================================
    // Path
    // ======================================================

    const capPath = new Path()
      .move(capTop)

      // 前袖
      .curve(
        ufCp1,
        ufCp2,
        frontPitch
      )
      .segment('armhole')

      .curve(
        lfCp1,
        lfCp2,
        frontAxilla
      )
      .segment('armhole')

      // 前侧缝
      .line(frontCuff)
      .segment('sideSeam')

      // 袖口
      .line(backCuff)
      .segment('hem')

      // 后侧缝
      .line(backAxilla)
      .segment('sideSeam')

      // 后袖
      .curve(
        lbCp1,
        lbCp2,
        backPitch
      )
      .segment('armhole')

      .curve(
        ubCp1,
        ubCp2,
        capTop
      )
      .segment('armhole')

      .close();

    return {
      capPath,

      points: {
        capTop,

        frontPitch,
        backPitch,

        frontAxilla,
        backAxilla,

        frontCuff,
        backCuff,

        frontNotch,
        backNotch,

        ufCp1,
        ufCp2,

        lfCp1,
        lfCp2,

        lbCp1,
        lbCp2,

        ubCp1,
        ubCp2
      },

      frontCapLength,
      backCapLength,
      totalCapLength,

      frontArmholeLength,
      backArmholeLength,

      ease
    };
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  private static extractArmholeSegments(
    ops: Array<{
      type: string;
      to?: { x: number; y: number };
      cp1?: { x: number; y: number };
      cp2?: { x: number; y: number };
    }>
  ): ArmholeSegment[] {

    const segments: ArmholeSegment[] = [];

    let prev: Point | null = null;

    for (const op of ops) {

      if (op.type === 'move' && op.to) {
        prev = new Point(op.to.x, op.to.y);
        continue;
      }

      if (
        op.type === 'curve' &&
        prev &&
        op.to &&
        op.cp1 &&
        op.cp2
      ) {

        segments.push({
          type: 'curve',
          start: prev,
          cp1: new Point(op.cp1.x, op.cp1.y),
          cp2: new Point(op.cp2.x, op.cp2.y),
          end: new Point(op.to.x, op.to.y)
        });

        prev = new Point(op.to.x, op.to.y);
      }

      if (
        op.type === 'line' &&
        prev &&
        op.to
      ) {

        segments.push({
          type: 'line',
          start: prev,
          end: new Point(op.to.x, op.to.y)
        });

        prev = new Point(op.to.x, op.to.y);
      }
    }

    return segments;
  }

  private static calculateTotalArmholeLength(
    segments: ArmholeSegment[]
  ): number {

    let total = 0;

    for (const seg of segments) {

      if (seg.type === 'curve') {

        total += new CubicBezier(
          seg.start,
          seg.cp1,
          seg.cp2,
          seg.end
        ).getLength();

      } else {

        total += seg.start.dist(seg.end);
      }
    }

    return total;
  }
}