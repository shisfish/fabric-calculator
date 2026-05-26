import { Point, Path, CubicBezier } from '../../geometry/index.js';
import { SeamAllowanceGenerator } from '../SeamAllowanceGenerator.js';
import type { PatternPiece } from '../tshirt/Tshirt.js';
import { createLogger } from '../../utils/CADLogger.js';

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
  elbowWidth?: number;
  cuffWidth: number;
  sleeveLength: number;
  sleeveCapHeight: number;
}

export interface WindbreakerCollarParams {
  collarWidth: number;
  standHeight: number;
  collarLength: number;
}

export class WindbreakerPatternGenerator {

  static generatePattern(params: WindbreakerParams): PatternPiece[] {
    const pieces: PatternPiece[] = [];

    logger.info('\n🧥 ===== 风衣裁片生成开始 =====');
    logger.info(`   品类: ${params.category}`);
    logger.info(`   后片: ${params.backPanel.width}×${params.backPanel.length}cm`);
    logger.info(`   前片: ${params.frontPanel.width}×${params.frontPanel.length}cm`);
    logger.info(`   袖子: 长${params.sleeve.sleeveLength}cm, 袖肥${params.sleeve.bicepsWidth}cm`);

    const backPiece = this.generateBackPanel(params.backPanel, params.seamAllowance);
    const frontPiece = this.generateFrontPanel(params.frontPanel, params.seamAllowance);

    const frontArmholeLen = frontPiece.frontArmholeLength || 0;
    const backArmholeLen = backPiece.backArmholeLength || 0;

    const { frontSleeve, backSleeve } = this.generateTwoPieceSleeve(
      params.sleeve,
      params.seamAllowance,
      frontArmholeLen,
      backArmholeLen
    );

    if (params.seamAllowance && params.seamAllowance > 0) {
      const sa = params.seamAllowance;

      const backRules = [
        { segment: 'neckline', distance: sa },
        { segment: 'shoulder', distance: sa },
        { segment: 'yoke', distance: sa },
        { segment: 'armhole', distance: sa },
        { segment: 'sideSeam', distance: sa * 1.2 },
        { segment: 'hem', distance: sa * 2.5 },
        { segment: 'vent', distance: sa },
        { segment: 'closure', distance: sa },
      ];

      const frontRules = [
        { segment: 'neckline', distance: sa * 0.8 },
        { segment: 'lapel', distance: sa },
        { segment: 'shoulder', distance: sa },
        { segment: 'yoke', distance: sa },
        { segment: 'armhole', distance: sa },
        { segment: 'sideSeam', distance: sa * 1.2 },
        { segment: 'hem', distance: sa * 2.5 },
        { segment: 'placket', distance: sa },
        { segment: 'closure', distance: sa },
      ];

      const sleeveRules = [
        { segment: 'sleeveCap', distance: sa },
        { segment: 'frontSeam', distance: sa },
        { segment: 'backSeam', distance: sa },
        { segment: 'underarmSeam', distance: sa },
        { segment: 'sleeveHem', distance: sa * 2.5 },
      ];

      logger.info(`   ✅ 缝份生成...`);
      backPiece.seamAllowancePath = SeamAllowanceGenerator.generate(backPiece.path, backRules);
      frontPiece.seamAllowancePath = SeamAllowanceGenerator.generate(frontPiece.path, frontRules);
      frontSleeve.seamAllowancePath = SeamAllowanceGenerator.generate(frontSleeve.path, sleeveRules);
      backSleeve.seamAllowancePath = SeamAllowanceGenerator.generate(backSleeve.path, sleeveRules);
    }

    pieces.push(backPiece, frontPiece, frontSleeve, backSleeve);

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

    logger.info(`\n🧥 ===== 完成: ${pieces.length}个裁片 (${pieces.map(p=>p.name).join(', ')}) =====\n`);
    return pieces;
  }

