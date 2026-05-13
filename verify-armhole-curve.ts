#!/usr/bin/env node
import { TshirtPatternGenerator, GarmentMeasurementAdapter } from './patterns/index.js';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🎯 袖窿Bezier控制点修复验证 - 外鼓-内收曲率检查');
console.log('═══════════════════════════════════════════════════════════════════\n');

const input = {
  chestWidth: 58,
  bodyLength: 72,
  shoulderWidth: 24,
  neckWidth: 18
};

const params = GarmentMeasurementAdapter.adapt(input);
const pieces = TshirtPatternGenerator.generatePattern(params);
const frontPiece = pieces.find(p => p.name === 'front');

if (!frontPiece) {
  console.log('❌ 未找到前片');
  process.exit(1);
}

const ops = frontPiece.path.ops;
const points = frontPiece.points;

console.log('📋 第1步：定位袖窿曲线操作');
console.log('═'.repeat(60) + '\n');

let curveOpIndex = -1;
for (let i = 0; i < ops.length; i++) {
  if (ops[i].type === 'curve') {
    curveOpIndex = i;
    console.log(`✅ 找到curve操作在 [${i}]`);
    break;
  }
}

if (curveOpIndex === -1) {
  console.log('❌ 未找到curve操作！');
  process.exit(1);
}

const curveOp = ops[curveOpIndex];
const prevOp = ops[curveOpIndex - 1];

if (!prevOp?.to || !curveOp?.cp1 || !curveOp?.cp2 || !curveOp?.to) {
  console.log('❌ 控制点数据不完整');
  process.exit(1);
}

const shoulder = prevOp.to;
const cp1 = curveOp.cp1;
const cp2 = curveOp.cp2;
const underarm = curveOp.to;

console.log('\n关键点位坐标:');
console.log(`  起点(shoulder):  (${shoulder.x.toFixed(2)}, ${shoulder.y.toFixed(2)})`);
console.log(`  CP1 (外鼓点):    (${cp1.x.toFixed(2)}, ${cp1.y.toFixed(2)})`);
console.log(`  CP2 (内收/hollow): (${cp2.x.toFixed(2)}, ${cp2.y.toFixed(2)})`);
console.log(`  终点(underarm):  (${underarm.x.toFixed(2)}, ${underarm.y.toFixed(2)})`);

console.log('\n' + '═'.repeat(60));
console.log('📋 第2步：共线性检测（核心问题）');
console.log('═'.repeat(60) + '\n');

function calculateLineEquation(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  
  if (Math.abs(dx) < 0.001) {
    return { a: 1, b: 0, c: -p1.x, isVertical: true };
  }
  
  const a = dy / dx;
  const b = -1;
  const c = p1.y - a * p1.x;
  
  return { a, b, c, isVertical: false };
}

function pointToLineDistance(point: { x: number; y: number }, line: { a: number; b: number; c: number }) {
  return Math.abs(line.a * point.x + line.b * point.y + line.c) / Math.sqrt(line.a * line.a + line.b * line.b);
}

const shoulderToUnderarm = calculateLineEquation(shoulder, underarm);

console.log('起点→终点直线方程:');
if (shoulderToUnderarm.isVertical) {
  console.log(`  X = ${shoulder.x}`);
} else {
  console.log(`  Y = ${shoulderToUnderarm.a.toFixed(4)}X + ${shoulderToUnderarm.c.toFixed(4)}`);
}

const cp1Dist = pointToLineDistance(cp1, shoulderToUnderarm);
const cp2Dist = pointToLineDistance(cp2, shoulderToUnderarm);

console.log(`\n控制点到直线的距离（偏离度）:`);
console.log(`  CP1偏离: ${cp1Dist.toFixed(3)} cm`);

const cp1OnLineY = shoulderToUnderarm.a * cp1.x + shoulderToUnderarm.c;
const cp1Direction = cp1.y < cp1OnLineY ? '上方(外鼓✅)' : '下方';
console.log(`         方向: 相对直线${cp1Direction} (理想应该是外鼓/上方)`);

console.log(`\n  CP2偏离: ${cp2Dist.toFixed(3)} cm`);

const cp2OnLineY = shoulderToUnderarm.a * cp2.x + shoulderToUnderarm.c;
const cp2Direction = cp2.y > cp2OnLineY ? '下方(内收✅)' : '上方';
console.log(`         方向: 相对直线${cp2Direction} (理想应该是内收/下方)`);

