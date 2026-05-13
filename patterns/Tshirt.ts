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

    // 基础参数定义
  const W = fp.width;           // 1/4 胸围
  const L = fp.length;          // 衣长
  const neckW = fp.neckWidth;   // 领宽
  const neckD = fp.neckDepth;   // 领深
  const shoulderW = fp.shoulderWidth; // 总肩宽（通常指中心到肩点的水平距离）
  const armholeD = fp.armholeDepth;   // 腋下深度坐标

  // 1. 肩斜落差计算 (增加更明显的斜度)
  const shoulderSlopeDeg = fp.shoulderSlope ?? 20; // 提升默认斜度到20度
  const shoulderDrop = Math.tan(shoulderSlopeDeg * Math.PI / 180) * (shoulderW - neckW);

  // 2. 基础点定位
  points.cfNeck = new Point(0, 0); // 前中领底点（以此为0,0或由neckD决定，此处逻辑保持一致）
  
  // 领口：Q 的控制点应水平向右，确保中心垂直
  points.neckCp = new Point(neckW * 0.5, 0);
  points.neckEnd = new Point(neckW, -neckD); // 假设neckD为正值，向上偏移至HPS点

  // 肩点：基于 shoulderW 绝对位置
  points.shoulder = new Point(shoulderW, -neckD + shoulderDrop);

  // 腋下点
  points.armholeEnd = new Point(W, armholeD);

  // 3. 袖窿关键参数
  const armholeTotalHeight = points.armholeEnd.y - points.shoulder.y;
  const armholeTotalWidth = W - shoulderW;

  // Pitch 点 (上三分之一处，向内收)
  points.armholePitch = new Point(
    shoulderW + armholeTotalWidth * 0.1, // 略微外扩
    points.shoulder.y + armholeTotalHeight * 0.3
  );

  // Hollow 点 (下三分之一处，最凹处)
  points.armholeHollow = new Point(
    W - armholeTotalWidth * 0.05, 
    points.shoulder.y + armholeTotalHeight * 0.7
  );

  // 4. 三段式三次贝塞尔控制点优化 (G1/G2 连续逻辑)
  
  // 第一段：Shoulder -> Pitch (应向下垂直延伸)
  points.armholeTopCp1 = new Point(points.shoulder.x, points.shoulder.y + armholeTotalHeight * 0.1);
  points.armholeTopCp2 = new Point(points.armholePitch.x, points.armholePitch.y - armholeTotalHeight * 0.1);

  // 第二段：Pitch -> Hollow (内凹弧度)
  points.armholeMidCp1 = new Point(points.armholePitch.x, points.armholePitch.y + armholeTotalHeight * 0.15);
  points.armholeMidCp2 = new Point(points.armholeHollow.x - 2, points.armholeHollow.y - armholeTotalHeight * 0.1);

  // 第三段：Hollow -> ArmholeEnd (平滑切入腋下)
  // CP2 必须与 ArmholeEnd 水平对齐，确保侧缝连接平顺
  points.armholeBottomCp1 = new Point(points.armholeHollow.x + 2, points.armholeHollow.y + armholeTotalHeight * 0.1);
  points.armholeBottomCp2 = new Point(points.armholeEnd.x - armholeTotalWidth * 0.4, points.armholeEnd.y);

  // 5. 下摆逻辑
  points.sideBottom = new Point(W, L);
  points.hemFold = new Point(0, L);
  points.hemCp = new Point(W * 0.5, L + 1.5); // 增加下摆弧度

  const path = new Path()
    .move(points.cfNeck)
    .quad(points.neckCp, points.neckEnd)
    .line(points.shoulder)
    .curve(points.armholeTopCp1, points.armholeTopCp2, points.armholePitch)
    .curve(points.armholeMidCp1, points.armholeMidCp2, points.armholeHollow)
    .curve(points.armholeBottomCp1, points.armholeBottomCp2, points.armholeEnd)
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