  private static generateBackPanel(bp: WindbreakerBackPanelParams, _sa: number): PatternPiece {
    const p: Record<string, Point> = {};
    const W = bp.width;
    const L = bp.length;
    const nW = bp.neckWidth;
    const sW = bp.shoulderWidth;
    const aD = bp.armholeDepth;
    const yD = bp.yokeDepth ?? 12;
    const vL = bp.ventLength ?? 18;
    const sDrop = Math.tan((bp.shoulderSlope || 3.5) * Math.PI / 180) * sW;

    p.cbNeck = new Point(0, nW * 0.12);
    p.hps = new Point(nW, 0);
    p.shoulder = new Point(nW + sW, sDrop);
    p.yokeEnd = new Point(W * 0.52, sDrop + yD);
    p.armholeEnd = new Point(W, aD);
    p.sideHem = new Point(W + 1.5, L);
    p.cbHem = new Point(0, L);
    p.ventTop = new Point(0, L - vL);

    const ax = W - p.shoulder.x;
    const ay = aD - sDrop - yD;
    p.armCp1 = new Point(p.yokeEnd.x + ax * 0.15, p.yokeEnd.y + ay * 0.35);
    p.armCp2 = new Point(p.armholeEnd.x - ax * 0.28, p.armholeEnd.y - ay * 0.08);

    const path = new Path()
      .move(p.cbNeck)
      .quad(new Point(nW * 0.4, nW * 0.06), p.hps).segment('neckline')
      .line(p.shoulder).segment('shoulder')
      .line(p.yokeEnd).segment('yoke')
      .curve(p.armCp1, p.armCp2, p.armholeEnd).segment('armhole')
      .line(p.sideHem).segment('sideSeam')
      .quad(new Point(W * 0.35, L + 1), p.cbHem).segment('hem')
      .line(p.ventTop).segment('vent')
      .line(p.cbNeck).segment('closure')
      .close();

    const armLen = p.shoulder.dist(p.yokeEnd) +
      new CubicBezier(p.yokeEnd, p.armCp1, p.armCp2, p.armholeEnd).getLength();

    logger.info(`📐 后片: ${W}×${L}cm, 袖窿=${armLen.toFixed(1)}cm, 过肩=${yD}cm, 开衩=${vL}cm`);

    return {
      name: 'back',
      path,
      points: p,
      seamAllowance: _sa,
      cutCount: 1,
      onFold: true,
      backArmholeLength: armLen,
      allowedRotations: [0],
      isMirrorable: false,
    };
  }

  private static generateFrontPanel(fp: WindbreakerFrontPanelParams, _sa: number): PatternPiece {
    const p: Record<string, Point> = {};
    const W = fp.width;
    const L = fp.length;
    const nW = fp.neckWidth;
    const nD = fp.neckDepth;
    const sW = fp.shoulderWidth;
    const pkW = fp.placketWidth ?? 6;
    const yD = fp.yokeDepth ?? 12;

    const slopeDeg = fp.shoulderSlope || 4;
    const sDrop = Math.tan(slopeDeg * Math.PI / 180) * (sW * 0.5);

    const armholeRatio = 0.42;
    const aD = L * armholeRatio;

    p.cfTop = new Point(0, 0);
    p.cfBottom = new Point(pkW, L);
    p.hps = new Point(nW, nD * 0.12);

    const lapelNotchX = nW + sW * 0.06;
    const lapelNotchY = nD * 0.30;
    p.lapelNotch = new Point(lapelNotchX, lapelNotchY);
    p.lapelTip = new Point(pkW * 1.05, nD * 0.78);

    const shX = nW + sW * 0.46;
    p.shoulder = new Point(shX, sDrop);
    p.yokeEnd = new Point(shX + (W - shX) * 0.16, sDrop + yD);
    p.armholeEnd = new Point(W, aD);
    p.sideBottom = new Point(W + 1.5, L);
    p.hemCp = new Point(W * 0.38, L + 1.2);

    const ax = W - shX;
    const ay = aD - sDrop - yD;
    p.armPitch = new Point(shX + ax * 0.18, sDrop + yD + ay * 0.34);
    p.armCp1 = new Point(shX + ax * 0.06, sDrop + yD + ay * 0.12);
    p.armCp2 = new Point(p.armPitch.x - ax * 0.07, p.armPitch.y - ay * 0.10);
    p.armCp3 = new Point(p.armPitch.x + ax * 0.14, p.armPitch.y + ay * 0.28);
    p.armCp4 = new Point(p.armholeEnd.x - ax * 0.32, p.armholeEnd.y - ay * 0.06);

    const path = new Path()
      .move(p.cfTop)
      .quad(new Point(nW * 0.50, nD * 0.04), p.hps).segment('neckline')
      .line(p.lapelNotch).segment('lapel')
      .quad(
        new Point((p.lapelNotch.x + p.lapelTip.x) / 2 + 0.5, p.lapelNotch.y + (p.lapelTip.y - p.lapelNotch.y) * 0.45),
        p.lapelTip
      ).segment('lapel')
      .line(p.cfBottom).segment('placket')
      .quad(p.hemCp, p.sideBottom).segment('hem')
      .line(p.armholeEnd).segment('sideSeam')
      .curve(p.armCp4, p.armCp3, p.armPitch).segment('armhole')
      .curve(p.armCp2, p.armCp1, p.shoulder).segment('armhole')
      .line(p.yokeEnd).segment('yoke')
      .close();

    const upperLen = new CubicBezier(p.shoulder, p.armCp1, p.armCp2, p.armPitch).getLength();
    const lowerLen = new CubicBezier(p.armPitch, p.armCp3, p.armCp4, p.armholeEnd).getLength();
    const armLen = p.shoulder.dist(p.yokeEnd) + upperLen + lowerLen;

    logger.info(`📐 前片: ${W}×${L}cm, 袖窿=${armLen.toFixed(1)}cm, 门襟=${pkW}cm, 领深=${nD}cm`);

    return {
      name: 'front',
      path,
      points: p,
      seamAllowance: _sa,
      cutCount: 2,
      onFold: false,
      frontArmholeLength: armLen,
      allowedRotations: [0, 180],
      isMirrorable: true,
    };
  }

