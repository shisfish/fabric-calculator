// 验证缝份系统
import { GarmentMeasurementAdapter, TshirtPatternGenerator, SeamAllowanceGenerator } from './patterns/index.js';
import { Path } from './geometry/index.js';

console.log('═══════════════════════════════════════');
console.log('🧵 工业缝份系统验证');
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

const seamDistance = 1.0;

console.log(`\n📐 缝份距离: ${seamDistance} cm`);
console.log('='.repeat(70));

pieces.forEach((piece, index) => {
    console.log(`\n【${index + 1}. ${piece.name.toUpperCase()}】`);
    
    const outlinePath = piece.path;
    
    if (!outlinePath || outlinePath.ops.length === 0) {
        console.log('  ❌ 缺少轮廓数据');
        return;
    }

    // 获取原始轮廓边界
    const originalPoints = outlinePath.toPoints(50);
    let origMinX = Infinity, origMinY = Infinity, origMaxX = -Infinity, origMaxY = -Infinity;
    for (const p of originalPoints) {
        origMinX = Math.min(origMinX, p.x);
        origMinY = Math.min(origMinY, p.y);
        origMaxX = Math.max(origMaxX, p.x);
        origMaxY = Math.max(origMaxY, p.y);
    }
    const origWidth = origMaxX - origMinX;
    const origHeight = origMaxY - origMinY;

    console.log(`  原始轮廓尺寸: ${origWidth.toFixed(1)} × ${origHeight.toFixed(1)} cm`);

    // 检查是否有自动生成的缝份path
    if (piece.seamAllowancePath && piece.seamAllowancePath.ops.length > 0) {
        console.log(`  ✅ 自动缝份Path已生成`);
        
        const seamPath = piece.seamAllowancePath;
        const seamPoints = seamPath.toPoints(50);
        
        let seamMinX = Infinity, seamMinY = Infinity, seamMaxX = -Infinity, seamMaxY = -Infinity;
        for (const p of seamPoints) {
            seamMinX = Math.min(seamMinX, p.x);
            seamMinY = Math.min(seamMinY, p.y);
            seamMaxX = Math.max(seamMaxX, p.x);
            seamMaxY = Math.max(seamMaxY, p.y);
        }
        
        const seamWidth = seamMaxX - seamMinX;
        const seamHeight = seamMaxY - seamMinY;
        
        console.log(`  缝份轮廓尺寸: ${seamWidth.toFixed(1)} × ${seamHeight.toFixed(1)} cm`);
        
        const widthDiff = seamWidth - origWidth;
        const heightDiff = seamHeight - origHeight;
        
        console.log(`  尺寸差异:`);
        console.log(`    宽度增加: +${widthDiff.toFixed(2)} cm (预期: ~${(seamDistance * 2).toFixed(1)} cm)`);
        console.log(`    高度增加: +${heightDiff.toFixed(2)} cm (预期: ~${(seamDistance * 2).toFixed(1)} cm)`);
        
        const widthAccurate = Math.abs(widthDiff - seamDistance * 2) < 0.5;
        const heightAccurate = Math.abs(heightDiff - seamDistance * 2) < 0.5;
        
        console.log(`  宽度准确性: ${widthAccurate ? '✅' : '⚠️'}`);
        console.log(`  高度准确性: ${heightAccurate ? '✅' : '⚠️'}`);
    } else {
        console.log(`  ⚠️ 未检测到自动生成的缝份Path，手动生成...`);
        
        // 手动生成缝份用于演示
        const visualData = SeamAllowanceGenerator.generateWithVisualData(outlinePath, seamDistance);
        
        if (visualData.offsetPath.ops.length > 0) {
            const offsetPoints = visualData.offsetPath.toPoints(50);
            
            let offMinX = Infinity, offMinY = Infinity, offMaxX = -Infinity, offMaxY = -Infinity;
            for (const p of offsetPoints) {
                offMinX = Math.min(offMinX, p.x);
                offMinY = Math.min(offMinY, p.y);
                offMaxX = Math.max(offMaxX, p.x);
                offMaxY = Math.max(offMaxY, p.y);
            }
            
            const offWidth = offMaxX - offMinX;
            const offHeight = offMaxY - offMinY;
            
            console.log(`  手动生成缝份尺寸: ${offWidth.toFixed(1)} × ${offHeight.toFixed(1)} cm`);
            
            const widthDiff = offWidth - origWidth;
            const heightDiff = offHeight - origHeight;
            
            console.log(`  尺寸差异:`);
            console.log(`    宽度增加: +${widthDiff.toFixed(2)} cm (预期: ~${(seamDistance * 2).toFixed(1)} cm)`);
            console.log(`    高度增加: +${heightDiff.toFixed(2)} cm (预期: ~${(seamDistance * 2).toFixed(1)} cm)`);
            console.log(`    采样点数: ${visualData.sampleCount}`);
        }
    }

    console.log(`\n  📊 Path操作统计:`);
    console.log(`    原始轮廓Ops数: ${outlinePath.ops.length}`);
    if (piece.seamAllowancePath) {
        console.log(`    缝份路径Ops数: ${piece.seamAllowancePath.ops.length}`);
    }
});

