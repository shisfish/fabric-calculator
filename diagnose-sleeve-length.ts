import { TshirtPatternGenerator } from './patterns/Tshirt.js';
import { Point } from './geometry/Point.js';

function cubicBezierLength(p0: Point, p1: Point, p2: Point, p3: Point, segments = 50): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const curr = new Point(
      mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
      mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
    );
    length += Math.sqrt((curr.x-prev.x)**2 + (curr.y-prev.y)**2);
    prev = curr;
  }
  return length;
}

function quadBezierLength(p0: Point, cp: Point, p1: Point, segments = 50): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const curr = new Point(
      mt*mt*p0.x + 2*mt*t*cp.x + t*t*p1.x,
      mt*mt*p0.y + 2*mt*t*cp.y + t*t*p1.y
    );
    length += Math.sqrt((curr.x-prev.x)**2 + (curr.y-prev.y)**2);
    prev = curr;
  }
  return length;
}

const testParams = {
  category: 'tshirt' as const,
  frontPanel: {
    width: 29, length: 72, neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26, shoulderSlope: 5.5,
    armholePitchX: 0.15, hemExtension: 0
  },
  backPanel: {
    width: 29, length: 72, neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26, shoulderSlope: 12,
    armholePitchX: 0.2, hemExtension: 0
  },
  sleeve: {
    bicepsWidth: 20, sleeveCapHeight: 14, sleeveLength: 58, cuffWidth: 8
  },
  seamAllowance: 0
};

const pieces = TshirtPatternGenerator.generatePattern(testParams);
const sleeve = pieces.find(p => p.name === 'sleeve')!;
const front = pieces.find(p => p.name === 'front')!;
const back = pieces.find(p => p.name === 'back')!;

const pts = sleeve.points;

console.log('=== 袖山关键点 ===');
console.log('capTop:', pts.capTop?.x.toFixed(2), pts.capTop?.y.toFixed(2));
console.log('frontPitch:', pts.frontPitch?.x.toFixed(2), pts.frontPitch?.y.toFixed(2));
console.log('frontAxilla:', pts.frontAxilla?.x.toFixed(2), pts.frontAxilla?.y.toFixed(2));
console.log('backPitch:', pts.backPitch?.x.toFixed(2), pts.backPitch?.y.toFixed(2));
console.log('backAxilla:', pts.backAxilla?.x.toFixed(2), pts.backAxilla?.y.toFixed(2));

console.log('\n=== 袖山控制点 ===');
console.log('upperFrontCp1:', pts.upperFrontCp1?.x.toFixed(2), pts.upperFrontCp1?.y.toFixed(2));
console.log('upperFrontCp2:', pts.upperFrontCp2?.x.toFixed(2), pts.upperFrontCp2?.y.toFixed(2));
console.log('lowerFrontCp1:', pts.lowerFrontCp1?.x.toFixed(2), pts.lowerFrontCp1?.y.toFixed(2));
console.log('lowerFrontCp2:', pts.lowerFrontCp2?.x.toFixed(2), pts.lowerFrontCp2?.y.toFixed(2));
console.log('lowerBackCp1:', pts.lowerBackCp1?.x.toFixed(2), pts.lowerBackCp1?.y.toFixed(2));
console.log('lowerBackCp2:', pts.lowerBackCp2?.x.toFixed(2), pts.lowerBackCp2?.y.toFixed(2));
console.log('upperBackCp1:', pts.upperBackCp1?.x.toFixed(2), pts.upperBackCp1?.y.toFixed(2));
console.log('upperBackCp2:', pts.upperBackCp2?.x.toFixed(2), pts.upperBackCp2?.y.toFixed(2));