  private static generateTwoPieceSleeve(
    sp: WindbreakerSleeveParams,
    _sa: number,
    _frontAH: number,
    _backAH: number
  ): { frontSleeve: PatternPiece; backSleeve: PatternPiece } {
    const bW = sp.bicepsWidth;
    const eW = sp.elbowWidth || (bW * 0.92);
    const cW = sp.cuffWidth;
    const sL = sp.sleeveLength;
    const sCH = sp.sleeveCapHeight;

    const offsetF = 2.0;
    const offsetB = 3.0;

    const fBW = bW - offsetF;
    const bBW = bW + offsetB;
    const fEW = Math.max(eW - offsetF - 1, cW + 1);
    const bEW = eW + offsetB + 1.5;
    const fCW = Math.max(cW - offsetF, 7);
    const bCW = cW + offsetB;

    const elbowY = sL * 0.42;
    const bicepY = sCH * 0.15;

    const fs: Record<string, Point> = {};
    fs.capTop = new Point(fBW * 0.78, -sCH);
    fs.capFront = new Point(0, bicepY);
    fs.elbowFront = new Point(fEW * 0.88, elbowY);
    fs.cuffFront = new Point(fCW * 0.92, sL);
    fs.underarmFront = new Point(0, bicepY + 2);

    const fcp1x = fs.capTop.x - fBW * 0.32;
    const fcp1y = -sCH * 0.42;
    const fcp2x = fBW * 0.08;
    const fcp2y = bicepY - sCH * 0.16;

    fs.fCapCp1 = new Point(fcp1x, fcp1y);
    fs.fCapCp2 = new Point(fcp2x, fcp2y);

    const frontPath = new Path()
      .move(fs.capTop)
      .curve(fs.fCapCp1, fs.fCapCp2, fs.capFront).segment('sleeveCap')
      .line(fs.underarmFront).segment('underarmSeam')
      .quad(
        new Point(fEW * 0.35, (fs.underarmFront.y + elbowY) / 2 + 1),
        fs.elbowFront
      ).segment('frontSeam')
      .quad(
        new Point((fEW * 0.88 + fCW * 0.92) / 2, elbowY + (sL - elbowY) / 2 + 0.5),
        fs.cuffFront
      ).segment('frontSeam')
      .quad(new Point(fCW * 0.5, sL + 1.5), new Point(fs.capTop.x * 0.4, sL + 0.8)).segment('sleeveHem')
      .close();

    const fCapLen = new CubicBezier(fs.capTop, fs.fCapCp1, fs.fCapCp2, fs.capFront).getLength();

    const bs: Record<string, Point> = {};
    bs.capTop = new Point(1.5, -sCH);
    bs.capBack = new Point(bBW, bicepY + 1);
    bs.elbowBack = new Point(bEW, elbowY + 2);
    bs.cuffBack = new Point(bCW, sL);
    bs.underarmBack = new Point(bBW * 0.94, bicepY + 3);

    const bcp1x = bs.capTop.x + bBW * 0.28;
    const bcp1y = -sCH * 0.38;
    const bcp2x = bBW * 0.82;
    const bcp2y = bicepY - sCH * 0.10;

    bs.bCapCp1 = new Point(bcp1x, bcp1y);
    bs.bCapCp2 = new Point(bcp2x, bcp2y);

    const backPath = new Path()
      .move(bs.capTop)
      .curve(bs.bCapCp1, bs.bCapCp2, bs.capBack).segment('sleeveCap')
      .line(bs.underarmBack).segment('underarmSeam')
      .quad(
        new Point((bBW * 0.94 + bEW) / 2 + 1.5, (bs.underarmBack.y + elbowY) / 2 + 2),
        bs.elbowBack
      ).segment('backSeam')
      .quad(
        new Point((bEW + bCW) / 2 + 0.8, elbowY + (sL - elbowY) / 2 + 1),
        bs.cuffBack
      ).segment('backSeam')
      .quad(new Point(bCW * 0.55, sL + 1.5), new Point(bs.capTop.x + bBW * 0.08, sL + 0.8)).segment('sleeveHem')
      .close();

    const bCapLen = new CubicBezier(bs.capTop, bs.bCapCp1, bs.bCapCp2, bs.capBack).getLength();

    logger.info(`📐 前袖(小袖): 宽${fBW.toFixed(1)}cm, 袖口${fCW.toFixed(1)}cm, 袖山${fCapLen.toFixed(1)}cm`);
    logger.info(`📐 后袖(大袖): 宽${bBW.toFixed(1)}cm, 袖口${bCW.toFixed(1)}cm, 袖山${bCapLen.toFixed(1)}cm`);

    return {
      frontSleeve: {
        name: 'frontSleeve',
        path: frontPath,
        points: fs,
        seamAllowance: _sa,
        cutCount: 2,
        onFold: false,
        frontCapLength: fCapLen,
        allowedRotations: [0, 180],
        isMirrorable: true,
      },
      backSleeve: {
        name: 'backSleeve',
        path: backPath,
        points: bs,
        seamAllowance: _sa,
        cutCount: 2,
        onFold: false,
        backCapLength: bCapLen,
        allowedRotations: [0, 180],
        isMirrorable: true,
      },
    };
  }

