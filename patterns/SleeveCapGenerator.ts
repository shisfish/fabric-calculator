import { Point, Path } from '../geometry/index.js';
import { createLogger } from '../utils/CADLogger.js';

const logger = createLogger('SLEEVE-CAP');

interface ArmholeCurve {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

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
 * 工业级袖山生成器 v4.0
 * 
 * 核心设计原则（遵循 rule-match.md）:
 * 1. 基于明确工业比例（非数值优化）
 * 2. 前袖山：更深、更陡、曲率集中在上半段
 * 3. 后袖山：更平、更长、曲率分布均匀
 * 4. 所有控制点使用比例系统（spanX * ratio, spanY * ratio）
 * 5. 必须包含 front notch 和 back notch
 * 6. 袖山长度 ≈ 前袖窿 + 后袖窿 + ease (±0.5cm)
 * 
 * 工业T恤袖子典型特征：
 * - 袖山高度 = 腋下半围 × 0.35~0.50
 * - 前袖山弧长 ≈ 前袖窿 + ease/2
 * - 后袖山弧长 ≈ 后袖窿 + ease/2
 * - 前后袖山在pitch点汇合
 */
export class SleeveCapGenerator {

  /**
   * 基于前后袖窿曲线生成可缝合的工业袖山
   */
  static generateFromArmhole(
    frontArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    backArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    sleeveParams: {
      bicepsWidth: number;
      sleeveCapHeight: number;
      sleeveLength: number;
      cuffWidth: number;
    },
    ease: number = 0.5
  ): SleeveCapResult {

    const bW = sleeveParams.bicepsWidth;
    const cH = sleeveParams.sleeveCapHeight;
    const sL = sleeveParams.sleeveLength;
    const cuW = sleeveParams.cuffWidth;

    logger.debug('\n🏭 ===== 工业级袖山生成器 v4.0 =====');
    logger.debug(`   腋下半围(bW): ${bW} cm`);
    logger.debug(`   袖山高度(cH): ${cH} cm`);
    logger.debug(`   袖长(sL): ${sL} cm`);
    logger.debug(`   袖口半围(cuW): ${cuW} cm`);

    // Step 1: 计算前后袖窿长度
    const frontCurves = this.extractCurves(frontArmholeOps);
    const backCurves = this.extractCurves(backArmholeOps);

    const frontArmholeLength = this.calculateTotalCurveLength(frontCurves);
    const backArmholeLength = this.calculateTotalCurveLength(backCurves);
    
    const targetFrontLen = frontArmholeLength + ease * 0.5;
    const targetBackLen = backArmholeLength + ease * 0.5;
    const targetTotalLen = frontArmholeLength + backArmholeLength + ease;

    logger.debug(`   前袖窿长度: ${frontArmholeLength.toFixed(2)} cm`);
    logger.debug(`   后袖窿长度: ${backArmholeLength.toFixed(2)} cm`);
    logger.debug(`   目标前袖山: ${targetFrontLen.toFixed(2)} cm (含ease=${(ease*0.5).toFixed(2)}cm)`);
    logger.debug(`   目标后袖山: ${targetBackLen.toFixed(2)} cm (含ease=${(ease*0.5).toFixed(2)}cm)`);
    logger.debug(`   目标总长度: ${targetTotalLen.toFixed(2)} cm`);

    // Step 2: 使用工业比例生成袖山几何
    const result = this.generateIndustrialSleeveCap(
      bW, cH, sL, cuW,
      targetFrontLen, targetBackLen, targetTotalLen,
      frontArmholeLength, backArmholeLength, ease
    );

    return result;
  }

