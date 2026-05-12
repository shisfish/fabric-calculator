import { Point, Path } from '../geometry/index.js';

export interface Measurements {
  chest: number;
  waist: number;
  hips: number;
  neck: number;
  shoulderToShoulder: number;
  shoulderSlope: number;
  biceps: number;
  wrist: number;
  hpsToWaistFront: number;
  hpsToWaistBack: number;
  waistToHips: number;
  hpsToBust?: number;
  bustSpan?: number;
}

export interface PatternOptions {
  chestEase: number;
  waistEase: number;
  hipsEase: number;
  bicepsEase: number;
  collarEase: number;
  cuffEase: number;
  shoulderEase: number;
  lengthBonus: number;
  sleeveLengthBonus: number;
  armholeDepthFactor: number;
  neckCutoutFront: number;
  neckCutoutBack: number;
  shoulderSlopeReduction: number;
  acrossBackFactor: number;
  hemCurve: number;
  sideSeamShift: number;
}

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

export const DEFAULT_OPTIONS: PatternOptions = {
  chestEase: 15,
  waistEase: 10,
  hipsEase: 10,
  bicepsEase: 15,
  collarEase: 5,
  cuffEase: 20,
  shoulderEase: 0,
  lengthBonus: 0,
  sleeveLengthBonus: 0,
  armholeDepthFactor: 0.55,
  neckCutoutFront: 0.07,
  neckCutoutBack: 0.04,
  shoulderSlopeReduction: 0,
  acrossBackFactor: 0.98,
  hemCurve: 0,
  sideSeamShift: 0,
};

export const DEFAULT_MEASUREMENTS: Measurements = {
  chest: 100,
  waist: 85,
  hips: 100,
  neck: 40,
  shoulderToShoulder: 42,
  shoulderSlope: 22,
  biceps: 35,
  wrist: 18,
  hpsToWaistFront: 45,
  hpsToWaistBack: 43,
  waistToHips: 20,
};

export class TshirtPatternGenerator {
  measurements: Measurements;
  options: PatternOptions;
  pieces: PatternPiece[] = [];

