import { Point, Path } from '../geometry/index.js';

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

export class SleeveCapGenerator {

  /**
   * 基于前后袖窿曲线生成可缝合的工业袖山
   * 
   * 核心算法:
   * 1. 计算前后袖窿的真实Bezier弧长
   * 2. 目标袖山长度 = 前袖窿 + 后袖窿 + ease (1~4cm for T-shirt)
   * 3. 动态生成控制点，迭代调整直到长度匹配
   * 
   * 工业规则:
   * - 前袖山: 更陡峭、更短（模拟手臂前倾）
   * - 后袖山: 更平缓、更长（提供背部空间）
   * - 必须包含notch标记系统
   */
  static generateFromArmhole(
    frontArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    backArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    sleeveParams: {
      bicepsWidth: number;       // 腋下半围 (cm)
      sleeveCapHeight: number;    // 袖山高度 (cm)
      sleeveLength: number;       // 袖长 (cm)
      cuffWidth: number;          // 袖口半围 (cm)
    },
    ease: number = 0.5            // 容量: T-shirt 0~1cm
  ): SleeveCapResult {

    // Step 1: 提取并计算袖窿曲线长度
    const frontCurves = this.extractCurves(frontArmholeOps);
    const backCurves = this.extractCurves(backArmholeOps);

    const frontArmholeLength = this.calculateTotalCurveLength(frontCurves);
    const backArmholeLength = this.calculateTotalCurveLength(backCurves);
    
    const targetTotalLength = frontArmholeLength + backArmholeLength + ease;

    // Step 2: 初始化基础参数
    const bW = sleeveParams.bicepsWidth;
    const cH = sleeveParams.sleeveCapHeight;
    const sL = sleeveParams.sleeveLength;
    const cuW = sleeveParams.cuffWidth;

    // Step 3: 动态生成袖山控制点（带length matching）
    const result = this.generateWithLengthMatching(
      frontArmholeLength,
      backArmholeLength,
      targetTotalLength,
      bW,
      cH,
      sL,
      cuW,
      ease,
      5  // 最大迭代次数
    );

    return result;
  }