const lenUF = cubicBezierLength(pts.capTop, pts.upperFrontCp1, pts.upperFrontCp2, pts.frontPitch);
const lenLF = cubicBezierLength(pts.frontPitch, pts.lowerFrontCp1, pts.lowerFrontCp2, pts.frontAxilla);
const lenLB = cubicBezierLength(pts.backAxilla, pts.lowerBackCp1, pts.lowerBackCp2, pts.backPitch);
const lenUB = cubicBezierLength(pts.backPitch, pts.upperBackCp1, pts.upperBackCp2, pts.capTop);

console.log('\n=== 每段Bezier长度 ===');
console.log('前袖山上段(capTop→frontPitch):', lenUF.toFixed(2), 'cm');
console.log('前袖山下段(frontPitch→frontAxilla):', lenLF.toFixed(2), 'cm');
console.log('后袖山下段(backAxilla→backPitch):', lenLB.toFixed(2), 'cm');
console.log('后袖山上段(backPitch→capTop):', lenUB.toFixed(2), 'cm');

const frontCapLen = lenUF + lenLF;
const backCapLen = lenLB + lenUB;
const totalCapLen = frontCapLen + backCapLen;

console.log('\n=== 袖山长度汇总 ===');
console.log('前袖山总长:', frontCapLen.toFixed(2), 'cm');
console.log('后袖山总长:', backCapLen.toFixed(2), 'cm');
console.log('袖山总长:', totalCapLen.toFixed(2), 'cm');

console.log('\n=== 前片Path操作 ===');
const frontOps = front.path.ops;
for (let i = 0; i < frontOps.length; i++) {
  const op = frontOps[i] as any;
  console.log(`  [${i}] ${op.type}`, op.to ? `to=(${op.to.x?.toFixed(2)},${op.to.y?.toFixed(2)})` : '',
    op.cp1 ? `cp1=(${op.cp1.x?.toFixed(2)},${op.cp1.y?.toFixed(2)})` : '',
    op.cp2 ? `cp2=(${op.cp2.x?.toFixed(2)},${op.cp2.y?.toFixed(2)})` : '');
}

console.log('\n=== 后片Path操作 ===');
const backOps = back.path.ops;
for (let i = 0; i < backOps.length; i++) {
  const op = backOps[i] as any;
  console.log(`  [${i}] ${op.type}`, op.to ? `to=(${op.to.x?.toFixed(2)},${op.to.y?.toFixed(2)})` : '',
    op.cp1 ? `cp1=(${op.cp1.x?.toFixed(2)},${op.cp1.y?.toFixed(2)})` : '',
    op.cp2 ? `cp2=(${op.cp2.x?.toFixed(2)},${op.cp2.y?.toFixed(2)})` : '');
}

let frontArmholeLen = 0;
let frontArmholeStart: Point | null = null;
for (const op of frontOps as any[]) {
  if (op.type === 'move') {
    frontArmholeStart = new Point(op.to.x, op.to.y);
  } else if (op.type === 'line' && frontArmholeStart) {
    const end = new Point(op.to.x, op.to.y);
    frontArmholeLen += Math.sqrt((end.x - frontArmholeStart.x) ** 2 + (end.y - frontArmholeStart.y) ** 2);
    frontArmholeStart = end;
  } else if (op.type === 'curve' && frontArmholeStart) {
    const end = new Point(op.to.x, op.to.y);
    const cp1 = new Point(op.cp1.x, op.cp1.y);
    const cp2 = new Point(op.cp2.x, op.cp2.y);
    frontArmholeLen += cubicBezierLength(frontArmholeStart, cp1, cp2, end);
    frontArmholeStart = end;
  } else if (op.type === 'quad' && frontArmholeStart) {
    const end = new Point(op.to.x, op.to.y);
    const cp = new Point(op.cp1.x, op.cp1.y);
    frontArmholeLen += quadBezierLength(frontArmholeStart, cp, end);
    frontArmholeStart = end;
  }
}

