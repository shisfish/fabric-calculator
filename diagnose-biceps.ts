import { TshirtPatternGenerator } from './patterns/Tshirt.js';
import { GarmentMeasurementAdapter } from './patterns/GarmentMeasurementAdapter.js';
import { SleeveCapGenerator } from './patterns/SleeveCapGenerator.js';

console.log('\n' + '='.repeat(100));
console.log('🔬 BicepsWidth 定义与算法深度诊断');
console.log('   目标：找出为什么用户输入的正确参数导致计算错误');
console.log('='.repeat(100) + '\n');

const testParams = {
  category: 'tshirt' as const,
  frontPanel: {
    width: 29, length: 72,
    neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26,
    shoulderSlope: 5.5, armholePitchX: 0.15, hemExtension: 0
  },
  backPanel: {
    width: 29, length: 72,
    neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26,
    shoulderSlope: 12, armholePitchX: 0.2, hemExtension: 0
  },
  sleeve: {
    bicepsWidth: 20,      // 用户输入：20cm
    bicepWidth: 20,       // 兼容字段
    sleeveCapHeight: 14,  // 用户输入：14cm
    sleeveLength: 58,     // 用户输入：58cm
    cuffWidth: 18         // 用户输入：18cm
  },
  seamAllowance: 1
};

const params = GarmentMeasurementAdapter.adapt(testParams);

console.log('📥 第一步：用户输入 vs 系统处理\n');
console.log('用户原始输入:');
console.log(`   sleeve.bicepsWidth = ${testParams.sleeve.bicepsWidth} cm`);
console.log(`   sleeve.sleeveCapHeight = ${testParams.sleeve.sleeveCapHeight} cm`);
console.log(`   sleeve.cuffWidth = ${testParams.sleeve.cuffWidth} cm`);

console.log('\nGarmentMeasurementAdapter处理后:');
console.log(`   params.sleeve.bicepsWidth = ${params.sleeve.bicepsWidth} cm`);
console.log(`   params.sleeve.sleeveCapHeight = ${params.sleeve.sleeveCapHeight} cm`);
console.log(`   params.sleeve.cuffWidth = ${params.sleeve.cuffWidth} cm`);

// 生成前后片以获取袖窿数据
const pieces = TshirtPatternGenerator.generatePattern(params);
const backPiece = pieces.find(p => p.name === 'back')!;
const frontPiece = pieces.find(p => p.name === 'front')!;
const sleevePiece = pieces.find(p => p.name === 'sleeve')!;

// 提取袖窿操作
const frontArmholeOps = (TshirtPatternGenerator as any).extractArmholeOps(frontPiece.path);
const backArmholeOps = (TshirtPatternGenerator as any).extractArmholeOps(backPiece.path);

console.log('\n' + '-'.repeat(80));
console.log('📏 第二步：袖窿长度分析（目标值）\n');

// 计算袖窿长度
const frontSegments = (SleeveCapGenerator as any).extractArmholeSegments(frontArmholeOps);
const backSegments = (SleeveCapGenerator as any).extractArmholeSegments(backArmholeOps);
const frontArmholeLen = (SleeveCapGenerator as any).calculateTotalArmholeLength(frontSegments);
const backArmholeLen = (SleeveCapGenerator as any).calculateTotalArmholeLength(backSegments);
const totalArmhole = frontArmholeLen + backArmholeLen;
const ease = 2.0; // 标准ease
const targetCapLen = totalArmhole + ease;

console.log(`前袖窿长度: ${frontArmholeLen.toFixed(2)} cm`);
console.log(`后袖窿长度: ${backArmholeLen.toFixed(2)} cm`);
console.log(`总袖窿长度: ${totalArmhole.toFixed(2)} cm`);
console.log(`Ease值: ${ease} cm`);
console.log(`\n⭕ 目标袖山长度 = ${targetCapLen.toFixed(2)} cm (袖窿 + ease)`);