  /**
   * 核心算法：动态生成控制点并确保长度匹配
   * 
   * 改进策略：
   * 1. 激进的outward初始值（基于长度比直接计算）
   * 2. 指数级迭代调整（快速收敛）
   * 3. 控制点位置优化（产生更大弧长）
   */
  private static generateWithLengthMatching(
    frontTargetLen: number,
    backTargetLen: number,
    totalTargetLen: number,
    bW: number,
    cH: number,
    sL: number,
    cuW: number,
    ease: number,
    maxIterations: number = 20
  ): SleeveCapResult {

    const points: Record<string, Point> = {};
    
    // 基础关键点
    points.capTop = new Point(0, 0);
    points.frontAxilla = new Point(bW / 2, cH);
    points.backAxilla = new Point(-bW / 2, cH);
    points.frontCuff = new Point(cuW / 2, cH + sL);
    points.backCuff = new Point(-cuW / 2, cH + sL);

    // 计算直线距离作为基准
    const frontStraightDist = Math.sqrt(
      Math.pow(points.frontAxilla.x - points.capTop.x, 2) +
      Math.pow(points.frontAxilla.y - points.capTop.y, 2)
    );
    
    const backStraightDist = Math.sqrt(
      Math.pow(points.backAxilla.x - points.capTop.x, 2) +
      Math.pow(points.backAxilla.y - points.capTop.y, 2)
    );
    
    const totalStraightDist = frontStraightDist + backStraightDist;

    // 计算需要的长度比
    const lengthRatio = totalTargetLen / totalStraightDist;
    
    console.log(`\n📊 长度分析:`);
    console.log(`   目标总长度: ${totalTargetLen.toFixed(2)} cm`);
    console.log(`   直线距离: ${totalStraightDist.toFixed(2)} cm`);
    console.log(`   长度比: ${lengthRatio.toFixed(3)}`);
    console.log(`   (需要曲线是直线的${lengthRatio.toFixed(2)}倍)`);

    let iteration = 0;
    let outwardMultiplier = this.calculateInitialOutward(lengthRatio, bW);
    let bestResult: SleeveCapResult | null = null;
    let minError = Infinity;

    while (iteration < maxIterations) {
      
      const currentOutwardMult = outwardMultiplier;

      // === 前袖山生成（更陡峭）- 使用2段curve ===
      const frontCap = this.generateFrontCap(
        points.capTop,
        points.frontAxilla,
        frontTargetLen,
        cH,
        bW,
        currentOutwardMult
      );

      // === 后袖山生成（更平缓）- 使用2段curve ===
      const backCap = this.generateBackCap(
        points.capTop,
        points.backAxilla,
        backTargetLen,
        cH,
        bW,
        currentOutwardMult
      );

      // 合并points
      Object.assign(points, frontCap.points);
      Object.assign(points, backCap.points);

      // 构建Path（使用2段curve）
      const capPath = new Path()
        .move(points.capTop)
        
        // 前袖山上段
        .curve(frontCap.upperCp1, frontCap.upperCp2, frontCap.pitchPoint)
        
        // 前袖山下段
        .curve(frontCap.lowerCp1, frontCap.lowerCp2, points.frontAxilla)
        
        // 袖口
        .line(points.frontCuff)
        .line(points.backCuff)
        
        // 后腋下
        .line(points.backAxilla)
        
        // 后袖山下段
        .curve(backCap.lowerCp2, backCap.lowerCp1, backCap.pitchPoint)
        
        // 后袖山上段
        .curve(backCap.upperCp2, backCap.upperCp1, points.capTop)
        
        .close();

      // 计算实际长度（2段curve的总和）
      const actualFrontUpperLen = this.calculateBezierLength(
        points.capTop, frontCap.upperCp1, frontCap.upperCp2, frontCap.pitchPoint
      );
      const actualFrontLowerLen = this.calculateBezierLength(
        frontCap.pitchPoint, frontCap.lowerCp1, frontCap.lowerCp2, points.frontAxilla
      );
      const actualFrontLen = actualFrontUpperLen + actualFrontLowerLen;
      
      const actualBackLowerLen = this.calculateBezierLength(
        points.backAxilla, backCap.lowerCp1, backCap.lowerCp2, backCap.pitchPoint
      );
      const actualBackUpperLen = this.calculateBezierLength(
        backCap.pitchPoint, backCap.upperCp1, backCap.upperCp2, points.capTop
      );
      const actualBackLen = actualBackLowerLen + actualBackUpperLen;
      
      const actualTotalLen = actualFrontLen + actualBackLen;

      // 计算误差
      const error = Math.abs(actualTotalLen - totalTargetLen);

      console.log(`  迭代 ${iteration + 1}: 总长度=${actualTotalLen.toFixed(2)}cm, 目标=${totalTargetLen.toFixed(2)}cm, 误差=${error.toFixed(2)}cm, multiplier=${currentOutwardMult.toFixed(3)}`);

      if (error < minError) {
        minError = error;
        bestResult = {
          capPath,
          points: {...points},
          frontCapLength: actualFrontLen,
          backCapLength: actualBackLen,
          totalCapLength: actualTotalLen,
          frontArmholeLength: frontTargetLen,
          backArmholeLength: backTargetLen,
          ease
        };
      }

      // 检查是否达到精度要求
      if (error <= 0.5) {
        console.log(`  ✅ 达到精度要求！`);
        break;
      }

      // 智能调整策略：根据误差大小动态调整步长
      const errorRatio = error / totalTargetLen; // 误差百分比
      
      if (actualTotalLen < totalTargetLen) {
        // 曲线太短，需要增加弯曲度
        if (errorRatio > 0.3) {
          // 误差很大，大幅增加
          outwardMultiplier *= 1.5;
        } else if (errorRatio > 0.15) {
          // 误差中等，中幅增加
          outwardMultiplier *= 1.3;
        } else {
          // 误差较小，小幅增加
          outwardMultiplier *= 1.15;
        }
      } else {
        // 曲线太长，需要减少弯曲度
        if (errorRatio > 0.3) {
          outwardMultiplier *= 0.7;
        } else if (errorRatio > 0.15) {
          outwardMultiplier *= 0.85;
        } else {
          outwardMultiplier *= 0.92;
        }
      }

      iteration++;
    }

    if (!bestResult) {
      throw new Error('无法生成符合要求的袖山');
    }

    return bestResult;
  }

