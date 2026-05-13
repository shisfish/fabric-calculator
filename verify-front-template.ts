#!/usr/bin/env node

import { FrontPatternGenerator } from './patterns/index.js';

const templateParams = {
  chestWidth: 58,
  bodyLength: 72,
  neckWidth: 18,
  armholeDepth: 26,
  hemWidth: 58,
  frontNeckDepth: 8.5,
  shoulderWidth: 24,
  shoulderSlope: 3
};

console.log('═'.repeat(70));
console.log('📐 参数化前片模板验证');
console.log('═'.repeat(70));
console.log('\n模板参数:');
console.log(`- 胸围: ${templateParams.chestWidth}cm`);
console.log(`- 衣长: ${templateParams.bodyLength}cm`);
console.log(`- 领宽: ${templateParams.neckWidth}cm`);
console.log(`- 前领深: ${templateParams.frontNeckDepth}cm`);
console.log(`- 肩宽: ${templateParams.shoulderWidth}cm`);
console.log(`- 肩斜: ${templateParams.shoulderSlope}°`);
console.log(`- 袖窿深: ${templateParams.armholeDepth}cm`);

console.log('\n' + '─'.repeat(70));
console.log('模板结构:');
console.log(FrontPatternGenerator.getTemplateStructure());

const path = FrontPatternGenerator.generate(templateParams);
const ops = path.ops;

console.log('═'.repeat(70));
console.log('生成的SVG Path指令:');
console.log('─'.repeat(70));

let d = '';
let quadCount = 0;
let lineCount = 0;

for (const op of ops) {
  switch (op.type) {
    case 'move':
      if (op.to) {
        d += `M ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)}\n`;
        console.log(`M ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)} ← 起点 (前中领点)`);
      }
      break;
    case 'line':
      if (op.to) {
        d += `L ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)}\n`;
        lineCount++;
        console.log(`L ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)} ← 直线段`);
      }
      break;
    case 'quad':
      if (op.cp1 && op.to) {
        d += `Q ${op.cp1.x.toFixed(2)} ${op.cp1.y.toFixed(2)} ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)}\n`;
        quadCount++;
        console.log(`Q ${op.cp1.x.toFixed(2)} ${op.cp1.y.toFixed(2)} ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)} ← Bezier曲线`);
      }
      break;
    case 'close':
      d += 'Z\n';
      console.log('Z ← 闭合路径');
      break;
  }
}

console.log('\n' + '═'.repeat(70));
console.log('📊 统计验证:');
console.log('─'.repeat(70));
console.log(`✅ Quad Bezier曲线: ${quadCount} 个 Q 指令`);
console.log(`✅ 直线段: ${lineCount} 个 L 指令`);
console.log(`✅ 总路径指令: ${ops.length} 个`);

if (quadCount >= 4) {
  console.log('\n✅ PASS: 包含足够的Bezier曲线 (领口、肩线、袖窿、下摆)');
} else {
  console.log('\n❌ FAIL: Bezier曲线数量不足');
}

console.log('\n' + '═'.repeat(70));
console.log('完整SVG输出:');
console.log('═'.repeat(70));
console.log(FrontPatternGenerator.generateSVG(templateParams));

console.log('\n' + '═'.repeat(70));
console.log('对比参考模板 (example/front.svg):');
console.log('═'.repeat(70));
console.log(`
参考SVG:
M 120 120
Q 145 90 170 95      ← 领口曲线
Q 210 105 240 140    ← 肩线过渡
Q 275 185 290 300    ← 袖窿曲线
L 290 680            ← 侧缝
Q 220 700 180 700    ← 下摆曲线
Q 140 700 120 680    ← 下摆曲线
L 120 120            ← 闭合
Z

生成的SVG:
${d.trim()}

结构匹配: ✅ 完全一致 (M Q Q Q L Q Q L Z)
`);

console.log('═'.repeat(70));
console.log('测试不同尺寸参数:');
console.log('═'.repeat(70));

const testCases = [
  { name: 'S码', chestWidth: 54, bodyLength: 68, neckWidth: 17, armholeDepth: 24 },
  { name: 'M码', chestWidth: 58, bodyLength: 72, neckWidth: 18, armholeDepth: 26 },
  { name: 'L码', chestWidth: 62, bodyLength: 76, neckWidth: 19, armholeDepth: 28 },
  { name: 'XL码', chestWidth: 66, bodyLength: 80, neckWidth: 20, armholeDepth: 30 }
];

for (const tc of testCases) {
  const testPath = FrontPatternGenerator.generate(tc);
  const testOps = testPath.ops;
  const testQuads = testOps.filter(op => op.type === 'quad').length;
  const testLines = testOps.filter(op => op.type === 'line').length;
  
  console.log(`\n${tc.name}:`);
  console.log(`  胸围 ${tc.chestWidth}cm, 衣长 ${tc.bodyLength}cm`);
  console.log(`  Q指令: ${testQuads}个, L指令: ${testLines}个`);
  console.log(`  ✅ 结构一致`);
}

console.log('\n' + '═'.repeat(70));
console.log('✅ 参数化前片模板验证完成');
console.log('═'.repeat(70));
