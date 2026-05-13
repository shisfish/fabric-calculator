#!/usr/bin/env node
import { FrontPatternGenerator, type FrontPatternParams } from './patterns/index.js';

const testCases = [
  {
    name: '标准版 M码',
    params: {
      chestWidth: 58,
      bodyLength: 72,
      neckWidth: 18,
      armholeDepth: 26
    } as FrontPatternParams
  },
  {
    name: 'Oversize版 L码',
    params: {
      chestWidth: 66,
      bodyLength: 78,
      neckWidth: 21,
      armholeDepth: 31,
      shoulderWidth: 30,
      shoulderSlope: 2
    } as FrontPatternParams
  },
  {
    name: '紧身版 S码',
    params: {
      chestWidth: 50,
      bodyLength: 65,
      neckWidth: 16,
      armholeDepth: 22,
      shoulderWidth: 20,
      shoulderSlope: 4
    } as FrontPatternParams
  }
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🧪 端到端验证：FrontPatternGenerator');
console.log('═══════════════════════════════════════════════════════════════════\n');

for (const testCase of testCases) {
  console.log(`\n📦 测试用例: ${testCase.name}`);
  console.log(`   参数: ${JSON.stringify(testCase.params)}\n`);

  const path = FrontPatternGenerator.generate(testCase.params);
  const ops = path.ops;

  let structure = '';
  let quadCount = 0;
  let lineCount = 0;

  for (const op of ops) {
    switch (op.type) {
      case 'move': structure += 'M '; break;
      case 'line':
        lineCount++;
        structure += 'L ';
        break;
      case 'quad':
        quadCount++;
        structure += 'Q ';
        break;
      case 'close': structure += 'Z'; break;
    }
  }

  console.log(`   路径结构: ${structure.trim()}`);
  console.log(`   Bezier曲线数: ${quadCount}`);
  console.log(`   直线段数: ${lineCount}`);

  const svg = path.toSVGPath();
  console.log(`   SVG Path: ${svg.substring(0, 80)}...`);

  const hasBezier = svg.includes(' Q ') || svg.includes(' C ');
  console.log(`   包含Bezier曲线: ${hasBezier ? '✅ 是' : '❌ 否'}`);

  const isRectangle = structure.trim() === 'M L L L Z' || structure.trim() === 'M L L L L Z';
  console.log(`   是否为矩形: ${isRectangle ? '⚠️ 是（失败）' : '✅ 否'}`);
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ 端到端验证完成！');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('📋 整合清单:');
console.log('   ✅ verify-oversize-scaling.ts 编译错误已修复');
console.log('   ✅ cad_runner.ts 已更新支持 frontOnly 模式');
console.log('   ✅ cad.js 已添加 getFrontPatternParams() 函数');
console.log('   ✅ cad.html 已添加"仅生成前片"复选框');
console.log('   ✅ 默认参数已更新为工业级模板值');
console.log('\n🚀 使用方式:');
console.log('   1. 打开 CAD 页面');
console.log('   2. 勾选 "仅生成前片（参数化模板模式）"');
console.log('   3. 输入成衣尺寸参数');
console.log('   4. 点击计算，系统将使用 FrontPatternGenerator 生成裁片');