  /**
   * 计算初始outward multiplier（基于长度比）
   * 
   * 核心逻辑：
   * - 如果目标长度是直线距离的1.5倍，需要较大的弯曲度
   * - 使用经验公式估算初始outward值
   */
  private static calculateInitialOutward(lengthRatio: number, bicepWidth: number): number {
    const halfBicep = bicepWidth / 2;
    
    // 经验公式：基于长度比计算基础outward比例
    let baseOutwardRatio;
    
    if (lengthRatio > 2.0) {
      // 需要非常大的弯曲度
      baseOutwardRatio = 1.8;
    } else if (lengthRatio > 1.7) {
      // 需要较大弯曲度
      baseOutwardRatio = 1.4;
    } else if (lengthRatio > 1.4) {
      // 需要中等弯曲度
      baseOutwardRatio = 1.0;
    } else {
      // 需要轻微弯曲度
      baseOutwardRatio = 0.7;
    }
    
    // 转换为实际的outward值（相对于bicepWidth的比例）
    const initialOutward = halfBicep * baseOutwardRatio;
    
    console.log(`\n🎯 初始outward计算:`);
    console.log(`   长度比: ${lengthRatio}`);
    console.log(`   基础比例: ${baseOutwardRatio}`);
    console.log(`   初始outward: ${initialOutward.toFixed(2)} cm`);
    
    return initialOutward;
  }

  /**
   * 生成前袖山控制点（更陡峭、更短）- 使用2段curve
   * 
   * 改进：
   * 1. 接受绝对outward值（而非multiplier）
   * 2. 优化控制点位置以产生更大弧长
   * 3. 确保曲线连续且平滑
   */
  private static generateFrontCap(
    top: Point,
    axilla: Point,
    targetLength: number,
    capHeight: number,
    bicepWidth: number,
    outwardAbs: number = 0  // 绝对outward值(cm)
  ): {
    upperCp1: Point;
    upperCp2: Point;
    pitchPoint: Point;
    lowerCp1: Point;
    lowerCp2: Point;
    points: Record<string, Point>
  } {

    const points: Record<string, Point> = {};
    const halfBicep = bicepWidth / 2;

    // Pitch point位置（前袖更低 - 工业标准42%）
    const pitchY = capHeight * 0.42;
    const pitchX = halfBicep * 0.35 + outwardAbs * 0.15; // pitch点也随outward外移
    const pitchPoint = new Point(pitchX, pitchY);
    points.frontPitch = pitchPoint;

    // 使用绝对outward值直接设置控制点
    const outward = outwardAbs;

    // 上段控制点（从顶点到pitch）- 更饱满的曲线
    // CP1: 向右上方突出
    points.frontUpperCp1 = new Point(
      top.x + outward * 0.70,  // 增加水平偏移
      top.y + capHeight * 0.22   // 增加垂直偏移
    );

    // CP2: 从pitch点向左上延伸
    points.frontUpperCp2 = new Point(
      pitchX + outward * 0.25,
      pitchY - capHeight * 0.08
    );

    // 下段控制点（从pitch到腋下）- 制造"凹"感
    // CP1: 从pitch向右下延伸
    points.frontLowerCp1 = new Point(
      pitchX + outward * 0.45,
      pitchY + capHeight * 0.18
    );

    // CP2: 接近腋下点，向内收缩
    points.frontLowerCp2 = new Point(
      axilla.x - outward * 0.25,
      axilla.y - capHeight * 0.12
    );

    // Notch标记（前袖山典型位置）
    points.frontNotch = new Point(
      pitchX + halfBicep * 0.10,
      pitchY + capHeight * 0.14
    );

    return {
      upperCp1: points.frontUpperCp1,
      upperCp2: points.frontUpperCp2,
      pitchPoint,
      lowerCp1: points.frontLowerCp1,
      lowerCp2: points.frontLowerCp2,
      points
    };
  }

