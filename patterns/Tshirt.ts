import { Point, Path } from '../geometry/index.js';
import { GarmentParams, BackPanelParams, FrontPanelParams, SleeveParams } from './GarmentMeasurementAdapter.js';

export interface PatternPiece {
  name: string;
  path: Path;
  points: Record<string, Point>;
  seamAllowance?: number;
  grainline?: { start: Point; end: Point };
  notches?: Point[];
  cutCount: number;
  onFold: boolean;
}

export class TshirtPatternGenerator {
  static generatePattern(params: GarmentParams): PatternPiece[] {
    const pieces: PatternPiece[] = [];
    
    pieces.push(this.generateBackPanel(params.backPanel, params.seamAllowance));
    pieces.push(this.generateFrontPanel(params.frontPanel, params.seamAllowance));
    
    // 袖子逻辑：传入前后片参数以保持几何关联
    pieces.push(this.generateSleeve(params.sleeve, params.seamAllowance));
    
    return pieces;
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
   * 袖子 (Sleeve) - 调整为非对称工业结构
   */
  private static generateSleeve(sl: SleeveParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const bW = Number(sl.bicepsWidth);
    const cH = Number(sl.sleeveCapHeight);
    const sL = Number(sl.sleeveLength);
    const cuW = Number(sl.cuffWidth);
    const totalL = cH + sL;

    // 以袖山顶点为原点 (0,0)
    points.capTop = new Point(0, 0);
    points.frontAxilla = new Point(bW / 2, cH);
    points.backAxilla = new Point(-bW / 2, cH);
    points.frontCuff = new Point(cuW / 2, totalL);
    points.backCuff = new Point(-cuW / 2, totalL);

    // --- 前袖山曲线 (更凹，配合前袖窿) ---
    points.fCp1 = new Point(bW * 0.2, 0);
    points.fCp2 = new Point(bW * 0.4, cH * 0.1);
    points.fPitch = new Point(bW * 0.35, cH * 0.5);
    points.fCp3 = new Point(bW * 0.3, cH * 0.9);

    // --- 后袖山曲线 (更饱满，配合后袖窿) ---
    points.bCp1 = new Point(-bW * 0.15, 0);
    points.bCp2 = new Point(-bW * 0.45, cH * 0.2);
    points.bCp3 = new Point(-bW * 0.4, cH * 0.8);

    const path = new Path()
      .move(points.capTop)
      .curve(points.fCp1, points.fCp2, points.fPitch)
      .curve(points.fCp3, new Point(bW / 2, cH), points.frontAxilla)
      .line(points.frontCuff)
      .line(points.backCuff)
      .line(points.backAxilla)
      .curve(points.bCp3, points.bCp2, points.capTop)
      .close();

    return { 
      name: 'sleeve', 
      path, 
      points, 
      seamAllowance, 
      cutCount: 2, 
      onFold: false 
    };
  }
}