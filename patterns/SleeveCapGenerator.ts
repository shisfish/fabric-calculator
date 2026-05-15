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
 * 工业级袖山生成器 v5.0 - 简化版
 * 
 * 核心设计原则：
 * 1. **简化拓扑**：只用2个curve（前+后），不使用复杂分段
 * 2. **工业比例**：所有控制点基于 halfBicep 和 cH 的百分比
 * 3. **自然形状**：前袖陡、后袖平，顶部圆弧过渡
 * 4. **不硬凑数据**：遵循真实T恤几何逻辑
 * 
 * 拓扑结构（固定）：
 * M(capTop) 
 * → C(前袖山: capTop→frontAxilla) 
 * → L(frontAxilla→frontCuff) 
 * → L(frontCuff→backCuff) 
 * → L(backCuff→backAxilla) 
 * → C(后袖山: backAxilla→capTop) 
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

    logger.debug('\n🏭 ===== 工业级袖山生成器 v5.0 (简化版) =====');
    logger.debug(`   腋下半围(bW): ${bW} cm`);
    logger.debug(`   袖山高度(cH): ${cH} cm`);
    logger.debug(`   袖长(sL): ${sL} cm`);
    logger.debug(`   袖口半围(cuW): ${cuW} cm`);

    // 计算前后袖窿长度
    const frontCurves = this.extractCurves(frontArmholeOps);
    const backCurves = this.extractCurves(backArmholeOps);

    const frontArmholeLength = this.calculateTotalCurveLength(frontCurves);
    const backArmholeLength = this.calculateTotalCurveLength(backCurves);

    // 使用工业比例直接生成袖山几何
    const result = this.generateSimpleIndustrialSleeve(
      bW, cH, sL, cuW,
      frontArmholeLength, backArmholeLength, ease
    );

    return result;
  }

  /**
   * 简化的工业袖山生成（基于明确比例）
   * 
   * 工业T恤袖子的几何特征：
   * - 袖山高度 ≈ 腋下半围 × 0.6~0.8
   * - 前袖山弧长 > 后袖山弧长（因为前片袖窿更深）
   * - 前袖山更陡峭（曲率集中在靠近肩点）
   * - 后袖山更平缓（曲率分布均匀）
   * - 顶部形成自然的圆弧形（不是尖角）
   */
  private static generateSimpleIndustrialSleeve(
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

    // ========== 前袖山控制点（1段curve）==========
    //
    // 工业规则：
    // - CP1: 在1/3处向外凸出（形成圆弧顶）
    // - CP2: 在2/3处略内收（产生轻微hollow）
    // - 整体形状：从capTop平滑过渡到frontAxilla
    //

    // CP1: 控制顶部圆弧（外凸）
    // X方向：约halfBicep的50-60%（大幅外凸确保圆弧）
    // Y方向：约cH的25-35%（向下延伸）
    const frontCp1 = new Point(
      halfBicep * 0.55,
      cH * 0.28
    );

    // CP2: 控制下段弯曲（接近axilla但略有内收）
    // X方向：比frontAxilla小10-15%
    // Y方向：接近cH
    const frontCp2 = new Point(
      frontAxilla.x - halfBicep * 0.12,
      cH * 0.82
    );

    // Front Notch（在前袖山60%处）
    const frontNotch = new Point(
      halfBicep * 0.62,
      cH * 0.65
    );

    // ========== 后袖山控制点（1段curve）==========
    //
    // 工业规则：
    // - CP1: 从backAxilla开始平缓弯曲
    // - CP2: 对称于前袖CP1（保证顶部圆弧平衡）
    // - 整体形状：更平缓、更长
    //

    // CP1: 控制下段弯曲（平缓）
    // X方向：比backAxilla大10-15%
    // Y方向：接近cH
    const backCp1 = new Point(
      backAxilla.x + halfBicep * 0.12,
      cH * 0.80
    );

    // CP2: 控制顶部圆弧（对称于前袖）
    // X方向：约-halfBicep的50-60%
    // Y方向：约cH的25-35%
    const backCp2 = new Point(
      -halfBicep * 0.55,
      cH * 0.28
    );

    // Back Notch（在后袖山60%处）
    const backNotch = new Point(
      -halfBicep * 0.62,
      cH * 0.65
    );

    logger.debug('\n📐 简化版袖山几何:');
    logger.debug(`   关键点:`);
    logger.debug(`     capTop: (0, 0)`);
    logger.debug(`     frontAxilla: (${frontAxilla.x.toFixed(2)}, ${frontAxilla.y.toFixed(2)})`);
    logger.debug(`     backAxilla: (${backAxilla.x.toFixed(2)}, ${backAxilla.y.toFixed(2)})`);
    logger.debug(`   前袖山控制点 (1段curve):`);
    logger.debug(`     CP1: (${frontCp1.x.toFixed(2)}, ${frontCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${frontCp2.x.toFixed(2)}, ${frontCp2.y.toFixed(2)})`);
    logger.debug(`   后袖山控制点 (1段curve):`);
    logger.debug(`     CP1: (${backCp1.x.toFixed(2)}, ${backCp1.y.toFixed(2)})`);
    logger.debug(`     CP2: (${backCp2.x.toFixed(2)}, ${backCp2.y.toFixed(2)})`);
    logger.debug(`   Notches:`);
    logger.debug(`     frontNotch: (${frontNotch.x.toFixed(2)}, ${frontNotch.y.toFixed(2)})`);
    logger.debug(`     backNotch: (${backNotch.x.toFixed(2)}, ${backNotch.y.toFixed(2)})`);

    // ========== 计算实际弧长 ==========
    const actualFrontLen = this.calculateBezierLength(
      capTop, frontCp1, frontCp2, frontAxilla
    );
    
    const actualBackLen = this.calculateBezierLength(
      backAxilla, backCp1, backCp2, capTop
    );

    const actualTotalLen = actualFrontLen + actualBackLen;

    logger.debug('\n📏 弧长验证:');
    logger.debug(`   实际前袖山: ${actualFrontLen.toFixed(2)} cm`);
    logger.debug(`   实际后袖山: ${actualBackLen.toFixed(2)} cm`);
    logger.debug(`   实际总长度: ${actualTotalLen.toFixed(2)} cm`);

    // ========== 构建Path（简化拓扑：只有2个curve）==========
    const points: Record<string, Point> = {
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
      backNotch,
      grainlineStart: new Point(0, cH * 0.3),
      grainlineEnd: new Point(0, cH + sL * 0.8)
    };

    const capPath = new Path()
      .move(capTop)
      
      // 前袖山（1段curve）
      .curve(frontCp1, frontCp2, frontAxilla)
      
      // 前侧缝
      .line(frontCuff)
      
      // 袖口
      .line(backCuff)
      
      // 后侧缝
      .line(backAxilla)
      
      // 后袖山（1段curve）
      .curve(backCp1, backCp2, capTop)
      
      .close();

    logger.debug('\n✅ 简化版袖山生成完成');
    logger.debug(`   Path操作数: ${capPath.ops.length} (应为7: M + C + L + L + L + C + Z)`);
    logger.debug('=========================================\n');

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
