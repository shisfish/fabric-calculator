import { Point, Path } from '../geometry/index.js';

interface ArmholeCurve {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

interface SleeveCapResult {
  capPath: Path;
  points: Record<string, Point>;
  frontCapLength: number;
  backCapLength: number;
  totalCapLength: number;
  frontArmholeLength: number;
  backArmholeLength: number;
  ease: number;
}

export class SleeveCapGenerator {

  static generateFromArmhole(
    frontArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    backArmholeOps: Array<{type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}; cp2?: {x: number; y: number}}>,
    sleeveParams: {
      bicepsWidth: number;
      sleeveCapHeight: number;
      sleeveLength: number;
      cuffWidth: number;
    },
    ease: number = 0.5
  ): SleeveCapResult {

    const frontCurves = this.extractArmholeCurves(frontArmholeOps);
    const backCurves = this.extractArmholeCurves(backArmholeOps);

    const frontArmholeLength = this.calculateCurveLengths(frontCurves);
    const backArmholeLength = this.calculateCurveLengths(backCurves);
    
    const totalArmholeLength = frontArmholeLength + backArmholeLength;
    const targetCapLength = totalArmholeLength + ease;

    const bW = sleeveParams.bicepsWidth;
    const cH = sleeveParams.sleeveCapHeight;
    const sL = sleeveParams.sleeveLength;
    const cuW = sleeveParams.cuffWidth;

    const points: Record<string, Point> = {};

    points.capTop = new Point(0, 0);
    points.frontAxilla = new Point(bW / 2, cH);
    points.backAxilla = new Point(-bW / 2, cH);
    points.frontCuff = new Point(cuW / 2, cH + sL);
    points.backCuff = new Point(-cuW / 2, cH + sL);

    const frontTargetLength = frontArmholeLength + (ease * 0.45);
    const backTargetLength = backArmholeLength + (ease * 0.55);

    const frontCap = this.generateFrontSleeveCap(
      points.capTop,
      points.frontAxilla,
      frontTargetLength,
      cH,
      bW
    );

    const backCap = this.generateBackSleeveCap(
      points.capTop,
      points.backAxilla,
      backTargetLength,
      cH,
      bW
    );

    Object.assign(points, frontCap.points);
    Object.assign(points, backCap.points);

    const capPath = new Path()
      .move(points.capTop)
      .curve(frontCap.cp1, frontCap.cp2, points.frontAxilla)
      .line(points.frontCuff)
      .line(points.backCuff)
      .curve(backCap.cp2, backCap.cp1, points.capTop)
      .close();

    const actualFrontCapLength = this.calculateBezierLength(
      points.capTop,
      frontCap.cp1,
      frontCap.cp2,
      points.frontAxilla
    );
    
    const actualBackCapLength = this.calculateBezierLength(
      points.capTop,
      backCap.cp1,
      backCap.cp2,
      points.backAxilla
    );

    return {
      capPath,
      points,
      frontCapLength: actualFrontCapLength,
      backCapLength: actualBackCapLength,
      totalCapLength: actualFrontCapLength + actualBackCapLength,
      frontArmholeLength,
      backArmholeLength,
      ease
    };
  }

  private static extractArmholeCurves(ops: Array<{
    type: string;
    to?: {x: number; y: number};
    cp1?: {x: number; y: number};
    cp2?: {x: number; y: number}
  }>): ArmholeCurve[] {
    const curves: ArmholeCurve[] = [];
    let currentStart: Point | null = null;

    for (const op of ops) {
      if (op.type === 'move' && op.to) {
        currentStart = new Point(op.to.x, op.to.y);
      } else if (op.type === 'curve' && op.to && op.cp1 && op.cp2 && currentStart) {
        curves.push({
          start: currentStart,
          cp1: new Point(op.cp1.x, op.cp1.y),
          cp2: new Point(op.cp2.x, op.cp2.y),
          end: new Point(op.to.x, op.to.y)
        });
        currentStart = new Point(op.to.x, op.to.y);
      }
    }

    return curves;
  }

  private static calculateCurveLengths(curves: ArmholeCurve[]): number {
    let totalLength = 0;
    
    for (const curve of curves) {
      totalLength += this.calculateBezierLength(
        curve.start,
        curve.cp1,
        curve.cp2,
        curve.end
      );
    }
    
    return totalLength;
  }

