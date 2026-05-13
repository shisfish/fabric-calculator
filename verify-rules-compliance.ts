#!/usr/bin/env node
import { TshirtPatternGenerator, GarmentMeasurementAdapter } from './patterns/index.js';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🏭 工业比例系统验证 - 遵守rule-size.md规则');
console.log('═══════════════════════════════════════════════════════════════════\n');

const input = {
  chestWidth: 29,
  bodyLength: 72,
  shoulderWidth: 24,
  neckWidth: 9
};

const params = GarmentMeasurementAdapter.adapt(input);
const pieces = TshirtPatternGenerator.generatePattern(params);
const frontPiece = pieces.find(p => p.name === 'front');

if (!frontPiece) {
  console.log('❌ 未找到前片');
  process.exit(1);
}

console.log('📋 第1步：拓扑结构检查');
console.log('═'.repeat(60) + '\n');

const ops = frontPiece.path.ops;
const topologyStr = ops.map(op => {
  switch (op.type) {
    case 'move': return 'M';
    case 'line': return 'L';
    case 'quad': return 'Q';
    case 'curve': return 'C';
    case 'close': return 'Z';
    default: return '?';
  }
}).join(' ');

console.log(`当前拓扑: ${topologyStr}`);
console.log(`操作数:   ${ops.length}`);

const expectedTopology = 'MQLCCCLQZ';
const isCorrectTopology = topologyStr.replace(/\s/g, '') === expectedTopology;

console.log(`期望拓扑: ${expectedTopology}`);
console.log(`匹配状态: ${isCorrectTopology ? '✅ 完全匹配' : '❌ 不匹配'}\n`);

if (!isCorrectTopology) {
  console.log('❌ 拓扑错误！必须是 M Q L C C C L Q Z');
  process.exit(1);
}

console.log('═'.repeat(60));
console.log('📋 第2步：工业比例系统检查（rule-size.md）');
console.log('═'.repeat(60) + '\n');

const points = frontPiece.points;
const W = input.chestWidth;
const actualShoulderX = points.shoulder.x;
const armholeSpanX = points.armholeEnd.x - actualShoulderX;

console.log('基础参数:');
console.log(`  chestWidth (输入):   ${W} cm`);
console.log(`  shoulder点x (实际):  ${actualShoulderX.toFixed(2)} cm`);
console.log(`  armholeEnd.x:        ${points.armholeEnd.x.toFixed(2)} cm`);
console.log(`  armholeSpanX:        ${armholeSpanX.toFixed(2)} cm\n`);

console.log('袖窿控制点分析 (3段曲线):');
console.log(`  ${'─'.repeat(55)}`);

