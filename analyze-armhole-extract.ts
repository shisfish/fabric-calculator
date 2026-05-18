import { TshirtPatternGenerator } from './patterns/Tshirt.js';
import { GarmentMeasurementAdapter } from './patterns/GarmentMeasurementAdapter.js';

console.log('\n' + '='.repeat(100));
console.log('🔬 袖窿提取逻辑深度分析');
console.log('   目标：验证extractArmholeOps()是否正确提取袖窿曲线');
console.log('='.repeat(100) + '\n');

const testParams = {
  category: 'tshirt' as const,
  frontPanel: {
    width: 29, length: 72,
    neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26,
    shoulderSlope: 5.5, armholePitchX: 0.15, hemExtension: 0
  },
  backPanel: {
    width: 29, length: 72,
    neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26,
    shoulderSlope: 12, armholePitchX: 0.2, hemExtension: 0
  },
  sleeve: {
    bicepsWidth: 20,
    bicepWidth: 20,
    sleeveCapHeight: 14,
    sleeveLength: 58,
    cuffWidth: 18
  },
  seamAllowance: 1
};

const params = GarmentMeasurementAdapter.adapt(testParams);
const pieces = TshirtPatternGenerator.generatePattern(params);

const frontPiece = pieces.find(p => p.name === 'front')!;
const backPiece = pieces.find(p => p.name === 'back')!;

// 获取完整的path操作
const frontOps = frontPiece.path.ops || [];
const backOps = backPiece.path.ops || [];

console.log('📋 第一步：前片完整Path操作序列\n');

for (let i = 0; i < frontOps.length; i++) {
  const op = frontOps[i];
  const coords = op.to ? `(${op.to.x.toFixed(1)}, ${op.to.y.toFixed(1)})` : '';
  const cps = op.cp1 && op.cp2 ? 
    `\n      CP1: (${op.cp1.x.toFixed(1)}, ${op.cp1.y.toFixed(1)}), CP2: (${op.cp2.x.toFixed(1)}, ${op.cp2.y.toFixed(1)})` : '';
  
  console.log(`[${i}] ${op.type.padEnd(6)} → ${coords}${cps}`);
}

console.log('\n' + '-'.repeat(80));
console.log('📋 第二步：调用extractArmholeOps()后的结果\n');

const extractMethod = (TshirtPatternGenerator as any).extractArmholeOps;
const frontArmholeOps = extractMethod.call(TshirtPatternGenerator, frontPiece.path);
const backArmholeOps = extractMethod.call(TshirtPatternGenerator, backPiece.path);

console.log(`前片提取到的袖窿操作数: ${frontArmholeOps.length}`);
console.log('详细内容:');
for (let i = 0; i < frontArmholeOps.length; i++) {
  const op = frontArmholeOps[i];
  const coords = op.to ? `(${op.to.x.toFixed(1)}, ${op.to.y.toFixed(1)})` : '';
  const cps = op.cp1 && op.cp2 ?
    `\n      CP1: (${op.cp1.x.toFixed(1)}, ${op.cp1.y.toFixed(1)}), CP2: (${op.cp2.x.toFixed(1)}, ${op.cp2.y.toFixed(1)})` : '';
  
  console.log(`  [${i}] ${op.type.padEnd(6)} → ${coords}${cps}`);
}

console.log(`\n后片提取到的袖窿操作数: ${backArmholeOps.length}`);
console.log('详细内容:');
for (let i = 0; i < backArmholeOps.length; i++) {
  const op = backArmholeOps[i];
  const coords = op.to ? `(${op.to.x.toFixed(1)}, ${op.to.y.toFixed(1)})` : '';
  const cps = op.cp1 && op.cp2 ?
    `\n      CP1: (${op.cp1.x.toFixed(1)}, ${op.cp1.y.toFixed(1)}), CP2: (${op.cp2.x.toFixed(1)}, ${op.cp2.y.toFixed(1)})` : '';

  console.log(`  [${i}] ${op.type.padEnd(6)} → ${coords}${cps}`);
}

console.log('\n' + '-'.repeat(80));
console.log('📏 第三步：手动计算每段长度\n');

function calculateBezierLength(p0: {x:number,y:number}, p1:{x:number,y:number}, p2:{x:number,y:number}, p3:{x:number,y:number}, steps=50): number {
  let length = 0;
  let prevPoint = p0;
  
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.pow(1-t,3)*p0.x + 3*Math.pow(1-t,2)*t*p1.x + 3*(1-t)*Math.pow(t,2)*p2.x + Math.pow(t,3)*p3.x;
    const y = Math.pow(1-t,3)*p0.y + 3*Math.pow(1-t,2)*t*p1.y + 3*(1-t)*Math.pow(t,2)*p2.y + Math.pow(t,3)*p3.y;
    
    const dx = x - prevPoint.x;
    const dy = y - prevPoint.y;
    length += Math.sqrt(dx*dx + dy*dy);
    prevPoint = {x, y};
  }
  
  return length;
}