  constructor(measurements: Partial<Measurements> = {}, options: Partial<PatternOptions> = {}) {
    this.measurements = { ...DEFAULT_MEASUREMENTS, ...measurements };
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  generate(): PatternPiece[] {
    this.pieces = [];
    this.generateBackPanel();
    this.generateFrontPanel();
    this.generateSleeve();
    return this.pieces;
  }

  private generateBackPanel(): void {
    const m = this.measurements;
    const o = this.options;

    const points: Record<string, Point> = {};

    const chestWidth = (m.chest * (1 + o.chestEase / 100)) / 4;
    const shoulderWidth = m.shoulderToShoulder / 2 + o.shoulderEase / 2;
    const neckWidth = m.neck * (1 + o.collarEase / 100) / 5;
    const neckDepth = m.neck * o.neckCutoutBack;

    points.cbHps = new Point(0, 0);
    points.cbNeck = new Point(0, neckDepth);
    points.cbWaist = new Point(0, m.hpsToWaistBack);
    points.cbHips = new Point(0, m.hpsToWaistBack + m.waistToHips);
    points.cbHem = new Point(0, m.hpsToWaistBack + m.waistToHips * (1 + o.lengthBonus / 100));

    points.neck = new Point(neckWidth, 0);
    points.hps = points.neck.clone();

    const shoulderAngle = m.shoulderSlope * (1 - o.shoulderSlopeReduction / 100);
    points.shoulder = new Point(shoulderWidth, 0).rotate(-shoulderAngle, points.hps);

    const armholeDepth = m.biceps * (1 + o.bicepsEase / 100) * o.armholeDepthFactor;
    points.cbArmhole = new Point(0, points.shoulder.y + armholeDepth);
    points.armhole = new Point(chestWidth, points.cbArmhole.y);

    points.armholePitch = new Point(
      m.shoulderToShoulder * o.acrossBackFactor / 2,
      points.shoulder.y + points.shoulder.dy(points.armhole) * 0.45
    );

    points.waist = new Point(chestWidth, points.cbWaist.y);
    points.hips = new Point(chestWidth, points.cbHips.y);
    points.hem = new Point(chestWidth, points.cbHem.y);

    points.neckCp2 = points.neck.shift(-90, neckDepth * 0.6);
    points.shoulderCp1 = points.shoulder.shift(180, points.shoulder.dy(points.armholePitch) * 0.2);
    points.armholePitchCp1 = points.armholePitch.shift(-90, points.armholePitch.dy(points.armhole) * 0.5);
    points.armholePitchCp2 = points.armholePitch.shift(90, points.shoulder.dy(points.armholePitch) * 0.5);

    const armholeHollowX = points.armholePitch.x + (points.armhole.x - points.armholePitch.x) * 0.3;
    points.armholeHollow = new Point(armholeHollowX, points.armhole.y - (points.armhole.y - points.armholePitch.y) * 0.15);
    points.armholeCp2 = points.armhole.shift(180, chestWidth * 0.1);
    points.armholeHollowCp1 = points.armholeHollow.shift(-45, points.armholeHollow.dy(points.armhole) * 0.6);
    points.armholeHollowCp2 = points.armholeHollow.shift(135, points.armholePitch.dx(points.armholeHollow) * 0.8);

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

    const piece: PatternPiece = {
      name: 'back',
      path,
      points,
      seamAllowance: 1,
      grainline: {
        start: new Point(10, points.cbNeck.y + 10),
        end: new Point(10, points.cbHem.y - 10),
      },
      notches: [points.armholePitch],
      cutCount: 1,
      onFold: true,
    };

    this.pieces.push(piece);
  }

  private generateFrontPanel(): void {
    const m = this.measurements;
    const o = this.options;

    const points: Record<string, Point> = {};

    const chestWidth = (m.chest * (1 + o.chestEase / 100)) / 4;
    const shoulderWidth = m.shoulderToShoulder / 2 + o.shoulderEase / 2;
    const neckWidth = m.neck * (1 + o.collarEase / 100) / 5;
    const neckDepthFront = m.neck * o.neckCutoutFront;

    points.cfHps = new Point(0, 0);
    points.cfNeck = new Point(0, neckDepthFront);
    points.cfWaist = new Point(0, m.hpsToWaistFront);
    points.cfHips = new Point(0, m.hpsToWaistFront + m.waistToHips);
    points.cfHem = new Point(0, m.hpsToWaistFront + m.waistToHips * (1 + o.lengthBonus / 100));

    points.neck = new Point(neckWidth, 0);
    points.hps = points.neck.clone();

    const shoulderAngle = m.shoulderSlope * (1 - o.shoulderSlopeReduction / 100);
    points.shoulder = new Point(shoulderWidth, 0).rotate(-shoulderAngle, points.hps);

    const armholeDepth = m.biceps * (1 + o.bicepsEase / 100) * o.armholeDepthFactor;
    points.cfArmhole = new Point(0, points.shoulder.y + armholeDepth);
    points.armhole = new Point(chestWidth, points.cfArmhole.y);

    points.armholePitch = new Point(
      m.shoulderToShoulder * o.acrossBackFactor / 2,
      points.shoulder.y + points.shoulder.dy(points.armhole) * 0.5
    );

    points.waist = new Point(chestWidth, points.cfWaist.y);
    points.hips = new Point(chestWidth, points.cfHips.y);
    points.hem = new Point(chestWidth, points.cfHem.y);

    points.neckCp2 = points.neck.shift(-90, neckDepthFront * 0.5);
    points.cfNeckCp1 = points.cfNeck.shift(0, neckWidth * 0.5);

    points.shoulderCp1 = points.shoulder.shift(180, points.shoulder.dy(points.armholePitch) * 0.15);
    points.armholePitchCp1 = points.armholePitch.shift(-90, points.armholePitch.dy(points.armhole) * 0.4);
    points.armholePitchCp2 = points.armholePitch.shift(90, points.shoulder.dy(points.armholePitch) * 0.4);

    const armholeHollowX = points.armholePitch.x + (points.armhole.x - points.armholePitch.x) * 0.35;
    points.armholeHollow = new Point(armholeHollowX, points.armhole.y - (points.armhole.y - points.armholePitch.y) * 0.1);
    points.armholeCp2 = points.armhole.shift(180, chestWidth * 0.08);
    points.armholeHollowCp1 = points.armholeHollow.shift(-45, points.armholeHollow.dy(points.armhole) * 0.5);
    points.armholeHollowCp2 = points.armholeHollow.shift(135, points.armholePitch.dx(points.armholeHollow) * 0.7);

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

    const piece: PatternPiece = {
      name: 'front',
      path,
      points,
      seamAllowance: 1,
      grainline: {
        start: new Point(10, points.cfNeck.y + 10),
        end: new Point(10, points.cfHem.y - 10),
      },
      notches: [points.armholePitch],
      cutCount: 1,
      onFold: false,
    };

    this.pieces.push(piece);
  }

  private generateSleeve(): void {
    const m = this.measurements;
    const o = this.options;

    const backPiece = this.pieces.find(p => p.name === 'back');
    const frontPiece = this.pieces.find(p => p.name === 'front');

    if (!backPiece || !frontPiece) {
      throw new Error('Back and front panels must be generated before sleeve');
    }

    const points: Record<string, Point> = {};

    const bicepsWidth = m.biceps * (1 + o.bicepsEase / 100);
    const sleeveLength = m.hpsToWaistFront * 0.35 + o.sleeveLengthBonus;
    const cuffWidth = m.wrist * (1 + o.cuffEase / 100);

    const backArmholeLength = this.calculateArmholeLength(backPiece);
    const frontArmholeLength = this.calculateArmholeLength(frontPiece);
    const totalArmholeLength = backArmholeLength + frontArmholeLength;

    points.sleeveCapTop = new Point(0, 0);

    const sleeveCapHeight = totalArmholeLength * 0.15;
    const halfBiceps = bicepsWidth / 2;

    points.backSleeveSide = new Point(-halfBiceps, sleeveCapHeight);
    points.frontSleeveSide = new Point(halfBiceps, sleeveCapHeight);

    points.backSleeveCap = new Point(-halfBiceps * 0.3, 0);
    points.frontSleeveCap = new Point(halfBiceps * 0.3, 0);

    const capCurveDepth = sleeveCapHeight * 0.6;
    points.backCapCp1 = points.sleeveCapTop.shift(-135, capCurveDepth * 0.5);
    points.backCapCp2 = points.backSleeveSide.shift(90, capCurveDepth * 0.8);
    points.frontCapCp1 = points.sleeveCapTop.shift(-45, capCurveDepth * 0.5);
    points.frontCapCp2 = points.frontSleeveSide.shift(90, capCurveDepth * 0.8);

    points.backCuff = new Point(-cuffWidth / 2, sleeveCapHeight + sleeveLength);
    points.frontCuff = new Point(cuffWidth / 2, sleeveCapHeight + sleeveLength);

    points.backCuffCp = points.backCuff.shift(90, sleeveLength * 0.3);
    points.frontCuffCp = points.frontCuff.shift(90, sleeveLength * 0.3);

    const path = new Path()
      .move(points.sleeveCapTop)
      .curve(points.backCapCp1, points.backCapCp2, points.backSleeveSide)
      .line(points.backCuff)
      .line(points.frontCuff)
      .line(points.frontSleeveSide)
      .curve(points.frontCapCp2, points.frontCapCp1, points.sleeveCapTop)
      .close();

    path.attr('class', 'fabric');

    const piece: PatternPiece = {
      name: 'sleeve',
      path,
      points,
      seamAllowance: 1,
      grainline: {
        start: new Point(0, sleeveCapHeight + 20),
        end: new Point(0, sleeveCapHeight + sleeveLength - 20),
      },
      notches: [points.sleeveCapTop],
      cutCount: 2,
      onFold: false,
    };

    this.pieces.push(piece);
  }

  private calculateArmholeLength(piece: PatternPiece): number {
    const points = piece.points;
    let length = 0;

    const armholePoints = [
      points.armhole,
      points.armholeHollow,
      points.armholePitch,
      points.shoulder,
    ];

    for (let i = 0; i < armholePoints.length - 1; i++) {
      length += armholePoints[i].dist(armholePoints[i + 1]);
    }

    return length * 1.2;
  }

  getPiece(name: string): PatternPiece | undefined {
    return this.pieces.find(p => p.name === name);
  }

  toSVG(): string {
    let svg = '<?xml version="1.0" encoding="UTF-8"?>\n';
    svg += '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500" viewBox="0 0 1000 1500">\n';

    let offsetX = 50;
    let offsetY = 50;

    for (const piece of this.pieces) {
      const bbox = piece.path.getBoundingBox();
      if (!bbox) continue;

      const width = bbox.bottomRight.x - bbox.topLeft.x;
      const height = bbox.bottomRight.y - bbox.topLeft.y;

      const transformedPath = piece.path.translate(offsetX - bbox.topLeft.x, offsetY - bbox.topLeft.y);

      svg += `  <g id="${piece.name}">\n`;
      svg += `    ${transformedPath.toSVGElement()}\n`;

      if (piece.grainline) {
        const gs = piece.grainline.start.translate(offsetX - bbox.topLeft.x, offsetY - bbox.topLeft.y);
        const ge = piece.grainline.end.translate(offsetX - bbox.topLeft.x, offsetY - bbox.topLeft.y);
        svg += `    <line x1="${gs.x}" y1="${gs.y}" x2="${ge.x}" y2="${ge.y}" stroke="black" stroke-width="1" stroke-dasharray="10,5"/>\n`;
      }

      for (const notch of piece.notches || []) {
        const n = notch.translate(offsetX - bbox.topLeft.x, offsetY - bbox.topLeft.y);
        svg += `    <circle cx="${n.x}" cy="${n.y}" r="3" fill="black"/>\n`;
      }

      svg += `    <text x="${offsetX + width / 2}" y="${offsetY + height + 20}" text-anchor="middle" font-size="14">${piece.name}</text>\n`;
      svg += `  </g>\n`;

      offsetX += width + 100;
      if (offsetX > 800) {
        offsetX = 50;
        offsetY += height + 100;
      }
    }

    svg += '</svg>';
    return svg;
  }
}
