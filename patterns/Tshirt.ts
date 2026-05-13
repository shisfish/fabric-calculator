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

    const shoulderDrop = Math.tan((bp.shoulderSlope ?? 12) * Math.PI / 180) * shoulderW;

    points.cbHps = new Point(0, 0);
    points.cbNeck = new Point(0, neckD);
    points.cbWaist = new Point(0, L * 0.6);
    points.cbHem = new Point(0, L + (bp.hemExtension ?? 1));

    points.neck = new Point(neckW, 0);
    points.hps = new Point(neckW, 0);

    points.shoulder = new Point(shoulderW, shoulderDrop);

    points.cbArmhole = new Point(0, shoulderDrop + armholeD);
    points.armhole = new Point(W, shoulderDrop + armholeD);

    points.armholePitch = new Point(
      bp.armholePitchX || shoulderW + (W - shoulderW) * 0.55,
      shoulderDrop + armholeD * 0.35
    );

    points.waist = new Point(W, L * 0.58);
    points.hem = new Point(W, L + (bp.hemExtension ?? 1));

    points.neckCp2 = new Point(neckW * 0.85, neckD * 0.7);
    points.shoulderCp1 = new Point(shoulderW * 0.85, shoulderDrop * 0.8);

    points.armholePitchCp1 = new Point(
      points.armholePitch.x,
      points.armholePitch.y + (points.armhole.y - points.armholePitch.y) * 0.4
    );
    points.armholePitchCp2 = new Point(
      points.armholePitch.x,
      points.shoulder.y + (points.armholePitch.y - points.shoulder.y) * 0.3
    );

    const armholeSpanX = W - points.armholePitch.x;
    points.armholeHollow = new Point(
      points.armholePitch.x + armholeSpanX * 0.55,
      points.armhole.y - (points.armhole.y - points.armholePitch.y) * 0.15
    );

    points.armholeHollowCp1 = new Point(
      points.armholeHollow.x + armholeSpanX * 0.08,
      points.armholeHollow.y - (points.armhole.y - points.armholeHollow.y) * 0.5
    );
    points.armholeHollowCp2 = new Point(
      points.armholeHollow.x - armholeSpanX * 0.12,
      points.armholeHollow.y + (points.armholeHollow.y - points.armholePitch.y) * 0.4
    );

    points.armholeCp2 = new Point(points.armhole.x - W * 0.08, points.armhole.y);

    const path = new Path()
      .move(points.cbHps)
      .line(points.hps)
      .curve(points.shoulderCp1, points.neckCp2, points.neck)
      .line(points.cbNeck)
      .line(points.cbHem)
      .line(points.hem)
      .line(points.armhole)
      .curve(points.armholeCp2, points.armholeHollowCp1, points.armholeHollow)
      .curve(points.armholeHollowCp2, points.armholePitchCp1, points.armholePitch)
      .curve(points.armholePitchCp2, points.armholePitchCp2, points.shoulder)
      .close();

    path.attr('class', 'fabric');

    return {
      name: 'back',
      path,
      points,
      seamAllowance,
      grainline: {
        start: new Point(8, points.cbHps.y + 10),
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

    const shoulderDrop = Math.tan((fp.shoulderSlope ?? 12) * Math.PI / 180) * shoulderW;

    points.cfNeck = new Point(0, 0);

    points.neckCp = new Point(neckW * 0.42, 0);

    points.neckEnd = new Point(neckW, neckD);

    points.shoulder = new Point(shoulderW, shoulderDrop);

    points.armholeEnd = new Point(W, armholeD);

    const armholeSpanX = W - shoulderW;

    const pitchX = shoulderW + armholeSpanX * 0.35;
    const pitchY = shoulderDrop + (armholeD - shoulderDrop) * 0.30;
    points.armholePitch = new Point(pitchX, pitchY);

    const hollowX = W - W * 0.12;
    const hollowY = armholeD * 0.65;
    points.armholeHollow = new Point(hollowX, hollowY);

    points.sideBottom = new Point(W, L);

    points.hemCp = new Point(
      W * 0.48,
      L + 1
    );

    points.hemFold = new Point(0, L);

    points.armholeTopCp1 = new Point(
      shoulderW + armholeSpanX * 0.18,
      shoulderDrop + (armholeD - shoulderDrop) * 0.08
    );
    points.armholeTopCp2 = new Point(
      pitchX - armholeSpanX * 0.08,
      pitchY - (armholeD - shoulderDrop) * 0.05
    );

    points.armholeMidCp1 = new Point(
      pitchX + armholeSpanX * 0.12,
      pitchY + (armholeD - shoulderDrop) * 0.08
    );
    points.armholeMidCp2 = new Point(
      hollowX - armholeSpanX * 0.04,
      hollowY - (armholeD - shoulderDrop) * 0.05
    );

    points.armholeBottomCp1 = new Point(
      hollowX - armholeSpanX * 0.03,
      hollowY + (armholeD - shoulderDrop) * 0.08
    );
    points.armholeBottomCp2 = new Point(
      W - W * 0.08 * 0.6,
      armholeD * 0.88
    );

    const path = new Path()
      .move(points.cfNeck)
      .quad(points.neckCp, points.neckEnd)
      .line(points.shoulder)
      .curve(
        points.armholeTopCp1,
        points.armholeTopCp2,
        points.armholePitch
      )
      .curve(
        points.armholeMidCp1,
        points.armholeMidCp2,
        points.armholeHollow
      )
      .curve(
        points.armholeBottomCp1,
        points.armholeBottomCp2,
        points.armholeEnd
      )
      .line(points.sideBottom)
      .quad(points.hemCp, points.hemFold)
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
      notches: [points.armholePitch],
      cutCount: 1,
      onFold: true,
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

    points.backSleeveCap = new Point(-halfBiceps * 0.30, 0);
    points.frontSleeveCap = new Point(halfBiceps * 0.40, 0);

    const capCurveDepth = capHeight * capRatio;

    points.backCapCp1 = new Point(-halfBiceps * 0.15, capCurveDepth * 0.38);
    points.backCapCp2 = new Point(-halfBiceps, capCurveDepth * 0.68);
    points.frontCapCp1 = new Point(halfBiceps * 0.22, capCurveDepth * 0.52);
    points.frontCapCp2 = new Point(halfBiceps, capCurveDepth * 0.78);

    points.backCuff = new Point(-sl.cuffWidth / 2, capHeight + sl.sleeveLength);
    points.frontCuff = new Point(sl.cuffWidth / 2, capHeight + sl.sleeveLength);

    points.backCuffCp = new Point(-sl.cuffWidth / 2, capHeight + sl.sleeveLength * 0.78);
    points.frontCuffCp = new Point(sl.cuffWidth / 2, capHeight + sl.sleeveLength * 0.82);

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
