import { Point, Path, QuadraticBezier, CubicBezier } from '../geometry/index.js';
import { SeamAllowanceGenerator } from './SeamAllowanceGenerator.js';
import { GarmentParams, BackPanelParams, FrontPanelParams, SleeveParams } from './GarmentMeasurementAdapter.js';
import { SleeveCapGenerator } from './SleeveCapGenerator.js';
import { createLogger } from '../utils/CADLogger.js';

const logger = createLogger('TSHIRT-PATTERN');

export interface PatternPiece {
  name: string;
  path: Path;
  points: Record<string, Point>;
  seamAllowance?: number;
  seamAllowancePath?: Path;
  grainline?: { start: Point; end: Point };
  notches?: Point[];
  cutCount: number;
  onFold: boolean;
  
  // 袖山特有属性（工业长度匹配）
  frontCapLength?: number;
  backCapLength?: number;
  totalCapLength?: number;
  frontArmholeLength?: number;
  backArmholeLength?: number;
  ease?: number;
}

export class TshirtPatternGenerator {
  static generatePattern(params: GarmentParams): PatternPiece[] {
    const pieces: PatternPiece[] = [];
    
    const backPiece = this.generateBackPanel(params.backPanel, params.seamAllowance);
    const frontPiece = this.generateFrontPanel(params.frontPanel, params.seamAllowance);
    
    // 提取前后袖窿曲线用于生成袖子
    const frontArmholeOps = this.extractArmholeOps(frontPiece.path);
    const backArmholeOps = this.extractArmholeOps(backPiece.path);
    
    // 使用工业袖山生成器（基于袖窿反推）
    // 注意：直接使用params.sleeve中的原始尺寸（已经是最终值）
    const sleevePiece = this.generateSleeveFromArmhole(
      params.sleeve,
      params.seamAllowance,
      frontArmholeOps,
      backArmholeOps,
      (params.frontPanel.armholeDepth + params.backPanel.armholeDepth) / 2
    );

    if (params.seamAllowance && params.seamAllowance > 0) {
      const rules = [
        { segment: 'shoulder', distance: 1.0 },
        { segment: 'armhole', distance: 1.0 },
        { segment: 'sideSeam', distance: 1.2 },
        { segment: 'neckline', distance: 0.6 },
        { segment: 'hem', distance: 2.5 },
        { segment: 'sleeveHem', distance: 2.5 }
      ];

      backPiece.seamAllowancePath = SeamAllowanceGenerator.generate(backPiece.path, rules);
      frontPiece.seamAllowancePath = SeamAllowanceGenerator.generate(frontPiece.path, rules);
      sleevePiece.seamAllowancePath = SeamAllowanceGenerator.generate(sleevePiece.path, rules);
    }

    pieces.push(backPiece, frontPiece, sleevePiece);
    
    return pieces;
  }

