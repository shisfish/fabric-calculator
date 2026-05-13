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
    const neckD = bp.neckDepth; // 后领深通常很浅 (2-3cm)
    const shoulderW = bp.shoulderWidth;
    const armholeD = bp.armholeDepth;

    // 1. 基础点：以 HPS 为 (neckW, 0)
    points.hps = new Point(neckW, 0);
    points.cbNeck = new Point(0, neckD); // 后中领深点
    points.cbHem = new Point(0, L);      // 后中下摆
    points.hem = new Point(W, L);        // 侧缝下摆
    points.armholeEnd = new Point(W, armholeD); // 腋下点

    // 2. 肩点计算 (后肩通常比前肩略高或倾斜度略小)
    const shoulderDrop = Math.tan((bp.shoulderSlope ?? 12) * Math.PI / 180) * shoulderW;
    points.shoulder = new Point(neckW + shoulderW, shoulderDrop);

    // 3. 后领口控制点 (确保后中平齐)
    points.neckCp = new Point(neckW * 0.4, neckD);

    // 4. 后袖窿曲线 (比前片更平直一些)
    const armholeW = W - points.shoulder.x;
    const armholeH = armholeD - shoulderDrop;
    
    // 后袖窿 Pitch 点 (位置稍高)
    points.armholePitch = new Point(points.shoulder.x + armholeW * 0.1, shoulderDrop + armholeH * 0.4);
    points.armholeCp1 = new Point(points.armholePitch.x, points.armholePitch.y + armholeH * 0.3);
    points.armholeCp2 = new Point(points.armholeEnd.x - armholeW * 0.3, points.armholeEnd.y);

    const path = new Path()
      .move(new Point(0, 0)) // 辅助点
      .move(points.cbNeck)
      .quad(points.neckCp, points.hps) // 后领弧线
      .line(points.shoulder)          // 肩线必须是直线
      .curve(points.shoulder, points.armholePitch, points.armholePitch) // 袖窿上段
      .curve(points.armholeCp1, points.armholeCp2, points.armholeEnd)   // 袖窿下段
      .line(points.hem)
      .line(points.cbHem)
      .close();

    return { name: 'back', path, points, seamAllowance, cutCount: 1, onFold: true };
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
    const halfBiceps = sl.bicepsWidth / 2;
    const capH = sl.sleeveCapHeight;
    const fullL = sl.sleeveLength + capH;
    const halfCuff = sl.cuffWidth / 2;

    // 核心坐标
    points.capTop = new Point(0, 0);
    points.backAxilla = new Point(-halfBiceps, capH);  // 后腋下
    points.frontAxilla = new Point(halfBiceps, capH); // 前腋下
    points.backCuff = new Point(-halfCuff, fullL);
    points.frontCuff = new Point(halfCuff, fullL);

    // 袖山曲线控制点 (S形曲线)
    // 前袖山 (通常更凹)
    points.fCp1 = new Point(halfBiceps * 0.4, 0); // 靠近顶点，平出
    points.fCp2 = new Point(halfBiceps * 0.7, capH * 0.1);
    points.fCp3 = new Point(halfBiceps * 0.5, capH * 0.9);
    points.fCp4 = new Point(halfBiceps, capH);

    // 后袖山 (更饱满)
    points.bCp1 = new Point(-halfBiceps * 0.4, 0);
    points.bCp2 = new Point(-halfBiceps * 0.9, capH * 0.2);
    points.bCp3 = new Point(-halfBiceps * 0.8, capH * 0.8);
    points.bCp4 = new Point(-halfBiceps, capH);

    const path = new Path()
      .move(points.capTop)
      // 绘制前袖山 (顶点 -> 前腋下)
      .curve(points.fCp1, points.fCp2, new Point(halfBiceps * 0.8, capH * 0.5))
      .curve(new Point(halfBiceps * 0.9, capH * 0.8), points.frontAxilla, points.frontAxilla)
      // 侧缝与袖口
      .line(points.frontCuff)
      .line(points.backCuff)
      .line(points.backAxilla)
      // 绘制后袖山 (后腋下 -> 顶点)
      .curve(new Point(-halfBiceps * 0.9, capH * 0.8), points.bCp2, points.capTop)
      .close();

    return { name: 'sleeve', path, points, seamAllowance, cutCount: 2, onFold: false };
  }
}
