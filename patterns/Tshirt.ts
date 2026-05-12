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

    points.cbHps = new Point(0, 0);
    points.cbNeck = new Point(0, bp.neckDepth);
    points.cbWaist = new Point(0, bp.length * 0.65);
    points.cbHem = new Point(0, bp.length + bp.hemExtension);

    points.neck = new Point(bp.neckWidth, 0);
    points.hps = points.neck.clone();

    const shoulderRad = bp.shoulderSlope * Math.PI / 180;
    points.shoulder = new Point(
      bp.shoulderWidth,
      -Math.tan(shoulderRad) * bp.shoulderWidth
    );

    points.cbArmhole = new Point(0, points.shoulder.y + bp.armholeDepth);
    points.armhole = new Point(bp.width, points.cbArmhole.y);

    points.armholePitch = new Point(
      bp.armholePitchX,
      points.shoulder.y + points.shoulder.dy(points.armhole) * 0.45
    );

    points.waist = new Point(bp.width, points.cbWaist.y);
    points.hem = new Point(bp.width, points.cbHem.y);

    const neckCp2Y = bp.neckDepth * 0.6;
    points.neckCp2 = points.neck.shift(-90, neckCp2Y);
    points.shoulderCp1 = points.shoulder.shift(
      180,
      points.shoulder.dy(points.armholePitch) * 0.2
    );
    points.armholePitchCp1 = points.armholePitch.shift(
      -90,
      points.armholePitch.dy(points.armhole) * 0.5
    );
    points.armholePitchCp2 = points.armholePitch.shift(
      90,
      points.shoulder.dy(points.armholePitch) * 0.5
    );

    const armholeHollowX = points.armholePitch.x +
      (points.armhole.x - points.armholePitch.x) * 0.3;
    points.armholeHollow = new Point(
      armholeHollowX,
      points.armhole.y - (points.armhole.y - points.armholePitch.y) * 0.15
    );
    points.armholeCp2 = points.armhole.shift(180, bp.width * 0.1);
    points.armholeHollowCp1 = points.armholeHollow.shift(
      -45,
      points.armholeHollow.dy(points.armhole) * 0.6
    );
    points.armholeHollowCp2 = points.armholeHollow.shift(
      135,
      points.armholePitch.dx(points.armholeHollow) * 0.8
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
        start: new Point(10, points.cbNeck.y + 10),
        end: new Point(10, points.cbHem.y - 10),
      },
      notches: [points.armholePitch],
      cutCount: 1,
      onFold: true,
    };
  }

  private static generateFrontPanel(fp: FrontPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};

    points.cfHps = new Point(0, 0);
    points.cfNeck = new Point(0, fp.neckDepth);
    points.cfWaist = new Point(0, fp.length * 0.65);
    points.cfHem = new Point(0, fp.length + fp.hemExtension);

    points.neck = new Point(fp.neckWidth, 0);
    points.hps = points.neck.clone();

    const shoulderRad = fp.shoulderSlope * Math.PI / 180;
    points.shoulder = new Point(
      fp.shoulderWidth,
      -Math.tan(shoulderRad) * fp.shoulderWidth
    );

    points.cfArmhole = new Point(0, points.shoulder.y + fp.armholeDepth);
    points.armhole = new Point(fp.width, points.cfArmhole.y);

    points.armholePitch = new Point(
      fp.armholePitchX,
      points.shoulder.y + points.shoulder.dy(points.armhole) * 0.5
    );

    points.waist = new Point(fp.width, points.cfWaist.y);
    points.hem = new Point(fp.width, points.cfHem.y);

    const frontNeckCp1X = fp.neckWidth * 0.5;
    points.neckCp2 = points.neck.shift(-90, fp.neckDepth * 0.5);
    points.cfNeckCp1 = points.cfNeck.shift(0, frontNeckCp1X);

    points.shoulderCp1 = points.shoulder.shift(
      180,
      points.shoulder.dy(points.armholePitch) * 0.15
    );
    points.armholePitchCp1 = points.armholePitch.shift(
      -90,
      points.armholePitch.dy(points.armhole) * 0.4
    );
    points.armholePitchCp2 = points.armholePitch.shift(
      90,
      points.shoulder.dy(points.armholePitch) * 0.4
    );

    const armholeHollowX = points.armholePitch.x +
      (points.armhole.x - points.armholePitch.x) * 0.35;
    points.armholeHollow = new Point(
      armholeHollowX,
      points.armhole.y - (points.armhole.y - points.armholePitch.y) * 0.1
    );
    points.armholeCp2 = points.armhole.shift(180, fp.width * 0.08);
    points.armholeHollowCp1 = points.armholeHollow.shift(
      -45,
      points.armholeHollow.dy(points.armhole) * 0.5
    );
    points.armholeHollowCp2 = points.armholeHollow.shift(
      135,
      points.armholePitch.dx(points.armholeHollow) * 0.7
    );

    const path = new Path()
      .move(points.cfHem)
      .line(points.hem)
      .line(points.armhole)
      .curve(points.armholeCp2, points.armholeHollowCp1, points.armholeHollow)
      .curve(points.armholeHollowCp2, points.armholePitchCp1, points.armholePitch)
      .curve(points.armholePitchCp2, points.shoulderCp1, points.shoulder)
      .line(points.neck)
      .curve(points.neckCp2, points.cfNeckCp1, points.cfNeck)
      .line(points.cfHem)
      .close();

    path.attr('class', 'fabric');

    return {
      name: 'front',
      path,
      points,
      seamAllowance,
      grainline: {
        start: new Point(10, points.cfNeck.y + 10),
        end: new Point(10, points.cfHem.y - 10),
      },
      notches: [points.armholePitch],
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
    const capRatio = sl.capDepthRatio ?? 0.6;

    points.sleeveCapTop = new Point(0, 0);

    points.backSleeveSide = new Point(-halfBiceps, capHeight);
    points.frontSleeveSide = new Point(halfBiceps, capHeight);

    points.backSleeveCap = new Point(-halfBiceps * 0.3, 0);
    points.frontSleeveCap = new Point(halfBiceps * 0.3, 0);

    const capCurveDepth = capHeight * capRatio;
    points.backCapCp1 = points.sleeveCapTop.shift(-135, capCurveDepth * 0.5);
    points.backCapCp2 = points.backSleeveSide.shift(90, capCurveDepth * 0.8);
    points.frontCapCp1 = points.sleeveCapTop.shift(-45, capCurveDepth * 0.5);
    points.frontCapCp2 = points.frontSleeveSide.shift(90, capCurveDepth * 0.8);

    points.backCuff = new Point(-sl.cuffWidth / 2, capHeight + sl.sleeveLength);
    points.frontCuff = new Point(sl.cuffWidth / 2, capHeight + sl.sleeveLength);

    points.backCuffCp = points.backCuff.shift(90, sl.sleeveLength * 0.3);
    points.frontCuffCp = points.frontCuff.shift(90, sl.sleeveLength * 0.3);

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
