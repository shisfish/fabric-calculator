#!/usr/bin/env node
import { FrontPatternGenerator, type FrontPatternParams } from './patterns/index.js';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🔍 前片形状诊断分析 - 不修改代码');
console.log('═══════════════════════════════════════════════════════════════════\n');

const params: FrontPatternParams = {
  chestWidth: 58,
  bodyLength: 72,
  shoulderWidth: 24,
  neckWidth: 18
};

console.log('📦 输入参数:');
console.log(`   chestWidth: ${params.chestWidth} cm`);
console.log(`   bodyLength: ${params.bodyLength} cm`);
console.log(`   shoulderWidth: ${params.shoulderWidth} cm`);
console.log(`   neckWidth: ${params.neckWidth} cm\n`);

const path = FrontPatternGenerator.generate(params);
const ops = path.ops;

console.log('📐 当前生成的关键点坐标:');
console.log('─'.repeat(70));

let pointIndex = 0;
for (const op of ops) {
  switch (op.type) {
    case 'move':
      console.log(`\n[0] M (move)`);
      console.log(`    → (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)}) [neckLeft]`);
      break;
    case 'quad':
      pointIndex++;
      console.log(`\n[${pointIndex}] Q (quad Bezier)`);
      console.log(`    CP: (${op.cp1?.x.toFixed(2)}, ${op.cp1?.y.toFixed(2)})`);
      console.log(`    →  (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
      break;
    case 'line':
      pointIndex++;
      console.log(`\n[${pointIndex}] L (line)`);
      console.log(`    →  (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
      break;
    case 'curve':
      pointIndex++;
      console.log(`\n[${pointIndex}] C (cubic Bezier)`);
      console.log(`    CP1: (${op.cp1?.x.toFixed(2)}, ${op.cp1?.y.toFixed(2)})`);
      console.log(`    CP2: (${op.cp2?.x.toFixed(2)}, ${op.cp2?.y.toFixed(2)})`);
      console.log(`    →  (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
      break;
    case 'close':
      pointIndex++;
      console.log(`\n[${pointIndex}] Z (close)`);
      break;
  }
}

console.log('\n' + '═'.repeat(70));
console.log('📊 坐标范围分析');
console.log('═'.repeat(70));

let allPoints: Array<{ x: number; y: number; name: string }> = [];

ops.forEach((op, idx) => {
  if (op.to) {
    allPoints.push({ x: op.to.x, y: op.to.y, name: `endpoint_${idx}` });
  }
  if (op.cp1) {
    allPoints.push({ x: op.cp1.x, y: op.cp1.y, name: `cp1_${idx}` });
  }
  if (op.cp2) {
    allPoints.push({ x: op.cp2.x, y: op.cp2.y, name: `cp2_${idx}` });
  }
});

const xs = allPoints.map(p => p.x);
const ys = allPoints.map(p => p.y);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);

console.log(`\nX轴范围: ${minX.toFixed(2)} ~ ${maxX.toFixed(2)} (宽度: ${(maxX - minX).toFixed(2)})`);
console.log(`Y轴范围: ${minY.toFixed(2)} ~ ${maxY.toFixed(2)} (高度: ${(maxY - minY).toFixed(2)})`);
console.log(`宽高比: ${((maxX - minX) / (maxY - minY)).toFixed(3)}`);

console.log('\n' + '═'.repeat(70));
console.log('🎯 与 example/front_template_point.ts 对比');
console.log('═'.repeat(70));

const EXAMPLE_TEMPLATE = {
  neckLeft: { x: 120, y: 120 },
  neckCurveControl: { x: 145, y: 90 },
  neckCenter: { x: 180, y: 100 },
  shoulderEnd: { x: 240, y: 140 },
  armholeControl1: { x: 270, y: 180 },
  armholeControl2: { x: 285, y: 230 },
  armholeBottom: { x: 290, y: 300 },
  sideBottom: { x: 290, y: 680 },
  hemCurveControl: { x: 220, y: 705 },
  hemCenter: { x: 180, y: 710 },
  hemLeftControl: { x: 140, y: 700 },
  leftBottom: { x: 120, y: 680 }
};

console.log('\nExample模板坐标 (原始):');
Object.entries(EXAMPLE_TEMPLATE).forEach(([name, pt]) => {
  console.log(`   ${name.padEnd(20)}: (${String(pt.x).padStart(4)}, ${String(pt.y).padStart(4)})`);
});

const exampleXs = Object.values(EXAMPLE_TEMPLATE).map(p => p.x);
const exampleYs = Object.values(EXAMPLE_TEMPLATE).map(p => p.y);
const exMinX = Math.min(...exampleXs);
const exMaxX = Math.max(...exampleXs);
const exMinY = Math.min(...exampleYs);
const exMaxY = Math.max(...exampleYs);

console.log(`\nExample模板尺寸:`);
console.log(`   X轴范围: ${exMinX} ~ ${exMaxX} (宽度: ${exMaxX - exMinX})`);
console.log(`   Y轴范围: ${exMinY} ~ ${exMaxY} (高度: ${exMaxY - exMinY})`);
console.log(`   宽高比: ${((exMaxX - exMinX) / (exMaxY - exMinY)).toFixed(3)}`);

console.log('\n' + '═'.repeat(70));
console.log('⚠️ 问题诊断');
console.log('═'.repeat(70));

const currentRatio = (maxX - minX) / (maxY - minY);
const exampleRatio = (exMaxX - exMinX) / (exMaxY - exMinY);

console.log('\n🔍 宽高比对比:');
console.log(`   Example模板: ${exampleRatio.toFixed(3)} (接近正方形/略长)`);
console.log(`   当前生成:   ${currentRatio.toFixed(3)}`);

if (currentRatio < 0.3) {
  console.log(`   ⚠️  当前形状过于窄长！`);
}

console.log('\n🔍 关键点位坐标检查:');

if (ops[0]?.to) {
  const neckLeft = ops[0].to;
  console.log(`\n   [neckLeft] 前中领点:`);
  console.log(`       当前: (${neckLeft.x.toFixed(2)}, ${neckLeft.y.toFixed(2)})`);
  console.log(`       Example: (120, 120)`);

  if (neckLeft.x !== 0) {
    console.log(`       ⚠️  X坐标不为0，前中应该在Y轴上`);
  }

  if (neckLeft.y < 5 || neckLeft.y > 15) {
    console.log(`       ⚠️  Y坐标${neckLeft.y.toFixed(1)}可能不合理（标准8.5左右）`);
  }
}

if (ops[1]?.to && ops[1]?.cp1) {
  const neckCenter = ops[1].to;
  const neckCP = ops[1].cp1;
  console.log(`\n   [neckCenter] 领宽点:`);
  console.log(`       当前: (${neckCenter.x.toFixed(2)}, ${neckCenter.y.toFixed(2)})`);
  console.log(`       Example: (180, 100)`);
  console.log(`   [neckCurveControl] 领口控制点:`);
  console.log(`       当前: (${neckCP.x.toFixed(2)}, ${neckCP.y.toFixed(2)})`);
  console.log(`       Example: (145, 90)`);

  if (neckCenter.x < neckCP.x) {
    console.log(`       ⚠️  控制点X(${neckCP.x.toFixed(1)}) > 终点X(${neckCenter.x.toFixed(1)})，曲线方向可能错误`);
  }
}

if (ops[2]?.to) {
  const shoulderEnd = ops[2].to;
  console.log(`\n   [shoulderEnd] 肩点:`);
  console.log(`       当前: (${shoulderEnd.x.toFixed(2)}, ${shoulderEnd.y.toFixed(2)})`);
  console.log(`       Example: (240, 140)`);

  if (shoulderEnd.y < 0 || shoulderEnd.y > 10) {
    console.log(`       ⚠️  Y坐标${shoulderEnd.y.toFixed(1)}异常（肩点应该有轻微下降）`);
  }
}

if (ops[3]?.to) {
  const armholeBottom = ops[3].to;
  console.log(`\n   [armholeBottom] 袖窿底点:`);
  console.log(`       当前: (${armholeBottom.x.toFixed(2)}, ${armholeBottom.y.toFixed(2)})`);
  console.log(`       Example: (290, 300)`);

  if (armholeBottom.x < params.chestWidth * 0.4) {
    console.log(`       ⚠️  X坐标过小，袖窿底点应该在胸围线附近`);
  }
}

if (ops[4]?.to) {
  const sideBottom = ops[4].to;
  console.log(`\n   [sideBottom] 侧缝底点:`);
  console.log(`       当前: (${sideBottom.x.toFixed(2)}, ${sideBottom.y.toFixed(2)})`);
  console.log(`       Example: (290, 680)`);

  if (Math.abs(sideBottom.y - params.bodyLength) > 1) {
    console.log(`       ⚠️  Y坐标${sideBottom.y.toFixed(1)} ≠ 衣长${params.bodyLength}`);
  }
}

console.log('\n' + '═'.repeat(70));
console.log('📋 SVG可视化输出');
console.log('═'.repeat(70) + '\n');

let d = '';
for (const op of ops) {
  switch (op.type) {
    case 'move': d += `M ${op.to!.x.toFixed(2)} ${op.to!.y.toFixed(2)} `; break;
    case 'line': d += `L ${op.to!.x.toFixed(2)} ${op.to!.y.toFixed(2)} `; break;
    case 'quad': d += `Q ${op.cp1!.x.toFixed(2)} ${op.cp1!.y.toFixed(2)} ${op.to!.x.toFixed(2)} ${op.to!.y.toFixed(2)} `; break;
    case 'curve': d += `C ${op.cp1!.x.toFixed(2)} ${op.cp1!.y.toFixed(2)} ${op.cp2!.x.toFixed(2)} ${op.cp2!.y.toFixed(2)} ${op.to!.x.toFixed(2)} ${op.to!.y.toFixed(2)} `; break;
    case 'close': d += 'Z'; break;
  }
}

const svgPadding = 10;
const viewBox = `${minX - svgPadding} ${minY - svgPadding} ${(maxX - minX) + svgPadding*2} ${(maxY - minY) + svgPadding*2}`;

console.log('<svg xmlns="http://www.w3.org/2000/svg"');
console.log(`     viewBox="${viewBox}"`);
console.log('     width="400" height="600">');
console.log(`  <path d="${d.trim()}" fill="#e3f2fd" stroke="#1976d2" stroke-width="2"/>`);
console.log('</svg>');

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ 诊断完成 - 请查看上方问题分析');
console.log('═══════════════════════════════════════════════════════════════════\n');
