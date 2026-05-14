import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';
import { SleeveCapGenerator } from './patterns/SleeveCapGenerator.js';

console.log('═══════════════════════════════════════');
console.log('🔬 SleeveCapGenerator 深度诊断');
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

console.log('\n📐 Step 1: 参数转换');
console.log(`   输入 bicepsWidth: ${garmentInput.bicepsWidth} cm`);
console.log(`   转换后 bicepsWidth: ${params.sleeve.bicepsWidth} cm`);
console.log(`   ⚠️ 问题: 被错误放大了 ${params.sleeve.bicepsWidth / garmentInput.bicepsWidth} 倍`);

// 手动生成前后片（不生成袖子）
const backPiece = TshirtPatternGenerator.generateBackPanel(params.backPanel, params.seamAllowance);
const frontPiece = TshirtPatternGenerator.generateFrontPanel(params.frontPanel, params.seamAllowance);

console.log('\n📊 Step 2: 提取前后袖窿曲线');

// 手动提取前片袖窿（从shoulder到armholeEnd的所有curve）
const frontOps = frontPiece.path.ops || [];
console.log('\n前片完整Path结构:');
frontOps.forEach((op, idx) => {
  if (op.to) {
    const extra = op.cp1 && op.cp2 ? 
      ` CP1(${op.cp1.x.toFixed(1)},${op.cp1.y.toFixed(1)}) CP2(${op.cp2.x.toFixed(1)},${op.cp2.y.toFixed(1)})` : '';
    console.log(`  [${idx}] ${op.type.padEnd(6)} → (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})${extra}`);
  }
});

