import { Point, Path } from '../geometry/index.js';
import { SeamAllowanceGenerator } from './SeamAllowanceGenerator.js';
import { GarmentParams, BackPanelParams, FrontPanelParams, SleeveParams } from './GarmentMeasurementAdapter.js';
import { SleeveCapGenerator } from './SleeveCapGenerator.js';

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

  private static extractArmholeOps(path: Path): Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}> {
    const ops = path.ops || [];
    const armholeOps: typeof ops = [];
    
    let foundShoulder = false;
    let collectingArmhole = false;
    
    for (const op of ops) {
      if (op.type === 'line' && op.to) {
        if (!foundShoulder && op.to.y > 0) {
          foundShoulder = true;
          collectingArmhole = true;
        } else if (collectingArmhole && op.to.y > (ops[0]?.to?.y || 0)) {
          break;
        }
      }
      
      if (collectingArmhole) {
        armholeOps.push(op);
        
        if (op.type === 'line' && op.to && !op.cp1 && !op.cp2) {
          // 检查是否到达腋下点（armholeEnd）
          const prevOps = armholeOps.slice(0, -1);
          const hasCurve = prevOps.some(p => p.type === 'curve');
          if (hasCurve && armholeOps.length > 2) {
            break;
          }
        }
      }
    }
    
    // 如果上面的逻辑没找到，用简单方法：提取所有curve操作
    if (armholeOps.length === 0) {
      let inArmholeSection = false;
      for (const op of ops) {
        if (op.type === 'line' && op.to && op.to.y < (path.ops?.[0]?.to?.y || 999)) {
          inArmholeSection = true;
        }
        if (inArmholeSection) {
          armholeOps.push(op);
          if (op.type === 'line' && op.to && !op.cp1) {
            // 到达侧缝线，停止
            break;
          }
        }
      }
    }
    
    return armholeOps.length > 0 ? armholeOps : ops.filter(op => op.type === 'curve');
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
   * 袖子 (Sleeve) - 基于袖窿反推的工业袖山生成器
   */
  private static generateSleeveFromArmhole(
    sl: SleeveParams,
    seamAllowance: number,
    frontArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    backArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>
  ): PatternPiece {

    const bW = Number(sl.bicepsWidth);
    const cH = Number(sl.sleeveCapHeight);
    const sL = Number(sl.sleeveLength);
    const cuW = Number(sl.cuffWidth);

    // 使用工业袖山生成器
    const sleeveResult = SleeveCapGenerator.generateFromArmhole(
      frontArmholeOps,
      backArmholeOps,
      {
        bicepsWidth: bW,
        sleeveCapHeight: cH,
        sleeveLength: sL,
        cuffWidth: cuW
      },
      0.5 // T-shirt ease: 0~1cm
    );

    // 添加notches到points
    const points = { ...sleeveResult.points };
    
    // 添加grainline
    const grainline = {
      start: new Point(0, cH * 0.3),
      end: new Point(0, cH + sL * 0.7)
    };

    return {
      name: 'sleeve',
      path: sleeveResult.capPath,
      points,
      seamAllowance,
      cutCount: 2,
      onFold: false,
      grainline,
      notches: [points.frontNotch, points.backNotch].filter(p => p)
    };
  }
}