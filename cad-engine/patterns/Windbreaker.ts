import { Point, Path, QuadraticBezier, CubicBezier } from '../geometry/index.js';
import { SeamAllowanceGenerator } from './SeamAllowanceGenerator.js';
import type { PatternPiece } from './Tshirt.js';
import { createLogger } from '../utils/CADLogger.js';

const logger = createLogger('WINDBREAKER-PATTERN');

export interface WindbreakerParams {
  category: 'windbreaker';

  backPanel: WindbreakerBackPanelParams;
  frontPanel: WindbreakerFrontPanelParams;
  sleeve: WindbreakerSleeveParams;

  collar?: WindbreakerCollarParams;
  seamAllowance: number;

  hasStormFlap?: boolean;
  hasBelt?: boolean;
  hasEpaulettes?: boolean;
}

export interface WindbreakerBackPanelParams {
  width: number;
  length: number;
  neckWidth: number;
  neckDepth: number;
  shoulderWidth: number;
  shoulderSlope: number;
  armholeDepth: number;
  yokeDepth?: number;
  ventLength?: number;
  hemExtension: number;
}

export interface WindbreakerFrontPanelParams {
  width: number;
  length: number;
  neckWidth: number;
  neckDepth: number;
  shoulderWidth: number;
  shoulderSlope: number;
  armholeDepth: number;
  yokeDepth?: number;
  placketWidth?: number;
  hemExtension: number;
  hemWidth?: number;
}

export interface WindbreakerSleeveParams {
  bicepsWidth: number;
  cuffWidth: number;
  sleeveLength: number;
  sleeveCapHeight: number;
  capDepthRatio?: number;
}

export interface WindbreakerCollarParams {
  collarWidth: number;
  standHeight: number;
  collarLength: number;
}

export const DEFAULT_WINDBREAKER_INPUT = {
  garment: 'classic_windbreaker',
  back: {
    chestWidth: 53,
    bodyLength: 88,
    shoulderWidth: 22,
    neckWidth: 10,
    neckDrop: 3,
    armholeDepth: 36,
    yokeDepth: 12,
    ventLength: 18,
  },
  front: {
    chestWidth: 53,
    bodyLength: 88,
    shoulderWidth: 21,
    neckWidth: 10,
    neckDrop: 10,
    armholeDepth: 35,
    yokeDepth: 12,
    placketWidth: 6,
  },
  sleeve: {
    sleeveLength: 64,
    bicepWidth: 44,
    cuffWidth: 30,
    sleeveCapHeight: 17,
  },
  collar: {
    collarWidth: 8,
    standHeight: 4,
    collarLength: 44,
  }
};

export class WindbreakerPatternGenerator {

  static generatePattern(params: WindbreakerParams): PatternPiece[] {
    const pieces: PatternPiece[] = [];

    logger.info('\n🧥 ===== 风衣裁片生成开始 =====');
    logger.info(`   品类: ${params.category}`);
    logger.info(`   后片尺寸: ${params.backPanel.width}×${params.backPanel.length}cm`);
    logger.info(`   前片尺寸: ${params.frontPanel.width}×${params.frontPanel.length}cm`);
    logger.info(`   袖子尺寸: 长${params.sleeve.sleeveLength}cm, 袖肥${params.sleeve.bicepsWidth}cm`);

    const backPiece = this.generateBackPanel(params.backPanel, params.seamAllowance);
    const frontPiece = this.generateFrontPanel(params.frontPanel, params.seamAllowance);

    const frontArmholeOps = this.extractArmholeOps(frontPiece.path);
    const backArmholeOps = this.extractArmholeOps(backPiece.path);

    const sleevePiece = this.generateSleeveFromArmhole(
      params.sleeve,
      params.seamAllowance,
      frontArmholeOps,
      backArmholeOps,
      (params.frontPanel.armholeDepth + params.backPanel.armholeDepth) / 2
    );

    if (params.seamAllowance && params.seamAllowance > 0) {
      const sa = params.seamAllowance;

      const backRules = [
        { segment: 'neckline', distance: sa },
        { segment: 'shoulder', distance: sa },
        { segment: 'yoke', distance: sa },
        { segment: 'armhole', distance: sa },
        { segment: 'sideSeam', distance: sa },
        { segment: 'vent', distance: sa },
        { segment: 'hem', distance: sa * 2.5 },
      ];

      const frontRules = [
        { segment: 'neckline', distance: sa },
        { segment: 'lapel', distance: sa },
        { segment: 'shoulder', distance: sa },
        { segment: 'yoke', distance: sa },
        { segment: 'armhole', distance: sa },
        { segment: 'sideSeam', distance: sa },
        { segment: 'placket', distance: sa },
        { segment: 'hem', distance: sa * 2.5 },
        { segment: 'closure', distance: sa },
      ];

      const sleeveRules = [
        { segment: 'sleeveCap', distance: sa },
        { segment: 'frontSeam', distance: sa },
        { segment: 'backSeam', distance: sa },
        { segment: 'sleeveHem', distance: sa * 2.5 },
      ];

      logger.info(`   ✅ 风衣缝份生成...`);
      backPiece.seamAllowancePath = SeamAllowanceGenerator.generate(backPiece.path, backRules);
      frontPiece.seamAllowancePath = SeamAllowanceGenerator.generate(frontPiece.path, frontRules);
      sleevePiece.seamAllowancePath = SeamAllowanceGenerator.generate(sleevePiece.path, sleeveRules);
    }

    pieces.push(backPiece, frontPiece, sleevePiece);

    if (params.collar) {
      const collarPiece = this.generateCollar(params.collar, params.seamAllowance);
      pieces.push(collarPiece);

      if (params.seamAllowance && params.seamAllowance > 0) {
        const collarRules = [
          { segment: 'collarEdge', distance: params.seamAllowance },
          { segment: 'centerBack', distance: 0 },
          { segment: 'collarStand', distance: params.seamAllowance },
        ];
        collarPiece.seamAllowancePath = SeamAllowanceGenerator.generate(collarPiece.path, collarRules);
      }
    }

    logger.info(`\n🧥 ===== 风衣裁片生成完成: ${pieces.length}个主裁片 =====\n`);

    return pieces;
  }

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

