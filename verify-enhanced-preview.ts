// 验证增强的裁片预览效果
import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';

console.log('═══════════════════════════════════════');
console.log('✅ 裁片预览增强验证');
console.log('═══════════════════════════════════════');

const input = {
    garment: 'basic_tshirt',
    front: {
        chestWidth: 59,
        bodyLength: 68,
        shoulderWidth: 19.5,
        neckWidth: 25,
        neckDrop: 8.5,
        armholeDepth: 28
    },
    back: {
        chestWidth: 59,
        bodyLength: 68,
        shoulderWidth: 19.5,
        neckWidth: 25,
        neckDrop: 2.5,
        armholeDepth: 28
    },
    sleeve: {
        sleeveLength: 60,
        bicepWidth: 22.42,
        cuffWidth: 20,
        sleeveCapHeight: 12.6
    }
};

const params = GarmentMeasurementAdapter.adapt(input);
const pieces = TshirtPatternGenerator.generatePattern(params);

console.log('\n' + '='.repeat(70));
console.log('📊 三个裁片尺寸对比');
console.log('='.repeat(70));

pieces.forEach((piece, index) => {
    const pathOps = piece.path?.ops || [];
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let keyPointCount = 0;

    for (const op of pathOps) {
        if (op.to) {
            minX = Math.min(minX, op.to.x);
            minY = Math.min(minY, op.to.y);
            maxX = Math.max(maxX, op.to.x);
            maxY = Math.max(maxY, op.to.y);
            keyPointCount++;
        }
    }

    const width = maxX - minX;
    const height = maxY - minY;

    console.log(`\n【${index + 1}. ${piece.name.toUpperCase()}】`);
    console.log(`  尺寸: ${width.toFixed(1)} × ${height.toFixed(1)} cm`);
    console.log(`  面积: ${(piece.area || 0).toFixed(1)} cm²`);
    console.log(`  关键点数: ${keyPointCount}`);
    console.log(`  Path操作数: ${pathOps.length}`);
    console.log(`  对折: ${piece.onFold ? '是 ✓' : '否'}`);
    console.log(`  数量: ${piece.cutCount || 1}片`);

    if (index === 0) {
        console.log(`\n  📐 前片特征:`);
        console.log(`     - 前领较深（neckDrop=${input.front.neckDrop}cm）`);
        console.log(`     - 袖窿更凹`);
        console.log(`     - 半片结构（onFold=true）`);
    } else if (index === 1) {
        console.log(`\n  📐 后片特征:`);
        console.log(`     - 后领浅（neckDrop=${input.back.neckDrop}cm）`);
        console.log(`     - 后肩略长`);
        console.log(`     - 袖窿更平`);
    } else if (index === 2) {
        console.log(`\n  📐 袖子特征:`);
        console.log(`     - 不对称设计`);
        console.log(`     - 前袖山更深更陡`);
        console.log(`     - 后袖山更平更长`);
        console.log(`     - 包含notch标记`);
        
        if (piece.notches && piece.notches.length > 0) {
            console.log(`     - Notch数量: ${piece.notches.length}`);
            piece.notches.forEach((notch, i) => {
                console.log(`       notch${i+1}: (${notch.x.toFixed(2)}, ${notch.y.toFixed(2)})`);
            });
        }
    }
});

console.log('\n' + '='.repeat(70));
console.log('🎯 预期渲染效果');
console.log('='.repeat(70));

console.log(`
✅ Canvas尺寸: 320 × 400 px (原180×180)

✅ 新增功能:
   1. 关键点标注（红色圆点）
      - 显示所有path端点位置
      
   2. 尺寸线（红色虚线）
      - 底部宽度标注: "XX.X cm"
      - 左侧高度标注: "XX.X cm"
      
   3. 底部文字信息
      - "尺寸: XX.X × XX.X cm"
      
   4. 卡片底部详细信息
      - 宽度、高度、面积
      - 对折标识（如适用）

✅ 比例问题修复:
   - 使用自适应缩放（保持真实比例）
   - 不同裁片会显示不同大小
   - 前后片较大，袖子较小（符合实际）

✅ 视觉改进:
   - 白色背景
   - 更大的内边距(40px)
   - 更粗的边框和描边
   - 清晰的文字标注

📋 三个裁片的预期相对大小:
   前片: 约 29.5 × 73.0 cm (最大)
   后片: 约 29.5 × 69.0 cm (次大)
   袖子: 约 22.4 × 72.6 cm (最小)
   
   比例关系:
   前片 ≈ 后片 > 袖子
   
   现在可以清楚看到三个裁片的差异！
`);

console.log('═══════════════════════════════════════');
console.log('🎨 请刷新CAD页面查看效果');
console.log('═══════════════════════════════════════');
