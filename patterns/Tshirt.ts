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
    
    const sleeve = this.generateSleeve(
      params.sleeve,
      params.backPanel,
      params.frontPanel,
      params.seamAllowance
    );
    pieces.push(sleeve);
    
    return pieces;
  }

  private static generateBackPanel(bp: BackPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    
    const W = bp.width;
    const L = bp.length;
    const neckW = bp.neckWidth;
    const neckD = bp.neckDepth;
    const shoulderW = bp.shoulderWidth;
    const armholeD = bp.armholeDepth;

    points.cbHps = new Point(0, 0);
    points.cbNeck = new Point(0, neckD);
    points.cbWaist = new Point(0, L * 0.6);
    points.cbHem = new Point(0, L + bp.hemExtension);

    points.neck = new Point(neckW, 0);
    points.hps = new Point(neckW, 0);

    const shoulderDrop = Math.tan((bp.shoulderSlope || 12) * Math.PI / 180) * shoulderW;
    points.shoulder = new Point(shoulderW, -shoulderDrop);

    points.cbArmhole = new Point(0, shoulderDrop + armholeD);
    points.armhole = new Point(W, shoulderDrop + armholeD);

    points.armholePitch = new Point(
      bp.armholePitchX || shoulderW * 0.55,
      shoulderDrop + armholeD * 0.35
    );

    points.waist = new Point(W, L * 0.58);
    points.hem = new Point(W, L + bp.hemExtension);

    const neckCp2Y = neckD * 0.7;
    points.neckCp2 = new Point(neckW * 0.85, neckCp2Y);
    points.shoulderCp1 = new Point(
      shoulderW * 0.85,
      -shoulderDrop * 0.8
    );
    points.armholePitchCp1 = new Point(
      points.armholePitch.x,
      points.armholePitch.y + (points.armhole.y - points.armholePitch.y) * 0.4
    );
    points.armholePitchCp2 = new Point(
      points.armholePitch.x,
      points.shoulder.y + (points.armholePitch.y - points.shoulder.y) * 0.3
    );

    const armholeMidX = points.armholePitch.x + (points.armhole.x - points.armholePitch.x) * 0.45;
    const armholeMidY = points.armhole.y - (points.armhole.y - points.armholePitch.y) * 0.15;
    points.armholeHollow = new Point(armholeMidX, armholeMidY);
    points.armholeCp2 = new Point(points.armhole.x - W * 0.08, points.armhole.y);
    points.armholeHollowCp1 = new Point(
      points.armholeHollow.x + 2,
      points.armholeHollow.y - (points.armhole.y - points.armholeHollow.y) * 0.5
    );
    points.armholeHollowCp2 = new Point(
      points.armholeHollow.x - (points.armholeHollow.x - points.armholePitch.x) * 0.3,
      points.armholeHollow.y + (points.armholeHollow.y - points.armholePitch.y) * 0.4
    );

    const path = new Path()
      .move(points.cbNeck)
      .line(points.cbHem)
      .line(points.hem)
      .line(points.armhole)
      .curve(points.armholeCp2, points.armholeHollowCp1, points.armholeHollow)
      .curve(points.armholeHollowCp2, points.armholePitchCp1, points.armholePitch)
      .curve(points.armholePitchCp2, points.shoulderCp1, points.shoulder)
      .line(points.neck)
      .curve(points.neckCp2, points.cbNeck, points.cbNeck)
      .close();

    path.attr('class', 'fabric');

    return {
      name: 'back',
      path,
      points,
      seamAllowance,
      grainline: {
        start: new Point(8, points.cbNeck.y + 10),
        end: new Point(8, points.cbHem.y - 10),
      },
      notches: [points.armholePitch],
      cutCount: 1,
      onFold: true,
    };
  }

  private static generateFrontPanel(fp: FrontPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};

    const W = fp.width;
    const L = fp.length;
    const neckW = fp.neckWidth;
    const neckD = fp.neckDepth;
    const shoulderW = fp.shoulderWidth;
    const armholeD = fp.armholeDepth;

    const halfChest = W;
    const shoulderDrop = 3;

    points.cfNeck = new Point(0, 0);

    points.neckCp = new Point(neckW * 0.45, 0);

    points.neckEnd = new Point(neckW, neckD);

    points.shoulder = new Point(shoulderW, shoulderDrop);

    points.armholeCp1 = new Point(
      shoulderW + (halfChest - shoulderW) * 0.15,
      armholeD * 0.18
    );

    points.armholeCp2 = new Point(
      halfChest + 1.5,
      armholeD * 0.72
    );

    points.armholeEnd = new Point(halfChest, armholeD);

    points.sideBottom = new Point(halfChest, L);

    points.hemFold = new Point(0, L);

    const path = new Path()
      .move(points.cfNeck)
      .quad(points.neckCp, points.neckEnd)
      .line(points.shoulder)
      .curve(points.armholeCp1, points.armholeCp2, points.armholeEnd)
      .line(points.sideBottom)
      .line(points.hemFold)
      .close();

    path.attr('class', 'fabric');

    return {
      name: 'front',
      path,
      points,
      seamAllowance,
      grainline: {
        start: new Point(8, points.cfNeck.y + 10),
        end: new Point(8, points.hemFold.y - 10),
      },
      notches: [points.shoulder],
      cutCount: 1,
      onFold: false,
    };
  }

  private static generateSleeve(
    sl: SleeveParams,
    _bp: BackPanelParams,
    _fp: FrontPanelParams,
    seamAllowance: number
  ): PatternPiece {
    const points: Record<string, Point> = {};

    const halfBiceps = sl.bicepsWidth / 2;
    const capHeight = sl.sleeveCapHeight;
    const capRatio = sl.capDepthRatio ?? 0.65;

    points.sleeveCapTop = new Point(0, 0);

    points.backSleeveSide = new Point(-halfBiceps, capHeight);
    points.frontSleeveSide = new Point(halfBiceps, capHeight);

    points.backSleeveCap = new Point(-halfBiceps * 0.35, 0);
    points.frontSleeveCap = new Point(halfBiceps * 0.35, 0);

    const capCurveDepth = capHeight * capRatio;
    points.backCapCp1 = new Point(-halfBiceps * 0.18, capCurveDepth * 0.45);
    points.backCapCp2 = new Point(-halfBiceps, capCurveDepth * 0.72);
    points.frontCapCp1 = new Point(halfBiceps * 0.18, capCurveDepth * 0.45);
    points.frontCapCp2 = new Point(halfBiceps, capCurveDepth * 0.72);

    points.backCuff = new Point(-sl.cuffWidth / 2, capHeight + sl.sleeveLength);
    points.frontCuff = new Point(sl.cuffWidth / 2, capHeight + sl.sleeveLength);

    points.backCuffCp = new Point(-sl.cuffWidth / 2, capHeight + sl.sleeveLength * 0.78);
    points.frontCuffCp = new Point(sl.cuffWidth / 2, capHeight + sl.sleeveLength * 0.78);

    const path = new Path()
      .move(points.sleeveCapTop)
      .curve(points.backCapCp1, points.backCapCp2, points.backSleeveSide)
      .line(points.backCuff)
      .line(points.frontCuff)
      .line(points.frontSleeveSide)
      .curve(points.frontCapCp2, points.frontCapCp1, points.sleeveCapTop)
      .close();

    path.attr('class', 'fabric');

    return {
      name: 'sleeve',
      path,
      points,
      seamAllowance,
      grainline: {
        start: new Point(0, capHeight + 20),
        end: new Point(0, capHeight + sl.sleeveLength - 20),
      },
      notches: [points.sleeveCapTop],
      cutCount: 2,
      onFold: false,
    };
  }
}