  private static generateBackPanel(bp: WindbreakerBackPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const { width: W, length: L, neckWidth: nW, neckDepth: nD, shoulderWidth: sW, armholeDepth: aD } = bp;
    const yokeD = bp.yokeDepth ?? 12;
    const ventL = bp.ventLength ?? 18;

    const sSlope = bp.shoulderSlope ?? 14;
    const sDrop = Math.tan(sSlope * Math.PI / 180) * sW;

    points.cbNeck = new Point(0, nD);
    points.hps = new Point(nW, 0);
    points.shoulder = new Point(nW + sW, sDrop);
    points.yokeEnd = new Point(W * 0.55, sDrop + yokeD);
    points.armholeEnd = new Point(W, aD);
    points.sideHem = new Point(W + 3, L);
    points.cbHem = new Point(0, L);
    points.ventTop = new Point(0, L - ventL);

    const aW = W - points.shoulder.x;
    const aH = aD - sDrop;
    points.backPitch = new Point(points.shoulder.x + aW * 0.18, sDrop + aH * 0.38);
    points.bCp1 = new Point(points.backPitch.x + aW * 0.08, points.backPitch.y + aH * 0.32);
    points.bCp2 = new Point(points.armholeEnd.x - aW * 0.25, points.armholeEnd.y - aH * 0.08);

    const path = new Path()
      .move(points.cbNeck)
      .quad(new Point(nW * 0.45, nD), points.hps).segment('neckline')
      .line(points.shoulder).segment('shoulder')
      .line(points.yokeEnd).segment('yoke')
      .curve(points.bCp1, points.bCp2, points.armholeEnd).segment('armhole')
      .line(points.sideHem).segment('sideSeam')
      .quad(new Point(W * 0.4, L + 1.5), points.cbHem).segment('hem')
      .line(points.ventTop).segment('vent')
      .line(points.cbNeck).segment('closure')
      .close();

    const totalArmholeLen = points.shoulder.dist(points.yokeEnd) +
      new CubicBezier(points.yokeEnd, points.bCp1, points.bCp2, points.armholeEnd).getLength();

    logger.info(`\n📐 风衣后片: ${W}×${L}cm, 袖窿=${totalArmholeLen.toFixed(1)}cm, 过肩=${yokeD}cm`);

    return {
      name: 'back',
      path,
      points,
      seamAllowance,
      cutCount: 1,
      onFold: true,
      backArmholeLength: totalArmholeLen,
      allowedRotations: [0, 180],
      isMirrorable: false,
    };
  }