console.log('\n' + '═'.repeat(60));
console.log('📋 第3步：曲率特征分析');
console.log('═'.repeat(60) + '\n');

const totalSpan = Math.sqrt(
  Math.pow(underarm.x - shoulder.x, 2) + 
  Math.pow(underarm.y - shoulder.y, 2)
);

console.log(`总跨度(shoulder→underarm): ${totalSpan.toFixed(2)} cm\n`);

const cp1RatioFromStart = Math.sqrt(
  Math.pow(cp1.x - shoulder.x, 2) + 
  Math.pow(cp1.y - shoulder.y, 2)
) / totalSpan;

const cp2RatioFromEnd = Math.sqrt(
  Math.pow(underarm.x - cp2.x, 2) + 
  Math.pow(underarm.y - cp2.y, 2)
) / totalSpan;

console.log('控制点位置比例:');
console.log(`  CP1距起点: ${(cp1RatioFromStart * 100).toFixed(1)}% (理想10-25%)`);
console.log(`  CP2距终点: ${(cp2RatioFromEnd * 100).toFixed(1)}% (理想15-30%)\n`);

const isOutwardBulge = cp1Dist > 0.5 && cp1.y < (shoulderToUnderarm.a * cp1.x + shoulderToUnderarm.c);
const isInwardHollow = cp2Dist > 0.5 && cp2.y > (shoulderToUnderarm.a * cp2.x + shoulderToUnderarm.c);

console.log('曲率特征:');
console.log(`  ✅ 外鼓(outward bulge): ${isOutwardBulge ? 'CP1向外偏移，产生外鼓效果' : '❌ 未检测到明显外鼓'}`);
console.log(`  ✅ 内收(inward hollow): ${isInwardHollow ? 'CP2向内偏移，产生凹陷效果' : '❌ 未检测到明显内收'}`);

if (isOutwardBulge && isInwardHollow) {
  console.log(`\n  🎯 完美！形成"S"形工业袖窿曲线！`);
} else if (cp1Dist > 0.5 || cp2Dist > 0.5) {
  console.log(`\n  ⚠️ 有一定曲率，但可能不够明显`);
} else {
  console.log(`\n  ❌ 警告：控制点几乎共线，曲线会退化为直线！`);
}

