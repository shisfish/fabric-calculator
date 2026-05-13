// 快速诊断：当前Tshirt.ts实际生成的图形
import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';

console.log('═══════════════════════════════════════');
console.log('🔍 当前状态快速诊断');
console.log('═══════════════════════════════════════');

// 使用默认参数
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
const frontPiece = pieces.find(p => p.name === 'front');

if (frontPiece && frontPiece.points) {
    const pts = frontPiece.points;
    
    console.log('\n📍 关键点坐标:');
    console.log(`cfNeck (前中领口):     (${pts.cfNeck?.x?.toFixed(2)}, ${pts.cfNeck?.y?.toFixed(2)})`);
    console.log(`neckEnd (肩颈点):      (${pts.neckEnd?.x?.toFixed(2)}, ${pts.neckEnd?.y?.toFixed(2)})`);
    console.log(`shoulder (肩点):       (${pts.shoulder?.x?.toFixed(2)}, ${pts.shoulder?.y?.toFixed(2)})`);
    console.log(`armholePitch:          (${pts.armholePitch?.x?.toFixed(2)}, ${pts.armholePitch?.y?.toFixed(2)})`);
    console.log(`armholeEnd (腋下):     (${pts.armholeEnd?.x?.toFixed(2)}, ${pts.armholeEnd?.y?.toFixed(2)})`);
    console.log(`sideBottom (侧缝下摆): (${pts.sideBottom?.x?.toFixed(2)}, ${pts.sideBottom?.y?.toFixed(2)})`);
    console.log(`hemFold (前中下摆):    (${pts.hemFold?.x?.toFixed(2)}, ${pts.hemFold?.y?.toFixed(2)})`);

    // 检查几何关系
    const neckEndX = pts.neckEnd?.x || 0;
    const shoulderX = pts.shoulder?.x || 0;
    const shoulderY = pts.shoulder?.y || 0;
    
    console.log('\n📐 几何关系检查:');
    console.log(`shoulder.x (${shoulderX.toFixed(2)}) > neckEnd.x (${neckEndX.toFixed(2)})? ${shoulderX > neckEndX ? '✅ YES' : '❌ NO'}`);
    console.log(`shoulder.y (${shoulderY.toFixed(2)}) > 0? ${shoulderY > 0 ? '✅ YES (向下倾斜)' : '❌ NO (向上或水平)'}`);
    
    // 输出SVG path
    const ops = frontPiece.path?.ops || [];
    let d = '';
    for (const op of ops) {
        switch (op.type) {
            case 'move': d += `M ${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; break;
            case 'line': d += `L ${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; break;
            case 'quad': d += `Q ${op.cp1?.x?.toFixed(1)} ${op.cp1?.y?.toFixed(1)} ${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; break;
            case 'curve': d += `C ${op.cp1?.x?.toFixed(1)} ${op.cp1?.y?.toFixed(1)},${op.cp2?.x?.toFixed(1)} ${op.cp2?.y?.toFixed(1)},${op.to?.x?.toFixed(1)} ${op.to?.y?.toFixed(1)} `; break;
            case 'close': d += 'Z'; break;
        }
    }
    
    console.log('\n🎨 SVG Path:');
    console.log(d.trim());
    
    // 绘制ASCII示意图
    console.log('\n🖼️ 形状示意:');
    console.log(`
    Y轴 ↑
        |
    0   |● neckEnd(${neckEndX.toFixed(1)}, 0)
        | ╲
        |  ╲
   ${shoulderY.toFixed(1)}|   ● shoulder(${shoulderX.toFixed(1)}, ${shoulderY.toFixed(1)})
        |    ╲
        |     ╲ (袖窿曲线)
        |      ● armholeEnd
        |      |
        |      ● sideBottom
   ${pts.hemFold?.y?.toFixed(1)||'?'}|______● hemFold
        +------------------------→ X轴
        0       ${neckEndX.toFixed(1)}  ${shoulderX.toFixed(1)}
    `);
}
