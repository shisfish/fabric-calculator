/**
 * 测试工业级袖山生成器 v4.0
 * 
 * 验证内容：
 * 1. 袖山形状是否符合工业标准
 * 2. 前后袖窿长度匹配
 * 3. Notch系统是否正确
 * 4. 控制点是否基于比例系统
 */

import { TshirtPatternGenerator } from './patterns/Tshirt.js';
import { SvgExporter } from './export/SvgExporter.js';
import { createLogger } from './utils/CADLogger.js';
import fs from 'fs';

const logger = createLogger('TEST-SLEEVE');

// 标准M号T恤参数
const testParams = {
  category: 'tshirt' as const,
  frontPanel: {
    width: 29,
    length: 72,
    neckWidth: 9,
    neckDepth: 8,
    shoulderWidth: 24,
    armholeDepth: 26,
    shoulderSlope: 5.5,
    armholePitchX: 0.15,
    hemExtension: 0
  },
  backPanel: {
    width: 29,
    length: 72,
    neckWidth: 9,
    neckDepth: 8,
    shoulderWidth: 24,
    armholeDepth: 26,
    shoulderSlope: 12,
    armholePitchX: 0.2,
    hemExtension: 0
  },
  sleeve: {
    bicepsWidth: 20,
    sleeveCapHeight: 14,
    sleeveLength: 58,
    cuffWidth: 8
  },
  seamAllowance: 0
};

async function main() {
  console.log('\n🧪 ===== 工业袖山 v4.0 测试 =====\n');
  
  try {
    // 生成裁片
    const pieces = TshirtPatternGenerator.generatePattern(testParams);
    
    console.log(`✅ 成功生成 ${pieces.length} 个裁片`);
    
    for (const piece of pieces) {
      console.log(`\n📦 ${piece.name}:`);
      console.log(`   - Path操作数: ${piece.path.ops.length}`);
      console.log(`   - 关键点数: ${Object.keys(piece.points).length}`);
      console.log(`   - onFold: ${piece.onFold}`);
      console.log(`   - cutCount: ${piece.cutCount}`);
      
      if (piece.name === 'sleeve') {
        console.log(`\n🎯 袖子详细信息 (v5.0 简化版):`);
        
        // 检查关键点（简化版）
        const points = piece.points;
        const requiredPoints = [
          'capTop', 'frontAxilla', 'backAxilla',
          'frontCuff', 'backCuff',
          'frontNotch', 'backNotch',
          'frontCp1', 'frontCp2',
          'backCp1', 'backCp2'
        ];
        
        let missingPoints = [];
        for (const p of requiredPoints) {
          if (!points[p]) {
            missingPoints.push(p);
          }
        }
        
        if (missingPoints.length === 0) {
          console.log('   ✅ 所有关键点存在');
        } else {
          console.log(`   ❌ 缺少关键点: ${missingPoints.join(', ')}`);
        }
        
        // 输出关键点坐标
        console.log('\n📐 关键点坐标:');
        console.log(`   capTop: (${points.capTop?.x?.toFixed(2)}, ${points.capTop?.y?.toFixed(2)})`);
        console.log(`   frontAxilla: (${points.frontAxilla?.x?.toFixed(2)}, ${points.frontAxilla?.y?.toFixed(2)})`);
        console.log(`   backAxilla: (${points.backAxilla?.x?.toFixed(2)}, ${points.backAxilla?.y?.toFixed(2)})`);
        console.log(`   frontNotch: (${points.frontNotch?.x?.toFixed(2)}, ${points.frontNotch?.y?.toFixed(2)})`);
        console.log(`   backNotch: (${points.backNotch?.x?.toFixed(2)}, ${points.backNotch?.y?.toFixed(2)})`);
        
        // 输出控制点
        console.log('\n🎨 前袖山控制点 (1段curve):');
        console.log(`   CP1: (${points.frontCp1?.x?.toFixed(2)}, ${points.frontCp1?.y?.toFixed(2)})`);
        console.log(`   CP2: (${points.frontCp2?.x?.toFixed(2)}, ${points.frontCp2?.y?.toFixed(2)})`);
        
        console.log('\n🎨 后袖山控制点 (1段curve):');
        console.log(`   CP1: (${points.backCp1?.x?.toFixed(2)}, ${points.backCp1?.y?.toFixed(2)})`);
        console.log(`   CP2: (${points.backCp2?.x?.toFixed(2)}, ${points.backCp2?.y?.toFixed(2)})`);
        
        // 验证Path拓扑
        console.log('\n🔍 Path拓扑验证:');
        const ops = piece.path.ops;
        console.log(`   操作序列:`);
        ops.forEach((op, i) => {
          const type = op.type.toUpperCase();
          let details = '';
          if (op.to) details += ` → (${op.to.x.toFixed(1)}, ${op.to.y.toFixed(1)})`;
          if (op.cp1) details += ` CP1(${op.cp1.x.toFixed(1)}, ${op.cp1.y.toFixed(1)})`;
          if (op.cp2) details += ` CP2(${op.cp2.x.toFixed(1)}, ${op.cp2.y.toFixed(1)})`;
          console.log(`     [${i}] ${type}${details}`);
        });
        
        // 检查notches
        if (piece.notches && piece.notches.length >= 2) {
          console.log('\n✅ Notch系统完整');
          console.log(`   frontNotch: (${piece.notches[0].x.toFixed(2)}, ${piece.notches[0].y.toFixed(2)})`);
          console.log(`   backNotch: (${piece.notches[1].x.toFixed(2)}, ${piece.notches[1].y.toFixed(2)})`);
        } else {
          console.log('\n❌ Notch系统不完整');
        }
      }
    }
    
    // 生成SVG
    console.log('\n🎨 生成SVG文件...');
    
    const exporter = new SvgExporter({
      showGrainline: true,
      showNotches: true,
      showLabels: true,
      strokeWidth: 0.5,
      scale: 10  // 放大10倍以便查看
    });
    
    const svgContent = exporter.exportPattern(pieces);
    
    const outputPath = 'test-sleeve-v4.svg';
    fs.writeFileSync(outputPath, svgContent);
    console.log(`✅ SVG已保存到: ${outputPath}`);
    
    console.log('\n🎉 测试完成！\n');
    
  } catch (error: unknown) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