console.log('\n' + '═'.repeat(60));
console.log('📋 第4步：生成可视化SVG');
console.log('═'.repeat(60) + '\n');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 40 35" width="800" height="700">
  <defs>
    <pattern id="grid" width="2" height="2" patternUnits="userSpaceOnUse">
      <path d="M 2 0 L 0 0 0 2" fill="none" stroke="#e0e0e0" stroke-width="0.2"/>
    </pattern>
  </defs>
  
  <!-- 背景 -->
  <rect x="-5" y="-5" width="40" height="35" fill="url(#grid)" />
  
  <!-- 起点→终点参考线（虚线） -->
  <line x1="${shoulder.x}" y1="${shoulder.y}" x2="${underarm.x}" y2="${underarm.y}" 
        stroke="#ff0000" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.6"/>
  <text x="${(shoulder.x + underarm.x) / 2 - 8}" y="${(shoulder.y + underarm.y) / 2 - 2}" 
        font-size="2.5" fill="#ff0000" opacity="0.8">参考线</text>

  <!-- 肩点→CP1控制线 -->
  <line x1="${shoulder.x}" y1="${shoulder.y}" x2="${cp1.x}" y2="${cp1.y}" 
        stroke="#e74c3c" stroke-width="0.6" opacity="0.7"/>
  
  <!-- CP1→CP2控制线 -->
  <line x1="${cp1.x}" y1="${cp1.y}" x2="${cp2.x}" y2="${cp2.y}" 
        stroke="#f39c12" stroke-width="0.6" opacity="0.7"/>
  
  <!-- CP2→腋下控制线 -->
  <line x1="${cp2.x}" y1="${cp2.y}" x2="${underarm.x}" y2="${underarm.y}" 
        stroke="#27ae60" stroke-width="0.6" opacity="0.7"/>

  <!-- Bezier曲线本身（加粗显示） -->
  <path d="M ${shoulder.x} ${shoulder.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${underarm.x} ${underarm.y}" 
        fill="none" stroke="#2ecc71" stroke-width="2.5" stroke-linecap="round"/>

  <!-- 关键点标记 -->
  <circle cx="${shoulder.x}" cy="${shoulder.y}" r="1.2" fill="#3498db"/>
  <text x="${shoulder.x - 6}" y="${shoulder.y - 2}" font-size="2.8" fill="#3498db" font-weight="bold">肩点</text>
  
  <circle cx="${cp1.x}" cy="${cp1.y}" r="1.5" fill="#e74c3c"/>
  <text x="${cp1.x + 2}" y="${cp1.y - 2}" font-size="2.5" fill="#e74c3c" font-weight="bold">CP1</text>
  <text x="${cp1.x + 2}" y="${cp1.y + 2.5}" font-size="2" fill="#e74c3c">(${cp1Dist.toFixed(1)}cm外鼓)</text>
  
  <circle cx="${cp2.x}" cy="${cp2.y}" r="1.5" fill="#f39c12"/>
  <text x="${cp2.x + 2}" y="${cp2.y - 2}" font-size="2.5" fill="#f39c12" font-weight="bold">CP2</text>
  <text x="${cp2.x + 2}" y="${cp2.y + 2.5}" font-size="2" fill="#f39c12">(${cp2Dist.toFixed(1)}cm内收)</text>
  
  <circle cx="${underarm.x}" cy="${underarm.y}" r="1.2" fill="#27ae60"/>
  <text x="${underarm.x + 2}" y="${underarm.y + 3}" font-size="2.8" fill="#27ae60" font-weight="bold">腋下</text>

  <!-- 图例 -->
  <rect x="-3" y="29" width="38" height="5" fill="white" stroke="#ccc" stroke-width="0.3" rx="1"/>
  <line x1="-1" y1="30.5" x2="3" y2="30.5" stroke="#ff0000" stroke-width="0.5" stroke-dasharray="2 2"/>
  <text x="4" y="31.2" font-size="2">参考线</text>
  <circle cx="14" cy="30.5" r="0.8" fill="#e74c3c"/><text x="15" y="31.2" font-size="2">CP1外鼓</text>
  <circle cx="24" cy="30.5" r="0.8" fill="#f39c12"/><text x="25" y="31.2" font-size="2">CP2内收</text>
  <path d="M 33 29.5 Q 34 30 35 31.5" fill="none" stroke="#2ecc71" stroke-width="1"/>
  <text x="36" y="31.2" font-size="2">曲线</text>

</svg>`;

console.log(svgContent);

console.log('\n' + '═'.repeat(60));
console.log('📊 最终诊断结果');
console.log('═'.repeat(60) + '\n');

const issues: string[] = [];
const passes: string[] = [];

if (cp1Dist > 1.0) {
  passes.push(`✅ CP1外鼓明显 (${cp1Dist.toFixed(2)}cm > 1cm)`);
} else if (cp1Dist > 0.5) {
  passes.push(`⚠️ CP1有轻微外鼓 (${cp1Dist.toFixed(2)}cm)`);
} else {
  issues.push(`❌ CP1外鼓不足 (${cp1Dist.toFixed(2)}cm < 0.5cm)，曲线会退化`);
}

if (cp2Dist > 1.0) {
  passes.push(`✅ CP2内收明显 (${cp2Dist.toFixed(2)}cm > 1cm)`);
} else if (cp2Dist > 0.5) {
  passes.push(`⚠️ CP2有轻微内收 (${cp2Dist.toFixed(2)}cm)`);
} else {
  issues.push(`❌ CP2内收不足 (${cp2Dist.toFixed(2)}cm < 0.5cm)，缺少hollow`);
}

if (isOutwardBulge && isInwardHollow) {
  passes.push('✅ 形成"S"形工业袖窿曲线');
}

passes.forEach(p => console.log(`  ${p}`));

if (issues.length > 0) {
  console.log('\n问题:');
  issues.forEach(i => console.log(`  ${i}`));
}

console.log('\n═══════════════════════════════════════════════════════════════════');
if (issues.length === 0) {
  console.log('✅ ✅ ✅ 袖窿Bezier控制点修复成功！');
  console.log('   现在应该能看到真正的曲线而不是直线！');
} else {
  console.log('⚠️ 还需要进一步调整控制点位置');
}
console.log('═══════════════════════════════════════════════════════════════════\n');

process.exit(issues.length > 0 ? 1 : 0);