console.log('\n' + '-'.repeat(80));
console.log('📐 第三步：当前算法实际输出\n');

console.log(`实际袖山长度:`);
console.log(`   前袖山: ${sleevePiece.frontCapLength?.toFixed(2)} cm`);
console.log(`   后袖山: ${sleevePiece.backCapLength?.toFixed(2)} cm`);
console.log(`   总长度: ${sleevePiece.totalCapLength?.toFixed(2)} cm`);

const error = (sleevePiece.totalCapLength || 0) - targetCapLen;
const errorPercent = (error / targetCapLen) * 100;

console.log(`\n❌ 误差分析:`);
console.log(`   差值: ${error.toFixed(2)} cm (${errorPercent.toFixed(1)}%)`);
console.log(`   状态: ${Math.abs(error) <= 0.3 ? '✅ 优秀' : Math.abs(error) <= 0.8 ? '⚠️ 可接受' : '❌ 失败'}`);

console.log('\n' + '-'.repeat(80));
console.log('🔢 第四步：BicepWidth 使用情况追踪\n');

console.log('在 SleeveCapGenerator.generateFromArmhole() 中:');
console.log(`   输入 bicepsWidth = ${params.sleeve.bicepsWidth} cm`);
console.log(`   直接传递给 generateSleeveCap(halfBicep=${params.sleeve.bicepsWidth}, ...)`);

console.log('\n在 generateSleeveCap() 中:');
const halfBicep = params.sleeve.bicepsWidth; // 20
console.log(`   halfBicep = ${halfBicep} cm (直接使用用户输入)`);

// 计算关键点位置
const capHeight = params.sleeve.sleeveCapHeight; // 14
const frontAxillaX = halfBicep; // 20
const backAxillaX = -halfBicep; // -20
const totalWidth = frontAxillaX - backAxillaX; // 40

console.log(`\n   关键点坐标 (基于halfBicep=${halfBicep}):`);
console.log(`   frontAxilla = (${frontAxillaX}, ${capHeight})`);
console.log(`   backAxilla  = (${backAxillaX}, ${capHeight})`);
console.log(`   腋下全围宽度 = ${totalWidth} cm`);

console.log('\n' + '-'.repeat(80));
console.log('⚠️ 第五步：问题根源假设验证\n');

console.log('【假设1】bicepsWidth定义混淆？');
console.log('   如果20cm是"全围"而非"半围":');
const ifFullCircumference = 20;
const halfIfFull = ifFullCircumference / 2; // 10
console.log(`      实际半围应该是: ${halfIfFull} cm`);
console.log(`      但代码直接使用: ${halfBicep} cm → 这会导致袖子变窄`);

console.log('\n【假设2】工业标准对比？');
console.log('   对于M号T恤（胸围96-100cm）:');
console.log('   标准bicepsWidth（半围）范围: 18-22 cm');
console.log('   用户输入: 20 cm ← ✅ 在正常范围内');
console.log('   标准袖山高度: 13-15 cm');
console.log('   用户输入: 14 cm ← ✅ 在正常范围内');

console.log('\n【假设3】袖窿长度异常？');
console.log(`   前袖窿: ${frontArmholeLen.toFixed(2)} cm`);
console.log(`   后袖窿: ${backArmholeLen.toFixed(2)} cm`);
console.log(`   总计: ${totalArmhole.toFixed(2)} cm`);
console.log(`   对于M号T恤，这个值偏${totalArmhole > 55 ? '大' : '小'}`);
if (totalArmhole > 55) {
  console.log('   ⚠️ 可能原因: 袖窿曲线过长或包含多余线段');
}

console.log('\n【假设4】控制点放置过于保守？');
console.log('   当前控制点基于比例系统:');
const pts = sleevePiece.points;

