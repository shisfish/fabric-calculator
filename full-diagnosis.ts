// 完整数据流诊断：从前端到最终SVG输出
// 目的：找出为什么修复传参后图形还是不对

import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';
import type { GarmentParams } from './patterns/GarmentMeasurementAdapter.js';

console.log('═══════════════════════════════════════════════════');
console.log('🔍 完整数据流诊断（端到端）');
console.log('═══════════════════════════════════════════════════');

// ============================================
// STEP 1: 模拟前端输入（cad.js getGarmentInput）
// ============================================
console.log('\n【STEP 1】前端输入 (cad.js getGarmentInput)');
console.log('-'.repeat(50));

const frontendInput = {
    chestWidth: 59,        // 用户在页面输入的实际胸宽
    shoulderWidth: 19.5,   // 单侧肩长
    bodyLength: 68,        // 衣长
    neckWidth: 25,         // 领宽（实际测量值）
    armholeDepth: 28,      // 袖窿深
    sleeveLength: 60,      // 袖长
    cuffWidth: 10,         // 袖口宽（半围）
    hemCurve: 0,
    shoulderSlope: 5.5     // 肩斜角
};

console.log('前端发送的JSON:');
console.log(JSON.stringify(frontendInput, null, 2));

// ============================================
// STEP 2: 模拟piece_generator.py _normalize_garment_input()
// ============================================
console.log('\n【STEP 2】Python转换 (piece_generator.py)');
console.log('-'.repeat(50));

// 这是我们刚修改的逻辑
const chest_width = frontendInput.chestWidth || 59;
const shoulder_width = frontendInput.shoulderWidth || 19.5;
const body_length = frontendInput.bodyLength || 68;
const sleeve_length = frontendInput.sleeveLength || 60;
const neck_width = frontendInput.neckWidth || 25;
const armhole_depth = frontendInput.armholeDepth || 28;
const cuff_width = frontendInput.cuffWidth || 10;

const front_neck_drop = neck_width * 0.34;  // 8.5
const back_neck_drop = neck_width * 0.10;   // 2.5

const pythonConvertedInput = {
    garment: 'basic_tshirt',
    front: {
        chestWidth: chest_width,
        bodyLength: body_length,
        shoulderWidth: shoulder_width,
        neckWidth: neck_width,
        neckDrop: front_neck_drop,
        armholeDepth: armhole_depth
    },
    back: {
        chestWidth: chest_width,
        bodyLength: body_length,
        shoulderWidth: shoulder_width,
        neckWidth: neck_width,
        neckDrop: back_neck_drop,
        armholeDepth: armhole_depth
    },
    sleeve: {
        sleeveLength: sleeve_length,
        bicepWidth: chest_width * 0.38,      // 22.42
        cuffWidth: cuff_width * 2,           // 20 (半围→全围)
        sleeveCapHeight: armhole_depth * 0.45 // 12.6
    }
};

console.log('转换后的嵌套结构:');
console.log(JSON.stringify(pythonConvertedInput, null, 2));
console.log(`\n关键值:`);
console.log(`  front.chestWidth = ${pythonConvertedInput.front.chestWidth}`);
console.log(`  front.shoulderWidth = ${pythonConvertedInput.front.shoulderWidth}`);
console.log(`  front.neckDrop = ${pythonConvertedInput.front.neckDrop}`);
console.log(`  sleeve.cuffWidth = ${pythonConvertedInput.sleeve.cuffWidth}`);

// ============================================
// STEP 3: cad_runner.ts 接收并调用 adapt()
// ============================================
console.log('\n【STEP 3】TypeScript适配 (GarmentMeasurementAdapter.adapt())');
console.log('-'.repeat(50));

let params: GarmentParams;
try {
    params = GarmentMeasurementAdapter.adapt(pythonConvertedInput);
    
    console.log('✅ adapt() 成功处理');
    console.log('\n生成的 GarmentParams:');
    
    console.log('\n--- frontPanel ---');
    console.log(`  width = ${params.frontPanel.width} cm`);
    console.log(`  length = ${params.frontPanel.length} cm`);
    console.log(`  neckWidth = ${params.frontPanel.neckWidth} cm`);
    console.log(`  neckDepth = ${params.frontPanel.neckDepth} cm`);
    console.log(`  shoulderWidth = ${params.frontPanel.shoulderWidth} cm`);
    console.log(`  shoulderSlope = ${params.frontPanel.shoulderSlope}°`);
    console.log(`  armholeDepth = ${params.frontPanel.armholeDepth} cm`);
    
    console.log('\n--- backPanel ---');
    console.log(`  width = ${params.backPanel.width} cm`);
    console.log(`  length = ${params.backPanel.length} cm`);
    console.log(`  neckWidth = ${params.backPanel.neckWidth} cm`);
    console.log(`  shoulderWidth = ${params.backPanel.shoulderWidth} cm`);
    
    console.log('\n--- sleeve ---');
    console.log(`  bicepsWidth = ${params.sleeve.bicepsWidth} cm`);
    console.log(`  cuffWidth = ${params.sleeve.cuffWidth} cm`);
    console.log(`  sleeveLength = ${params.sleeve.sleeveLength} cm`);

} catch (error) {
    console.error('❌ adapt() 失败:', error.message);
    throw error;
}

