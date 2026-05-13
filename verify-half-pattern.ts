#!/usr/bin/env node
import { FrontPatternGenerator, type FrontPatternParams } from './patterns/index.js';

const EXPECTED_TOPOLOGY = {
  segmentCount: 7,
  pathStructure: 'M Q L C L L Z',
  segments: [
    { index: 0, type: 'move', name: '前中领点', to: 'neckStart (x=0)' },
    { index: 1, type: 'quad', name: '领口Bezier', controlPoint: 'neckCp', to: 'neckEnd' },
    { index: 2, type: 'line', name: '肩线', to: 'shoulderEnd' },
    { index: 3, type: 'curve', name: '袖窿三次Bezier', controlPoints: ['armholeCp1', 'armholeCp2'], to: 'armholeBottom' },
    { index: 4, type: 'line', name: '侧缝', to: 'sideBottom' },
    { index: 5, type: 'line', name: '下摆(回到x=0)', to: 'hemFold (x=0)' },
    { index: 6, type: 'close', name: '闭合', to: '' }
  ]
};

const testCases: Array<{ name: string; params: FrontPatternParams }> = [
  {
    name: '标准版 M码 (58×72)',
    params: {
      chestWidth: 58,
      bodyLength: 72,
      shoulderWidth: 24,
      neckWidth: 18
    }
  },
  {
    name: 'Oversize版 L码 (66×78)',
    params: {
      chestWidth: 66,
      bodyLength: 78,
      shoulderWidth: 30,
      neckWidth: 21
    }
  },
  {
    name: '紧身版 S码 (50×65)',
    params: {
      chestWidth: 50,
      bodyLength: 65,
      shoulderWidth: 20,
      neckWidth: 16
    }
  }
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🔒 工业服装前片（半片结构）- 验证');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('📋 固定拓扑结构 (基于 template.ts):');
console.log('─'.repeat(60));
console.log(`总段数: ${EXPECTED_TOPOLOGY.segmentCount}`);
console.log(`路径指令序列: ${EXPECTED_TOPOLOGY.pathStructure}`);
console.log('\n各段详情:');
for (const seg of EXPECTED_TOPOLOGY.segments) {
  const cpInfo = seg.controlPoint ? ` [CP: ${seg.controlPoint}]` : 
                  seg.controlPoints ? ` [CPs: ${seg.controlPoints.join(', ')}]` : '';
  console.log(`  [${seg.index}] ${seg.type.toUpperCase().padEnd(6)} ${seg.name.padEnd(24)} → ${seg.to}${cpInfo}`);
}

console.log('\n半片规则:');
console.log('  ✓ x=0 永远是前中折线(FOLD LINE)');
console.log('  ✓ 下摆左侧必须在 x=0');
console.log('  ✓ 不允许下摆Bezier向中间收缩');
console.log('  ✓ 只绘制右半边轮廓\n');

console.log('═'.repeat(60));
console.log('🧪 多尺度测试 - 验证结构不变性');
console.log('═'.repeat(60) + '\n');

let allStructuresMatch = true;
const results: Array<{ name: string; structure: string; match: boolean; points: any[] }> = [];

for (const testCase of testCases) {
  const path = FrontPatternGenerator.generate(testCase.params);
  const ops = path.ops;

  let structure = '';
  const pointData: Array<{ op: string; coords: string; x?: number; y?: number }> = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    
    switch (op.type) {
      case 'move':
        structure += 'M ';
        pointData.push({ op: 'M', coords: `(${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`, x: op.to?.x, y: op.to?.y });
        break;
      case 'line':
        structure += 'L ';
        pointData.push({ op: 'L', coords: `→ (${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`, x: op.to?.x, y: op.to?.y });
        break;
      case 'quad':
        structure += 'Q ';
        pointData.push({ op: 'Q', coords: `[${op.cp1?.x.toFixed(1)}, ${op.cp1?.y.toFixed(1)}] → (${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`, x: op.to?.x, y: op.to?.y });
        break;
      case 'curve':
        structure += 'C ';
        pointData.push({ op: 'C', coords: `[${op.cp1?.x.toFixed(1)}, ${op.cp1?.y.toFixed(1)}] [${op.cp2?.x.toFixed(1)}, ${op.cp2?.y.toFixed(1)}] → (${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`, x: op.to?.x, y: op.to?.y });
        break;
      case 'close':
        structure += 'Z';
        pointData.push({ op: 'Z', coords: '(闭合)' });
        break;
    }
  }

  const trimmedStructure = structure.trim();
  const match = trimmedStructure === EXPECTED_TOPOLOGY.pathStructure;

  results.push({ name: testCase.name, structure: trimmedStructure, match, points: pointData });

  console.log(`\n📦 测试用例: ${testCase.name}`);
  console.log(`   参数: chest=${testCase.params.chestWidth}, length=${testCase.params.bodyLength}, shoulder=${testCase.params.shoulderWidth}, neck=${testCase.params.neckWidth}`);
  console.log(`   路径结构: ${trimmedStructure}`);
  console.log(`   段数: ${ops.length}`);
  console.log(`   结构匹配: ${match ? '✅ PASS' : '❌ FAIL'}`);

  if (!match) {
    allStructuresMatch = false;
    console.log(`   ⚠️  期望: ${EXPECTED_TOPOLOGY.pathStructure}`);
  }

  console.log('\n   关键点坐标:');
  for (let i = 0; i < pointData.length; i++) {
    const pd = pointData[i];
    const segName = EXPECTED_TOPOLOGY.segments[i]?.name || '';
    console.log(`   [${i.toString().padStart(2)}] ${pd.op.padEnd(3)} ${pd.coords.padEnd(55)} ← ${segName}`);
    
    if (pd.x !== undefined && i === 0) {
      console.log(`         ↑ neckStart.x = ${pd.x.toFixed(2)} (必须=0) ${pd.x === 0 ? '✅' : '❌'}`);
    }
    if (pd.x !== undefined && i === 5) {
      console.log(`         ↑ hemFold.x = ${pd.x.toFixed(2)} (必须=0) ${pd.x === 0 ? '✅' : '❌'}`);
    }
  }

  const quadCount = ops.filter(op => op.type === 'quad').length;
  const curveCount = ops.filter(op => op.type === 'curve').length;
  const lineCount = ops.filter(op => op.type === 'line').length;
  console.log(`   统计: Quad(Q)=${quadCount}, Curve(C)=${curveCount}, Line(L)=${lineCount}`);
}

