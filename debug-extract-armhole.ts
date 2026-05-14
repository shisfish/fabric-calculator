import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';

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

console.log('🔍 调试extractArmholeOps()');

// 手动生成前后片
const backPiece = (TshirtPatternGenerator as any).generateBackPanel(params.backPanel, params.seamAllowance);
const frontPiece = (TshirtPatternGenerator as any).generateFrontPanel(params.frontPanel, params.seamAllowance);

// 测试extractArmholeOps
const frontArmholeOps = (TshirtPatternGenerator as any).extractArmholeOps(frontPiece.path);
const backArmholeOps = (TshirtPatternGenerator as any).extractArmholeOps(backPiece.path);

console.log('\n前片Path结构:');
frontPiece.path.ops.forEach((op: {type: string; to?: {x: number; y: number}}, idx: number) => {
  console.log(`  [${idx}] ${op.type.padEnd(6)} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)})`);
});

console.log(`\nextractArmholeOps提取的前袖窿:`);
if (frontArmholeOps.length === 0) {
  console.log('  ❌ 空数组！未找到任何曲线');
} else {
  frontArmholeOps.forEach((op: {type: string; to?: {x: number; y: number}}, idx: number) => {
    console.log(`  [${idx}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)})`);
  });
}

console.log('\n后片Path结构:');
backPiece.path.ops.forEach((op: {type: string; to?: {x: number; y: number}}, idx: number) => {
  console.log(`  [${idx}] ${op.type.padEnd(6)} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)})`);
});

console.log(`\nextractArmholeOps提取的后袖窿:`);
if (backArmholeOps.length === 0) {
  console.log('  ❌ 空数组！未找到任何曲线');
} else {
  backArmholeOps.forEach((op: {type: string; to?: {x: number; y: number}}, idx: number) => {
    console.log(`  [${idx}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)})`);
  });
}

console.log('\n💡 结论:');
console.log('如果extractArmholeOps返回空，说明逻辑有bug需要修复');