  static calculateBezierLength(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    segments: number = 50
  ): number {
    let length = 0;
    let prevPoint = p0;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      
      const x = mt*mt*mt * p0.x + 3*mt*mt*t * p1.x + 3*mt*t*t * p2.x + t*t*t * p3.x;
      const y = mt*mt*mt * p0.y + 3*mt*mt*t * p1.y + 3*mt*t*t * p2.y + t*t*t * p3.y;
      
      const currPoint = new Point(x, y);
      length += prevPoint.dist(currPoint);
      prevPoint = currPoint;
    }

    return length;
  }

  private static generateFrontSleeveCap(
    top: Point,
    axilla: Point,
    targetLength: number,
    capHeight: number,
    bicepsWidth: number
  ): {cp1: Point; cp2: Point; points: Record<string, Point>} {

    const points: Record<string, Point> = {};
    
    const halfBicep = bicepsWidth / 2;
    
    const frontPitchX = halfBicep * 0.35;
    const frontPitchY = capHeight * 0.38;
    
    points.frontPitch = new Point(frontPitchX, frontPitchY);

    const straightDist = Math.sqrt(
      Math.pow(axilla.x - top.x, 2) + 
      Math.pow(axilla.y - top.y, 2)
    );

    const curveRatio = targetLength / straightDist;
    
    const baseOutward = halfBicep * 0.25 * Math.min(curveRatio - 1, 0.3);
    const outward = Math.max(baseOutward, halfBicep * 0.08);

    const cp1X = top.x + outward * 0.6;
    const cp1Y = top.y + capHeight * 0.28;
    points.frontCapCp1 = new Point(cp1X, cp1Y);

    const cp2X = axilla.x - outward * 0.3;
    const cp2Y = axilla.y - capHeight * 0.18;
    points.frontCapCp2 = new Point(cp2X, cp2Y);

    let currentLength = this.calculateBezierLength(top, points.frontCapCp1, points.frontCapCp2, axilla);
    
    if (Math.abs(currentLength - targetLength) > 0.5) {
      const adjustment = targetLength / currentLength;
      const adjustedOutward = outward * adjustment;
      
      points.frontCapCp1 = new Point(
        top.x + adjustedOutward * 0.6,
        top.y + capHeight * 0.28
      );
      points.frontCapCp2 = new Point(
        axilla.x - adjustedOutward * 0.3,
        axilla.y - capHeight * 0.18
      );
    }

    points.frontNotch = new Point(
      frontPitchX + halfBicep * 0.15,
      frontPitchY + capHeight * 0.12
    );

    return {
      cp1: points.frontCapCp1,
      cp2: points.frontCapCp2,
      points
    };
  }

  private static generateBackSleeveCap(
    top: Point,
    axilla: Point,
    targetLength: number,
    capHeight: number,
    bicepsWidth: number
  ): {cp1: Point; cp2: Point; points: Record<string, Point>} {

    const points: Record<string, Point> = {};
    
    const halfBicep = bicepsWidth / 2;
    
    const backPitchX = -halfBicep * 0.32;
    const backPitchY = capHeight * 0.30;
    
    points.backPitch = new Point(backPitchX, backPitchY);

    const straightDist = Math.sqrt(
      Math.pow(axilla.x - top.x, 2) + 
      Math.pow(axilla.y - top.y, 2)
    );

    const curveRatio = targetLength / straightDist;
    
    const baseOutward = halfBicep * 0.30 * Math.min(curveRatio - 1, 0.35);
    const outward = Math.max(baseOutward, halfBicep * 0.10);

    const cp1X = top.x - outward * 0.5;
    const cp1Y = top.y + capHeight * 0.22;
    points.backCapCp1 = new Point(cp1X, cp1Y);

    const cp2X = axilla.x + outward * 0.4;
    const cp2Y = axilla.y - capHeight * 0.12;
    points.backCapCp2 = new Point(cp2X, cp2Y);

    let currentLength = this.calculateBezierLength(top, points.backCapCp1, points.backCapCp2, axilla);
    
    if (Math.abs(currentLength - targetLength) > 0.5) {
      const adjustment = targetLength / currentLength;
      const adjustedOutward = outward * adjustment;
      
      points.backCapCp1 = new Point(
        top.x - adjustedOutward * 0.5,
        top.y + capHeight * 0.22
      );
      points.backCapCp2 = new Point(
        axilla.x + adjustedOutward * 0.4,
        axilla.y - capHeight * 0.12
      );
    }

    points.backNotch = new Point(
      backPitchX - halfBicep * 0.12,
      backPitchY + capHeight * 0.10
    );

    return {
      cp1: points.backCapCp1,
      cp2: points.backCapCp2,
      points
    };
  }
}
