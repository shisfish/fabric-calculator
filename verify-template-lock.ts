#!/usr/bin/env node
import { FrontPatternGenerator, type FrontPatternParams } from './patterns/index.js';

const EXPECTED_TOPOLOGY = {
  segmentCount: 9,
  pathStructure: 'M Q Q Q L Q Q L Z',
  segments: [
    { index: 0, type: 'move', name: '起始点', from: 'cfNeck' },
    { index: 1, type: 'quad', name: '前领口Bezier', controlPoint: 'neckCp1', to: 'neckEnd' },
    { index: 2, type: 'quad', name: '肩线过渡', controlPoint: 'shoulderCp1', to: 'shoulderEnd' },
    { index: 3, type: 'quad', name: '袖窿Bezier曲线', controlPoint: 'armholeCp', to: 'armholeBottom' },
    { index: 4, type: 'line', name: '侧缝直线', to: 'sideBottom' },
    { index: 5, type: 'quad', name: '下摆Bezier(右)', controlPoint: 'hemCp1', to: 'hemMid' },
    { index: 6, type: 'quad', name: '下摆Bezier(左)', controlPoint: 'hemCp2', to: 'leftBottom' },
    { index: 7, type: 'line', name: '闭合线', to: 'cfNeck' },
    { index: 8, type: 'close', name: '路径闭合', to: '' }
  ]
};

const testCases: Array<{ name: string; params: FrontPatternParams }> = [
  {
    name: '标准版 M码 (58×72)',
    params: {
      chestWidth: 58,
      bodyLength: 72,
      neckWidth: 18,
      armholeDepth: 26
    }
  },
  {
    name: 'Oversize版 L码 (66×78)',
    params: {
      chestWidth: 66,
      bodyLength: 78,
      neckWidth: 21,
      armholeDepth: 31,
      shoulderWidth: 30,
      shoulderSlope: 2
    }
  },
  {
    name: '紧身版 S码 (50×65)',
    params: {
      chestWidth: 50,
      bodyLength: 65,
      neckWidth: 16,
      armholeDepth: 22,
      shoulderWidth: 20,
      shoulderSlope: 4
    }
  },
  {
    name: '超大码 XXL (80×85)',
    params: {
      chestWidth: 80,
      bodyLength: 85,
      neckWidth: 24,
      armholeDepth: 35,
      shoulderWidth: 38,
      shoulderSlope: 1.5
    }
  },
  {
    name: '儿童码 XS (36×45)',
    params: {
      chestWidth: 36,
      bodyLength: 45,
      neckWidth: 13,
      armholeDepth: 16,
      shoulderWidth: 14,
      shoulderSlope: 5
    }
  }
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🔒 参数化模板系统 - 拓扑结构锁定验证');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('📋 固定拓扑结构定义:');
console.log('─'.repeat(60));
console.log(`总段数: ${EXPECTED_TOPOLOGY.segmentCount}`);
console.log(`路径指令序列: ${EXPECTED_TOPOLOGY.pathStructure}`);
console.log('\n各段详情:');
for (const seg of EXPECTED_TOPOLOGY.segments) {
  const cpInfo = seg.controlPoint ? ` [CP: ${seg.controlPoint}]` : '';
  console.log(`  [${seg.index}] ${seg.type.toUpperCase().padEnd(5)} ${seg.name.padEnd(20)} → ${seg.to}${cpInfo}`);
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
        break;
      case 'close':
        structure += 'Z';
        segStr = 'Z (闭合)';
        break;
    }

    if (segStr && i < EXPECTED_TOPOLOGY.segments.length) {
      segmentDetails.push(`[${i.toString().padStart(2)}] ${segStr.padEnd(55)} ← ${EXPECTED_TOPOLOGY.segments[i].name}`);
    }
  }

  const trimmedStructure = structure.trim();
  const match = trimmedStructure === EXPECTED_TOPOLOGY.pathStructure;

  results.push({ name: testCase.name, structure: trimmedStructure, match });

  console.log(`\n📦 测试用例: ${testCase.name}`);
  console.log(`   参数: chest=${testCase.params.chestWidth}, length=${testCase.params.bodyLength}, neck=${testCase.params.neckWidth}, armhole=${testCase.params.armholeDepth}`);
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

  const bezierCount = ops.filter(op => op.type === 'quad' || op.type === 'curve').length;
  const lineCount = ops.filter(op => op.type === 'line').length;
  console.log(`   统计: Bezier段=${bezierCount}, 直线段=${lineCount}`);
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

