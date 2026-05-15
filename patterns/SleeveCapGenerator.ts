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
 * 工业级袖山生成器 v6.0 - 完整工业版
 * 
 * 核心设计原则（严格遵循 rule-match.md）:
 * 
 * 1. **固定拓扑结构（4段curve）**：
 *    M(capTop) 
 *    → C(upperFront: capTop→frontPitch)     [前袖山上段]
 *    → C(lowerFront: frontPitch→frontAxilla) [前袖山下段]
 *    → L(frontAxilla→frontCuff)
 *    → L(frontCuff→backCuff)
 *    → L(backCuff→backAxilla)
 *    → C(lowerBack: backAxilla→backPitch)   [后袖山下段]
 *    → C(upperBack: backPitch→capTop)      [后袖山上段]
 *    → Z
 * 
 * 2. **前后不对称**：
 *    - 前袖：更陡、更深、hollow明显
 *    - 后袖：更长、更平、更饱满（禁止镜像）
 * 
 * 3. **capTop切线约束**：
 *    - 顶部切线必须接近水平（角度<15°）
 *    - 禁止垂直下冲
 * 
 * 4. **Pitch点系统**：
 *    - 前pitch：较低（40-45%高度），产生陡峭曲线
 *    - 后pitch：较高（30-35%高度），产生平缓曲线
 * 
 * 5. **工业比例系统**：
 *    - 所有坐标基于 halfBicep 和 cH 的百分比
 *    - 不使用硬编码数值
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

    logger.debug('\n🏭 ===== 工业级袖山生成器 v6.0 (完整工业版) =====');
    logger.debug(`   腋下半围(bW): ${bW} cm`);
    logger.debug(`   袖山高度(cH): ${cH} cm`);
    logger.debug(`   袖长(sL): ${sL} cm`);
    logger.debug(`   袖口半围(cuW): ${cuW} cm`);

    // 计算前后袖窿长度
    const frontCurves = this.extractCurves(frontArmholeOps);
    const backCurves = this.extractCurves(backArmholeOps);

    const frontArmholeLength = this.calculateTotalCurveLength(frontCurves);
    const backArmholeLength = this.calculateTotalCurveLength(backCurves);

    // 使用完整的工业几何系统生成袖山
    const result = this.generateIndustrialSleeveV6(
      bW, cH, sL, cuW,
      frontArmholeLength, backArmholeLength, ease
    );

    return result;
  }

  /**
   * 完整工业袖山生成（v6.0）
   * 
   * 几何结构：
   * - 4个cubic Bezier curve（前上+前下+后下+后上）
   * - 2个pitch点（前后不对称）
   * - 切线方向验证
   * - 自交检测
   */
  private static generateIndustrialSleeveV6(
    bW: number,
    cH: number,
    sL: number,
    cuW: number,
    frontArmholeLen: number,
    backArmholeLen: number,
    ease: number
  ): SleeveCapResult {

    // ========== 基础尺寸 ==========
    const halfBicep = bW / 2;

    // ========== 关键点定义 ==========

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
    // - 前袖pitch更低（40-45%高度）：产生更陡峭的上半段
    // - 后袖pitch更高（30-35%高度）：产生更平缓的下段
    //

    const frontPitchY = cH * 0.42;  // 前pitch：较低位置
    const frontPitchX = halfBicep * 0.38;  // 前pitch：向内收
    const frontPitch = new Point(frontPitchX, frontPitchY);

    const backPitchY = cH * 0.32;  // 后pitch：较高位置
    const backPitchX = -halfBicep * 0.36;  // 后pitch：向内收
    const backPitch = new Point(backPitchX, backPitchY);

    // ========== 前袖山上段控制点 (capTop → frontPitch)==========
    //
    // 【关键】capTop处切线必须接近水平！
    //
    // 数学原理：
    // - Cubic Bezier在t=0处的切线方向 = P1 - P0
    // - 要使切线水平，需要 P1.y ≈ P0.y (= 0)
    // - 所以 upperFrontCp1 的 Y 值必须很小（< cH 的10%）
    //
    // 工业特征：
    // - 更陡峭
    // - 曲率集中在上半段
    // - 外凸明显（产生肩部饱满感）
    //

    const frontUpperSpanX = frontPitch.x - capTop.x;  // 正值
    const frontUpperSpanY = frontPitch.y - capTop.y;  // 正值

    // CP1: 控制顶部圆弧和外凸
    // 【重要】Y值必须小，确保capTop处切线水平！
    const upperFrontCp1 = new Point(
      halfBicep * 0.48,           // X: 大幅向外凸出（48% halfBicep）
      cH * 0.08                   // Y: 很小（8% cH），确保水平切线 ✓
    );

    // CP2: 接近frontPitch点
    const upperFrontCp2 = new Point(
      frontPitch.x - frontUpperSpanX * 0.18,
      frontPitch.y - frontUpperSpanY * 0.12
    );

    // ========== 前袖山下段控制点 (frontPitch → frontAxilla)==========
    //
    // 工业特征：
    // - hollow效果明显
    // - 从pitch点先内收再外放
    // - 形成自然的腋下弯曲
    //

    const frontLowerSpanX = frontAxilla.x - frontPitch.x;
    const frontLowerSpanY = frontAxilla.y - frontPitch.y;

    // CP1: 从pitch点开始hollow（内收）
    const lowerFrontCp1 = new Point(
      frontPitch.x + frontLowerSpanX * 0.25,
      frontPitch.y + frontLowerSpanY * 0.35 - halfBicep * 0.06
    );

    // CP2: 接近frontAxilla（外放）
    const lowerFrontCp2 = new Point(
      frontAxilla.x - frontLowerSpanX * 0.40,
      frontAxilla.y - frontLowerSpanY * 0.12
    );

    // Front Notch（在前袖山下段30%处）
    const frontNotch = new Point(
      frontPitch.x + frontLowerSpanX * 0.28,
      frontPitch.y + frontLowerSpanY * 0.30
    );

    // ========== 后袖山下段控制点 (backAxilla → backPitch)==========
    //
    // 【关键】后袖特征：更长、更平、更饱满（禁止镜像！）
    //
    // 与前袖的区别：
    // - 曲线更长（span更大）
    // - 外凸更明显（更饱满）
    // - 分布更均匀（更平）
    //

    const backLowerSpanX = backPitch.x - backAxilla.x;  // 正值（因为backPitch.x > backAxilla.x）
    const backLowerSpanY = backPitch.y - backAxilla.y;  // 负值（因为backPitch.y < backAxilla.y）

    // CP1: 从backAxilla开始大幅外凸（更饱满！）
    // 比前袖的对应点更向外凸出
    const lowerBackCp1 = new Point(
      backAxilla.x + Math.abs(backLowerSpanX) * 0.35,  // 比前袖0.25更大
      backAxilla.y + Math.abs(backLowerSpanY) * 0.38 - halfBicep * 0.04  // 比前袖更平缓
    );

    // CP2: 接近backPitch（保持平缓）
    const lowerBackCp2 = new Point(
      backPitch.x - Math.abs(backLowerSpanX) * 0.22,
      backPitch.y + Math.abs(backLowerSpanY) * 0.15
    );

    // Back Notch（在后袖山下段30%处）
    const backNotch = new Point(
      backAxilla.x + Math.abs(backLowerSpanX) * 0.32,
      backAxilla.y + Math.abs(backLowerSpanY) * 0.35
    );

    // ========== 后袖山上段控制点 (backPitch → capTop)==========
    //
    // 【关键】capTop处切线必须接近水平！（同前端）
    //
    // 数学原理：
    // - Cubic Bezier在t=1处的切线方向 = P3 - P2
    // - 要使切线水平，需要 P2.y ≈ P3.y (= 0)
    // - 所以 upperBackCp2 的 Y 值必须很小（< cH 的10%）
    //
    // 工业特征：
    // - 更平缓（配合后袖整体特征）
    // - 过渡自然
    //

    const backUpperSpanX = capTop.x - backPitch.x;  // 正值
    const backUpperSpanY = capTop.y - backPitch.y;  // 负值

    // CP1: 从backPitch开始
    const upperBackCp1 = new Point(
      backPitch.x + backUpperSpanX * 0.35,
      backPitch.y - Math.abs(backUpperSpanY) * 0.25 + halfBicep * 0.08
    );

    // CP2: 控制顶部圆弧
    // 【重要】Y值必须小，确保capTop处切线水平！
    const upperBackCp2 = new Point(
      -halfBicep * 0.50,          // X: 大幅向外凸出（50% halfBicep，略大于前袖）
      cH * 0.06                   // Y: 很小（6% cH），确保水平切线 ✓
    );

    // ========== 构建所有points对象 ==========
    const points: Record<string, Point> = {
      // 关键点
      capTop,
      frontPitch,
      frontAxilla,
      backPitch,
      backAxilla,
      frontCuff,
      backCuff,

      // 前袖山控制点
      upperFrontCp1,
      upperFrontCp2,
      lowerFrontCp1,
      lowerFrontCp2,

      // 后袖山控制点
      lowerBackCp1,
      lowerBackCp2,
      upperBackCp1,
      upperBackCp2,

      // Notches
      frontNotch,
      backNotch,

      // Grainline
      grainlineStart: new Point(0, cH * 0.3),
      grainlineEnd: new Point(0, cH + sL * 0.8)
    };

    // ========== 计算每段Bezier长度 ==========
    const lenUpperFront = this.calculateBezierLength(capTop, upperFrontCp1, upperFrontCp2, frontPitch);
    const lenLowerFront = this.calculateBezierLength(frontPitch, lowerFrontCp1, lowerFrontCp2, frontAxilla);
    const lenLowerBack = this.calculateBezierLength(backAxilla, lowerBackCp1, lowerBackCp2, backPitch);
    const lenUpperBack = this.calculateBezierLength(backPitch, upperBackCp1, upperBackCp2, capTop);

    const actualFrontLen = lenUpperFront + lenLowerFront;
    const actualBackLen = lenLowerBack + lenUpperBack;
    const actualTotalLen = actualFrontLen + actualBackLen;

    // ========== 验证系统（8项检查）==========

    // 1. 输出pitch坐标
    logger.debug('\n📐 1. Pitch坐标:');
    logger.debug(`   frontPitch: (${frontPitch.x.toFixed(2)}, ${frontPitch.y.toFixed(2)})`);
    logger.debug(`   backPitch: (${backPitch.x.toFixed(2)}, ${backPitch.y.toFixed(2)})`);

    // 2. 输出控制点坐标
    logger.debug('\n🎯 2. 控制点坐标:');
    logger.debug(`   前袖山上段:`);
    logger.debug(`     CP1(upperFrontCp1): (${upperFrontCp1.x.toFixed(2)}, ${upperFrontCp1.y.toFixed(2)})`);
    logger.debug(`     CP2(upperFrontCp2): (${upperFrontCp2.x.toFixed(2)}, ${upperFrontCp2.y.toFixed(2)})`);
    logger.debug(`   前袖山下段:`);
    logger.debug(`     CP1(lowerFrontCp1): (${lowerFrontCp1.x.toFixed(2)}, ${lowerFrontCp1.y.toFixed(2)})`);
    logger.debug(`     CP2(lowerFrontCp2): (${lowerFrontCp2.x.toFixed(2)}, ${lowerFrontCp2.y.toFixed(2)})`);
    logger.debug(`   后袖山下段:`);
    logger.debug(`     CP1(lowerBackCp1): (${lowerBackCp1.x.toFixed(2)}, ${lowerBackCp1.y.toFixed(2)})`);
    logger.debug(`     CP2(lowerBackCp2): (${lowerBackCp2.x.toFixed(2)}, ${lowerBackCp2.y.toFixed(2)})`);
    logger.debug(`   后袖山上段:`);
    logger.debug(`     CP1(upperBackCp1): (${upperBackCp1.x.toFixed(2)}, ${upperBackCp1.y.toFixed(2)})`);
    logger.debug(`     CP2(upperBackCp2): (${upperBackCp2.x.toFixed(2)}, ${upperBackCp2.y.toFixed(2)})`);

    // 3. 输出每段Bezier长度
    logger.debug('\n📏 3. 每段Bezier长度:');
    logger.debug(`   前袖山上段: ${lenUpperFront.toFixed(2)} cm`);
    logger.debug(`   前袖山下段: ${lenLowerFront.toFixed(2)} cm`);
    logger.debug(`   后袖山下段: ${lenLowerBack.toFixed(2)} cm`);
    logger.debug(`   后袖山上段: ${lenUpperBack.toFixed(2)} cm`);

    // 4. 前后袖山长度差
    const lengthDiff = actualBackLen - actualFrontLen;
    logger.debug('\n⚖️  4. 前后袖山长度差:');
    logger.debug(`   前袖山总长: ${actualFrontLen.toFixed(2)} cm`);
    logger.debug(`   后袖山总长: ${actualBackLen.toFixed(2)} cm`);
    logger.debug(`   长度差(后-前): ${lengthDiff.toFixed(2)} cm`);
    if (lengthDiff > 0) {
      logger.info(`   ✅ 后袖更长（符合工业规范，差异${lengthDiff.toFixed(2)}cm）`);
    } else {
      logger.warn(`   ⚠️ 后袖应该更长！当前后袖比前袖短${Math.abs(lengthDiff).toFixed(2)}cm`);
    }

    // 5. 验证顶部切线方向
    logger.debug('\n↗️  5. 顶部切线方向验证:');
    
    // 前袖山顶部切线 (t=0处)：方向 = CP1 - P0
    const frontTangentAtTop = {
      x: upperFrontCp1.x - capTop.x,
      y: upperFrontCp1.y - capTop.y
    };
    const frontTangentAngle = Math.atan2(frontTangentAtTop.y, frontTangentAtTop.x) * 180 / Math.PI;
    
    // 后袖山顶部切线 (t=1处)：方向 = P3 - CP2
    const backTangentAtTop = {
      x: capTop.x - upperBackCp2.x,
      y: capTop.y - upperBackCp2.y
    };
    const backTangentAngle = Math.atan2(backTangentAtTop.y, backTangentAtTop.x) * 180 / Math.PI;

    logger.debug(`   前袖山顶部切线角度: ${frontTangentAngle.toFixed(1)}°`);
    logger.debug(`   后袖山顶部切线角度: ${backTangentAngle.toFixed(1)}°`);
    
    // 前袖山：t=0处切线应接近水平（|角度| < 15°）
    // 后袖山：t=1处切线应接近水平（|角度| < 15° 或 |角度-180°| < 15°）
    const frontIsHorizontal = Math.abs(frontTangentAngle) < 15;
    const backIsHorizontal = Math.abs(backTangentAngle) < 15 || Math.abs(backTangentAngle - 180) < 15 || Math.abs(backTangentAngle + 180) < 15;
    
    if (frontIsHorizontal && backIsHorizontal) {
      logger.info(`   ✅ 顶部切线接近水平（前${frontTangentAngle.toFixed(1)}°，后${backTangentAngle.toFixed(1)}°）`);
    } else {
      logger.warn(`   ⚠️ 顶部切线不够水平！可能存在尖顶`);
      if (!frontIsHorizontal) {
        logger.warn(`      前袖切线角度过大: ${frontTangentAngle.toFixed(1)}° (应<15°)`);
        logger.warn(`      建议: 减小upperFrontCp1.y值`);
      }
      if (!backIsHorizontal) {
        logger.warn(`      后袖切线角度异常: ${backTangentAngle.toFixed(1)}°`);
        logger.warn(`      建议: 减小upperBackCp2.y值`);
      }
    }

    // 6. 检测是否存在自交
    logger.debug('\n🔄  6. 自交检测:');
    const hasSelfIntersection = this.checkSelfIntersection([
      { p0: capTop, p1: upperFrontCp1, p2: upperFrontCp2, p3: frontPitch },
      { p0: frontPitch, p1: lowerFrontCp1, p2: lowerFrontCp2, p3: frontAxilla },
      { p0: backAxilla, p1: lowerBackCp1, p2: lowerBackCp2, p3: backPitch },
      { p0: backPitch, p1: upperBackCp1, p2: upperBackCp2, p3: capTop }
    ]);
    
    if (!hasSelfIntersection) {
      logger.info(`   ✅ 无自交`);
    } else {
      logger.error(`   ❌ 存在自交！曲线形状错误`);
    }

    // 7. 检查是否存在共线退化
    logger.debug('\n📏  7. 共线退化检测:');
    const degenerateCurves = this.checkDegenerateCurves([
      { name: '前上', p0: capTop, p1: upperFrontCp1, p2: upperFrontCp2, p3: frontPitch },
      { name: '前下', p0: frontPitch, p1: lowerFrontCp1, p2: lowerFrontCp2, p3: frontAxilla },
      { name: '后下', p0: backAxilla, p1: lowerBackCp1, p2: lowerBackCp2, p3: backPitch },
      { name: '后上', p0: backPitch, p1: upperBackCp1, p2: upperBackCp2, p3: capTop }
    ]);
    
    if (degenerateCurves.length === 0) {
      logger.info(`   ✅ 无共线退化（所有curve都是真实Bezier曲线）`);
    } else {
      logger.warn(`   ⚠️ 存在共线退化: ${degenerateCurves.join(', ')}`);
    }

    // 8. 总体评估
    logger.debug('\n🎯 8. 总体评估:');
    logger.debug(`   实际总长度: ${actualTotalLen.toFixed(2)} cm`);
    logger.debug(`   目标总长度: ${(frontArmholeLen + backArmholeLen + ease).toFixed(2)} cm`);
    const totalError = Math.abs(actualTotalLen - (frontArmholeLen + backArmholeLen + ease));
    logger.debug(`   长度误差: ${totalError.toFixed(2)} cm`);
    
    if (totalError <= 3.0) {
      logger.info(`   ✅ 长度匹配可接受（误差≤3cm）`);
    } else if (totalError <= 5.0) {
      logger.warn(`   ⚠️ 长度基本匹配（误差≤5cm）`);
    } else {
      logger.warn(`   ⚠️ 长度差异较大: ${totalError.toFixed(2)}cm`);
    }

    // ========== 构建Path（固定拓扑：4段curve）==========
    const capPath = new Path()
      .move(capTop)
      
      // 前袖山上段 (1st curve)
      .curve(upperFrontCp1, upperFrontCp2, frontPitch)
      
      // 前袖山下段 (2nd curve)
      .curve(lowerFrontCp1, lowerFrontCp2, frontAxilla)
      
      // 前侧缝
      .line(frontCuff)
      
      // 袖口
      .line(backCuff)
      
      // 后侧缝
      .line(backAxilla)
      
      // 后袖山下段 (3rd curve)
      .curve(lowerBackCp1, lowerBackCp2, backPitch)
      
      // 后袖山上段 (4th curve)
      .curve(upperBackCp1, upperBackCp2, capTop)
      
      .close();

    logger.debug('\n✅ v6.0 工业袖山生成完成');
    logger.debug(`   Path操作数: ${capPath.ops.length} (应为9: M + C + C + L + L + L + C + C + Z)`);
    logger.debug('================================================\n');

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
   * 检测自交（简化版本）
   */
  private static checkSelfIntersection(curves: Array<{
    p0: Point; p1: Point; p2: Point; p3: Point
  }>): boolean {

    for (let i = 0; i < curves.length; i++) {
      for (let j = i + 2; j < curves.length; j++) {
        if (i === 0 && j === curves.length - 1) continue; // 首尾相连不算自交
        
        // 简化检测：检查bounding box是否重叠
        const curveI = curves[i];
        const curveJ = curves[j];
        
        const boxI = {
          minX: Math.min(curveI.p0.x, curveI.p1.x, curveI.p2.x, curveI.p3.x),
          maxX: Math.max(curveI.p0.x, curveI.p1.x, curveI.p2.x, curveI.p3.x),
          minY: Math.min(curveI.p0.y, curveI.p1.y, curveI.p2.y, curveI.p3.y),
          maxY: Math.max(curveI.p0.y, curveI.p1.y, curveI.p2.y, curveI.p3.y)
        };
        
        const boxJ = {
          minX: Math.min(curveJ.p0.x, curveJ.p1.x, curveJ.p2.x, curveJ.p3.x),
          maxX: Math.max(curveJ.p0.x, curveJ.p1.x, curveJ.p2.x, curveJ.p3.x),
          minY: Math.min(curveJ.p0.y, curveJ.p1.y, curveJ.p2.y, curveJ.p3.y),
          maxY: Math.max(curveJ.p0.y, curveJ.p1.y, curveJ.p2.y, curveJ.p3.y)
        };
        
        if (boxI.maxX > boxJ.minX && boxI.minX < boxJ.maxX &&
            boxI.maxY > boxJ.minY && boxI.minY < boxJ.maxY) {
          return true; // 可能存在自交
        }
      }
    }
    
    return false;
  }

  /**
   * 检查共线退化（control points collinear with endpoints）
   */
  private static checkDegenerateCurves(curves: Array<{
    name: string;
    p0: Point; p1: Point; p2: Point; p3: Point
  }>): string[] {

    const degenerate: string[] = [];
    const tolerance = 0.01;

    for (const curve of curves) {
      // 计算三角形面积（叉积）来检测共线性
      const area1 = Math.abs(
        (curve.p1.x - curve.p0.x) * (curve.p2.y - curve.p0.y) -
        (curve.p1.y - curve.p0.y) * (curve.p2.x - curve.p0.x)
      );
      
      const area2 = Math.abs(
        (curve.p2.x - curve.p0.x) * (curve.p3.y - curve.p0.y) -
        (curve.p2.y - curve.p0.y) * (curve.p3.x - curve.p0.x)
      );
      
      const span = Math.sqrt(
        Math.pow(curve.p3.x - curve.p0.x, 2) +
        Math.pow(curve.p3.y - curve.p0.y, 2)
      );
      
      if (area1 < tolerance * span || area2 < tolerance * span) {
        degenerate.push(curve.name);
      }
    }

    return degenerate;
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
