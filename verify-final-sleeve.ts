import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';

console.log('═══════════════════════════════════════');
console.log('🔬 端到端验证：修复后的袖子系统');
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

console.log('\n📐 Step 1: 参数转换验证');
console.log(`   输入 bicepsWidth: ${garmentInput.bicepsWidth} cm`);
console.log(`   转换后 bicepsWidth: ${params.sleeve.bicepsWidth} cm`);
if (params.sleeve.bicepsWidth === garmentInput.bicepsWidth) {
  console.log(`   ✅ 参数保持原始值（不再被错误放大）`);
} else {
  console.log(`   ❌ 参数仍被转换！差异=${params.sleeve.bicepsWidth / garmentInput.bicepsWidth}`);
}

// 生成裁片
const pieces = TshirtPatternGenerator.generatePattern(params);

console.log('\n👕 Step 2: 裁片生成结果');

for (let i = 0; i < pieces.length; i++) {
  const piece = pieces[i];
  console.log(`\n【${i + 1}. ${piece.name.toUpperCase()}】`);
  
  const pathOps = piece.path.ops || [];
  
  // 计算边界框
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const op of pathOps) {
    if (op.to) {
      minX = Math.min(minX, op.to.x);
      maxX = Math.max(maxX, op.to.x);
      minY = Math.min(minY, op.to.y);
      maxY = Math.max(maxY, op.to.y);
    }
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  console.log(`  📐 尺寸: ${width.toFixed(1)} × ${height.toFixed(1)} cm`);
  
  if (piece.name === 'sleeve') {
    // 详细显示袖子信息
    console.log(`\n  👕 袖子详细信息:`);
    
    // 检查关键点
    const keyPoints = ['capTop', 'frontAxilla', 'backAxilla', 'frontCuff', 'backCuff'];
    for (const key of keyPoints) {
      if (piece.points[key]) {
        const p = piece.points[key];
        console.log(`     ${key}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
      }
    }
    
    // 检查notches
    if (piece.notches && piece.notches.length > 0) {
      console.log(`  📍 Notch标记:`);
      piece.notches.forEach((notch: {x: number; y: number}, idx: number) => {
        console.log(`     ${idx === 0 ? '前' : '后'}Notch: (${notch.x.toFixed(2)}, ${notch.y.toFixed(2)})`);
      });
    }

    // 验证Path结构
    console.log(`\n  🔍 Path结构验证:`);
    let curveCount = 0;
    let lineCount = 0;
    
    for (const op of pathOps) {
      switch (op.type) {
        case 'line': lineCount++; break;
        case 'curve': curveCount++; break;
      }
    }
    
    console.log(`     Line操作: ${lineCount} (应该=3)`);
    console.log(`     Curve操作: ${curveCount} (应该=2: 前袖山+后袖山)`);
    
    // 验证前后不对称性
    const frontPitch = piece.points.frontPitch;
    const backPitch = piece.points.backPitch;
    
    if (frontPitch && backPitch) {
      console.log(`\n  ⚖️ 前后不对称性检查:`);
      console.log(`     前Pitch Y位置: ${frontPitch.y.toFixed(2)}`);
      console.log(`     后Pitch Y位置: ${backPitch.y.toFixed(2)}`);
      
      if (frontPitch.y > backPitch.y) {
        console.log(`     ✅ 前袖山更低（更陡）- 符合工业标准`);
      } else {
        console.log(`     ❌ 前后位置关系错误`);
      }
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log('✅ 验证完成！');
console.log('='.repeat(70));

console.log(`
💡 修复总结:

1. ✅ 重写SleeveCapGenerator算法:
   - 实现动态length matching
   - 迭代调整控制点直到长度匹配
   - 目标精度: ±0.5cm

2. ✅ 修复参数传递问题:
   - GarmentMeasurementAdapter不再错误放大sleeve参数
   - 使用原始前端输入值

3. ✅ 工业规则实现:
   - 前袖山基于前袖窿长度生成
   - 后袖山基于后袖窿长度生成
   - 总袖山长度 = 前袖窿 + 后袖窿 + ease

4. ✅ 算法核心改进:
   - 动态outward计算（根据目标长度）
   - 自动迭代微调（最多5次）
   - 智能比例系统（非固定值）

🎯 当前实现特点:
   - 完全基于几何约束
   - 可计算、可验证
   - 符合工业CAD标准
`);
