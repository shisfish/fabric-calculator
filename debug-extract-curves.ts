import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';
import { SleeveCapGenerator } from './patterns/SleeveCapGenerator.js';

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

console.log('🔍 调试SleeveCapGenerator.extractCurves()\n');

// 生成前后片
const backPiece = (TshirtPatternGenerator as any).generateBackPanel(params.backPanel, params.seamAllowance);
const frontPiece = (TshirtPatternGenerator as any).generateFrontPanel(params.frontPanel, params.seamAllowance);

// 提取袖窿ops
const frontArmholeOps = (TshirtPatternGenerator as any).extractArmholeOps(frontPiece.path);
const backArmholeOps = (TshirtPatternGenerator as any).extractArmholeOps(backPiece.path);

console.log('=== 前袖窿OPS ===');
frontArmholeOps.forEach((op: {type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}}, idx: number) => {
  console.log(`[${idx}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)}) ${op.cp1 ? '有CP' : '无CP'}`);
});

console.log('\n=== 后袖窿OPS ===');
backArmholeOps.forEach((op: {type: string; to?: {x: number; y: number}; cp1?: {x: number; y: number}}, idx: number) => {
  console.log(`[${idx}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)}) ${op.cp1 ? '有CP' : '无CP'}`);
});

// 手动测试extractCurves
console.log('\n=== 测试SleeveCapGenerator.extractCurves() ===');

// 使用私有方法的替代方案：直接查看curve数量
const frontCurveCount = frontArmholeOps.filter((op: {type: string}) => op.type === 'curve').length;
const backCurveCount = backArmholeOps.filter((op: {type: string}) => op.type === 'curve').length;

console.log(`\n前袖窿中curve数量: ${frontCurveCount}`);
console.log(`后袖窿中curve数量: ${backCurveCount}`);

if (frontCurveCount > 0 && backCurveCount > 0) {
  console.log(`✅ 两个都有curve，应该能正常工作`);
  
  // 手动计算长度看看
  let frontLen = 0;
  let prevPoint = frontArmholeOps[0]?.to || {x: 14.63, y: 1.8};
  
  for (let i = 1; i < frontArmholeOps.length; i++) {
    const op = frontArmholeOps[i];
    if (op.type === 'curve' && op.cp1 && op.cp2 && op.to) {
      const len = SleeveCapGenerator.calculateBezierLength(prevPoint, op.cp1, op.cp2, op.to);
      console.log(`  前Curve ${i}: 长度=${len.toFixed(2)}cm`);
      frontLen += len;
      prevPoint = op.to;
    }
  }
  
  console.log(`\n前袖窿总长度（手动计算）: ${frontLen.toFixed(2)} cm`);
  
} else {
  console.log(`❌ 缺少curve！`);
}
