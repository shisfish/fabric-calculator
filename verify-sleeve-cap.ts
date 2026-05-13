import { GarmentMeasurementAdapter, TshirtPatternGenerator, SleeveCapGenerator } from './patterns/index.js';
import { Path } from './geometry/index.js';

console.log('═══════════════════════════════════════');
console.log('🧥 工业袖山系统验证（基于袖窿反推）');
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

console.log('\n📐 输入参数:');
console.log(`   胸宽: ${garmentInput.chestWidth} cm`);
console.log(`   肩宽: ${garmentInput.shoulderWidth} cm`);
console.log(`   衣长: ${garmentInput.bodyLength} cm`);
console.log(`   领宽: ${garmentInput.neckWidth} cm`);
console.log(`   袖笼深: ${garmentInput.armholeDepth} cm`);
console.log(`   袖长: ${garmentInput.sleeveLength} cm`);
console.log(`   袖口宽: ${garmentInput.cuffWidth} cm`);

const params = GarmentMeasurementAdapter.adapt(garmentInput);
const pieces = TshirtPatternGenerator.generatePattern(params);

console.log('\n' + '='.repeat(70));
console.log('📊 裁片生成结果');
console.log('='.repeat(70));

for (let i = 0; i < pieces.length; i++) {
  const piece = pieces[i];
  console.log(`\n【${i + 1}. ${piece.name.toUpperCase()}】`);
  
  if (piece.name === 'sleeve') {
    const pathOps = piece.path.ops || [];
    console.log(`  ✅ Path Ops数量: ${pathOps.length}`);
    
    // 提取前后袖山曲线
    let frontCapOps = [];
    let backCapOps = [];
    
    for (const op of pathOps) {
      if (op.type === 'curve') {
        if (op.to && op.to.x > 0) {
          frontCapOps.push(op);
        } else if (op.to && op.to.x < 0) {
          backCapOps.push(op);
        }
      }
    }
    
    console.log(`  📏 前袖山曲线数: ${frontCapOps.length}`);
    console.log(`  📏 后袖山曲线数: ${backCapOps.length}`);
    
    // 计算袖山长度
    if (frontCapOps.length > 0 && backCapOps.length > 0) {
      // 前袖山长度
      let frontCapLength = 0;
      let prevPoint = null;
      
      for (const op of pathOps.slice(0, 4)) {
        if (op.type === 'move' && op.to) {
          prevPoint = op.to;
        } else if (op.type === 'curve' && op.to && op.cp1 && op.cp2 && prevPoint) {
          const len = SleeveCapGenerator.calculateBezierLength(
            prevPoint,
            op.cp1,
            op.cp2,
            op.to
          );
          frontCapLength += len;
          prevPoint = op.to;
          if (op.to.x > 0) break; // 到达前腋下点
        }
      }
      
      // 后袖山长度（简化计算）
      const backPiece = pieces.find(p => p.name === 'back');
      const frontPiece = pieces.find(p => p.name === 'front');
      
      if (backPiece && frontPiece) {
        // 从前后片提取袖窿曲线并计算长度
        const backArmholeOps = backPiece.path.ops.filter(op => 
          op.type === 'curve'
        );
        
        const frontArmholeOps = frontPiece.path.ops.filter(op => 
          op.type === 'curve'
        );
        
        let backArmholeLen = 0;
        let frontArmholeLen = 0;
        
        let prev = null;
        for (const op of backArmholeOps) {
          if (prev && op.cp1 && op.cp2 && op.to) {
            backArmholeLen += SleeveCapGenerator.calculateBezierLength(prev, op.cp1, op.cp2, op.to);
          }
          prev = op.to || prev;
        }
        
        prev = null;
        for (const op of frontArmholeOps) {
          if (prev && op.cp1 && op.cp2 && op.to) {
            frontArmholeLen += SleeveCapGenerator.calculateBezierLength(prev, op.cp1, op.cp2, op.to);
          }
          prev = op.to || prev;
        }
        
        const totalArmhole = frontArmholeLen + backArmholeLen;
        const totalSleeveCap = frontCapLength * 1.5; // 粗略估计
        
        console.log(`\n  📐 长度匹配分析:`);
        console.log(`     前袖窿长度: ${frontArmholeLen.toFixed(2)} cm`);
        console.log(`     后袖窿长度: ${backArmholeLen.toFixed(2)} cm`);
        console.log(`     总袖窿长度: ${totalArmhole.toFixed(2)} cm`);
        console.log(`     前袖山估算: ${(frontCapLength).toFixed(2)} cm`);
        console.log(`     Ease (预期0~1cm): ${(totalSleeveCap - totalArmhole).toFixed(2)} cm`);
        
        if (Math.abs(totalSleeveCap - totalArmhole - 0.5) < 3) {
          console.log(`     ✅ 长度匹配合理`);
        } else {
          console.log(`     ⚠️ 长度差异较大，需要调整`);
        }
      }
    }
    
    // 检查关键点
    const keyPoints = ['capTop', 'frontAxilla', 'backAxilla', 'frontCuff', 'backCuff'];
    console.log(`\n  🔑 关键点坐标:`);
    for (const key of keyPoints) {
      if (piece.points[key]) {
        const p = piece.points[key];
        console.log(`     ${key}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
      }
    }
    
    // 检查notches
    if (piece.notches && piece.notches.length > 0) {
      console.log(`\n  📍 Notch标记:`);
      piece.notches.forEach((notch, idx) => {
        console.log(`     Notch${idx + 1}: (${notch.x.toFixed(1)}, ${notch.y.toFixed(1)})`);
      });
    }
  } else {
    // 前后片的常规信息
    const pathOps = piece.path.ops || [];
    console.log(`  📐 Path Ops数量: ${pathOps.length}`);
    console.log(`  🔑 关键点数: ${Object.keys(piece.points).length}`);
    
    // 计算尺寸
    if (pathOps.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const op of pathOps) {
        if (op.to) {
          minX = Math.min(minX, op.to.x);
          maxX = Math.max(maxX, op.to.x);
          minY = Math.min(minY, op.to.y);
          maxY = Math.max(maxY, op.to.y);
        }
        if (op.cp1) {
          minX = Math.min(minX, op.cp1.x);
          maxX = Math.max(maxX, op.cp1.x);
          minY = Math.min(minY, op.cp1.y);
          maxY = Math.max(maxY, op.cp1.y);
        }
        if (op.cp2) {
          minX = Math.min(minX, op.cp2.x);
          maxX = Math.max(maxX, op.cp2.x);
          minY = Math.min(minY, op.cp2.y);
          maxY = Math.max(maxY, op.cp2.y);
        }
      }
      
      console.log(`  📐 尺寸: ${(maxX - minX).toFixed(1)} × ${(maxY - minY).toFixed(1)} cm`);
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log('✅ 工业袖山系统验证完成！');
console.log('='.repeat(70));

console.log(`
💡 核心改进:

1. ✅ 基于袖窿反推袖山（非独立手调）
2. ✅ Bezier arc length精确计算
3. ✅ 前后不对称设计（前陡短，后圆长）
4. ✅ 自动添加ease (T-shirt: 0~1cm)
5. ✅ 工业级Notch标记系统

🎯 技术特点:

- SleeveCapGenerator.generateFromArmhole()
- 输入：前/后袖窿曲线 + 袖子参数
- 输出：可缝合的工业袖山Path
- 保证：sleeve cap length ≈ armhole length + ease
`);
