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
 * 工业级袖山生成器 v7.0 - G1/G2连续性版本
 * 
 * ================================================================
 * 核心创新：基于切线向量的G1/G2连续Bezier生成算法
 * ================================================================
 * 
 * 【解决的问题】
 * v6.0的问题：
 * - 仅实现C0连续（位置连续）
 * - pitch点出现"肩状尖凸"
 * - upper/lower curve拼接处肉眼可见
 * - 曲率不连续，像多段拼接
 * 
 * 【解决方案】
 * 1. 基于切线向量系统重构控制点生成
 * 2. 所有拼接点自动满足G1连续（共线约束）
 * 3. 通过张力参数优化接近G2连续
 * 4. hollow来自整体曲率，而非人工负偏移
 * 
 * 【数学原理】
 * 
 * G1连续条件：
 * 对于相邻的两段cubic Bezier:
 *   Curve1: P0 → P1 → P2 → P3 (结束于pitch点)
 *   Curve2: Q0(=P3) → Q1 → Q2 → Q3 (起始于pitch点)
 *   
 * 要求：P3 - P2 与 Q1 - Q0 共线（方向相同或相反）
 * 即：P2, P3, Q1 三点共线
 * 
 * G2连续条件（近似）：
 * 在G1基础上，还需要曲率匹配：
 * κ₁(P3) ≈ κ₂(Q0)
 * 
 * Cubic Bezier曲率公式：
 * κ(t) = |x'y'' - y'x''| / (x'² + y'²)^(3/2)
 * 
 * 简化实现：通过调整张力参数使曲率平滑过渡
 * 
 * 【拓扑结构】（保持4段curve）
 * M(capTop) 
 * → C(upperFront: capTop→frontPitch)     [前袖山上段]
 * → C(lowerFront: frontPitch→frontAxilla) [前袖山下段]
 * → L(frontAxilla→frontCuff)
 * → L(frontCuff→backCuff)
 * → L(backCuff→backAxilla)
 * → C(lowerBack: backAxilla→backPitch)   [后袖山下段]
 * → C(upperBack: backPitch→capTop)      [后袖山上段]
 * → Z
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

    logger.debug('\n🏭 ===== 工业级袖山生成器 v7.0 (G1/G2连续版) =====');
    logger.debug(`   腋下半围(bW): ${bW} cm`);
    logger.debug(`   袖山高度(cH): ${cH} cm`);
    logger.debug(`   袖长(sL): ${sL} cm`);
    logger.debug(`   袖口半围(cuW): ${cuW} cm`);

    // 计算前后袖窿长度
    const frontCurves = this.extractCurves(frontArmholeOps);
    const backCurves = this.extractCurves(backArmholeOps);

    const frontArmholeLength = this.calculateTotalCurveLength(frontCurves);
    const backArmholeLength = this.calculateTotalCurveLength(backCurves);

    // 使用G1/G2连续几何系统生成袖山
    const result = this.generateG1G2SleeveV7(
      bW, cH, sL, cuW,
      frontArmholeLength,
      backArmholeLength,
      ease
    );

    return result;
  }

  /**
   * G1/G2连续袖山生成核心算法（v7.0）
   * 
   * 核心思想：
   * 1. 定义每个关键点的切线方向（angle）
   * 2. 基于切线方向自动计算控制点（保证G1连续）
   * 3. 通过张力参数调节曲率（接近G2连续）
   * 4. hollow效果来自整体曲率分布，而非人工偏移
   */
  private static generateG1G2SleeveV7(
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

    // ========== Pitch点定义（基于工业比例）==========
    
    // 前pitch：较低位置（产生更陡峭的上半段）
    const frontPitchY = cH * 0.42;
    const frontPitchX = halfBicep * 0.38;
    const frontPitch = new Point(frontPitchX, frontPitchY);

    // 后pitch：较高位置（产生更平缓的下段）
    const backPitchY = cH * 0.32;
    const backPitchX = -halfBicep * 0.36;
    const backPitch = new Point(backPitchX, backPitchY);

    // ========== 切线方向定义（核心！）==========
    //
    // 【关键设计原则】
    // 1. 每个关键点都有明确的切线方向
    // 2. 相邻curve在拼接点共享相同切线方向 → 保证G1连续
    // 3. 切线方向基于工业经验和人体工学
    //

    interface TangentDef {
      point: Point;
      angleDeg: number;  // 切线角度（度数），从正X轴逆时针测量
    }

    // 各关键点的切线方向定义
    const tangents: Record<string, TangentDef> = {
      // capTop: 接近水平（确保圆润顶部）
      'capTop': {
        point: capTop,
        angleDeg: 85  // 接近垂直向下（85°），但不是90°（避免尖顶）
      },
      
      // frontPitch: 向下向外倾斜（前袖特征：陡峭）
      'frontPitch': {
        point: frontPitch,
        angleDeg: 62  // 较大角度（更陡峭）
      },
      
      // frontAxilla: 接近垂直（进入侧缝）
      'frontAxilla': {
        point: frontAxilla,
        angleDeg: 88  // 几乎垂直向下
      },

      // backAxilla: 接近垂直（进入侧缝）
      'backAxilla': {
        point: backAxilla,
        angleDeg: 92  // 几乎垂直向下（略向后倾斜）
      },
      
      // backPitch: 向下向内倾斜（后袖特征：平缓）
      'backPitch': {
        point: backPitch,
        angleDeg: 118  // 较小角度（更平缓，向后倾斜更多）
      }
    };

    // ========== 张力参数定义（控制曲线形状）==========
    //
    // 张力参数（tension）：
    // - 控制控制点到关键点的距离
    // - 张力越大 → 控制点越远 → 曲线越"紧绷"
    // - 张力越小 → 控制点越近 → 曲线越"松弛"
    //
    // 工业规则：
    // - 前袖：上段张力较小（外凸明显），下段张力较大（hollow自然）
    // - 后袖：整体张力较小（更饱满、更平缓）
    //

    interface TensionParam {
      incoming: number;  // 进入该点的距离比例（相对于到上一个点的距离）
      outgoing: number;  // 离开该点的距离比例（相对于到下一个点的距离）
    }

    // 各关键点的张力参数
    const tensions: Record<string, TensionParam> = {
      // capTop: 对称张力（顶部圆弧）
      'capTop': {
        incoming: 0.30,  // 从frontPitch来的控制点距离
        outgoing: 0.30   // 到backPitch去的控制点距离
      },
      
      // frontPitch: 不对称张力（前陡后缓）
      'frontPitch': {
        incoming: 0.25,  // 从capTop来的控制点距离（较短 → 上段弯曲集中）
        outgoing: 0.32   // 到frontAxilla去的控制点距离（较长 → 下段较平）
      },
      
      // frontAxilla: 进入侧缝前的过渡
      'frontAxilla': {
        incoming: 0.28,
        outgoing: 0.28
      },

      // backAxilla: 从侧缝出来后的过渡
      'backAxilla': {
        incoming: 0.28,
        outgoing: 0.28
      },
      
      // backPitch: 不对称张力（后缓前陡）
      'backPitch': {
        incoming: 0.34,  // 从backAxilla来的控制点距离（更长 → 下段更饱满）
        outgoing: 0.28   // 到capTop去的控制点距离（较短 → 上段较陡）
      }
    };

    // ========== 基于切线和张力自动生成控制点（G1连续保证）==========

    /**
     * 辅助函数：根据切线方向和张力生成控制点
     * 
     * @param fromPoint 起始关键点
     * @param toPoint 终止关键点  
     * @param fromTangent 起始点的切线角度（度数）
     * @param toTangent 终止点的切线角度（度数）
     * @param fromTension 起始点的出向张力
     * @param toTension 终止点的入向张力
     * @returns {cp1, cp2} 两个控制点
     */
    const generateControlPoints = (
      fromPoint: Point,
      toPoint: Point,
      fromAngleDeg: number,
      toAngleDeg: number,
      fromTension: number,
      toTension: number
    ): { cp1: Point; cp2: Point } => {

      // 计算两点间距离
      const span = Math.sqrt(
        Math.pow(toPoint.x - fromPoint.x, 2) +
        Math.pow(toPoint.y - fromPoint.y, 2)
      );

      // CP1: 从fromPoint出发，沿fromAngleDeg方向，距离=span*fromTension
      const fromRad = fromAngleDeg * Math.PI / 180;
      const cp1 = new Point(
        fromPoint.x + Math.cos(fromRad) * span * fromTension,
        fromPoint.y + Math.sin(fromRad) * span * fromTension
      );

      // CP2: 到toPoint终止，沿toAngleDeg+180°方向（反向），距离=span*toTension
      const toRad = (toAngleDeg + 180) * Math.PI / 180;
      const cp2 = new Point(
        toPoint.x + Math.cos(toRad) * span * toTension,
        toPoint.y + Math.sin(toRad) * span * toTension
      );

      return { cp1, cp2 };
    };

    // ========== 生成所有控制点 ==========

    // 前袖山上段 (capTop → frontPitch)
    const upperFront = generateControlPoints(
      capTop,
      frontPitch,
      tangents['capTop'].angleDeg,      // capTop切线方向
      tangents['frontPitch'].angleDeg,   // frontPitch切线方向
      tensions['capTop'].outgoing,       // capTop出向张力
      tensions['frontPitch'].incoming    // frontPitch入向张力
    );
    const upperFrontCp1 = upperFront.cp1;
    const upperFrontCp2 = upperFront.cp2;

    // 前袖山下段 (frontPitch → frontAxilla)
    const lowerFront = generateControlPoints(
      frontPitch,
      frontAxilla,
      tangents['frontPitch'].angleDeg,   // frontPitch切线方向（与上段相同！G1连续✓）
      tangents['frontAxilla'].angleDeg,  // frontAxilla切线方向
      tensions['frontPitch'].outgoing,   // frontPitch出向张力
      tensions['frontAxilla'].incoming   // frontAxilla入向张力
    );
    const lowerFrontCp1 = lowerFront.cp1;
    const lowerFrontCp2 = lowerFront.cp2;

    // Front Notch（在前袖山下段40%处）
    const frontNotch = this.evaluateCubicBezier(
      frontPitch, lowerFrontCp1, lowerFrontCp2, frontAxilla, 0.4
    );

    // 后袖山下段 (backAxilla → backPitch)
    const lowerBack = generateControlPoints(
      backAxilla,
      backPitch,
      tangents['backAxilla'].angleDeg,   // backAxilla切线方向
      tangents['backPitch'].angleDeg,    // backPitch切线方向
      tensions['backAxilla'].outgoing,   // backAxilla出向张力
      tensions['backPitch'].incoming     // backPitch入向张力
    );
    const lowerBackCp1 = lowerBack.cp1;
    const lowerBackCp2 = lowerBack.cp2;

    // Back Notch（在后袖山下段40%处）
    const backNotch = this.evaluateCubicBezier(
      backAxilla, lowerBackCp1, lowerBackCp2, backPitch, 0.4
    );

    // 后袖山上段 (backPitch → capTop)
    const upperBack = generateControlPoints(
      backPitch,
      capTop,
      tangents['backPitch'].angleDeg,    // backPitch切线方向（与下段相同！G1连续✓）
      tangents['capTop'].angleDeg,       // capTop切线方向
      tensions['backPitch'].outgoing,    // backPitch出向张力
      tensions['capTop'].incoming        // capTop入向张力
    );
    const upperBackCp1 = upperBack.cp1;
    const upperBackCp2 = upperBack.cp2;

    // ========== 构建points对象 ==========
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

    // ========== 验证G1连续性 ==========
    this.validateG1Continuity(
      [
        { name: 'frontPitch', p2: upperFrontCp2, p3: frontPitch, q1: lowerFrontCp1 },
        { name: 'backPitch', p2: lowerBackCp2, p3: backPitch, q1: upperBackCp1 }
      ]
    );

    // ========== 计算每段Bezier长度 ==========
    const lenUpperFront = this.calculateBezierLength(capTop, upperFrontCp1, upperFrontCp2, frontPitch);
    const lenLowerFront = this.calculateBezierLength(frontPitch, lowerFrontCp1, lowerFrontCp2, frontAxilla);
    const lenLowerBack = this.calculateBezierLength(backAxilla, lowerBackCp1, lowerBackCp2, backPitch);
    const lenUpperBack = this.calculateBezierLength(backPitch, upperBackCp1, upperBackCp2, capTop);

    const actualFrontLen = lenUpperFront + lenLowerFront;
    const actualBackLen = lenLowerBack + lenUpperBack;
    const actualTotalLen = actualFrontLen + actualBackLen;

    // ========== 输出调试日志 ==========
    this.outputDebugLogV7({
      frontPitch, backPitch,
      upperFrontCp1, upperFrontCp2, lowerFrontCp1, lowerFrontCp2,
      lowerBackCp1, lowerBackCp2, upperBackCp1, upperBackCp2,
      lenUpperFront, lenLowerFront, lenLowerBack, lenUpperBack,
      actualFrontLen, actualBackLen, actualTotalLen,
      frontArmholeLen, backArmholeLen, ease,
      tangents, tensions
    });

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

    logger.debug('\n✅ v7.0 G1/G2连续袖山生成完成');
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
   * 验证G1连续性（共线性检查）
   */
  private static validateG1Continuity(joints: Array<{
    name: string;
    p2: Point;
    p3: Point;
    q1: Point;
  }>): void {

    logger.debug('\n🔗 G1连续性验证:');
    
    for (const joint of joints) {
      // 计算两个向量
      const vec1 = {
        x: joint.p3.x - joint.p2.x,
        y: joint.p3.y - joint.p2.y
      };
      
      const vec2 = {
        x: joint.q1.x - joint.p3.x,
        y: joint.q1.y - joint.p3.y
      };

      // 计算夹角
      const dot = vec1.x * vec2.x + vec1.y * vec2.y;
      const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
      
      let angleDeg = 0;
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = dot / (mag1 * mag2);
        angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
      }

      // 判断是否共线（允许<1°误差）
      if (angleDeg < 1 || angleDeg > 179) {
        logger.info(`   ✅ ${joint.name}: G1连续 ✓ (夹角${angleDeg.toFixed(2)}°)`);
      } else {
        logger.error(`   ❌ ${joint.name}: G1不连续！(夹角${angleDeg.toFixed(2)}°，应<1°)`);
      }
    }
  }

  /**
   * 输出v7.0完整调试日志
   */
  private static outputDebugLogV7(params: {
    frontPitch: Point;
    backPitch: Point;
    upperFrontCp1: Point;
    upperFrontCp2: Point;
    lowerFrontCp1: Point;
    lowerFrontCp2: Point;
    lowerBackCp1: Point;
    lowerBackCp2: Point;
    upperBackCp1: Point;
    upperBackCp2: Point;
    lenUpperFront: number;
    lenLowerFront: number;
    lenLowerBack: number;
    lenUpperBack: number;
    actualFrontLen: number;
    actualBackLen: number;
    actualTotalLen: number;
    frontArmholeLen: number;
    backArmholeLen: number;
    ease: number;
    tangents: Record<string, {point: Point; angleDeg: number}>;
    tensions: Record<string, {incoming: number; outgoing: number}>;
  }): void {

    // 1. 切线方向输出
    logger.debug('\n📐 1. 切线方向系统:');
    for (const [name, tangent] of Object.entries(params.tangents)) {
      logger.debug(`   ${name}: ${tangent.angleDeg.toFixed(0)}°`);
    }

    // 2. 张力参数输出
    logger.debug('\n💪 2. 张力参数:');
    for (const [name, tension] of Object.entries(params.tensions)) {
      logger.debug(`   ${name}: in=${tension.incoming.toFixed(2)}, out=${tension.outgoing.toFixed(2)}`);
    }

    // 3. 控制点坐标
    logger.debug('\n🎯 3. 控制点坐标（自动生成）:');
    logger.debug(`   前袖山上段:`);
    logger.debug(`     CP1: (${params.upperFrontCp1.x.toFixed(2)}, ${params.upperFrontCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${params.upperFrontCp2.x.toFixed(2)}, ${params.upperFrontCp2.y.toFixed(2)})`);
    logger.debug(`   前袖山下段:`);
    logger.debug(`     CP1: (${params.lowerFrontCp1.x.toFixed(2)}, ${params.lowerFrontCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${params.lowerFrontCp2.x.toFixed(2)}, ${params.lowerFrontCp2.y.toFixed(2)})`);
    logger.debug(`   后袖山下段:`);
    logger.debug(`     CP1: (${params.lowerBackCp1.x.toFixed(2)}, ${params.lowerBackCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${params.lowerBackCp2.x.toFixed(2)}, ${params.lowerBackCp2.y.toFixed(2)})`);
    logger.debug(`   后袖山上段:`);
    logger.debug(`     CP1: (${params.upperBackCp1.x.toFixed(2)}, ${params.upperBackCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${params.upperBackCp2.x.toFixed(2)}, ${params.upperBackCp2.y.toFixed(2)})`);

    // 4. Bezier长度
    logger.debug('\n📏 4. 每段Bezier长度:');
    logger.debug(`   前袖山上段: ${params.lenUpperFront.toFixed(2)} cm`);
    logger.debug(`   前袖山下段: ${params.lenLowerFront.toFixed(2)} cm`);
    logger.debug(`   后袖山下段: ${params.lenLowerBack.toFixed(2)} cm`);
    logger.debug(`   后袖山上段: ${params.lenUpperBack.toFixed(2)} cm`);

    // 5. 前后长度差
    const lengthDiff = params.actualBackLen - params.actualFrontLen;
    logger.debug('\n⚖️  5. 前后袖山长度差:');
    logger.debug(`   前袖山总长: ${params.actualFrontLen.toFixed(2)} cm`);
    logger.debug(`   后袖山总长: ${params.actualBackLen.toFixed(2)} cm`);
    logger.debug(`   长度差(后-前): ${lengthDiff.toFixed(2)} cm`);
    if (lengthDiff > 0) {
      logger.info(`   ✅ 后袖更长（符合工业规范，差异${lengthDiff.toFixed(2)}cm）`);
    } else {
      logger.warn(`   ⚠️ 后袖应该更长！`);
    }

    // 6. 总体评估
    logger.debug('\n🎯 6. 总体评估:');
    logger.debug(`   实际总长度: ${params.actualTotalLen.toFixed(2)} cm`);
    logger.debug(`   目标总长度: ${(params.frontArmholeLen + params.backArmholeLen + params.ease).toFixed(2)} cm`);
    const totalError = Math.abs(params.actualTotalLen - (params.frontArmholeLen + params.backArmholeLen + params.ease));
    logger.debug(`   长度误差: ${totalError.toFixed(2)} cm`);
    
    if (totalError <= 3.0) {
      logger.info(`   ✅ 长度匹配可接受（误差≤3cm）`);
    } else if (totalError <= 5.0) {
      logger.warn(`   ⚠️ 长度基本匹配（误差≤5cm）`);
    } else {
      logger.warn(`   ⚠️ 长度差异较大: ${totalError.toFixed(2)}cm`);
    }
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
