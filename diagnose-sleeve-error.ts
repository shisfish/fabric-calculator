import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';

console.log('═══════════════════════════════════════');
console.log('🔍 袖子系统错误诊断');
console.log('═══════════════════════════════════════');

const garmentInput = {
  chestWidth: 59,
  bodyLength: 68,
  shoulderWidth: 64,
  neckWidth: 25,
  neckDepth: 8,
  armholeDepth: 28,
  sleeveLength: 60,
  bicepsWidth: 20,
  cuffWidth: 10,
  shoulderSlope: 5.5,
  seamAllowance: 1
} as any;

const params = GarmentMeasurementAdapter.adapt(garmentInput);
console.log('\n📐 参数转换结果:');
console.log(`   前片胸宽: ${params.frontPanel.width} cm`);
console.log(`   后片胸宽: ${params.backPanel.width} cm`);
console.log(`   袖子臂围: ${params.sleeve.bicepsWidth} cm`);
console.log(`   袖山高: ${params.sleeve.sleeveCapHeight} cm`);
console.log(`   袖长: ${params.sleeve.sleeveLength} cm`);

const pieces = TshirtPatternGenerator.generatePattern(params);

const backPiece = pieces.find(p => p.name === 'back');
const frontPiece = pieces.find(p => p.name === 'front');
const sleevePiece = pieces.find(p => p.name === 'sleeve');

if (!backPiece || !frontPiece || !sleevePiece) {
  console.error('❌ 无法获取裁片数据');
  process.exit(1);
}

console.log('\n' + '='.repeat(70));
console.log('📊 前片 Path 结构分析');
console.log('='.repeat(70));

const frontOps = frontPiece.path.ops || [];
console.log(`\n总 Ops 数量: ${frontOps.length}`);
frontOps.forEach((op, idx) => {
  if (op.to) {
    const extra = op.cp1 && op.cp2 ? 
      ` CP1(${op.cp1.x.toFixed(1)},${op.cp1.y.toFixed(1)}) CP2(${op.cp2.x.toFixed(1)},${op.cp2.y.toFixed(1)})` : 
      '';
    console.log(`  [${idx}] ${op.type.toUpperCase()} → (${op.to.x.toFixed(1)}, ${op.to.y.toFixed(1)})${extra}`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('📊 后片 Path 结构分析');
console.log('='.repeat(70));

const backOps = backPiece.path.ops || [];
console.log(`\n总 Ops 数量: ${backOps.length}`);
backOps.forEach((op, idx) => {
  if (op.to) {
    const extra = op.cp1 && op.cp2 ? 
      ` CP1(${op.cp1.x.toFixed(1)},${op.cp1.y.toFixed(1)}) CP2(${op.cp2.x.toFixed(1)},${op.cp2.y.toFixed(1)})` : 
      '';
    console.log(`  [${idx}] ${op.type.toUpperCase()} → (${op.to.x.toFixed(1)}, ${op.to.y.toFixed(1)})${extra}`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('📊 袖子 Path 结构分析');
console.log('='.repeat(70));

const sleeveOps = sleevePiece.path.ops || [];
console.log(`\n总 Ops 数量: ${sleeveOps.length}`);
sleeveOps.forEach((op, idx) => {
  if (op.to) {
    const extra = op.cp1 && op.cp2 ? 
      ` CP1(${op.cp1.x.toFixed(1)},${op.cp1.y.toFixed(1)}) CP2(${op.cp2.x.toFixed(1)},${op.cp2.y.toFixed(1)})` : 
      '';
    console.log(`  [${idx}] ${op.type.toUpperCase()} → (${op.to.x.toFixed(1)}, ${op.to.y.toFixed(1)})${extra}`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('🔑 袖子关键点坐标');
console.log('='.repeat(70));

const keyPoints = ['capTop', 'frontAxilla', 'backAxilla', 'frontCuff', 'backCuff', 'frontPitch', 'backPitch'];
for (const key of keyPoints) {
  if (sleevePiece.points[key]) {
    const p = sleevePiece.points[key];
    console.log(`${key}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  } else {
    console.log(`${key}: ❌ 未找到`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('⚠️ 问题诊断');
console.log('='.repeat(70));

// 检查袖山高度是否合理
const capHeight = sleevePiece.points.frontAxilla?.y || 0;
const expectedCapHeight = params.sleeve.sleeveCapHeight;
console.log(`\n袖山高度:`);
console.log(`  实际: ${capHeight.toFixed(2)} cm`);
console.log(`  预期: ${expectedCapHeight} cm`);

if (Math.abs(capHeight - expectedCapHeight) > 0.1) {
  console.log(`  ❌ 差异过大！实际=${capHeight}, 预期=${expectedCapHeight}`);
}

// 检查袖子宽度
const sleeveWidth = (sleevePiece.points.frontAxilla?.x || 0) - (sleevePiece.points.backAxilla?.x || 0);
const expectedBicep = params.sleeve.bicepsWidth;
console.log(`\n袖子宽度（腋下）:`);
console.log(`  实际: ${sleeveWidth.toFixed(2)} cm`);
console.log(`  预期: ${expectedBicep} cm`);

if (Math.abs(sleeveWidth - expectedBicep) > 0.1) {
  console.log(`  ❌ 差异过大！实际=${sleeveWidth}, 预期=${expectedBicep}`);
}

// 检查袖长
const sleeveLength = (sleevePiece.points.frontCuff?.y || 0) - (sleevePiece.points.capTop?.y || 0);
const expectedSleeveLength = params.sleeve.sleeveLength + params.sleeve.sleeveCapHeight;
console.log(`\n袖子总长度:`);
console.log(`  实际: ${sleeveLength.toFixed(2)} cm`);
console.log(`  预期: ${expectedSleeveLength} cm (袖山+袖长)`);

if (Math.abs(sleeveLength - expectedSleeveLength) > 0.1) {
  console.log(`  ❌ 差异过大！`);
}

console.log('\n' + '='.repeat(70));
console.log('💡 可能的问题原因:');
console.log('='.repeat(70));
console.log(`
1. extractArmholeOps() 提取的曲线不正确
2. SleeveCapGenerator 控制点计算有误  
3. 前后袖窿长度计算为0或异常值
4. 袖山生成算法的ratio参数不合理

建议检查:
- 前后片的curve操作是否正确提取
- SleeveCapGenerator.generateFromArmhole() 的输入参数
- 控制点的outward比例是否合理
`);