console.log('\n' + '═'.repeat(60));
console.log('🔍 半片规则检查');
console.log('═'.repeat(60) + '\n');

const firstPath = FrontPatternGenerator.generate(testCases[0].params);
const violations: string[] = [];

if (firstPath.ops[0]?.to?.x !== 0) {
    violations.push(`❌ neckStart.x = ${firstPath.ops[0].to?.x ?? 'undefined'} (必须=0)`);
  } else {
    console.log('✅ neckStart.x = 0 (前中折线起点)');
  }

  const lastLineOp = firstPath.ops.find((op, idx) => idx === 5 && op.type === 'line');
  if (!lastLineOp || lastLineOp.to?.x !== 0) {
    violations.push(`❌ hemFold.x = ${lastLineOp?.to?.x ?? 'undefined'} (必须=0)`);
  } else {
  console.log('✅ hemFold.x = 0 (下摆回到前中折线)');
}

const hasHemBezier = firstPath.ops.slice(5).some(op => op.type === 'quad' || op.type === 'curve');
if (hasHemBezier) {
  violations.push('❌ 下摆包含Bezier曲线(应该是直线L)');
} else {
  console.log('✅ 下摆为直线(L)，无中间收缩');
}

console.log('\n' + '═'.repeat(60));
console.log('📊 总结报告');
console.log('═'.repeat(60) + '\n');

console.log(`测试用例总数: ${testCases.length}`);
console.log(`结构一致率: ${results.filter(r => r.match).length}/${results.length} (${((results.filter(r => r.match).length / results.length) * 100).toFixed(0)}%)`);

if (allStructuresMatch && violations.length === 0) {
  console.log('\n✅ ✅ ✅ 所有测试通过！\n');
  console.log('结论:');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │  🔒 半片结构已锁定                          │');
  console.log('  │                                              │');
  console.log('  │  固定拓扑: M Q L C L L Z                   │');
  console.log('  │  总段数: 7                                   │');
  console.log('  │  二次Bezier(Q): 1条 (领口)                 │');
  console.log('  │  三次Bezier(C): 1条 (袖窿)                  │');
  console.log('  │  直线段(L): 3条 (肩线+侧缝+下摆)            │');
  console.log('  │                                              │');
  console.log('  │  半片规则:                                   │');
  console.log('  │  ✓ x=0 前中折线(FOLD LINE)                 │');
  console.log('  │  ✓ 下摆在x=0闭合                           │');
  console.log('  │  ✓ 无下摆Bezier收缩                         │');
  console.log('  │  ✓ 只绘制右半边                             │');
  console.log('  └──────────────────────────────────────────────┘');
} else {
  console.log('\n❌ 发现问题！');
  if (!allStructuresMatch) {
    for (const result of results) {
      if (!result.match) {
        console.log(`  - ${result.name}: ${result.structure}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.log('\n⚠️  违规项:');
  for (const v of violations) {
    console.log(`  ${v}`);
  }
}

console.log('\n' + '═'.repeat(60));
console.log('🎨 SVG输出示例 (标准版 M码)');
console.log('═'.repeat(60) + '\n');

const svgOutput = FrontPatternGenerator.generateSVG(testCases[0].params);
console.log(svgOutput);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ 验证完成');
console.log('═══════════════════════════════════════════════════════════════════\n');

process.exit(violations.length > 0 || !allStructuresMatch ? 1 : 0);
