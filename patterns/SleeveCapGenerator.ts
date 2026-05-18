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

    logger.info(`\n🏭 ===== 工业袖山生成器 v13.0 (意大利CAD规范) =====`);
    logger.info(`   前袖窿长度: ${frontArmholeLength.toFixed(2)} cm`);
    logger.info(`   后袖窿长度: ${backArmholeLength.toFixed(2)} cm`);
    logger.info(`   袖山高度: ${capHeight.toFixed(2)} cm`);
    logger.info(`   腋下半围: ${halfBicep.toFixed(2)} cm`);

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
   * 工业CAD袖山生成器 v13.0
   * 基于意大利工业制版规范（TAGLIARE E APRIRE）
   *
   * 核心特征：
   * 1. 顶部宽圆弧（占袖山宽度60%+）
   * 2. 前后明显不对称（DAVANTI/DIETRO）
   * 3. 基于工业经验比例，非数学推导
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
    // 工业关键点定义
    // 基于图一：意大利CAD标准
    // ======================================================

    const capTop = new Point(0, 0);

    // 腋下点（固定位置）
    const frontAxilla = new Point(halfBicep, capHeight);
    const backAxilla = new Point(-halfBicep, capHeight);

    // ------------------------------------------------------
    // Pitch点（分段点）- 工业标准位置
    // 图一标注：前后pitch距离中心线约6cm（对于M码）
    // 使用相对比例以适应不同尺寸
    // ------------------------------------------------------

    // 后pitch (DIETRO)：更低、更靠外 → 形成更长的后袖山
    const backPitch = new Point(
      -halfBicep * 0.55,  // 更靠外
      capHeight * 0.38     // 更低（更平缓）
    );

    // 前pitch (DAVANTI)：更高、更靠内 → 形成更陡的前袖山
    const frontPitch = new Point(
      halfBicep * 0.45,   // 更靠内
      capHeight * 0.50    // 更高（更陡峭）
    );

    // ======================================================
    // 工业控制点 - 基于真实服装CAD经验
    // 不使用角度/切线系统，直接放置控制点
    // ======================================================

    // ----------------------------------------
    // 后上段：backPitch → capTop
    // DIETRO特征：长、圆、平
    // 控制点必须远离曲线，产生宽圆弧效果
    // ----------------------------------------

    const ubCp1 = new Point(
      -halfBicep * 0.42,  // 控制点向外扩展
      capHeight * 0.08     // 接近Y=0，形成平顶
    );

    const ubCp2 = new Point(
      -halfBicep * 0.18,  // 靠近中心线
      0                    // 在capTop高度
    );

    // ----------------------------------------
    // 前上段：capTop → frontPitch
    // DAVANTI特征：短、陡、略凹
    // 控制点较近，快速下降
    // ----------------------------------------

    const ufCp1 = new Point(
      halfBicep * 0.10,   // 靠近起点
      0                   // 在capTop高度
    );

    const ufCp2 = new Point(
      halfBicep * 0.28,   // 中等距离
      capHeight * 0.20    // 快速下降
    );

    // ----------------------------------------
    // 前下段：frontPitch → frontAxilla
    // DAVANTI下段：inward hollow
    // 工业特征：轻微向内凹陷
    // ----------------------------------------

    const lfCp1 = new Point(
      halfBicep * 0.56,   // 略微向外
      capHeight * 0.65    // 继续下降
    );

    const lfCp2 = new Point(
      halfBicep * 0.88,   // 接近腋下
      capHeight * 0.88    // 接近腋下高度
    );

    // ----------------------------------------
    // 后下段：backAxilla → backPitch
    // DIETRO下段：饱满外鼓
    // 工业特征：明显向外凸出
    // ----------------------------------------

    const lbCp1 = new Point(
      -halfBicep * 0.92,  // 明显向外凸出
      capHeight * 0.85    // 接近腋下高度
    );

    const lbCp2 = new Point(
      -halfBicep * 0.70,  // 向内收敛到backPitch
      capHeight * 0.55    // 上升
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