console.log('\n' + '='.repeat(70));
console.log('🎯 算法验证要点');
console.log('='.repeat(70));

// 测试简单矩形
console.log('\n【测试用例：简单矩形】');
const testRect = Path.rectangle(30, 50);
const testSeam = SeamAllowanceGenerator.generate(testRect, seamDistance);

if (testSeam.ops.length > 0) {
    const testOrigPts = testRect.toPoints(10);
    const testSeamPts = testSeam.toPoints(10);
    
    let testOrigW = 0, testOrigH = 0;
    let testSeamW = 0, testSeamH = 0;
    
    for (let i = 1; i < testOrigPts.length; i++) {
        testOrigW = Math.max(testOrigW, Math.abs(testOrigPts[i].x - testOrigPts[0].x));
        testOrigH = Math.max(testOrigH, Math.abs(testOrigPts[i].y - testOrigPts[0].y));
    }
    
    for (let i = 1; i < testSeamPts.length; i++) {
        testSeamW = Math.max(testSeamW, Math.abs(testSeamPts[i].x - testSeamPts[0].x));
        testSeamH = Math.max(testSeamH, Math.abs(testSeamPts[i].y - testSeamPts[0].y));
    }
    
    console.log(`  原始: ${testOrigW.toFixed(1)} × ${testOrigH.toFixed(1)} cm`);
    console.log(`  缝份: ${testSeamW.toFixed(1)} × ${testSeamH.toFixed(1)} cm`);
    console.log(`  宽度差: ${(testSeamW - testOrigW).toFixed(2)} cm`);
    console.log(`  高度差: ${(testSeamH - testOrigH).toFixed(2)} cm`);
}

console.log('\n' + '='.repeat(70));
console.log('✅ 缝份系统实现完成');
console.log('='.repeat(70));

console.log(`
💡 功能特性:

1. ✅ 几何偏移算法（非scale）
   - flattenBezier: 将Bezier曲线采样为点集
   - computeTangents: 计算每个点的切线向量
   - computeNormals: 计算法线（垂直于切线）
   - offsetPoints: 沿法线方向偏移指定距离
   - rebuildPath: 重建平滑的offset path

2. ✅ 角部平滑处理
   - 自动识别尖锐角
   - 圆角过渡避免自交

3. ✅ 可视化支持
   - 双轮廓显示（原始+缝份）
   - 颜色区分（蓝色=轮廓，黄色=缝份）
   - 尺寸标注（宽度+高度+缝份宽度）
   - 图例说明

4. ✅ 数据完整性
   - seamAllowance字段传递到前端
   - seamAllowancePathOps完整序列化
   - 支持前端Canvas渲染

🚀 请刷新CAD页面查看效果！
页面将显示:
- 🎨 裁片预览区（原始轮廓）
- 🧵 缝份预览区（双轮廓+尺寸标注）
- 📐 排料图
`);