  /**
   * 提取袖窿曲线操作（简化版）
   * 
   * 逻辑: 从shoulder开始，收集所有curve直到腋下点
   */
  private static extractArmholeOps(path: Path): Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}> {
    const ops = path.ops || [];
    const armholeOps: typeof ops = [];

    let shoulderPoint: {x: number, y: number} | null = null;

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];

      if ((op.type === 'curve' || op.type === 'quad') && op.segmentName === 'armhole') {

        if (!shoulderPoint && i > 0) {
          const prevOp = ops[i - 1];
          if (prevOp.to) {
            shoulderPoint = { x: prevOp.to.x, y: prevOp.to.y };
            armholeOps.push({ type: 'move', to: new Point(shoulderPoint.x, shoulderPoint.y) });
          }
        }

        armholeOps.push(op);
      }
    }

    return armholeOps;
  }

  /**
   * 后片 (Back Panel) - 恢复半片存储逻辑
   */
  private static generateBackPanel(bp: BackPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const { width: W, length: L, neckWidth: nW, neckDepth: nD, shoulderWidth: sW, armholeDepth: aD } = bp;

    const sSlope = bp.shoulderSlope ?? 12;
    const sDrop = Math.tan(sSlope * Math.PI / 180) * sW;

    // 关键点定义
    points.cbNeck = new Point(0, nD);
    points.hps = new Point(nW, 0);
    points.shoulder = new Point(nW + sW, sDrop);
    points.armholeEnd = new Point(W, aD);
    points.sideHem = new Point(W, L);
    points.cbHem = new Point(0, L);

    // 后袖窿控制点 - 工业比例
    const aW = W - points.shoulder.x;
    const aH = aD - sDrop;
    points.backPitch = new Point(points.shoulder.x + aW * 0.2, sDrop + aH * 0.4);
    points.bCp1 = new Point(points.backPitch.x, points.backPitch.y + aH * 0.3);
    points.bCp2 = new Point(points.armholeEnd.x - aW * 0.3, points.armholeEnd.y);

    const path = new Path()
      .move(points.cbNeck)
      .quad(new Point(nW * 0.5, nD), points.hps).segment('neckline') // 后领口
      .line(points.shoulder).segment('shoulder')
      .line(points.backPitch).segment('armhole')
      .curve(points.bCp1, points.bCp2, points.armholeEnd).segment('armhole')
      .line(points.sideHem).segment('sideSeam')
      .line(points.cbHem).segment('hem')
      .close();

    // ======================================================
    // 后片详细段长度分析（用于调试）
    // ======================================================
    logger.info('\n' + '═'.repeat(80));
    logger.info('📐 后片 (Back Panel) 详细段长度');
    logger.info('═'.repeat(80));

    const neckQuad = new QuadraticBezier(points.cbNeck, new Point(nW * 0.5, nD), points.hps);
    const neckLen = neckQuad.toCubic().getLength();
    const shoulderLen = points.cbNeck.dist(points.shoulder); // 这里应该是hps到shoulder，让我重新计算
    const shoulderLenCorrect = points.hps.dist(points.shoulder);
    const armholeLineLen = points.shoulder.dist(points.backPitch);
    const armholeCurveLen = new CubicBezier(points.backPitch, points.bCp1, points.bCp2, points.armholeEnd).getLength();
    const sideSeamLen = points.armholeEnd.dist(points.sideHem);
    const hemLen = points.sideHem.dist(points.cbHem);

    logger.info('\n【后片各段长度】');
    logger.info(`   1. 后领口 (cbNeck→hps):           ${neckLen.toFixed(2)} cm [quad]`);
    logger.info(`      控制点: (${(nW * 0.5).toFixed(1)}, ${nD.toFixed(1)})`);
    logger.info('');
    logger.info(`   2. 肩线 (hps→shoulder):            ${shoulderLenCorrect.toFixed(2)} cm [line]`);
    logger.info(`      起点: (${points.hps.x.toFixed(1)}, ${points.hps.y.toFixed(1)})`);
    logger.info(`      终点: (${points.shoulder.x.toFixed(1)}, ${points.shoulder.y.toFixed(1)})`);
    logger.info('');
    logger.info(`   3. 袖窿上段 (shoulder→backPitch):   ${armholeLineLen.toFixed(2)} cm [line] ⚠️`);
    logger.info(`      起点: (${points.shoulder.x.toFixed(1)}, ${points.shoulder.y.toFixed(1)})`);
    logger.info(`      终点: (${points.backPitch.x.toFixed(1)}, ${points.backPitch.y.toFixed(1)})`);
    logger.info('');
    logger.info(`   4. 袖窿下段 (backPitch→armholeEnd): ${armholeCurveLen.toFixed(2)} cm [curve]`);
    logger.info(`      控制点: bCp1(${points.bCp1.x.toFixed(1)}, ${points.bCp1.y.toFixed(1)}) → bCp2(${points.bCp2.x.toFixed(1)}, ${points.bCp2.y.toFixed(1)})`);
    logger.info('');
    logger.info(`   5. 侧缝 (armholeEnd→sideHem):      ${sideSeamLen.toFixed(2)} cm [line]`);
    logger.info(`      长度: ${L.toFixed(1)} - ${aD.toFixed(1)} = ${(L - aD).toFixed(1)} cm`);
    logger.info('');
    logger.info(`   6. 下摆 (sideHem→cbHem):          ${hemLen.toFixed(2)} cm [line]`);
    logger.info(`      宽度: ${W.toFixed(1)} cm`);

    const totalBackLen = neckLen + shoulderLenCorrect + armholeLineLen + armholeCurveLen + sideSeamLen + hemLen;
    const backArmholeTotal = armholeLineLen + armholeCurveLen;

    logger.info('\n【后片汇总】');
    logger.info(`   总周长: ${totalBackLen.toFixed(2)} cm`);
    logger.info(`   袖窿总长: ${backArmholeTotal.toFixed(2)} cm (直线${armholeLineLen.toFixed(2)} + 曲线${armholeCurveLen.toFixed(2)})`);
    logger.info(`   宽×高: ${W} × ${L} cm`);
    logger.info('═'.repeat(80) + '\n');

    return { 
      name: 'back', 
      path, 
      points, 
      seamAllowance, 
      cutCount: 1, 
      onFold: true,
      backArmholeLength: backArmholeTotal
    };
  }

  /**
   * 前片 (Front Panel) - 还原为你最初的逻辑
   */
  private static generateFrontPanel(fp: FrontPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const { width: W, length: L, neckWidth: nW, neckDepth: nD, shoulderWidth: sW, armholeDepth: aD } = fp;

    // 1. 领口与肩点
    points.cfNeck = new Point(0, nD);
    points.neckEnd = new Point(nW, 0);
    points.neckCp = new Point(nW * 0.42, nD); 

    const sSlope = fp.shoulderSlope ?? 5.5;
    const sDrop = Math.tan(sSlope * Math.PI / 180) * sW;
    const shoulderX = nW + sW * 0.45; // 遵循你原有的比例
    points.shoulder = new Point(shoulderX, sDrop);

    // 2. 腋下与下摆
    points.armholeEnd = new Point(W, aD);
    points.sideBottom = new Point(W, L);
    points.hemFold = new Point(0, L);
    points.hemCp = new Point(W * 0.48, L + 1);

    // 3. 袖窿两段式逻辑 (回退到你认可的版本)
    const aW = W - shoulderX;
    const aH = aD - sDrop;
    points.armholePitch = new Point(shoulderX + aW * 0.15, sDrop + aH * 0.35);

    points.armholeTopCp1 = new Point(points.shoulder.x + aW * 0.05, points.shoulder.y + aH * 0.15);
    points.armholeTopCp2 = new Point(points.armholePitch.x - aW * 0.1, points.armholePitch.y - aH * 0.15);

    const tX = points.armholePitch.x - points.armholeTopCp2.x;
    const tY = points.armholePitch.y - points.armholeTopCp2.y;
    points.armholeBottomCp1 = new Point(points.armholePitch.x + tX * 1.5, points.armholePitch.y + tY * 1.5);
    points.armholeBottomCp2 = new Point(points.armholeEnd.x - aW * 0.45, points.armholeEnd.y);

    const path = new Path()
      .move(points.cfNeck)
      .quad(points.neckCp, points.neckEnd).segment('neckline')
      .line(points.shoulder).segment('shoulder')
      .curve(points.armholeTopCp1, points.armholeTopCp2, points.armholePitch).segment('armhole')
      .curve(points.armholeBottomCp1, points.armholeBottomCp2, points.armholeEnd).segment('armhole')
      .line(points.sideBottom).segment('sideSeam')
      .quad(points.hemCp, points.hemFold).segment('hem')
      .close();

    // ======================================================
    // 前片详细段长度分析（用于调试）
    // ======================================================
    logger.info('\n' + '═'.repeat(80));
    logger.info('📐 前片 (Front Panel) 详细段长度');
    logger.info('═'.repeat(80));

    const frontNeckQuad = new QuadraticBezier(points.cfNeck, points.neckCp, points.neckEnd);
    const frontNeckLen = frontNeckQuad.toCubic().getLength();
    const frontShoulderLen = points.neckEnd.dist(points.shoulder);
    const frontArmholeUpperLen = new CubicBezier(points.shoulder, points.armholeTopCp1, points.armholeTopCp2, points.armholePitch).getLength();
    const frontArmholeLowerLen = new CubicBezier(points.armholePitch, points.armholeBottomCp1, points.armholeBottomCp2, points.armholeEnd).getLength();
    const frontSideSeamLen = points.armholeEnd.dist(points.sideBottom);
    const frontHemQuad = new QuadraticBezier(points.sideBottom, points.hemCp, points.hemFold);
    const frontHemLen = frontHemQuad.toCubic().getLength();

    logger.info('\n【前片各段长度】');
    logger.info(`   1. 前领口 (cfNeck→neckEnd):        ${frontNeckLen.toFixed(2)} cm [quad]`);
    logger.info(`      控制点: (${points.neckCp.x.toFixed(1)}, ${points.neckCp.y.toFixed(1)})`);
    logger.info('');
    logger.info(`   2. 肩线 (neckEnd→shoulder):         ${frontShoulderLen.toFixed(2)} cm [line]`);
    logger.info(`      起点: (${points.neckEnd.x.toFixed(1)}, ${points.neckEnd.y.toFixed(1)})`);
    logger.info(`      终点: (${points.shoulder.x.toFixed(1)}, ${points.shoulder.y.toFixed(1)})`);
    logger.info('');
    logger.info(`   3. 袖窿上段 (shoulder→armholePitch): ${frontArmholeUpperLen.toFixed(2)} cm [curve]`);
    logger.info(`      控制点: (${points.armholeTopCp1.x.toFixed(1)}, ${points.armholeTopCp1.y.toFixed(1)}) → (${points.armholeTopCp2.x.toFixed(1)}, ${points.armholeTopCp2.y.toFixed(1)})`);
    logger.info('');
    logger.info(`   4. 袖窿下段 (armholePitch→armholeEnd): ${frontArmholeLowerLen.toFixed(2)} cm [curve]`);
    logger.info(`      控制点: (${points.armholeBottomCp1.x.toFixed(1)}, ${points.armholeBottomCp1.y.toFixed(1)}) → (${points.armholeBottomCp2.x.toFixed(1)}, ${points.armholeBottomCp2.y.toFixed(1)})`);
    logger.info('');
    logger.info(`   5. 侧缝 (armholeEnd→sideBottom):    ${frontSideSeamLen.toFixed(2)} cm [line]`);
    logger.info(`      长度: ${L.toFixed(1)} - ${aD.toFixed(1)} = ${(L - aD).toFixed(1)} cm`);
    logger.info('');
    logger.info(`   6. 下摆 (sideBottom→hemFold):       ${frontHemLen.toFixed(2)} cm [quad]`);
    logger.info(`      控制点: (${points.hemCp.x.toFixed(1)}, ${points.hemCp.y.toFixed(1)})`);

    const totalFrontLen = frontNeckLen + frontShoulderLen + frontArmholeUpperLen + frontArmholeLowerLen + frontSideSeamLen + frontHemLen;
    const frontArmholeTotal = frontArmholeUpperLen + frontArmholeLowerLen;

    logger.info('\n【前片汇总】');
    logger.info(`   总周长: ${totalFrontLen.toFixed(2)} cm`);
    logger.info(`   袖窿总长: ${frontArmholeTotal.toFixed(2)} cm (上段${frontArmholeUpperLen.toFixed(2)} + 下段${frontArmholeLowerLen.toFixed(2)})`);
    logger.info(`   宽×高: ${W} × ${L} cm`);
    logger.info('═'.repeat(80) + '\n');

    return { 
      name: 'front', 
      path, 
      points, 
      seamAllowance, 
      cutCount: 1, 
      onFold: true,
      frontArmholeLength: frontArmholeTotal
    };
  }

  /**
   * 袖子 (Sleeve) - 基于前后袖窿曲线反推生成的工业袖山
   * 
   * 核心算法:
   * 1. 提取前后袖窿Bezier曲线
   * 2. 计算袖窿真实弧长
   * 3. 动态生成控制点确保: sleeve cap length = armhole length + ease (±0.5cm)
   */
  private static generateSleeveFromArmhole(
    sl: SleeveParams,
    seamAllowance: number,
    frontArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    backArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    armholeDepth: number
  ): PatternPiece {

    // 🔍 【调试日志】输入参数检查
    logger.debug('\n🔍 ===== generateSleeveFromArmhole 输入检查 =====');
    logger.debug(`   frontArmholeOps数量: ${frontArmholeOps.length}`);
    if (frontArmholeOps.length > 0) {
      logger.debug(`   frontArmholeOps类型:`);
      for (let i = 0; i < Math.min(frontArmholeOps.length, 5); i++) {
        const op = frontArmholeOps[i];
        logger.debug(`     [${i}] ${op.type}`);
      }
    }
    logger.debug(`   backArmholeOps数量: ${backArmholeOps.length}`);
    if (backArmholeOps.length > 0) {
      logger.debug(`   backArmholeOps类型:`);
      for (let i = 0; i < Math.min(backArmholeOps.length, 5); i++) {
        const op = backArmholeOps[i];
        logger.debug(`     [${i}] ${op.type}`);
      }
    }

    // 使用原始参数（直接来自前端输入，不被GarmentMeasurementAdapter错误放大）
    const bW = Number(sl.bicepsWidth);
    const cH = Number(sl.sleeveCapHeight);
    const sL = Number(sl.sleeveLength);
    const cuW = Number(sl.cuffWidth);

    logger.info('\n👕 袖子参数 (来自页面输入):');
    logger.info(`   🔍 [原始输入] sl.cuffWidth = ${sl.cuffWidth} (类型: ${typeof sl.cuffWidth})`);
    logger.info(`   🔍 [转换后] cuW = Number(sl.cuffWidth) = ${cuW}`);
    logger.info(`   腋下半围(bicepsWidth): ${bW} cm`);
    logger.info(`   袖山高度(capHeight): ${cH} cm`);
    logger.info(`   袖长(sleeveLength): ${sL} cm`);
    logger.info(`   袖口半围(cuffWidth): ${cuW} cm`);

    // 使用SleeveCapGenerator生成基于袖窿的可缝合袖山
    const sleeveResult = SleeveCapGenerator.generateFromArmhole(
      frontArmholeOps,
      backArmholeOps,
      {
        bicepsWidth: bW,
        sleeveCapHeight: cH,
        sleeveLength: sL,
        cuffWidth: cuW
      },
      2.0, // 默认使用 2.0cm ease
      armholeDepth
    );

    // 🔍 【调试日志】sleeveResult完整性检查
    logger.debug('\n🔍 ===== sleeveResult 完整性检查 =====');
    logger.debug(`   sleeveResult存在: ${!!sleeveResult}`);
    if (sleeveResult) {
      logger.debug(`   capPath存在: ${!!sleeveResult.capPath}`);
      if (sleeveResult.capPath && sleeveResult.capPath.ops) {
        logger.debug(`   capPath.ops数量: ${sleeveResult.capPath.ops.length}`);
      }
      logger.debug(`   points存在: ${!!sleeveResult.points}`);
      if (sleeveResult.points) {
        logger.debug(`   points keys数量: ${Object.keys(sleeveResult.points).length}`);
        logger.debug(`   points keys: ${Object.keys(sleeveResult.points).join(', ')}`);
      }
      logger.debug(`   frontCapLength: ${sleeveResult.frontCapLength?.toFixed(2)} cm`);
      logger.debug(`   backCapLength: ${sleeveResult.backCapLength?.toFixed(2)} cm`);
      logger.debug(`   totalCapLength: ${sleeveResult.totalCapLength?.toFixed(2)} cm`);
    }

    logger.debug('\n📏 袖山长度匹配结果:');
    logger.debug(`   前袖窿长度: ${sleeveResult.frontArmholeLength.toFixed(2)} cm`);
    logger.debug(`   后袖窿长度: ${sleeveResult.backArmholeLength.toFixed(2)} cm`);
    logger.debug(`   目标袖山长度: ${sleeveResult.totalCapLength.toFixed(2)} cm (含ease=${sleeveResult.ease}cm)`);
    logger.debug(`   实际前袖山: ${sleeveResult.frontCapLength.toFixed(2)} cm`);
    logger.debug(`   实际后袖山: ${sleeveResult.backCapLength.toFixed(2)} cm`);

    const lengthDiff = Math.abs(sleeveResult.totalCapLength - (sleeveResult.frontArmholeLength + sleeveResult.backArmholeLength + sleeveResult.ease));
    
    if (lengthDiff <= 0.5) {
      logger.info(`   ✅ 长度匹配成功！误差=${lengthDiff.toFixed(2)}cm`);
    } else {
      logger.warn(`   ⚠️ 长度差异: ${lengthDiff.toFixed(2)}cm (可接受范围±0.5cm)`);
    }

    // 添加grainline和notches（如果还没有的话）
    const points = {...sleeveResult.points};
    
    if (!points.grainline) {
      const totalL = cH + sL;
      points.grainlineStart = new Point(0, cH * 0.3);
      points.grainlineEnd = new Point(0, totalL * 0.8);
    }

    const sleevePiece: PatternPiece = {
      name: 'sleeve',
      path: sleeveResult.capPath,
      points,
      seamAllowance,
      cutCount: 2,
      onFold: false,
      grainline: points.grainline ?
        {start: points.grainlineStart, end: points.grainlineEnd} : undefined,
      notches: [points.frontNotch, points.backNotch].filter(p => p !== undefined),
      
      // 工业长度匹配数据
      frontCapLength: sleeveResult.frontCapLength,
      backCapLength: sleeveResult.backCapLength,
      totalCapLength: sleeveResult.totalCapLength,
      frontArmholeLength: sleeveResult.frontArmholeLength,
      backArmholeLength: sleeveResult.backArmholeLength,
      ease: sleeveResult.ease
    };

    // 🔍 【调试日志】最终sleevePiece输出检查
    logger.debug('\n🎯 ===== 最终 sleevePiece 输出 =====');
    logger.debug(`   name: ${sleevePiece.name}`);
    logger.debug(`   path存在: ${!!sleevePiece.path}`);
    if (sleevePiece.path && sleevePiece.path.ops) {
      logger.debug(`   path.ops数量: ${sleevePiece.path.ops.length}`);
    }
    logger.debug(`   points存在: ${!!sleevePiece.points}`);
    if (sleevePiece.points) {
      logger.debug(`   points数量: ${Object.keys(sleevePiece.points).length}`);
    }
    logger.debug(`   seamAllowance: ${sleevePiece.seamAllowance}`);
    logger.debug(`   cutCount: ${sleevePiece.cutCount}`);
    logger.debug(`   onFold: ${sleevePiece.onFold}`);
    logger.debug(`   grainline存在: ${!!sleevePiece.grainline}`);
    logger.debug(`   notches数量: ${sleevePiece.notches?.length || 0}`);
    logger.debug('=========================================\n');

    return sleevePiece;
  }
}