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

    // --- 1. 基础参数与常量计算 ---
    const { width: W, length: L, neckWidth: nW, neckDepth: nD, shoulderWidth: sW, armholeDepth: aD } = bp;
    const sSlope = bp.shoulderSlope ?? 12;
    const sDrop = Math.tan(sSlope * Math.PI / 180) * sW;
    
    // 计算袖窿核心常量
    const aW = W - (nW + sW); 
    const aH = aD - sDrop;

    // --- 2. 关键点定义 (以中心线为 X=0) ---
    // 右侧点
    points.hps_R = new Point(nW, 0);
    points.shoulder_R = new Point(nW + sW, sDrop);
    points.armholeEnd_R = new Point(W, aD);
    points.hem_R = new Point(W, L);
    
    // 左侧点 (镜像)
    points.hps_L = new Point(-nW, 0);
    points.shoulder_L = new Point(-(nW + sW), sDrop);
    points.armholeEnd_L = new Point(-W, aD);
    points.hem_L = new Point(-W, L);

    // 中线点
    points.cbNeck = new Point(0, nD);
    points.cbHem = new Point(0, L);

    // --- 3. 曲线控制点计算 ---
    // 领口控制点
    points.neckCp_R = new Point(nW * 0.4, nD);
    points.neckCp_L = new Point(-nW * 0.4, nD);

    // 袖窿控制点 (右侧)
    points.aPitch_R = new Point(points.shoulder_R.x + aW * 0.1, sDrop + aH * 0.4);
    points.aCp1_R = new Point(points.aPitch_R.x, points.aPitch_R.y + aH * 0.3);
    points.aCp2_R = new Point(points.armholeEnd_R.x - aW * 0.3, points.armholeEnd_R.y);

    // 袖窿控制点 (左侧镜像)
    points.aPitch_L = new Point(-points.aPitch_R.x, points.aPitch_R.y);
    points.aCp1_L = new Point(-points.aCp1_R.x, points.aCp1_R.y);
    points.aCp2_L = new Point(-points.aCp2_R.x, points.aCp2_R.y);

    // --- 4. 构建全铺开路径 ---
    const path = new Path()
      .move(points.cbNeck)
      // 连向右侧
      .quad(points.neckCp_R, points.hps_R)
      .line(points.shoulder_R)
      .line(points.aPitch_R)
      .curve(points.aCp1_R, points.aCp2_R, points.armholeEnd_R)
      .line(points.hem_R)
      .line(points.cbHem) // 连回中心底端
      // 连向左侧 (镜像)
      .line(points.hem_L)
      .line(points.armholeEnd_L)
      .curve(points.aCp2_L, points.aCp1_L, points.aPitch_L)
      .line(points.shoulder_L)
      .line(points.hps_L)
      .quad(points.neckCp_L, points.cbNeck)
      .close();

    return { name: 'back', path, points, seamAllowance, cutCount: 1, onFold: false };
  }

  private static generateFrontPanel(fp: FrontPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const W = fp.width;
    const L = fp.length;
    const neckW = fp.neckWidth;
    const neckD = fp.neckDepth;
    const shoulderW = fp.shoulderWidth;
    const armholeD = fp.armholeDepth;

    // 1. 领口：以 HPS (肩颈点) 为 Y=0 基准，向下推算领深
    points.cfNeck = new Point(0, neckD);
    points.neckEnd = new Point(neckW, 0);
    // 领口控制点：保持在最低点同一水平线，确保前中无折角
    points.neckCp = new Point(neckW * 0.42, neckD); 

    // 2. 肩点：基于工业比例计算，确保肩点始终在领口右侧
    // 工业规则：shoulder.x = neckW + shoulderW * ratio
    // 其中ratio (0.4~0.5) 控制肩线长度和角度
    const shoulderDrop = Math.tan((fp.shoulderSlope ?? 5.5) * Math.PI / 180) * shoulderW;
    const shoulderX = neckW + shoulderW * 0.45;
    points.shoulder = new Point(shoulderX, shoulderDrop);

    // 3. 侧缝与下摆锚点
    points.armholeEnd = new Point(W, armholeD);
    points.sideBottom = new Point(W, L);
    points.hemFold = new Point(0, L);
    points.hemCp = new Point(W * 0.48, L + 1);

    // 4. 袖窿核心计算 (抛弃三段式，改为极简平滑的两段式)
    const armholeW = W - shoulderX;
    const armholeH = armholeD - shoulderDrop;

    // Pitch 点：定位在袖窿上 1/3 处
    points.armholePitch = new Point(
      shoulderX + armholeW * 0.15,
      shoulderDrop + armholeH * 0.35
    );

    // --- 第一段曲线控制点：Shoulder -> Pitch ---
    points.armholeTopCp1 = new Point(
      points.shoulder.x + armholeW * 0.05,
      points.shoulder.y + armholeH * 0.15
    );
    points.armholeTopCp2 = new Point(
      points.armholePitch.x - armholeW * 0.1,
      points.armholePitch.y - armholeH * 0.15
    );

    // --- 第二段曲线控制点：Pitch -> ArmholeEnd ---
    // 关键修正1：通过向量计算，强制过 Pitch 点时的切线连续 (G1 G2 平滑)
    const tangentX = points.armholePitch.x - points.armholeTopCp2.x;
    const tangentY = points.armholePitch.y - points.armholeTopCp2.y;
    points.armholeBottomCp1 = new Point(
      points.armholePitch.x + tangentX * 1.5, // 1.5为张力倍数，决定下半部分饱满度
      points.armholePitch.y + tangentY * 1.5
    );

    // 关键修正2：强制进入腋下时 Y 坐标相等 (绝对水平入缝)
    points.armholeBottomCp2 = new Point(
      points.armholeEnd.x - armholeW * 0.45,
      points.armholeEnd.y 
    );

    // 5. 构建路径 (合并为 M Q L C C L Q Z)
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

  private static generateSleeve(sl: SleeveParams, _bp: BackPanelParams, _fp: FrontPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};

    // --- 1. 基础参数计算 ---
    const { bicepsWidth, sleeveCapHeight: capH, sleeveLength, cuffWidth } = sl;
    const halfBicep = bicepsWidth / 2;
    const halfCuff = cuffWidth / 2;
    const totalL = sleeveLength + capH;

    // --- 2. 核心骨架点 ---
    points.capTop = new Point(0, 0);                 // 袖山顶点
    points.backAxilla = new Point(-halfBicep, capH); // 后腋下点 (左)
    points.frontAxilla = new Point(halfBicep, capH); // 前腋下点 (右)
    points.backCuff = new Point(-halfCuff, totalL);  // 后袖口
    points.frontCuff = new Point(halfCuff, totalL); // 前袖口

    // --- 3. 袖山曲线控制点 (模拟人体工学 S 曲线) ---
    // 前袖山 (Front): 进深更大，更凹
    points.fCp1 = new Point(halfBicep * 0.35, 0);           // 顶点出线平滑
    points.fCp2 = new Point(halfBicep * 0.7, capH * 0.05);  // 前上部饱满度
    points.fCp3 = new Point(halfBicep * 0.45, capH * 0.95); // 前腋下深挖点
    
    // 后袖山 (Back): 更加圆润饱满
    points.bCp1 = new Point(-halfBicep * 0.3, 0);
    points.bCp2 = new Point(-halfBicep * 0.85, capH * 0.15);
    points.bCp3 = new Point(-halfBicep * 0.75, capH * 0.85);

    // --- 4. 路径构建 ---
    const path = new Path()
      .move(points.capTop)
      // 绘制前袖山 (顶点 -> 前腋下)
      .curve(points.fCp1, points.fCp2, new Point(halfBicep * 0.8, capH * 0.5))
      .curve(new Point(halfBicep * 0.9, capH * 0.8), points.frontAxilla, points.frontAxilla)
      // 侧缝与袖口
      .line(points.frontCuff)
      .line(points.backCuff)
      .line(points.backAxilla)
      // 绘制后袖山 (后腋下 -> 顶点)
      .curve(points.bCp3, points.bCp2, points.capTop)
      .close();

    path.attr('class', 'fabric');
    return { name: 'sleeve', path, points, seamAllowance, cutCount: 2, onFold: false };
  }
}