  private static generateFrontPanel(fp: WindbreakerFrontPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const { width: W, length: L, neckWidth: nW, neckDepth: nD, shoulderWidth: sW, armholeDepth: aD } = fp;
    const yokeD = fp.yokeDepth ?? 12;
    const placketW = fp.placketWidth ?? 6;

    const sSlope = fp.shoulderSlope ?? 12;
    const sDrop = Math.tan(sSlope * Math.PI / 180) * sW;

    points.cfNeck = new Point(0, nD);
    points.neckEnd = new Point(nW, 0);
    points.neckCp = new Point(nW * 0.38, nD * 0.7);
    points.lapelBreak = new Point(placketW * 0.8, nD + 8);
    points.lapelPeak = new Point(placketW + 4, nD + 16);

    const shoulderX = nW + sW * 0.42;
    points.shoulder = new Point(shoulderX, sDrop);
    points.yokeEnd = new Point(shoulderX + (W - shoulderX) * 0.15, sDrop + yokeD);
    points.armholeEnd = new Point(W, aD);
    points.sideBottom = new Point(W + 3, L);
    points.hemFold = new Point(0, L);
    points.hemCp = new Point(W * 0.45, L + 1.5);
    points.placketBottom = new Point(placketW, L);

    const aW = W - shoulderX;
    const aH = aD - sDrop;
    points.armholePitch = new Point(shoulderX + aW * 0.12, sDrop + aH * 0.32);
    points.armholeTopCp1 = new Point(points.shoulder.x + aW * 0.04, points.shoulder.y + aH * 0.12);
    points.armholeTopCp2 = new Point(points.armholePitch.x - aW * 0.08, points.armholePitch.y - aH * 0.12);
    const tX = points.armholePitch.x - points.armholeTopCp2.x;
    const tY = points.armholePitch.y - points.armholeTopCp2.y;
    points.armholeBottomCp1 = new Point(points.armholePitch.x + tX * 1.4, points.armholePitch.y + tY * 1.4);
    points.armholeBottomCp2 = new Point(points.armholeEnd.x - aW * 0.4, points.armholeEnd.y - aH * 0.06);

    const path = new Path()
      .move(points.cfNeck)
      .quad(points.neckCp, points.neckEnd).segment('neckline')
      .line(points.lapelBreak).segment('lapel')
      .quad(
        new Point(points.lapelBreak.x + 3, points.lapelBreak.y + 6),
        points.lapelPeak
      ).segment('lapel')
      .line(points.shoulder).segment('shoulder')
      .line(points.yokeEnd).segment('yoke')
      .curve(points.armholeTopCp1, points.armholeTopCp2, points.armholePitch).segment('armhole')
      .curve(points.armholeBottomCp1, points.armholeBottomCp2, points.armholeEnd).segment('armhole')
      .line(points.sideBottom).segment('sideSeam')
      .quad(points.hemCp, points.hemFold).segment('hem')
      .line(points.placketBottom).segment('placket')
      .line(points.cfNeck).segment('closure')
      .close();

    const upperArmholeLen = new CubicBezier(points.shoulder, points.armholeTopCp1, points.armholeTopCp2, points.armholePitch).getLength();
    const lowerArmholeLen = new CubicBezier(points.armholePitch, points.armholeBottomCp1, points.armholeBottomCp2, points.armholeEnd).getLength();
    const totalArmholeLen = (points.shoulder.dist(points.yokeEnd)) + upperArmholeLen + lowerArmholeLen;

    logger.info(`📐 风衣前片: ${W}×${L}cm, 袖窿=${totalArmholeLen.toFixed(1)}cm, 门襟=${placketW}cm`);

    return {
      name: 'front',
      path,
      points,
      seamAllowance,
      cutCount: 2,
      onFold: false,
      frontArmholeLength: totalArmholeLen,
      allowedRotations: [0, 180],
      isMirrorable: true,
    };
  }

