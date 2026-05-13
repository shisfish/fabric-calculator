#!/usr/bin/env node
import { FrontPatternGenerator, type FrontPatternParams } from './patterns/index.js';

const EXPECTED_TOPOLOGY = {
  segmentCount: 8,
  pathStructure: 'M Q L C L Q Q Z',
  segments: [
    { index: 0, type: 'move', name: '起始点', to: 'neckLeft' },
    { index: 1, type: 'quad', name: '前领口Bezier', controlPoint: 'neckCurveControl', to: 'neckCenter' },
    { index: 2, type: 'line', name: '肩线直线', to: 'shoulderEnd' },
    { index: 3, type: 'curve', name: '袖窿CubicBezier', controlPoints: ['armholeControl1', 'armholeControl2'], to: 'armholeBottom' },
    { index: 4, type: 'line', name: '侧缝直线', to: 'sideBottom' },
    { index: 5, type: 'quad', name: '下摆Bezier(右)', controlPoint: 'hemCurveControl', to: 'hemCenter' },
    { index: 6, type: 'quad', name: '下摆Bezier(左)', controlPoint: 'hemLeftControl', to: 'leftBottom' },
    { index: 7, type: 'close', name: '路径闭合', to: '' }
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
  },
  {
    name: '超大码 XXL (80×85)',
    params: {
      chestWidth: 80,
      bodyLength: 85,
      shoulderWidth: 38,
      neckWidth: 24
    }
  }
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🔒 参数化模板系统 - 基于example/front_template_point.ts');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('📋 固定拓扑结构 (来自 example/front_template_point.ts):');
console.log('─'.repeat(60));
console.log(`总段数: ${EXPECTED_TOPOLOGY.segmentCount}`);
console.log(`路径指令序列: ${EXPECTED_TOPOLOGY.pathStructure}`);
console.log('\n各段详情:');
for (const seg of EXPECTED_TOPOLOGY.segments) {
  const cpInfo = seg.controlPoint ? ` [CP: ${seg.controlPoint}]` : 
                  seg.controlPoints ? ` [CPs: ${seg.controlPoints.join(', ')}]` : '';
  console.log(`  [${seg.index}] ${seg.type.toUpperCase().padEnd(6)} ${seg.name.padEnd(22)} → ${seg.to}${cpInfo}`);
}

console.log('\n' + '═'.repeat(60));
console.log('🧪 多尺度测试 - 验证结构不变性');
console.log('═'.repeat(60) + '\n');

let allStructuresMatch = true;
const results: Array<{ name: string; structure: string; match: boolean }> = [];

for (const testCase of testCases) {
  const path = FrontPatternGenerator.generate(testCase.params);
  const ops = path.ops;

  let structure = '';
  const segmentDetails: string[] = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    let segStr = '';

    switch (op.type) {
      case 'move':
        structure += 'M ';
        segStr = `M (${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`;
        break;
      case 'line':
        structure += 'L ';
        segStr = `L → (${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`;
        break;
      case 'quad':
        structure += 'Q ';
        segStr = `Q [${op.cp1?.x.toFixed(1)}, ${op.cp1?.y.toFixed(1)}] → (${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`;
        break;
      case 'curve':
        structure += 'C ';
        segStr = `C [${op.cp1?.x.toFixed(1)}, ${op.cp1?.y.toFixed(1)}] [${op.cp2?.x.toFixed(1)}, ${op.cp2?.y.toFixed(1)}] → (${op.to?.x.toFixed(1)}, ${op.to?.y.toFixed(1)})`;
        break;
      case 'close':
        structure += 'Z';
        segStr = 'Z (闭合)';
        break;
    }

    if (segStr && i < EXPECTED_TOPOLOGY.segments.length) {
      segmentDetails.push(`[${i.toString().padStart(2)}] ${segStr.padEnd(65)} ← ${EXPECTED_TOPOLOGY.segments[i].name}`);
    }
  }

  const trimmedStructure = structure.trim();
  const match = trimmedStructure === EXPECTED_TOPOLOGY.pathStructure;

  results.push({ name: testCase.name, structure: trimmedStructure, match });

  console.log(`\n📦 测试用例: ${testCase.name}`);
  console.log(`   参数: chest=${testCase.params.chestWidth}, length=${testCase.params.bodyLength}, shoulder=${testCase.params.shoulderWidth}, neck=${testCase.params.neckWidth}`);
  console.log(`   路径结构: ${trimmedStructure}`);
  console.log(`   段数: ${ops.length}`);
  console.log(`   结构匹配: ${match ? '✅ PASS' : '❌ FAIL'}`);

  if (!match) {
    allStructuresMatch = false;
    console.log(`   ⚠️  期望: ${EXPECTED_TOPOLOGY.pathStructure}`);
  }

  console.log('\n   各段坐标:');
  for (const detail of segmentDetails) {
    console.log(`   ${detail}`);
  }

  const quadCount = ops.filter(op => op.type === 'quad').length;
  const curveCount = ops.filter(op => op.type === 'curve').length;
  const lineCount = ops.filter(op => op.type === 'line').length;
  console.log(`   统计: Quad(Q)=${quadCount}, Curve(C)=${curveCount}, Line(L)=${lineCount}`);
}