  private static generateCollar(cp: WindbreakerCollarParams, _sa: number): PatternPiece {
    const p: Record<string, Point> = {};
    const cL = cp.collarLength;
    const sH = cp.standHeight;
    const cW = cp.collarWidth;

    p.cbCenter = new Point(0, 0);
    p.cbRight = new Point(cL / 2, 0);
    p.standOuter = new Point(cL / 2, sH);
    p.rollPeak = new Point(cL / 2 + cW * 0.25, sH + cW * 0.7);
    p.collarTip = new Point(cL / 2 + cW * 0.5, sH + cW);
    p.collRollCenter = new Point(0, sH + cW);
    p.leftTip = new Point(-cL / 2 - cW * 0.5, sH + cW);
    p.leftRollPeak = new Point(-cL / 2 - cW * 0.25, sH + cW * 0.7);
    p.standOuterLeft = new Point(-cL / 2, sH);
    p.cbLeft = new Point(-cL / 2, 0);

    const path = new Path()
      .move(p.cbCenter)
      .line(p.cbRight).segment('centerBack')
      .line(p.standOuter).segment('collarStand')
      .quad(
        new Point((p.standOuter.x + p.rollPeak.x) / 2, p.standOuter.y + cW * 0.25),
        p.rollPeak
      ).segment('collarEdge')
      .quad(
        new Point((p.rollPeak.x + p.collarTip.x) / 2 + cW * 0.05, p.rollPeak.y + cW * 0.15),
        p.collarTip
      ).segment('collarEdge')
      .quad(
        new Point((p.collarTip.x + p.collRollCenter.x) / 2, p.collarTip.y),
        p.collRollCenter
      ).segment('collarEdge')
      .quad(
        new Point((p.collRollCenter.x + p.leftTip.x) / 2, p.leftTip.y),
        p.leftTip
      ).segment('collarEdge')
      .quad(
        new Point((p.leftTip.x + p.leftRollPeak.x) / 2 - cW * 0.05, p.leftRollPeak.y + cW * 0.15),
        p.leftRollPeak
      ).segment('collarEdge')
      .quad(
        new Point((p.leftRollPeak.x + p.standOuterLeft.x) / 2, p.standOuterLeft.y + cW * 0.25),
        p.standOuterLeft
      ).segment('collarEdge')
      .line(p.cbLeft).segment('collarStand')
      .line(p.cbCenter).segment('centerBack')
      .close();

    logger.info(`📐 领子: 长${cL}cm, 翻领${cW}cm, 领座${sH}cm`);

    return {
      name: 'collar',
      path,
      points: p,
      seamAllowance: _sa,
      cutCount: 2,
      onFold: false,
      allowedRotations: [0, 180],
      isMirrorable: true,
    };
  }
}