let backArmholeLen = 0;
let backArmholeStart: Point | null = null;
for (const op of backOps as any[]) {
  if (op.type === 'move') {
    backArmholeStart = new Point(op.to.x, op.to.y);
  } else if (op.type === 'line' && backArmholeStart) {
    const end = new Point(op.to.x, op.to.y);
    backArmholeLen += Math.sqrt((end.x - backArmholeStart.x) ** 2 + (end.y - backArmholeStart.y) ** 2);
    backArmholeStart = end;
  } else if (op.type === 'curve' && backArmholeStart) {
    const end = new Point(op.to.x, op.to.y);
    const cp1 = new Point(op.cp1.x, op.cp1.y);
    const cp2 = new Point(op.cp2.x, op.cp2.y);
    backArmholeLen += cubicBezierLength(backArmholeStart, cp1, cp2, end);
    backArmholeStart = end;
  } else if (op.type === 'quad' && backArmholeStart) {
    const end = new Point(op.to.x, op.to.y);
    const cp = new Point(op.cp1.x, op.cp1.y);
    backArmholeLen += quadBezierLength(backArmholeStart, cp, end);
    backArmholeStart = end;
  }
}

console.log('\n=== 袖窿长度(全周) ===');
console.log('前片全周长:', frontArmholeLen.toFixed(2), 'cm');
console.log('后片全周长:', backArmholeLen.toFixed(2), 'cm');

// 注意：前片和后片是半片(onFold)，袖窿只是path的一部分
// 需要只提取袖窿部分的长度
// 前片袖窿：shoulder → armhole curve → underarm
// 后片袖窿：shoulder → armhole curve → underarm

console.log('\n=== 长度匹配 ===');
const ease = 0.5;
const targetLen = frontArmholeLen + backArmholeLen + ease;
console.log('目标袖山长度(前片全周+后片全周+ease):', targetLen.toFixed(2), 'cm');
console.log('实际袖山长度:', totalCapLen.toFixed(2), 'cm');
console.log('差异:', (totalCapLen - targetLen).toFixed(2), 'cm');

// G1连续性验证
console.log('\n=== G1连续性验证 ===');

function checkG1(name: string, p2: Point, p3: Point, q1: Point) {
  const v1 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const v2 = { x: q1.x - p3.x, y: q1.y - p3.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  let angle = 0;
  if (mag1 > 0 && mag2 > 0) {
    const cosA = dot / (mag1 * mag2);
    angle = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
  }
  const isG1 = angle < 1 || angle > 179;
  console.log(`${name}: 夹角=${angle.toFixed(2)}° ${isG1 ? '✅ G1连续' : '❌ G1不连续'}`);
  
  if (isG1) {
    console.log(`  入向控制杆长: ${mag1.toFixed(2)}, 出向控制杆长: ${mag2.toFixed(2)}, 比: ${(mag1/mag2).toFixed(2)}`);
  }
}

checkG1('frontPitch', pts.upperFrontCp2, pts.frontPitch, pts.lowerFrontCp1);
checkG1('backPitch', pts.lowerBackCp2, pts.backPitch, pts.upperBackCp1);

// 验证capTop处的切线方向
console.log('\n=== capTop切线分析 ===');
const capOutV = { x: pts.upperFrontCp1.x - pts.capTop.x, y: pts.upperFrontCp1.y - pts.capTop.y };
const capInV = { x: pts.capTop.x - pts.upperBackCp2.x, y: pts.capTop.y - pts.upperBackCp2.y };
const capOutAngle = Math.atan2(capOutV.y, capOutV.x) * 180 / Math.PI;
const capInAngle = Math.atan2(capInV.y, capInV.x) * 180 / Math.PI;
console.log(`capTop出向角度: ${capOutAngle.toFixed(1)}° (目标15°)`);
console.log(`capTop入向角度: ${capInAngle.toFixed(1)}° (目标165°的反向=${(165+180)%360}°=345°)`);
console.log(`capTop两切线夹角: ${Math.abs(capOutAngle - capInAngle).toFixed(1)}° (应为~30°，即180°-15°-165°的补角)`);
