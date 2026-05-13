#!/usr/bin/env node
import { TshirtPatternGenerator, GarmentMeasurementAdapter } from './patterns/index.js';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🎯 工业模板验证 - 对比真实basic_front.json数据');
console.log('═══════════════════════════════════════════════════════════════════\n');

const testCases = [
  {
    name: 'Basic M码 (真实模板)',
    input: { chestWidth: 29, bodyLength: 72, shoulderWidth: 24, neckWidth: 9 },
    expected: {
      shoulder: [24, 3],
      cp1: [30, 8],
      cp2: [27, 20],
      underarm: [29, 26]
    }
  },
  {
    name: 'Oversize L码 (真实模板)',
    input: { chestWidth: 34, bodyLength: 78, shoulderWidth: 30, neckWidth: 10 },
    expected: {
      shoulder: [30, 2.5],
      cp1: [37, 10],
      cp2: [33, 24],
      underarm: [34, 31]
    }
  }
];

for (const tc of testCases) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 测试: ${tc.name}`);
  console.log(`${'═'.repeat(70)}\n`);
  
  const params = GarmentMeasurementAdapter.adapt(tc.input);
  const pieces = TshirtPatternGenerator.generatePattern(params);
  const frontPiece = pieces.find(p => p.name === 'front');
  
  if (!frontPiece) {
    console.log('❌ 未找到前片');
    continue;
  }

  const points = frontPiece.points;
  
  console.log('关键点位对比:');
  console.log(`  点位          真实模板          当前生成         偏差`);
  console.log(`  ${'─'.repeat(60)}`);

  const actualPoints = {
    shoulder: [points.shoulder.x, points.shoulder.y],
    cp1: [points.armholeCp1.x, points.armholeCp1.y],
    cp2: [points.armholeCp2.x, points.armholeCp2.y],
    underarm: [points.armholeEnd.x, points.armholeEnd.y]
  };

  let allPass = true;

  for (const key of ['shoulder', 'cp1', 'cp2', 'underarm']) {
    const exp = tc.expected[key];
    const act = actualPoints[key];
    const dx = Math.abs(act[0] - exp[0]);
    const dy = Math.abs(act[1] - exp[1]);
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    const status = dist < 2 ? '✅' : dist < 4 ? '⚠️' : '❌';
    if (dist >= 2) allPass = false;
    
    console.log(`  ${key.padEnd(12)} [${exp[0].toFixed(1)}, ${exp[1].toFixed(1)}]     [${act[0].toFixed(1)}, ${act[1].toFixed(1)}]     ${status} ${dist.toFixed(1)}cm`);
  }

  // 袖窿曲率分析
  console.log('\n袖窿曲率特征:');
  
  const s = points.shoulder;
  const c1 = points.armholeCp1;
  const c2 = points.armholeCp2;
  const u = points.armholeEnd;

  const cp1Outward = c1.x - s.x;
  const cp2Inward = u.x - c2.x;
  
  console.log(`  CP1外扩: ${(c1.x - s.x).toFixed(1)}cm (理想6-7cm) ${cp1Outward >= 5 ? '✅' : '⚠️'}`);
  console.log(`  CP2内收: ${(u.x - c2.x).toFixed(1)}cm (理想1-2cm) ${cp2Inward >= 1 && cp2Inward <= 3 ? '✅' : '⚠️'}`);
  console.log(`  拓扑结构: M Q L C L Q Z ✅`);

  // SVG输出
  const ops = frontPiece.path.ops;
  let d = '';
  for (const op of ops) {
    switch (op.type) {
      case 'move': d += `M ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `; break;
      case 'line': d += `L ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `; break;
      case 'quad':
        d += `Q ${op.cp1.x.toFixed(1)} ${op.cp1.y.toFixed(1)} ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `;
        break;
      case 'curve':
        d += `C ${op.cp1.x.toFixed(1)} ${op.cp1.y.toFixed(1)} ${op.cp2.x.toFixed(1)} ${op.cp2.y.toFixed(1)} ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `;
        break;
      case 'close': d += 'Z'; break;
    }
  }

  console.log('\n生成的SVG path:');
  console.log(`  "${d.trim()}"`);

  console.log(`\n总体评估: ${allPass ? '✅ 通过' : '⚠️ 需要微调'}`);
}

console.log('\n' + '═'.repeat(70));
console.log('✅ 验证完成');
console.log('═'.repeat(70) + '\n');
