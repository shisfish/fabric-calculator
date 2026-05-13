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

  private static generateFrontPanel(
  fp: FrontPanelParams,
  seamAllowance: number
): PatternPiece {

  const points: Record<string, Point> = {};

  const W = fp.width;
  const L = fp.length;

  const neckW = fp.neckWidth;
  const neckD = fp.neckDepth;

  const shoulderW = fp.shoulderWidth;
  const armholeD = fp.armholeDepth;

  // =========================
  // 基础几何
  // =========================

  const shoulderSlope =
    Math.tan((fp.shoulderSlope ?? 12) * Math.PI / 180);

  const shoulderDrop = shoulderSlope * shoulderW;

  // 中心前
  points.cfTop = new Point(0, 0);

  // 领口结束点
  points.neckPoint = new Point(
    neckW,
    neckD
  );

  // 肩点
  points.shoulderPoint = new Point(
    shoulderW,
    shoulderDrop
  );

  // 腋下点
  points.armholeBottom = new Point(
    W,
    armholeD
  );

  // 下摆
  points.sideHem = new Point(
    W,
    L
  );

  points.cfHem = new Point(
    0,
    L
  );

  // =========================
  // 领口曲线
  // =========================

  points.neckCp = new Point(
    neckW * 0.45,
    0
  );

  // =========================
  // 袖窿关键点
  // =========================

  const spanX = W - shoulderW;
  const spanY = armholeD - shoulderDrop;

  // pitch
  points.pitch = new Point(
    shoulderW + spanX * 0.32,
    shoulderDrop + spanY * 0.28
  );

  // hollow
  points.hollow = new Point(
    shoulderW + spanX * 0.72,
    shoulderDrop + spanY * 0.72
  );

  // =========================
  // 第一段（肩 -> pitch）
  // =========================

  points.cp1a = new Point(
    shoulderW + spanX * 0.10,
    shoulderDrop + spanY * 0.02
  );

  points.cp1b = new Point(
    points.pitch.x - spanX * 0.12,
    points.pitch.y - spanY * 0.10
  );

  // =========================
  // 第二段（pitch -> hollow）
  // =========================

  points.cp2a = new Point(
    points.pitch.x + spanX * 0.10,
    points.pitch.y + spanY * 0.12
  );

  points.cp2b = new Point(
    points.hollow.x - spanX * 0.12,
    points.hollow.y - spanY * 0.08
  );

  // =========================
  // 第三段（hollow -> 腋下）
  // =========================

  points.cp3a = new Point(
    points.hollow.x + spanX * 0.04,
    points.hollow.y + spanY * 0.10
  );

  points.cp3b = new Point(
    W - spanX * 0.06,
    armholeD - spanY * 0.04
  );

  // =========================
  // 下摆弧度
  // =========================

  points.hemCp = new Point(
    W * 0.50,
    L + 1.2
  );

  // =========================
  // PATH
  // =========================

  const path = new Path()
    .move(points.cfTop)

    // 领口
    .quad(
      points.neckCp,
      points.neckPoint
    )

    // 肩线
    .line(points.shoulderPoint)

    // 袖窿上段
    .curve(
      points.cp1a,
      points.cp1b,
      points.pitch
    )

    // 袖窿中段
    .curve(
      points.cp2a,
      points.cp2b,
      points.hollow
    )

    // 袖窿下段
    .curve(
      points.cp3a,
      points.cp3b,
      points.armholeBottom
    )

    // 侧缝
    .line(points.sideHem)

    // 下摆
    .quad(
      points.hemCp,
      points.cfHem
    )

    .close();

  path.attr('class', 'fabric');

  return {
    name: 'front',
    path,
    points,
    seamAllowance,

    grainline: {
      start: new Point(8, 12),
      end: new Point(8, L - 12),
    },

    notches: [
      points.pitch
    ],

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