if (pts.ufCp1 && pts.capTop) {
  const dist1 = Math.sqrt(Math.pow(pts.ufCp1.x - pts.capTop.x, 2) + Math.pow(pts.ufCp1.y - pts.capTop.y, 2));
  console.log(`      ufCp1距capTop距离: ${dist1.toFixed(2)} cm (占halfBicep的${(dist1/halfBicep*100).toFixed(1)}%)`);
}

if (pts.lfCp2 && pts.frontAxilla) {
  const dist2 = Math.sqrt(Math.pow(pts.lfCp2.x - pts.frontAxilla.x, 2) + Math.pow(pts.lfCp2.y - pts.frontAxilla.y, 2));
  console.log(`      lfCp2距frontAxilla距离: ${dist2.toFixed(2)} cm (占halfBicep的${(dist2/halfBicep*100).toFixed(1)}%)`);
}

console.log('\n   如果控制点太靠近端点，Bezier曲线会"不够饱满"，导致长度不足');

console.log('\n' + '-'.repeat(80));
console.log('🎯 第六步：工业标准参考对比\n');

// 基于工业经验公式估算
const estimatedCapLength = Math.PI * (halfBicep * 0.6) + capHeight * 1.5; // 粗略估计
console.log('工业经验公式估算:');
console.log(`   估算袖山长度 ≈ π × (biceps×0.6) + height×1.5`);
console.log(`                ≈ π × (${halfBicep}×0.6) + ${capHeight}×1.5`);
console.log(`                ≈ ${estimatedCapLength.toFixed(2)} cm`);

console.log(`\n对比:`);
console.log(`   目标值: ${targetCapLen.toFixed(2)} cm (来自袖窿)`);
console.log(`   实际值: ${(sleevePiece.totalCapLength || 0).toFixed(2)} cm (来自算法)`);
console.log(`   估算值: ${estimatedCapLength.toFixed(2)} cm (来自经验公式)`);

const gap1 = targetCapLen - (sleevePiece.totalCapLength || 0);
const gap2 = targetCapLen - estimatedCapLength;

console.log(`\n差距分析:`);
console.log(`   目标 vs 实际: ${gap1.toFixed(2)} cm (${gap1 > 0 ? '实际太短' : '实际太长'})`);
console.log(`   目标 vs 估算: ${gap2.toFixed(2)} cm (${gap2 > 0 ? '估算偏低' : '估算偏高'})`);

if (gap1 > 3) {
  console.log(`\n⚠️ 关键发现: 目标值(${targetCapLen.toFixed(2)})明显高于合理范围`);
  console.log('   可能原因:');
  console.log('   1. 袖窿长度计算包含非必要线段（如肩线、侧缝）');
  console.log('   2. 前后片armholeDepth设置过大');
  console.log('   3. Ease值设置不合理');
}

console.log('\n' + '='.repeat(100));
console.log('🔍 诊断结论\n');

if (Math.abs(error) <= 0.8) {
  console.log('✅ 结论: 参数和算法基本正确，误差在可接受范围内');
} else if (totalArmhole > 55) {
  console.log('⚠️ 结论: 袖窿长度可能异常（>55cm），需要检查前后片生成逻辑');
  console.log('   建议: 验证extractArmholeOps()是否只提取了真正的袖窿曲线');
} else {
  console.log('❌ 结论: 算法存在问题，需要优化控制点放置或调整比例系数');
  console.log('   建议: 增大控制点外扩比例，使Bezier曲线更饱满');
}

console.log('\n💡 下一步行动:\n');
console.log('1. 检查frontArmholeOps/backArmholeOps提取的内容是否正确');
console.log('2. 验证袖窿长度是否符合M号T恤标准（应该在45-52cm范围内）');
console.log('3. 如果袖窿长度正确，则优化generateSleeveCap()的控制点算法');
console.log('4. 如果袖窿长度异常，则修复前后片的袖窿生成逻辑');

console.log('\n' + '='.repeat(100) + '\n');