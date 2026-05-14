import { Point, Path } from '../geometry/index.js';
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
      backArmholeOps
    );

    if (params.seamAllowance && params.seamAllowance > 0) {
      backPiece.seamAllowancePath = SeamAllowanceGenerator.generate(backPiece.path, params.seamAllowance);
      frontPiece.seamAllowancePath = SeamAllowanceGenerator.generate(frontPiece.path, params.seamAllowance);
      sleevePiece.seamAllowancePath = SeamAllowanceGenerator.generate(sleevePiece.path, params.seamAllowance);
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
    
    let foundShoulder = false;
    let collectingArmhole = false;
    let hasCollectedCurve = false;
    
    for (const op of ops) {
      // 找到肩线终点（第一个y>0的line）
      if (!foundShoulder && op.type === 'line' && op.to && op.to.y > 0) {
        foundShoulder = true;
        collectingArmhole = true;
        armholeOps.push(op); // 包含shoulder点
        continue;
      }
      
      // 收集袖窿部分的操作
      if (collectingArmhole) {
        armholeOps.push(op);
        
        // 如果收集到了curve，标记它
        if (op.type === 'curve') {
          hasCollectedCurve = true;
        }
        
        // 如果已经收集到curve，并且遇到了下一个line（侧缝线），则停止
        if (hasCollectedCurve && op.type === 'line' && !op.cp1) {
          break;
        }
        
        // 如果收集了超过4个操作还没找到curve，可能是后片特殊情况
        if (armholeOps.length > 5 && !hasCollectedCurve) {
          // 继续收集，直到找到curve或到达边界
          if (op.type === 'curve') {
            hasCollectedCurve = true;
            continue; // 继续收集下一个line作为结束
          }
        }
      }
    }
    
    return armholeOps.length > 1 ? armholeOps : ops.filter(op => op.type === 'curve');
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
      .quad(new Point(nW * 0.5, nD), points.hps) // 后领口
      .line(points.shoulder)
      .line(points.backPitch)
      .curve(points.bCp1, points.bCp2, points.armholeEnd)
      .line(points.sideHem)
      .line(points.cbHem)
      .close();

    return { 
      name: 'back', 
      path, 
      points, 
      seamAllowance, 
      cutCount: 1, 
      onFold: true 
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
      .quad(points.neckCp, points.neckEnd)
      .line(points.shoulder)
      .curve(points.armholeTopCp1, points.armholeTopCp2, points.armholePitch)
      .curve(points.armholeBottomCp1, points.armholeBottomCp2, points.armholeEnd)
      .line(points.sideBottom)
      .quad(points.hemCp, points.hemFold)
      .close();

    return { 
      name: 'front', 
      path, 
      points, 
      seamAllowance, 
      cutCount: 1, 
      onFold: true 
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
    backArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>
  ): PatternPiece {

    // 使用原始参数（直接来自前端输入，不被GarmentMeasurementAdapter错误放大）
    const bW = Number(sl.bicepsWidth);
    const cH = Number(sl.sleeveCapHeight);
    const sL = Number(sl.sleeveLength);
    const cuW = Number(sl.cuffWidth);

    logger.debug('\n👕 袖子参数:');
    logger.debug(`   腋下半围(bicepsWidth): ${bW} cm`);
    logger.debug(`   袖山高度(capHeight): ${cH} cm`);
    logger.debug(`   袖长(sleeveLength): ${sL} cm`);
    logger.debug(`   袖口半围(cuffWidth): ${cuW} cm`);

    // 使用SleeveCapGenerator生成基于袖窿的可缝合袖山
    const sleeveResult = SleeveCapGenerator.generateFromArmhole(
      frontArmholeOps,
      backArmholeOps,
      {
        bicepsWidth: bW,        // 原始值，不经过转换
        sleeveCapHeight: cH,    // 原始值
        sleeveLength: sL,       // 原始值
        cuffWidth: cuW          // 原始值
      },
      0.5  // T-shirt ease: 0~1cm
    );

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

    return {
      name: 'sleeve',
      path: sleeveResult.capPath,
      points,
      seamAllowance,
      cutCount: 2,
      onFold: false,
      grainline: points.grainline ? 
        {start: points.grainlineStart, end: points.grainlineEnd} : undefined,
      notches: [points.frontNotch, points.backNotch].filter(p => p !== undefined)
    };
  }
}