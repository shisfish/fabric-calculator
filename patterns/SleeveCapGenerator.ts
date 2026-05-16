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
    let cH = sleeveParams.sleeveCapHeight || this.calculateCapHeight(totalArmholeLen, armholeDepth);
    let bW = sleeveParams.bicepsWidth || this.calculateBicepsWidth(totalArmholeLen, cH, ease);

    // 迭代调整 bicepsWidth 以匹配长度
    let bestResult: SleeveCapResult | null = null;
    let minDiff = Infinity;
    
    // 限制迭代次数，防止死循环
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
      // 修正系数：长度对宽度的导数大约是 0.8-1.0
      bW -= diff * 1.1; 
    }

    if (!bestResult) {
      throw new Error('Failed to generate matching sleeve cap');
    }

    logger.info(`   最终袖山高度: ${cH.toFixed(2)} cm`);
    logger.info(`   最终腋下宽度: ${bW.toFixed(2)} cm`);
    logger.info(`   最终袖山长度: ${bestResult.totalCapLength.toFixed(2)} cm (误差: ${(bestResult.totalCapLength - targetCapLen).toFixed(3)} cm)`);

    return bestResult;
  }

  private static calculateCapHeight(totalArmholeLen: number, armholeDepth?: number): number {
    if (armholeDepth) return Math.max(armholeDepth * 0.75, 12); // T恤袖山高度通常较高
    return totalArmholeLen * 0.32;
  }

  private static calculateBicepsWidth(totalArmholeLen: number, cH: number, ease: number): number {
    // 经验公式: bW ≈ sqrt(targetLen^2 - cH^2) * factor
    const targetLen = totalArmholeLen + ease;
    const bW = Math.sqrt(Math.pow(targetLen, 2) - Math.pow(cH, 2)) * 0.9;
    return bW;
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
    const halfBicep = bW / 2;

    // 1. 关键点
    const capTop = new Point(0, 0);
    const frontAxilla = new Point(halfBicep, cH);
    const backAxilla = new Point(-halfBicep, cH);
    const frontCuff = new Point(cuW / 2, cH + sL);
    const backCuff = new Point(-cuW / 2, cH + sL);

    // 2. Pitch 点 (分段点)
    // 前 Pitch: 更深 (Y更大), 更靠内 (X更小)
    const frontPitch = new Point(
      halfBicep * 0.45,
      cH * 0.45
    );

    // 后 Pitch: 更平 (Y更小), 更靠外 (X更大)
    const backPitch = new Point(
      -halfBicep * 0.55,
      cH * 0.35
    );

    // 3. 控制点 - 遵循比例规则 (spanX * ratio)
    // 核心优化：确保上段（Top to Pitch）始终保持凸起 (Convex)，消除 S-Curve
    
    // --- 前上段 (capTop -> frontPitch) ---
    // 顶部必须宽圆，CP1 的 Y 必须接近 0
    const ufCp1 = new Point(
      capTop.x + halfBicep * 0.25, 
      capTop.y
    );
    // CP2 必须向外推，确保曲线外凸，且 Y 坐标位于 capTop 和 frontPitch 之间
    const ufCp2 = new Point(
      frontPitch.x,
      frontPitch.y - cH * 0.15
    );

    // --- 前下段 (frontPitch -> frontAxilla) ---
    // CP1 延续 Pitch 处的切线方向
    const lfCp1 = new Point(
      frontPitch.x,
      frontPitch.y + cH * 0.15
    );
    // CP2 靠近腋下，前袖下段可以有轻微凹陷 (hollow)
    const lfCp2 = new Point(
      frontAxilla.x - halfBicep * 0.05,
      frontAxilla.y - cH * 0.1
    );

    // --- 后下段 (backAxilla -> backPitch) ---
    // 后袖必须饱满，CP1 远离腋下
    const lbCp1 = new Point(
      backAxilla.x + halfBicep * 0.05,
      backAxilla.y - cH * 0.1
    );
    // CP2 延续 Pitch 处的切线
    const lbCp2 = new Point(
      backPitch.x,
      backPitch.y + cH * 0.15
    );

    // --- 后上段 (backPitch -> capTop) ---
    // CP1 延续 Pitch 处的切线
    const ubCp1 = new Point(
      backPitch.x,
      backPitch.y - cH * 0.15
    );
    // CP2 靠近顶部，保持圆顺
    const ubCp2 = new Point(
      capTop.x - halfBicep * 0.25,
      capTop.y
    );

    // 4. 计算长度
    const bezUpperFront = new CubicBezier(capTop, ufCp1, ufCp2, frontPitch);
    const bezLowerFront = new CubicBezier(frontPitch, lfCp1, lfCp2, frontAxilla);
    const bezLowerBack = new CubicBezier(backAxilla, lbCp1, lbCp2, backPitch);
    const bezUpperBack = new CubicBezier(backPitch, ubCp1, ubCp2, capTop);

    const lenUpperFront = bezUpperFront.getLength();
    const lenLowerFront = bezLowerFront.getLength();
    const lenLowerBack = bezLowerBack.getLength();
    const lenUpperBack = bezUpperBack.getLength();

    const actualFrontLen = lenUpperFront + lenLowerFront;
    const actualBackLen = lenLowerBack + lenUpperBack;
    const actualTotalLen = actualFrontLen + actualBackLen;

    // 5. 生成 Notch (工业位置通常在下段 curves 上)
    const frontNotch = bezLowerFront.getPoint(0.4); // 前 Notch
    const backNotch = bezLowerBack.getPoint(0.4);  // 后 Notch

    // 6. 构造 Path
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

    return {
      capPath,
      points: {
        capTop, frontPitch, frontAxilla, backPitch, backAxilla,
        frontCuff, backCuff, frontNotch, backNotch,
        ufCp1, ufCp2, lfCp1, lfCp2, lbCp1, lbCp2, ubCp1, ubCp2
      },
      frontCapLength: actualFrontLen,
      backCapLength: actualBackLen,
      totalCapLength: actualTotalLen,
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

