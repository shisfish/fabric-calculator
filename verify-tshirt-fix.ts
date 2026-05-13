#!/usr/bin/env node
import { TshirtPatternGenerator, GarmentMeasurementAdapter } from './patterns/index.js';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🔍 验证 Tshirt.ts 中的前片生成');
console.log('═══════════════════════════════════════════════════════════════════\n');

const input = {
  chestWidth: 58,
  bodyLength: 72,
  shoulderWidth: 24,
  neckWidth: 18
};

const params = GarmentMeasurementAdapter.adapt(input);

console.log('📦 输入参数:');
console.log(`   chestWidth: ${input.chestWidth}`);
console.log(`   bodyLength: ${input.bodyLength}`);
console.log(`   shoulderWidth: ${input.shoulderWidth}`);
console.log(`   neckWidth: ${input.neckWidth}\n`);

const pieces = TshirtPatternGenerator.generatePattern(params);

const frontPiece = pieces.find(p => p.name === 'front');

if (!frontPiece) {
  console.log('❌ 未找到前片！');
  process.exit(1);
}

console.log('✅ 找到前片 (front)\n');

const ops = frontPiece.path.ops;

console.log('📐 路径结构分析:');
console.log('─'.repeat(60));

let structure = '';
for (const op of ops) {
  switch (op.type) {
    case 'move': structure += 'M '; break;
    case 'line': structure += 'L '; break;
    case 'quad': structure += 'Q '; break;
    case 'curve': structure += 'C '; break;
    case 'close': structure += 'Z'; break;
  }
}

const trimmedStructure = structure.trim();
console.log(`路径指令序列: ${trimmedStructure}`);
console.log(`总段数: ${ops.length}`);

const expected = 'M Q L C L L Z';
const match = trimmedStructure === expected;

console.log(`\n期望结构: ${expected}`);
console.log(`实际结构: ${trimmedStructure}`);
console.log(`匹配结果: ${match ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('📍 关键点坐标:');
console.log('─'.repeat(60));

for (let i = 0; i < ops.length; i++) {
  const op = ops[i];
  
  switch (op.type) {
    case 'move':
      console.log(`\n[0] M (前中领点)`);
      console.log(`    → (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
      if (i === 0 && op.to?.x === 0) {
        console.log(`    ✅ x=0 (前中折线起点)`);
      }
      break;
      
    case 'quad':
      console.log(`\n[${i}] Q (领口Bezier)`);
      console.log(`    CP: (${op.cp1?.x.toFixed(2)}, ${op.cp1?.y.toFixed(2)})`);
      console.log(`    →  (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
      break;
      
    case 'line':
      const lineNames = ['肩线', '侧缝', '下摆'];
      const lineName = lineNames.filter((_, idx) => 
        ops.slice(0, i).filter(o => o.type === 'line').length === idx
      )[0] || '直线';
      console.log(`\n[${i}] L (${lineName})`);
      console.log(`    →  (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
      
      if (i === 5 && op.to?.x === 0) {
        console.log(`    ✅ x=0 (下摆回到前中折线)`);
      }
      break;
      
    case 'curve':
      console.log(`\n[${i}] C (袖窿三次Bezier)`);
      console.log(`    CP1: (${op.cp1?.x.toFixed(2)}, ${op.cp1?.y.toFixed(2)})`);
      console.log(`    CP2: (${op.cp2?.x.toFixed(2)}, ${op.cp2?.y.toFixed(2)})`);
      console.log(`    →  (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
      break;
      
    case 'close':
      console.log(`\n[${i}] Z (闭合)`);
      break;
  }
}

console.log('\n' + '═'.repeat(60));
console.log('🔍 半片规则验证');
console.log('═'.repeat(60) + '\n');

const violations: string[] = [];

if (ops[0]?.to?.x !== 0) {
  violations.push(`❌ 起点X坐标: ${ops[0].to?.x} (必须=0)`);
} else {
  console.log('✅ 前中领点在 x=0');
}

const lastLineIdx = ops.findIndex((op, idx) => idx === 5 && op.type === 'line');
if (lastLineIdx >= 0 && ops[lastLineIdx].to?.x !== 0) {
  violations.push(`❌ 下摆终点X坐标: ${ops[lastLineIdx].to?.x} (必须=0)`);
} else if (lastLineIdx >= 0) {
  console.log('✅ 下摆终点在 x=0');
}

const hasHemBezier = ops.slice(5).some(op => op.type === 'quad' || op.type === 'curve');
if (hasHemBezier) {
  violations.push('❌ 下摆包含Bezier曲线（应该是直线）');
} else {
  console.log('✅ 下摆为直线，无中间收缩');
}

const quadCount = ops.filter(op => op.type === 'quad').length;
const curveCount = ops.filter(op => op.type === 'curve').length;

if (quadCount !== 1) {
  violations.push(`❌ 二次Bezier数量: ${quadCount} (应该=1, 只有领口)`);
} else {
  console.log('✅ 领口使用二次Bezier(Q)');
}

if (curveCount !== 1) {
  violations.push(`❌ 三次Bezier数量: ${curveCount} (应该=1, 只有袖窿)`);
} else {
  console.log('✅ 袖窿使用三次Bezier(C)');
}

console.log('\n' + '═'.repeat(60));
console.log('📊 最终结果');
console.log('═'.repeat(60) + '\n');

if (match && violations.length === 0) {
  console.log('✅ ✅ ✅ Tshirt.ts 前片生成正确！\n');
  console.log('结论:');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │  🔒 半片结构已生效                          │');
  console.log('  │                                              │');
  console.log('  │  固定拓扑: M Q L C L L Z                   │');
  console.log('  │  总段数: 7                                   │');
  console.log('  │                                              │');
  console.log('  │  ✅ 系统现在会生成正确的工业服装前片！       │');
  console.log('  └──────────────────────────────────────────────┘');
  process.exit(0);
} else {
  console.log('❌ 发现问题：');
  for (const v of violations) {
    console.log(`  ${v}`);
  }
  process.exit(1);
}
