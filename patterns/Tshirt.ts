import { Point, Path } from '../geometry/index.js';
import { SeamAllowanceGenerator } from './SeamAllowanceGenerator.js';
import { GarmentParams, BackPanelParams, FrontPanelParams, SleeveParams } from './GarmentMeasurementAdapter.js';

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
    
    // 袖子逻辑：传入前后片参数以保持几何关联
    const sleevePiece = this.generateSleeve(params.sleeve, params.seamAllowance);

    if (params.seamAllowance && params.seamAllowance > 0) {
      backPiece.seamAllowancePath = SeamAllowanceGenerator.generate(backPiece.path, params.seamAllowance);
      frontPiece.seamAllowancePath = SeamAllowanceGenerator.generate(frontPiece.path, params.seamAllowance);
      sleevePiece.seamAllowancePath = SeamAllowanceGenerator.generate(sleevePiece.path, params.seamAllowance);
    }

    pieces.push(backPiece, frontPiece, sleevePiece);
    
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
  private static generateSleeve(
    sl: SleeveParams,
    seamAllowance: number
  ): PatternPiece {

    const points: Record<string, Point> = {};

    const bW = Number(sl.bicepsWidth);
    const cH = Number(sl.sleeveCapHeight);
    const sL = Number(sl.sleeveLength);
    const cuW = Number(sl.cuffWidth);

    const totalL = cH + sL;

    // =========================
    // Base points
    // =========================

    points.capTop = new Point(0, 0);

    points.frontAxilla = new Point(
      bW / 2,
      cH
    );

    points.backAxilla = new Point(
      -bW / 2,
      cH
    );

    points.frontCuff = new Point(
      cuW / 2,
      totalL
    );

    points.backCuff = new Point(
      -cuW / 2,
      totalL
    );

    // =========================
    // Pitch points
    // =========================

    // 前袖更凹
    points.frontPitch = new Point(
      bW * 0.28,
      cH * 0.42
    );

    // 后袖更饱满
    points.backPitch = new Point(
      -bW * 0.32,
      cH * 0.34
    );

    // =========================
    // Front sleeve cap (前袖山：更剧烈的S曲线)
    // =========================
    // 上段：从顶点出来，先保持水平再向下突起
    points.frontTopCp1 = new Point(
      bW * 0.10,
      cH * 0.02
    );

    points.frontTopCp2 = new Point(
      bW * 0.24,
      cH * 0.08
    );

    // 下段：进入腋下，强制向内收缩，制造“凹”感
    points.frontBottomCp1 = new Point(
      bW * 0.34,
      cH * 0.52
    );

    points.frontBottomCp2 = new Point(
      bW * 0.48,
      cH * 0.82
    );
    // =========================
    // Back sleeve cap (后袖山：较平缓的S曲线)
    // =========================
    // 上段：后山要更饱满，凸起更明显
    points.backTopCp1 = new Point(
      -bW * 0.12,
      cH * 0.03
    );

    points.backTopCp2 = new Point(
      -bW * 0.26,
      cH * 0.10
    );
    // 下段：后腋下也要有轻微内凹
    points.backBottomCp1 = new Point(
      -bW * 0.38,
      cH * 0.50
    );

    points.backBottomCp2 = new Point(
      -bW * 0.54,
      cH * 0.84
    );
    // =========================
    // Build path
    // =========================

    const path = new Path()

      // cap top
      .move(points.capTop)

      // front upper cap
      .curve(
        points.frontTopCp1,
        points.frontTopCp2,
        points.frontPitch
      )

      // front lower cap
      .curve(
        points.frontBottomCp1,
        points.frontBottomCp2,
        points.frontAxilla
      )

      // cuff
      .line(points.frontCuff)
      .line(points.backCuff)

      // back underarm
      .line(points.backAxilla)

      // back lower cap
      .curve(
        points.backBottomCp2,
        points.backBottomCp1,
        points.backPitch
      )

      // back upper cap
      .curve(
        points.backTopCp2,
        points.backTopCp1,
        points.capTop
      )

      .close();

    path.attr('class', 'fabric sleeve');

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