// ============================================
// STEP 4: Tshirt.ts 使用参数生成裁片
// ============================================
console.log('\n【STEP 4】Tshirt.ts 生成前片');
console.log('-'.repeat(50));

try {
    const pieces = TshirtPatternGenerator.generatePattern(params);
    
    const frontPiece = pieces.find(p => p.name === 'front');
    
    if (!frontPiece) {
        console.error('❌ 未找到前片！');
    } else {
        console.log('✅ 前片生成成功');
        
        // 提取关键点坐标
        const points = frontPiece.points;
        console.log('\n前片关键点坐标:');
        
        if (points.cfNeck) {
            console.log(`  cfNeck (前中领口): (${points.cfNeck.x.toFixed(2)}, ${points.cfNeck.y.toFixed(2)})`);
        }
        if (points.neckEnd) {
            console.log(`  neckEnd (肩颈点): (${points.neckEnd.x.toFixed(2)}, ${points.neckEnd.y.toFixed(2)})`);
        }
        if (points.shoulder) {
            console.log(`  shoulder (肩点): (${points.shoulder.x.toFixed(2)}, ${points.shoulder.y.toFixed(2)})`);
        }
        if (points.armholePitch) {
            console.log(`  armholePitch: (${points.armholePitch.x.toFixed(2)}, ${points.armholePitch.y.toFixed(2)})`);
        }
        if (points.armholeEnd) {
            console.log(`  armholeEnd (腋下): (${points.armholeEnd.x.toFixed(2)}, ${points.armholeEnd.y.toFixed(2)})`);
        }
        if (points.sideBottom) {
            console.log(`  sideBottom (侧缝下摆): (${points.sideBottom.x.toFixed(2)}, ${points.sideBottom.y.toFixed(2)})`);
        }
        if (points.hemFold) {
            console.log(`  hemFold (前中下摆): (${points.hemFold.x.toFixed(2)}, ${points.hemFold.y.toFixed(2)})`);
        }

        // 检查path操作
        const ops = frontPiece.path?.ops || [];
        console.log(`\nPath操作数量: ${ops.length}`);
        
        // 输出SVG d属性预览
        let dPreview = '';
        for (const op of ops) {
            switch (op.type) {
                case 'move': 
                    dPreview += `M ${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; 
                    break;
                case 'line': 
                    dPreview += `L ${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; 
                    break;
                case 'quad': 
                    dPreview += `Q ${op.cp1?.x?.toFixed(1)} ${op.cp1?.y?.toFixed(1)} ${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; 
                    break;
                case 'curve': 
                    dPreview += `C ${op.cp1?.x?.toFixed(1)} ${op.cp1?.y?.toFixed(1)},${op.cp2?.x?.toFixed(1)} ${op.cp2?.y?.toFixed(1)},${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; 
                    break;
                case 'close': 
                    dPreview += 'Z'; 
                    break;
            }
        }
        
        console.log('\nSVG path d (预览):');
        console.log(dPreview.trim());
        
        // 计算边界框
        const allPoints = Object.values(points).filter(p => p && typeof p.x === 'number');
        if (allPoints.length > 0) {
            const xs = allPoints.map(p => p.x);
            const ys = allPoints.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            
            console.log('\n裁片尺寸:');
            console.log(`  宽度: ${(maxX - minX).toFixed(2)} cm`);
            console.log(`  高度: ${(maxY - minY).toFixed(2)} cm`);
            console.log(`  X范围: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`);
            console.log(`  Y范围: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);
        }
    }
    
} catch (error) {
    console.error('❌ Tshirt.ts 生成失败:', error.message);
    console.error(error.stack);
}

// ============================================
// 对比分析
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 数据流对比分析');
console.log('='.repeat(60));

console.log(`
期望值 vs 实际值:

【胸宽】
  输入: 59 cm
  → 半胸宽: 29.5 cm
  → frontPanel.width: ${params.frontPanel.width} cm
  ✅ 是否匹配: ${params.frontPanel.width === 29.5 ? 'YES ✓' : 'NO ❌ (' + params.frontPanel.width + ')'}

【肩长】
  输入: 19.5 cm (单侧)
  → 半肩长: 9.75 cm
  → frontPanel.shoulderWidth: ${params.frontPanel.shoulderWidth} cm
  ✅ 是否匹配: ${params.frontPanel.shoulderWidth === 9.75 ? 'YES ✓' : 'NO ❌ (' + params.frontPanel.shoulderWidth + ')'}

【衣长】
  输入: 68 cm
  → frontPanel.length: ${params.frontPanel.length} cm (应该减1)
  ✅ 是否合理: ${Math.abs(params.frontPanel.length - 67) < 0.1 ? 'YES ✓' : 'NO ❌'}

【领宽】
  输入: 25 cm
  → 半领宽: 12.5 cm
  → frontPanel.neckWidth: ${params.frontPanel.neckWidth} cm
  ✅ 是否匹配: ${params.frontPanel.neckWidth === 12.5 ? 'YES ✓' : 'NO ❌ (' + params.frontPanel.neckWidth + ')'}
`);

console.log('\n═══════════════════════════════════════════════════');
console.log('🎯 诊断完成');
console.log('═══════════════════════════════════════════════════');
