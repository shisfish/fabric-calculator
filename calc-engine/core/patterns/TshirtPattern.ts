import { Point, Path, QuadraticBezier, CubicBezier } from '../geometry/index.js';

export interface GarmentParams {
  frontPanel: FrontPanelParams;
  backPanel: BackPanelParams;
  sleeve: SleeveParams;
  seamAllowance: number;
}

export interface FrontPanelParams {
  width: number;
  length: number;
  neckWidth: number;
  neckDepth: number;
  shoulderWidth: number;
  armholeDepth: number;
  shoulderSlope?: number;
}

export interface BackPanelParams {
  width: number;
  length: number;
  neckWidth: number;
  neckDepth: number;
  shoulderWidth: number;
  armholeDepth: number;
  shoulderSlope?: number;
}

export interface SleeveParams {
  width: number;
  length: number;
}

export interface PatternPiece {
  name: string;
  path: Path;
  points: Record<string, Point>;
  seamAllowance?: number;
  seamAllowancePath?: Path;
  cutCount: number;
  onFold: boolean;
  frontArmholeLength?: number;
  backArmholeLength?: number;
  allowedRotations?: number[];
  isMirrorable?: boolean;
  _custom?: boolean;
}

export class TshirtPatternGenerator {
  static generatePattern(params: GarmentParams): PatternPiece[] {
    const pieces: PatternPiece[] = [];
    
    const backPiece = this.generateBackPanel(params.backPanel, params.seamAllowance);
    const frontPiece = this.generateFrontPanel(params.frontPanel, params.seamAllowance);
    const sleevePiece = this.generateSleeve(params.sleeve, params.seamAllowance);

    pieces.push(backPiece, frontPiece, sleevePiece);
    
    return pieces;
  }

  private static generateBackPanel(bp: BackPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const { width: W, length: L, neckWidth: nW, neckDepth: nD, shoulderWidth: sW, armholeDepth: aD } = bp;

    const sSlope = bp.shoulderSlope ?? 12;
    const sDrop = Math.tan(sSlope * Math.PI / 180) * sW;

    points.cbNeck = new Point(0, nD);
    points.hps = new Point(nW, 0);
    points.shoulder = new Point(nW + sW, sDrop);
    points.armholeEnd = new Point(W, aD);
    points.sideHem = new Point(W, L);
    points.cbHem = new Point(0, L);

    const aW = W - points.shoulder.x;
    const aH = aD - sDrop;
    points.backPitch = new Point(points.shoulder.x + aW * 0.2, sDrop + aH * 0.4);
    points.bCp1 = new Point(points.backPitch.x, points.backPitch.y + aH * 0.3);
    points.bCp2 = new Point(points.armholeEnd.x - aW * 0.3, points.armholeEnd.y);

    const path = new Path()
      .move(points.cbNeck)
      .quad(new Point(nW * 0.5, nD), points.hps).segment('neckline')
      .line(points.shoulder).segment('shoulder')
      .line(points.backPitch).segment('armhole')
      .curve(points.bCp1, points.bCp2, points.armholeEnd).segment('armhole')
      .line(points.sideHem).segment('sideSeam')
      .line(points.cbHem).segment('hem')
      .close();

    const armholeLineLen = points.shoulder.distanceTo(points.backPitch);
    const armholeCurveLen = new CubicBezier(points.backPitch, points.bCp1, points.bCp2, points.armholeEnd).getLength();
    const backArmholeTotal = armholeLineLen + armholeCurveLen;

    return {
      name: 'back',
      path,
      points,
      seamAllowance,
      cutCount: 1,
      onFold: true,
      backArmholeLength: backArmholeTotal,
      allowedRotations: [0, 180],
      isMirrorable: false
    };
  }

  private static generateFrontPanel(fp: FrontPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const { width: W, length: L, neckWidth: nW, neckDepth: nD, shoulderWidth: sW, armholeDepth: aD } = fp;

    points.cfNeck = new Point(0, nD);
    points.neckEnd = new Point(nW, 0);
    points.neckCp = new Point(nW * 0.42, nD); 

    const sSlope = fp.shoulderSlope ?? 5.5;
    const sDrop = Math.tan(sSlope * Math.PI / 180) * sW;
    const shoulderX = nW + sW * 0.45;
    points.shoulder = new Point(shoulderX, sDrop);

    points.armholeEnd = new Point(W, aD);
    points.sideBottom = new Point(W, L);
    points.hemFold = new Point(0, L);
    points.hemCp = new Point(W * 0.48, L + 1);

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
      .line(points.cfNeck).segment('closure')
      .close();

    const frontArmholeUpperLen = new CubicBezier(points.shoulder, points.armholeTopCp1, points.armholeTopCp2, points.armholePitch).getLength();
    const frontArmholeLowerLen = new CubicBezier(points.armholePitch, points.armholeBottomCp1, points.armholeBottomCp2, points.armholeEnd).getLength();
    const frontArmholeTotal = frontArmholeUpperLen + frontArmholeLowerLen;

    return {
      name: 'front',
      path,
      points,
      seamAllowance,
      cutCount: 1,
      onFold: true,
      frontArmholeLength: frontArmholeTotal,
      allowedRotations: [0, 180],
      isMirrorable: false
    };
  }

  private static generateSleeve(sp: SleeveParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const { width: W, length: L } = sp;

    const capHeight = W * 0.45;
    const cuffWidth = W * 0.7;

    points.capLeft = new Point(0, 0);
    points.capRight = new Point(cuffWidth, 0);
    points.capPeak = new Point(cuffWidth / 2, -capHeight);
    points.cuffLeft = new Point((cuffWidth - W) / 2, L);
    points.cuffRight = new Point((cuffWidth + W) / 2, L);

    const cpOffsetY = capHeight * 0.6;
    points.leftCapCp1 = new Point(points.capLeft.x - 3, points.capLeft.y - cpOffsetY * 0.4);
    points.leftCapCp2 = new Point(points.capPeak.x - 8, points.capPeak.y + 3);
    
    points.rightCapCp1 = new Point(points.capRight.x + 3, points.capRight.y - cpOffsetY * 0.4);
    points.rightCapCp2 = new Point(points.capPeak.x + 8, points.capPeak.y + 3);

    const path = new Path()
      .move(points.capLeft)
      .curve(points.leftCapCp1, points.leftCapCp2, points.capPeak).segment('sleeveCap')
      .curve(points.rightCapCp2, points.rightCapCp1, points.capRight).segment('sleeveCap')
      .line(points.cuffRight).segment('backSeam')
      .line(points.cuffLeft).segment('frontSeam')
      .close();

    return {
      name: 'sleeve',
      path,
      points,
      seamAllowance,
      cutCount: 2,
      onFold: false,
      allowedRotations: [0, 180],
      isMirrorable: true
    };
  }
}