const hasBezier = svgPath.includes(' Q ') || svgPath.includes(' C ');
if (!hasBezier) {
  violations.push('❌ 缺少 Bezier 曲线');
} else {
  console.log('✅ 包含 Bezier 曲线');
}

if (firstPath.ops.length !== EXPECTED_TOPOLOGY.segmentCount) {
  violations.push(`❌ 段数异常: ${firstPath.ops.length} (期望 ${EXPECTED_TOPOLOGY.segmentCount})`);
} else {
  console.log(`✅ 段数正确: ${EXPECTED_TOPOLOGY.segmentCount}`);
}

const expectedSegments = ['move', 'quad', 'quad', 'quad', 'line', 'quad', 'quad', 'line', 'close'];
const actualTypes = firstPath.ops.map(op => op.type);
const typesMatch = JSON.stringify(actualTypes) === JSON.stringify(expectedSegments);

if (!typesMatch) {
  violations.push(`❌ 段类型不匹配: [${actualTypes.join(', ')}]`);
} else {
  console.log('✅ 段类型完全匹配模板定义');
}

console.log('\n' + '═'.repeat(60));
console.log('📊 总结报告');
console.log('═'.repeat(60) + '\n');

console.log(`测试用例总数: ${testCases.length}`);
console.log(`结构一致率: ${results.filter(r => r.match).length}/${results.length} (${((results.filter(r => r.match).length / results.length) * 100).toFixed(0)}%)`);

if (allStructuresMatch) {
  console.log('\n✅ ✅ ✅ 所有测试通过！\n');
  console.log('结论:');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │  🔒 拓扑结构已锁定                          │');
  console.log('  │                                              │');
  console.log('  │  固定结构: M Q Q Q L Q Q L Z               │');
  console.log('  │  总段数: 8                                  │');
  console.log('  │  Bezier曲线: 5条                            │');
  console.log('  │  直线段: 2条                                │');
  console.log('  │                                              │');
  console.log('  │  允许操作:                                   │');
  console.log('  │  ✓ 根据尺寸参数调整关键点坐标              │');
  console.log('  │  ✓ 控制点微调                              │');
  console.log('  │  ✓ 等比缩放                                │');
  console.log('  │                                              │');
  console.log('  │  禁止操作:                                   │');
  console.log('  │  ✗ 新增/删除path段                         │');
  console.log('  │  ✗ 随机生成Bezier                          │');
  console.log('  │  ✗ 自动推断拓扑结构                        │');
  console.log('  │  ✗ 使用矩形模拟裁片                        │');
  console.log('  └──────────────────────────────────────────────┘');
} else {
  console.log('\n❌ 发现结构不一致！');
  for (const result of results) {
    if (!result.match) {
      console.log(`  - ${result.name}: ${result.structure}`);
    }
  }
}

if (violations.length > 0) {
  console.log('\n⚠️  违规项:');
  for (const v of violations) {
    console.log(`  ${v}`);
  }
} else {
  console.log('\n✅ 无违规项 - 符合工业CAD规范');
}

console.log('\n' + '═'.repeat(60));
console.log('🏭 参数化模板系统规范');
console.log('═'.repeat(60) + '\n');

console.log(FrontPatternGenerator.getTemplateStructure());

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ 验证完成');
console.log('═══════════════════════════════════════════════════════════════════\n');

process.exit(violations.length > 0 || !allStructuresMatch ? 1 : 0);