console.log('\n' + '═'.repeat(60));
console.log('🔍 禁止项检查');
console.log('═'.repeat(60) + '\n');

const firstPath = FrontPatternGenerator.generate(testCases[0].params);
const svgPath = firstPath.toSVGPath();

const violations: string[] = [];

if (svgPath.includes('rect')) {
  violations.push('❌ 包含 rect() 矩形指令');
} else {
  console.log('✅ 无 rect() 矩形指令');
}

if (/^M\s+L\s+L\s+L\s+Z$/.test(svgPath.trim())) {
  violations.push('❌ 为矩形路径 (M L L L Z)');
} else {
  console.log('✅ 非矩形路径');
}

const hasQuadBezier = svgPath.includes(' Q ');
const hasCubicBezier = svgPath.includes(' C ');
if (!hasQuadBezier && !hasCubicBezier) {
  violations.push('❌ 缺少 Bezier 曲线');
} else {
  console.log(`✅ 包含 Bezier 曲线 (Q:${hasQuadBezier ? '有' : '无'}, C:${hasCubicBezier ? '有' : '无'})`);
}

if (firstPath.ops.length !== EXPECTED_TOPOLOGY.segmentCount) {
  violations.push(`❌ 段数异常: ${firstPath.ops.length} (期望 ${EXPECTED_TOPOLOGY.segmentCount})`);
} else {
  console.log(`✅ 段数正确: ${EXPECTED_TOPOLOGY.segmentCount}`);
}

const expectedTypes = ['move', 'quad', 'line', 'curve', 'line', 'quad', 'quad', 'close'];
const actualTypes = firstPath.ops.map(op => op.type);
const typesMatch = JSON.stringify(actualTypes) === JSON.stringify(expectedTypes);

if (!typesMatch) {
  violations.push(`❌ 段类型不匹配:\n     实际: [${actualTypes.join(', ')}]\n     期望: [${expectedTypes.join(', ')}]`);
} else {
  console.log('✅ 段类型完全匹配: [move, quad, line, curve, line, quad, quad, close]');
}

if (!violations.includes('❌ 段类型不匹配') && actualTypes[3] !== 'curve') {
  violations.push('❌ 袖窿段不是三次Bezier(C)，实际为: ' + actualTypes[3]);
} else if (actualTypes[3] === 'curve') {
  console.log('✅ 袖窿使用三次Bezier曲线(C)');
}

if (!violations.includes('❌ 段类型不匹配') && actualTypes[2] !== 'line') {
  violations.push('❌ 肩线段不是直线(L)，实际为: ' + actualTypes[2]);
} else if (actualTypes[2] === 'line') {
  console.log('✅ 肩线使用直线(L)');
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
  console.log('  │  🔒 拓扑结构已锁定                          │');
  console.log('  │                                              │');
  console.log('  │  固定结构: M Q L C L Q Q Z                 │');
  console.log('  │  总段数: 8                                   │');
  console.log('  │  二次Bezier(Q): 3条                         │');
  console.log('  │  三次Bezier(C): 1条 (袖窿)                  │');
  console.log('  │  直线段(L): 2条                              │');
  console.log('  │                                              │');
  console.log('  │  ✅ 严格基于 example/front_template_point.ts│');
  console.log('  │                                              │');
  console.log('  │  允许操作:                                   │');
  console.log('  │  ✓ 根据尺寸参数调整12个关键点坐标           │');
  console.log('  │  ✓ 参数化等比/比例缩放                      │');
  console.log('  │                                              │');
  console.log('  │  禁止操作:                                   │');
  console.log('  │  ✗ 修改path拓扑                             │');
  console.log('  │  ✗ 新增/删除path段                           │');
  console.log('  │  ✗ 随机生成Bezier                            │');
  console.log('  │  ✗ 自由生成polygon                           │');
  console.log('  │  ✗ 使用矩形模拟裁片                         │');
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
console.log('🏭 参数化模板系统规范');
console.log('═'.repeat(60) + '\n');

console.log(FrontPatternGenerator.getTemplateStructure());

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ 验证完成');
console.log('═══════════════════════════════════════════════════════════════════\n');

process.exit(violations.length > 0 || !allStructuresMatch ? 1 : 0);