  private static generateSleeveFromArmhole(
    sleeveParams: WindbreakerSleeveParams,
    seamAllowance: number,
    _frontArmholeOps: Array<any>,
    _backArmholeOps: Array<any>,
    avgArmholeDepth: number
  ): PatternPiece {
    const { bicepsWidth: bW, cuffWidth: cW, sleeveCapHeight: sCH } = sleeveParams;
    const sL = sleeveParams.sleeveLength || 64;

    const points: Record<string, Point> = {};
    const sleeveWidth = bW;
    const underarmGap = Math.max(sleeveWidth * 0.06, 2);

    const cpHeight = sCH * 0.62;
    const capTopY = -sCH;

    points.capTop = new Point(sleeveWidth / 2, capTopY);
    points.frontNotch = new Point(sleeveWidth / 2 - underarmGap / 2, avgArmholeDepth * 0.75);
    points.backNotch = new Point(sleeveWidth / 2 + underarmGap / 2, avgArmholeDepth * 0.78);
    points.cuffLeft = new Point((sleeveWidth - cW) / 2, sL);
    points.cuffRight = new Point((sleeveWidth + cW) / 2, sL);
    points.underarmLeft = new Point(0, avgArmholeDepth);
    points.underarmRight = new Point(sleeveWidth, avgArmholeDepth);

    const fCp1x = points.capTop.x - sleeveWidth * 0.22;
    const fCp1y = capTopY + cpHeight * 0.5;
    const fCp2x = points.frontNotch.x - sleeveWidth * 0.08;
    const fCp2y = points.frontNotch.y - sCH * 0.15;

    const bCp1x = points.capTop.x + sleeveWidth * 0.22;
    const bCp1y = capTopY + cpHeight * 0.5;
    const bCp2x = points.backNotch.x + sleeveWidth * 0.08;
    const bCp2y = points.backNotch.y - sCH * 0.12;

    points.fCapCp1 = new Point(fCp1x, fCp1y);
    points.fCapCp2 = new Point(fCp2x, fCp2y);
    points.bCapCp1 = new Point(bCp1x, bCp1y);
    points.bCapCp2 = new Point(bCp2x, bCp2y);

    const path = new Path()
      .move(points.capTop)
      .curve(points.fCapCp1, points.fCapCp2, points.frontNotch).segment('sleeveCap')
      .line(points.cuffLeft).segment('frontSeam')
      .quad(new Point((points.cuffLeft.x + points.underarmLeft.x) / 2, sL + 1), points.underarmLeft).segment('sleeveHem')
      .line(points.underarmRight).segment('backSeam')
      .quad(new Point((points.underarmRight.x + points.cuffRight.x) / 2, sL + 1), points.cuffRight).segment('sleeveHem')
      .line(points.backNotch).segment('frontSeam')
      .curve(points.bCapCp2, points.bCapCp1, points.capTop).segment('sleeveCap')
      .close();

    const frontCapLen = new CubicBezier(points.capTop, points.fCapCp1, points.fCapCp2, points.frontNotch).getLength();
    const backCapLen = new CubicBezier(points.capTop, points.bCapCp1, points.bCapCp2, points.backNotch).getLength();
    const ease = 2.5;

    logger.info(`📐 风衣袖子: 长${sL}cm, 袖肥${bW}cm, 袖口${cW}cm`);
    logger.info(`   前袖山=${frontCapLen.toFixed(1)}cm, 后袖山=${backCapLen.toFixed(1)}cm, 总计=${(frontCapLen + backCapLen).toFixed(1)}cm (+ease=${ease}cm)`);

    return {
      name: 'sleeve',
      path,
      points,
      seamAllowance,
      cutCount: 2,
      onFold: false,
      frontCapLength: frontCapLen,
      backCapLength: backCapLen,
      totalCapLength: frontCapLen + backCapLen + ease,
      ease,
      allowedRotations: [0, 180],
      isMirrorable: true,
    };
  }

  private static generateCollar(collarParams: WindbreakerCollarParams, seamAllowance: number): PatternPiece {
    const { collarWidth: cW, standHeight: sH, collarLength: cL } = collarParams;

    const points: Record<string, Point> = {};

    points.cbCenter = new Point(0, 0);
    points.cbLeft = new Point(-cL / 2, 0);
    points.cbRight = new Point(cL / 2, 0);
    points.standOuter = new Point(cL / 2, sH);
    points.collarTip = new Point(cL / 2 + cW * 0.3, sH + cW * 0.8);
    points.collarRoll = new Point(0, sH + cW);
    points.collarLeftTip = new Point(-cL / 2 - cW * 0.3, sH + cW * 0.8);
    points.standOuterLeft = new Point(-cL / 2, sH);

    const path = new Path()
      .move(points.cbCenter)
      .line(points.cbRight).segment('centerBack')
      .line(points.standOuter).segment('collarStand')
      .quad(
        new Point((points.standOuter.x + points.collarTip.x) / 2, points.standOuter.y + cW * 0.3),
        points.collarTip
      ).segment('collarEdge')
      .quad(
        new Point((points.collarTip.x + points.collarRoll.x) / 2 + cW * 0.1, points.collarTip.y + cW * 0.2),
        points.collarRoll
      ).segment('collarEdge')
      .quad(
        new Point((points.collarRoll.x + points.collarLeftTip.x) / 2 - cW * 0.1, points.collarLeftTip.y + cW * 0.2),
        points.collarLeftTip
      ).segment('collarEdge')
      .quad(
        new Point((points.collarLeftTip.x + points.standOuterLeft.x) / 2, points.standOuterLeft.y + cW * 0.3),
        points.standOuterLeft
      ).segment('collarEdge')
      .line(points.cbLeft).segment('collarStand')
      .line(points.cbCenter).segment('centerBack')
      .close();

    logger.info(`📐 风衣领子: 长${cL}cm, 领宽${cW}cm, 领座高${sH}cm`);

    return {
      name: 'collar',
      path,
      points,
      seamAllowance,
      cutCount: 2,
      onFold: false,
      allowedRotations: [0, 180],
      isMirrorable: true,
    };
  }
}