// 找到前片袖窿：shoulder → armholeEnd之间的所有curve
let frontArmholeCurves = [];
let foundShoulder = false;
for (const op of frontOps) {
  if (op.type === 'line' && op.to && !foundShoulder) {
    // 这是肩线
    if (op.to.y > 0) { // shoulder点y > 0
      foundShoulder = true;
      console.log(`\n✅ 找到肩线终点(shoulder): (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
    }
  }
  
  if (foundShoulder) {
    if (op.type === 'curve') {
      frontArmholeCurves.push(op);
      console.log(`  📏 收集袖窿curve: → (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
    }
    if (op.type === 'line' && frontArmholeCurves.length > 0) {
      // 到达腋下点，停止
      console.log(`  ✅ 找到腋下点(armholeEnd): (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
      break;
    }
  }
}

console.log(`\n前片袖窿curve数量: ${frontArmholeCurves.length}`);

// 同样处理后片
const backOps = backPiece.path.ops || [];
console.log('\n后片完整Path结构:');
backOps.forEach((op, idx) => {
  if (op.to) {
    const extra = op.cp1 && op.cp2 ? 
      ` CP1(${op.cp1.x.toFixed(1)},${op.cp1.y.toFixed(1)}) CP2(${op.cp2.x.toFixed(1)},${op.cp2.y.toFixed(1)})` : '';
    console.log(`  [${idx}] ${op.type.padEnd(6)} → (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})${extra}`);
  }
});

let backArmholeCurves = [];
foundShoulder = false;
for (const op of backOps) {
  if (op.type === 'line' && op.to && !foundShoulder) {
    if (op.to.y > 0) {
      foundShoulder = true;
      console.log(`\n✅ 找到后肩线终点: (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
    }
  }
  
  if (foundShoulder) {
    if (op.type === 'curve') {
      backArmholeCurves.push(op);
      console.log(`  📏 收集后袖窿curve: → (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
    }
    if (op.type === 'line' && backArmholeCurves.length > 0) {
      console.log(`  ✅ 找到后腋下点: (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
      break;
    }
  }
}

console.log(`\n后片袖窿curve数量: ${backArmholeCurves.length}`);

console.log('\n' + '='.repeat(70));
console.log('📏 Step 3: 计算袖窿长度（Bezier Arc Length）');
console.log('='.repeat(70));

function calculateCurveLength(start, cp1, cp2, end, segments = 50) {
  let length = 0;
  let prevPoint = start;
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    
    const x = mt*mt*mt * prevPoint.x + 3*mt*mt*t * cp1.x + 3*mt*t*t * cp2.x + t*t*t * end.x;
    const y = mt*mt*mt * prevPoint.y + 3*mt*mt*t * cp1.y + 3*mt*t*t * cp2.y + t*t*t * end.y;
    
    const currPoint = {x, y};
    
    const dx = currPoint.x - prevPoint.x;
    const dy = currPoint.y - prevPoint.y;
    length += Math.sqrt(dx*dx + dy*dy);
    
    prevPoint = currPoint;
  }
  
  return length;
}

// 计算前袖窿总长度
let frontArmholeTotalLength = 0;
let prevFrontPoint = null;

console.log('\n前袖窿各段长度:');
for (let i = 0; i < frontArmholeCurves.length; i++) {
  const curve = frontArmholeCurves[i];
  if (!prevFrontPoint) {
    // 第一个curve的起点是shoulder
    prevFrontPoint = frontPiece.points.shoulder || {x: 14.6, y: 1.8};
  }
  
  const segLen = calculateCurveLength(
    prevFrontPoint,
    curve.cp1,
    curve.cp2,
    curve.to
  );
  
  console.log(`  Curve ${i+1}: ${segLen.toFixed(2)} cm`);
  frontArmholeTotalLength += segLen;
  prevFrontPoint = curve.to;
}

console.log(`  📏 前袖窿总长度: ${frontArmholeTotalLength.toFixed(2)} cm`);

// 计算后袖窿总长度
let backArmholeTotalLength = 0;
let prevBackPoint = null;

console.log('\n后袖窿各段长度:');
for (let i = 0; i < backArmholeCurves.length; i++) {
  const curve = backArmholeCurves[i];
  if (!prevBackPoint) {
    // 第一个curve的起点是back shoulder
    prevBackPoint = backPiece.points.shoulder || {x: 21.5, y: 1.8};
  }
  
  const segLen = calculateCurveLength(
    prevBackPoint,
    curve.cp1,
    curve.cp2,
    curve.to
  );
  
  console.log(`  Curve ${i+1}: ${segLen.toFixed(2)} cm`);
  backArmholeTotalLength += segLen;
  prevBackPoint = curve.to;
}

console.log(`  📏 后袖窿总长度: ${backArmholeTotalLength.toFixed(2)} cm`);

const totalArmholeLength = frontArmholeTotalLength + backArmholeTotalLength;
const ease = 0.5; // T-shirt: 0~1cm
const targetSleeveCapLength = totalArmholeLength + ease;

console.log(`\n` + '='.repeat(70));
console.log('🎯 Step 4: 目标袖山长度计算');
console.log('='.repeat(70));
console.log(`  前袖窿: ${frontArmholeTotalLength.toFixed(2)} cm`);
console.log(`  后袖窿: ${backArmholeTotalLength.toFixed(2)} cm`);
console.log(`  总计:   ${totalArmholeLength.toFixed(2)} cm`);
console.log(`  Ease:   ${ease} cm`);
console.log(`  ─────────────────────`);
console.log(`  目标袖山长度: ${targetSleeveCapLength.toFixed(2)} cm`);

console.log('\n' + '='.repeat(70));
console.log('⚠️ Step 5: 当前SleeveCapGenerator问题分析');
console.log('='.repeat(70));

// 测试当前的SleeveCapGenerator
try {
  const testResult = SleeveCapGenerator.generateFromArmhole(
    frontArmholeCurves,
    backArmholeCurves,
    {
      bicepsWidth: garmentInput.bicepsWidth, // 使用原始值，不要被转换
      sleeveCapHeight: params.sleeve.sleeveCapHeight,
      sleeveLength: garmentInput.sleeveLength,
      cuffWidth: garmentInput.cuffWidth
    },
    ease
  );
  
  console.log('\n✅ SleeveCapGenerator执行成功');
  console.log(`  前袖山长度: ${testResult.frontCapLength.toFixed(2)} cm`);
  console.log(`  后袖山长度: ${testResult.backCapLength.toFixed(2)} cm`);
  console.log(`  总袖山长度: ${testResult.totalCapLength.toFixed(2)} cm`);
  console.log(`  目标长度:   ${targetSleeveCapLength.toFixed(2)} cm`);
  
  const lengthDiff = Math.abs(testResult.totalCapLength - targetSleeveCapLength);
  console.log(`  长度差异:   ${lengthDiff.toFixed(2)} cm`);
  
  if (lengthDiff < 2) {
    console.log(`  ✅ 长度匹配良好`);
  } else {
    console.log(`  ❌ 长度差异过大！需要调整控制点`);
  }
  
  // 显示生成的关键点
  console.log('\n🔑 生成的关键点:');
  const keyPoints = ['capTop', 'frontAxilla', 'backAxilla', 'frontCuff', 'backCuff'];
  for (const key of keyPoints) {
    if (testResult.points[key]) {
      const p = testResult.points[key];
      console.log(`  ${key}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    }
  }
  
} catch (error) {
  console.error('\n❌ SleeveCapGenerator执行失败:', error.message);
}

console.log('\n' + '='.repeat(70));
console.log('💡 诊断结论与修复方向');
console.log('='.repeat(70));
console.log(`
问题1: extractArmholeOps() 提取逻辑复杂且容易出错
  → 应该简化为直接提取所有curve操作

问题2: 参数被GarmentMeasurementAdapter错误放大
  → 应该在Tshirt.ts中传递原始参数

问题3: SleeveCapGenerator的控制点计算不够智能
  → 应该基于真实袖窿长度动态调整outward比例

问题4: 缺少length matching验证
  → 应该在生成后验证并微调

建议修复步骤:
1. 简化extractArmholeOps() - 直接返回所有curve
2. 在generateSleeve中传递原始参数（不被转换）
3. 改进SleeveCapGenerator - 动态调整控制点以达到目标长度
4. 添加自动微调机制 - 迭代调整直到长度匹配
`);