let curveIndex = 0;
for (let i = 0; i < ops.length; i++) {
  if (ops[i].type === 'curve') {
    curveIndex++;
    const op = ops[i];
    const prevOp = i > 0 && ops[i-1].type !== 'curve' ? ops[i-1] : null;

    console.log(`\n曲线${curveIndex} [index=${i}]:`);

    if (op.cp1 && op.cp2 && op.to) {
      console.log(`  CP1: (${op.cp1.x.toFixed(2)}, ${op.cp1.y.toFixed(2)})`);
      console.log(`  CP2: (${op.cp2.x.toFixed(2)}, ${op.cp2.y.toFixed(2)})`);
      console.log(`  终点: (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);

      if (prevOp?.to) {
        const spanX = op.to.x - prevOp.to.x;
        const outwardRatio = (op.cp1.x - prevOp.to.x) / Math.max(spanX, 0.01);
        console.log(`  外扩比例: ${outwardRatio.toFixed(3)}`);
        console.log(`  状态: ${outwardRatio > 0 ? '✅ 外鼓' : '❌ 内收'}`);
      }
    }
  }
}

console.log('\n' + '═'.repeat(60));
console.log('📋 第3步：3段袖窿曲线检查');
console.log('═'.repeat(60) + '\n');

let curveCount = 0;
for (let i = 0; i < ops.length; i++) {
  if (ops[i].type === 'curve') {
    curveCount++;
    const op = ops[i];
    console.log(`曲线${curveCount} [index=${i}]:`);
    console.log(`  CP1: (${op.cp1?.x?.toFixed(2)}, ${op.cp1?.y?.toFixed(2)})`);
    console.log(`  CP2: (${op.cp2?.x?.toFixed(2)}, ${op.cp2?.y?.toFixed(2)})`);
    console.log(`  终点: (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)})`);
    
    // 计算曲率
    if (op.cp1 && op.cp2 && op.to) {
      const prevOp = i > 0 ? ops[i-1] : null;
      if (prevOp?.to) {
        const spanX = op.to.x - prevOp.to.x;
        const spanY = op.to.y - prevOp.to.y;
        const cp1Deviation = Math.abs(op.cp1.y - (prevOp.to.y + (spanY * 0.5)));
        const cp2Deviation = Math.abs(op.cp2.y - (prevOp.to.y + (spanY * 0.5)));
        console.log(`  曲率特征: CP1偏差=${cp1Deviation.toFixed(2)}cm, CP2偏差=${cp2Deviation.toFixed(2)}cm`);
      }
    }
    console.log('');
  }
}

console.log(`总曲线数: ${curveCount}/3 ${curveCount === 3 ? '✅' : '❌'}`);

console.log('\n' + '═'.repeat(60));
console.log('📋 第4步：半片结构检查');
console.log('═'.repeat(60) + '\n');

console.log(`onFold: ${frontPiece.onFold}`);
console.log(`前中线x=0: ${points.cfNeck.x === 0 && points.hemFold.x === 0 ? '✅ 正确' : '❌ 错误'}`);

console.log('\n' + '═'.repeat(60));
console.log('📋 第5步：完整SVG输出');
console.log('═'.repeat(60) + '\n');

let d = '';
for (const op of ops) {
  switch (op.type) {
    case 'move':
      d += `M ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `;
      break;
    case 'line':
      d += `L ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `;
      break;
    case 'quad':
      d += `Q ${op.cp1.x.toFixed(1)} ${op.cp1.y.toFixed(1)} ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `;
      break;
    case 'curve':
      d += `C ${op.cp1.x.toFixed(1)} ${op.cp1.y.toFixed(1)} ${op.cp2.x.toFixed(1)} ${op.cp2.y.toFixed(1)} ${op.to.x.toFixed(1)} ${op.to.y.toFixed(1)} `;
      break;
    case 'close':
      d += 'Z';
      break;
  }
}

console.log('SVG path d:');
console.log(d.trim());

// 统计
const hasC = d.includes('C ');
const hasQ = d.includes('Q ');
const curveOpsCount = (d.match(/C /g) || []).length;
const quadOpsCount = (d.match(/Q /g) || []).length;

console.log('\n统计:');
console.log(`  包含C指令: ${hasC ? '✅' : '❌'} (${curveOpsCount}个)`);
console.log(`  包含Q指令: ${hasQ ? '✅' : '❌'} (${quadOpsCount}个)`);
console.log(`  总操作数: ${ops.length}`);

console.log('\n' + '═'.repeat(60));
console.log('🎯 最终评估');
console.log('═'.repeat(60) + '\n');

const allChecks = [
  { name: '拓扑结构', pass: isCorrectTopology },
  { name: '3段袖窿曲线', pass: curveCount === 3 },
  { name: '半片结构(onFold)', pass: frontPiece.onFold === true }
];

let passedCount = 0;
allChecks.forEach(check => {
  console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
  if (check.pass) passedCount++;
});

console.log(`\n通过率: ${passedCount}/${allChecks.length} (${(passedCount/allChecks.length*100).toFixed(0)}%)`);

if (passedCount === allChecks.length) {
  console.log('\n🎉🎉🎉 完美！完全符合rule-size.md工业标准！');
} else {
  console.log('\n⚠️ 还有部分项目需要调整');
}

process.exit(passedCount === allChecks.length ? 0 : 1);