  /**
   * 生成后袖山控制点（更平缓、更长）- 使用2段curve
   * 
   * 改进：
   * 1. 后袖山需要更大的弯曲度以达到目标长度
   * 2. 控制点位置优化以产生更长曲线
   */
  private static generateBackCap(
    top: Point,
    axilla: Point,
    targetLength: number,
    capHeight: number,
    bicepWidth: number,
    outwardAbs: number = 0  // 绝对outward值(cm)
  ): {
    upperCp1: Point;
    upperCp2: Point;
    pitchPoint: Point;
    lowerCp1: Point;
    lowerCp2: Point;
    points: Record<string, Point>
  } {

    const points: Record<string, Point> = {};
    const halfBicep = bicepWidth / 2;

    // Pitch point位置（后袖更高 - 工业标准34%）
    const pitchY = capHeight * 0.34;
    const pitchX = -halfBicep * 0.32 - outwardAbs * 0.12; // pitch点随outward左移
    const pitchPoint = new Point(pitchX, pitchY);
    points.backPitch = pitchPoint;

    // 使用绝对outward值
    const outward = outwardAbs;

    // 上段控制点（后山更饱满 - 需要更大弯曲度）
    points.backUpperCp1 = new Point(
      top.x - outward * 0.65,  // 比前袖山更大偏移
      top.y + capHeight * 0.20
    );

    points.backUpperCp2 = new Point(
      pitchX - outward * 0.30,
      pitchY - capHeight * 0.06
    );

    // 下段控制点（后腋下轻微内凹）
    points.backLowerCp1 = new Point(
      pitchX - outward * 0.48,
      pitchY + capHeight * 0.16
    );

    points.backLowerCp2 = new Point(
      axilla.x + outward * 0.30,
      axilla.y - capHeight * 0.10
    );

    // Notch标记
    points.backNotch = new Point(
      pitchX - halfBicep * 0.08,
      pitchY + capHeight * 0.12
    );

    return {
      upperCp1: points.backUpperCp1,
      upperCp2: points.backUpperCp2,
      pitchPoint,
      lowerCp1: points.backLowerCp1,
      lowerCp2: points.backLowerCp2,
      points
    };
  }

  /**
   * 从Path操作中提取Bezier曲线
   * 
   * 支持两种输入格式:
   * 1. 完整Path（包含move作为起点）
   * 2. 部分Path（从任意位置开始，使用第一个op的to作为起点）
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
        // 如果第一个操作是line且还没有prevPoint，用这个line的终点作为起点
        prevPoint = new Point(op.to.x, op.to.y);
      } else if (op.type === 'curve' && op.to && op.cp1 && op.cp2) {
        // 如果还是没有prevPoint（理论上不应该），跳过这个curve
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
        // 更新prevPoint到当前line的终点
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
   * Cubic Bezier弧长计算（数值积分法）
   * 
   * 公式: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
   * 
   * @param p0 起点
   * @param p1 控制点1
   * @param p2 控制点2  
   * @param p3 终点
   * @param segments 采样段数（默认50，精度±0.01cm）
   */
  static calculateBezierLength(
    p0: Point | {x: number; y: number},
    p1: Point | {x: number; y: number},
    p2: Point | {x: number; y: number},
    p3: Point | {x: number; y: number},
    segments: number = 50
  ): number {
    
    let length = 0;
    let prevPoint = p0;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      
      // Cubic Bezier公式
      const x = mt*mt*mt * p0.x + 3*mt*mt*t * p1.x + 3*mt*t*t * p2.x + t*t*t * p3.x;
      const y = mt*mt*mt * p0.y + 3*mt*mt*t * p1.y + 3*mt*t*t * p2.y + t*t*t * p3.y;
      
      const currPoint = {x, y};
      
      // 计算两点距离
      const dx = currPoint.x - prevPoint.x;
      const dy = currPoint.y - prevPoint.y;
      length += Math.sqrt(dx*dx + dy*dy);
      
      prevPoint = currPoint;
    }

    return length;
  }
}