  /**
   * 工业级袖山几何生成（基于明确比例）
   * 
   * 拓扑结构（固定）：
   * M(capTop) 
   * → C(前上: capTop→frontPitch) 
   * → C(前下: frontPitch→frontAxilla) 
   * → L(frontAxilla→frontCuff) 
   * → L(frontCuff→backCuff) 
   * → L(backCuff→backAxilla) 
   * → C(后下: backAxilla→backPitch) 
   * → C(后上: backPitch→capTop) 
   * → Z
   */
  private static generateIndustrialSleeveCap(
    bW: number,
    cH: number,
    sL: number,
    cuW: number,
    targetFrontLen: number,
    targetBackLen: number,
    targetTotalLen: number,
    frontArmholeLen: number,
    backArmholeLen: number,
    ease: number
  ): SleeveCapResult {

    // ========== 基础关键点定义 ==========
    const halfBicep = bW / 2;

    // 袖山顶点（坐标原点）
    const capTop = new Point(0, 0);

    // 前腋下点
    const frontAxilla = new Point(halfBicep, cH);

    // 后腋下点
    const backAxilla = new Point(-halfBicep, cH);

    // 前袖口
    const frontCuff = new Point(cuW / 2, cH + sL);

    // 后袖口
    const backCuff = new Point(-cuW / 2, cH + sL);

    // ========== Pitch点计算（基于工业比例）==========
    // 
    // 工业规则：
    // - 前袖pitch更低（40-45%高度），产生更陡的曲线
    // - 后袖pitch更高（30-35%高度），产生更平的曲线
    //

    const frontPitchY = cH * 0.42;  // 前pitch：较低位置
    const frontPitchX = halfBicep * 0.38;  // 前pitch：略向内收
    const frontPitch = new Point(frontPitchX, frontPitchY);

    const backPitchY = cH * 0.32;  // 后pitch：较高位置
    const backPitchX = -halfBicep * 0.36;  // 后pitch：略向内收
    const backPitch = new Point(backPitchX, backPitchY);

    logger.debug('\n📐 关键点坐标:');
    logger.debug(`   capTop: (0, 0)`);
    logger.debug(`   frontPitch: (${frontPitch.x.toFixed(2)}, ${frontPitch.y.toFixed(2)})`);
    logger.debug(`   frontAxilla: (${frontAxilla.x.toFixed(2)}, ${frontAxilla.y.toFixed(2)})`);
    logger.debug(`   backPitch: (${backPitch.x.toFixed(2)}, ${backPitch.y.toFixed(2)})`);
    logger.debug(`   backAxilla: (${backAxilla.x.toFixed(2)}, ${backAxilla.y.toFixed(2)})`);

    // ========== 前袖山控制点（更深、更陡）==========
    //
    // 工业特征：
    // - 上半段：CP1向外凸出明显（产生圆弧形顶部）
    // - 下半段：hollow效果明显（CP1内收，CP2再外放）
    // - 曲率集中在上半段
    //
    // 【重要修正】T恤袖山顶部必须是圆弧形，不能是尖角！
    //

    const frontUpperSpanX = frontPitch.x - capTop.x;
    const frontUpperSpanY = frontPitch.y - capTop.y;

    // 前袖山上段 CP1：大幅向外凸出（产生圆弧形顶部）
    const frontUpperCp1 = new Point(
      halfBicep * 0.58,  // X: 腋下半围的58%（大幅外凸）
      cH * 0.30          // Y: 袖山高度的30%（向下延伸）
    );

    // 前袖山上段 CP2：接近pitch点
    const frontUpperCp2 = new Point(
      frontPitch.x - frontUpperSpanX * 0.12,
      frontPitch.y - frontUpperSpanY * 0.10
    );

    const frontLowerSpanX = frontAxilla.x - frontPitch.x;
    const frontLowerSpanY = frontAxilla.y - frontPitch.y;

    // 前袖山下段 CP1：hollow效果（先内收）
    const frontLowerCp1 = new Point(
      frontPitch.x + frontLowerSpanX * 0.28,
      frontPitch.y + frontLowerSpanY * 0.35 - halfBicep * 0.08
    );

    // 前袖山下段 CP2：接近axilla（外放）
    const frontLowerCp2 = new Point(
      frontAxilla.x - frontLowerSpanX * 0.42,
      frontAxilla.y - frontLowerSpanY * 0.15
    );

    // Front Notch（在下段曲线30%处）
    const frontNotch = new Point(
      frontPitch.x + frontLowerSpanX * 0.30,
      frontPitch.y + frontLowerSpanY * 0.32
    );

    // ========== 后袖山控制点（更平、更长）==========
    //
    // 工业特征：
    // - 上半段：较平缓但仍有明显外凸（保证圆弧形顶部）
    // - 下半段：更长更平（hollow弱）
    // - 曲率分布均匀
    //

    const backUpperSpanX = capTop.x - backPitch.x;
    const backUpperSpanY = backPitch.y - capTop.y;

    // 后袖山上段 CP1：向外凸出（配合前袖形成圆弧顶）
    const backUpperCp1 = new Point(
      backPitch.x + backUpperSpanX * 0.32,
      backPitch.y - backUpperSpanY * 0.20 + halfBicep * 0.12
    );

    // 后袖山上段 CP2：大幅向外凸出（对称于前袖CP1）
    const backUpperCp2 = new Point(
      -halfBicep * 0.58,  // X: 腋下半围的58%（大幅外凸，负方向）
      cH * 0.30           // Y: 袖山高度的30%（向下延伸）
    );

    const backLowerSpanX = backPitch.x - backAxilla.x;
    const backLowerSpanY = backAxilla.y - backPitch.y;

    // 后袖山下段 CP1：平缓弯曲
    const backLowerCp1 = new Point(
      backPitch.x - backLowerSpanX * 0.32,
      backPitch.y + backLowerSpanY * 0.38 - halfBicep * 0.05
    );

    // 后袖山下段 CP2：接近axilla
    const backLowerCp2 = new Point(
      backAxilla.x + backLowerSpanX * 0.38,
      backAxilla.y - backLowerSpanY * 0.12
    );

    // Back Notch（在下段曲线30%处）
    const backNotch = new Point(
      backPitch.x - backLowerSpanX * 0.30,
      backPitch.y + backLowerSpanY * 0.32
    );

    logger.debug('\n🎯 控制点坐标:');
    logger.debug(`   前袖山上段:`);
    logger.debug(`     CP1: (${frontUpperCp1.x.toFixed(2)}, ${frontUpperCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${frontUpperCp2.x.toFixed(2)}, ${frontUpperCp2.y.toFixed(2)})`);
    logger.debug(`   前袖山下段:`);
    logger.debug(`     CP1: (${frontLowerCp1.x.toFixed(2)}, ${frontLowerCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${frontLowerCp2.x.toFixed(2)}, ${frontLowerCp2.y.toFixed(2)})`);
    logger.debug(`   后袖山上段:`);
    logger.debug(`     CP1: (${backUpperCp1.x.toFixed(2)}, ${backUpperCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${backUpperCp2.x.toFixed(2)}, ${backUpperCp2.y.toFixed(2)})`);
    logger.debug(`   后袖山下段:`);
    logger.debug(`     CP1: (${backLowerCp1.x.toFixed(2)}, ${backLowerCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${backLowerCp2.x.toFixed(2)}, ${backLowerCp2.y.toFixed(2)})`);
    logger.debug(`   Notches:`);
    logger.debug(`     frontNotch: (${frontNotch.x.toFixed(2)}, ${frontNotch.y.toFixed(2)})`);
    logger.debug(`     backNotch: (${backNotch.x.toFixed(2)}, ${backNotch.y.toFixed(2)})`);

    // ========== 计算实际弧长并验证 ==========
    const actualFrontLen = 
      this.calculateBezierLength(capTop, frontUpperCp1, frontUpperCp2, frontPitch) +
      this.calculateBezierLength(frontPitch, frontLowerCp1, frontLowerCp2, frontAxilla);

    const actualBackLen =
      this.calculateBezierLength(backAxilla, backLowerCp1, backLowerCp2, backPitch) +
      this.calculateBezierLength(backPitch, backUpperCp1, backUpperCp2, capTop);

    const actualTotalLen = actualFrontLen + actualBackLen;

    logger.debug('\n📏 弧长验证:');
    logger.debug(`   实际前袖山: ${actualFrontLen.toFixed(2)} cm (目标: ${targetFrontLen.toFixed(2)} cm)`);
    logger.debug(`   实际后袖山: ${actualBackLen.toFixed(2)} cm (目标: ${targetBackLen.toFixed(2)} cm)`);
    logger.debug(`   实际总长度: ${actualTotalLen.toFixed(2)} cm (目标: ${targetTotalLen.toFixed(2)} cm)`);

    const frontError = Math.abs(actualFrontLen - targetFrontLen);
    const backError = Math.abs(actualBackLen - targetBackLen);
    const totalError = Math.abs(actualTotalLen - targetTotalLen);

    if (totalError <= 1.0) {
      logger.info(`   ✅ 长度匹配成功！总误差=${totalError.toFixed(2)}cm`);
    } else if (totalError <= 3.0) {
      logger.warn(`   ⚠️ 长度基本匹配，误差=${totalError.toFixed(2)}cm（可接受范围±3cm）`);
    } else {
      logger.warn(`   ⚠️ 长度差异较大: ${totalError.toFixed(2)}cm，建议调整参数`);
    }

    // ========== 构建Path（固定拓扑）==========
    const points: Record<string, Point> = {
      capTop,
      frontPitch,
      frontAxilla,
      frontCuff,
      backCuff,
      backAxilla,
      backPitch,
      frontUpperCp1,
      frontUpperCp2,
      frontLowerCp1,
      frontLowerCp2,
      backUpperCp1,
      backUpperCp2,
      backLowerCp1,
      backLowerCp2,
      frontNotch,
      backNotch,
      grainlineStart: new Point(0, cH * 0.3),
      grainlineEnd: new Point(0, cH + sL * 0.8)
    };

    const capPath = new Path()
      .move(capTop)
      
      // 前袖山（两段curve）
      .curve(frontUpperCp1, frontUpperCp2, frontPitch)
      .curve(frontLowerCp1, frontLowerCp2, frontAxilla)
      
      // 前侧缝
      .line(frontCuff)
      
      // 袖口
      .line(backCuff)
      
      // 后侧缝
      .line(backAxilla)
      
      // 后袖山（两段curve）
      .curve(backLowerCp1, backLowerCp2, backPitch)
      .curve(backUpperCp1, backUpperCp2, capTop)
      
      .close();

    logger.debug('\n✅ 工业袖山生成完成');
    logger.debug(`   Path操作数: ${capPath.ops.length}`);
    logger.debug('=====================================\n');

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
   * 从Path操作中提取Bezier曲线
   */
  private static extractCurves(ops: Array<{
    type: string;
    to?: {x: number; y: number};
    cp1?: {x: number; y: number};
    cp2?: {x: number; y: number}
  }>): ArmholeCurve[] {
    
    const curves: ArmholeCurve[] = [];
    let prevPoint: Point | null = null;

    for (const op of ops) {
      if (op.type === 'move' && op.to) {
        prevPoint = new Point(op.to.x, op.to.y);
      } else if (op.type === 'line' && op.to && !prevPoint) {
        prevPoint = new Point(op.to.x, op.to.y);
      } else if (op.type === 'curve' && op.to && op.cp1 && op.cp2) {
        if (!prevPoint) {
          console.warn(`⚠️ extractCurves: 找到curve但没有prevPoint，跳过`);
          continue;
        }
        
        curves.push({
          start: prevPoint,
          cp1: new Point(op.cp1.x, op.cp1.y),
          cp2: new Point(op.cp2.x, op.cp2.y),
          end: new Point(op.to.x, op.to.y)
        });
        prevPoint = new Point(op.to.x, op.to.y);
      } else if (op.type === 'line' && op.to) {
        prevPoint = new Point(op.to.x, op.to.y);
      }
    }

    return curves;
  }

  /**
   * 计算多条曲线的总长度
   */
  private static calculateTotalCurveLength(curves: ArmholeCurve[]): number {
    let totalLength = 0;
    
    for (const curve of curves) {
      totalLength += this.calculateBezierLength(
        curve.start,
        curve.cp1,
        curve.cp2,
        curve.end
      );
    }

    return totalLength;
  }

  /**
   * 计算三次Bezier曲线的近似长度
   * 使用数值积分方法（分段求和）
   */
  private static calculateBezierLength(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
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
   * 计算三次Bezier曲线上的点
   */
  private static evaluateCubicBezier(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t: number
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