function calculateLineLength(p1: {x:number,y:number}, p2: {x:number,y:number}): number {
  return Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y, 2));
}

console.log('前片袖窿各段长度:');
let totalFrontLen = 0;
let prevFrontPoint: {x:number, y:number} | null = null;

for (let i = 0; i < frontArmholeOps.length; i++) {
  const op = frontArmholeOps[i];
  
  if (op.type === 'move' && op.to) {
    prevFrontPoint = op.to;
    continue;
  }
  
  if (op.to && prevFrontPoint) {
    if (op.type === 'curve' && op.cp1 && op.cp2) {
      const len = calculateBezierLength(prevFrontPoint, op.cp1, op.cp2, op.to);
      console.log(`  段${i}: Curve → 长度=${len.toFixed(2)} cm`);
      totalFrontLen += len;
    } else if (op.type === 'line') {
      const len = calculateLineLength(prevFrontPoint, op.to);
      console.log(`  段${i}: Line  → 长度=${len.toFixed(2)} cm`);
      totalFrontLen += len;
    }
    
    prevFrontPoint = op.to;
  }
}
console.log(`  前袖窿总长: ${totalFrontLen.toFixed(2)} cm`);

console.log('\n后片袖窿各段长度:');
let totalBackLen = 0;
let prevBackPoint: {x:number, y:number} | null = null;

for (let i = 0; i < backArmholeOps.length; i++) {
  const op = backArmholeOps[i];
  
  if (op.type === 'move' && op.to) {
    prevBackPoint = op.to;
    continue;
  }
  
  if (op.to && prevBackPoint) {
    if (op.type === 'curve' && op.cp1 && op.cp2) {
      const len = calculateBezierLength(prevBackPoint, op.cp1, op.cp2, op.to);
      console.log(`  段${i}: Curve → 长度=${len.toFixed(2)} cm`);
      totalBackLen += len;
    } else if (op.type === 'line') {
      const len = calculateLineLength(prevBackPoint, op.to);
      console.log(`  段${i}: Line  → 长度=${len.toFixed(2)} cm`);
      totalBackLen += len;
    }
    
    prevBackPoint = op.to;
  }
}
console.log(`  后袖窿总长: ${totalBackLen.toFixed(2)} cm`);

const grandTotal = totalFrontLen + totalBackLen;
console.log(`\n总袖窿长度: ${grandTotal.toFixed(2)} cm`);

console.log('\n' + '-'.repeat(80));
console.log('🎯 第四步：工业标准对比\n');

console.log('M号T恤标准参考值:');
console.log('  前袖窿: 22-26 cm (通常24cm左右)');
console.log('  后袖窿: 20-24 cm (通常22cm左右)');
console.log('  总计:   45-52 cm (通常46-48cm)');
console.log('');
console.log('当前计算值:');
console.log(`  前袖窿: ${totalFrontLen.toFixed(2)} cm ${totalFrontLen > 26 ? '⚠️ 偏大' : '✅ 正常'}`);
console.log(`  后袖窿: ${totalBackLen.toFixed(2)} cm ${totalBackLen > 24 ? '⚠️ 偏大' : '✅ 正常'}`);
console.log(`  总计:   ${grandTotal.toFixed(2)} cm ${grandTotal > 52 ? '❌ 异常偏大' : '✅ 正常'}`);

if (grandTotal > 52) {
  console.log('\n⚠️ 问题确认: 袖窿长度异常！');
  console.log('可能原因:');
  console.log('1. 提取了非袖窿线段（如侧缝的一部分）');
  console.log('2. 前后片的armholeDepth参数过大');
  console.log('3. Bezier控制点导致曲线过度外凸');
}

console.log('\n' + '-'.repeat(80));
console.log('💡 第五步：可视化检查建议\n');

console.log('请检查以下坐标点是否合理:');
if (frontArmholeOps[0]?.to) {
  console.log(`  前片起点(shoulder): (${frontArmholeOps[0].to.x.toFixed(1)}, ${frontArmholeOps[0].to.y.toFixed(1)})`);
}
if (frontArmholeOps[frontArmholeOps.length-1]?.to) {
  console.log(`  前片终点(axilla):   (${frontArmholeOps[frontArmholeOps.length-1].to.x.toFixed(1)}, ${frontArmholeOps[frontArmholeOps.length-1].to.y.toFixed(1)})`);
}

if (backArmholeOps[0]?.to) {
  console.log(`  后片起点(shoulder): (${backArmholeOps[0].to.x.toFixed(1)}, ${backArmholeOps[0].to.y.toFixed(1)})`);
}
if (backArmholeOps[backArmholeOps.length-1]?.to) {
  console.log(`  后片终点(axilla):   (${backArmholeOps[backArmholeOps.length-1].to.x.toFixed(1)}, ${backArmholeOps[backArmholeOps.length-1].to.y.toFixed(1)})`);
}

console.log('\n' + '='.repeat(100) + '\n');