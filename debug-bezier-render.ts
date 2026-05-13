#!/usr/bin/env node
import { TshirtPatternGenerator, GarmentMeasurementAdapter } from './patterns/index.js';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🔍 Bezier曲线渲染诊断 - 完整调试');
console.log('═══════════════════════════════════════════════════════════════════\n');

const input = {
  chestWidth: 58,
  bodyLength: 72,
  shoulderWidth: 24,
  neckWidth: 18
};

const params = GarmentMeasurementAdapter.adapt(input);
const pieces = TshirtPatternGenerator.generatePattern(params);
const frontPiece = pieces.find(p => p.name === 'front');

if (!frontPiece) {
  console.log('❌ 未找到前片');
  process.exit(1);
}

const path = frontPiece.path;
const ops = path.ops;

console.log('📋 第1步：检查Path操作数组');
console.log('═'.repeat(60) + '\n');

console.log(`总操作数: ${ops.length}\n`);

let hasCurve = false;
let hasQuad = false;
let hasLineOnly = true;

for (let i = 0; i < ops.length; i++) {
  const op = ops[i];
  
  console.log(`[${i}] type="${op.type}"`);
  
  switch (op.type) {
    case 'move':
      console.log(`    → to: (${op.to?.x?.toFixed(4)}, ${op.to?.y?.toFixed(4)})`);
      break;
    case 'line':
      console.log(`    → to: (${op.to?.x?.toFixed(4)}, ${op.to?.y?.toFixed(4)})`);
      break;
    case 'quad':
      hasQuad = true;
      hasLineOnly = false;
      console.log(`    → cp1: (${op.cp1?.x?.toFixed(4)}, ${op.cp1?.y?.toFixed(4)})`);
      console.log(`    → to:  (${op.to?.x?.toFixed(4)}, ${op.to?.y?.toFixed(4)})`);
      break;
    case 'curve':
      hasCurve = true;
      hasLineOnly = false;
      console.log(`    → cp1: (${op.cp1?.x?.toFixed(4)}, ${op.cp1?.y?.toFixed(4)})`);
      console.log(`    → cp2: (${op.cp2?.x?.toFixed(4)}, ${op.cp2?.y?.toFixed(4)})`);
      console.log(`    → to:  (${op.to?.x?.toFixed(4)}, ${op.to?.y?.toFixed(4)})`);
      break;
    case 'close':
      console.log(`    → (闭合路径)`);
      break;
  }
  console.log('');
}

console.log('\n' + '═'.repeat(60));
console.log('📋 第2步：检查Bezier存在性');
console.log('═'.repeat(60) + '\n');

console.log(`包含三次Bezier(C): ${hasCurve ? '✅ YES' : '❌ NO'}`);
console.log(`包含二次Bezier(Q): ${hasQuad ? '✅ YES' : '❌ NO'}`);
console.log(`只有直线(L): ${hasLineOnly ? '⚠️ YES - 这就是问题！' : '✅ NO'}\n`);

if (!hasCurve) {
  console.log('❌ 错误：没有找到curve操作！');
  console.log('   袖窿应该是三次Bezier曲线，但实际是直线\n');
}

console.log('═'.repeat(60));
console.log('📋 第3步：检查SVG d属性输出');
console.log('═'.repeat(60) + '\n');

const svgPathD = path.toSVGPath();
console.log('完整SVG path d:');
console.log('─'.repeat(60));
console.log(svgPathD);
console.log('─'.repeat(60) + '\n');

const hasCinD = svgPathD.includes('C ');
const hasQinD = svgPathD.includes('Q ');
const hasLinD = svgPathD.includes('L ');

console.log(`d属性中包含 C (cubic): ${hasCinD ? '✅ YES' : '❌ NO'}`);
console.log(`d属性中包含 Q (quad):   ${hasQinD ? '✅ YES' : '❌ NO'}`);
console.log(`d属性中包含 L (line):   ${hasLinD ? '✅ YES' : '❌ NO'}\n`);

if (!hasCinD) {
  console.log('❌ 严重错误：SVG d属性中没有C指令！');
  console.log('   这意味着Bezier曲线没有被正确输出到SVG！\n');
}

console.log('═'.repeat(60));
console.log('📋 第4步：分析各段类型分布');
console.log('═'.repeat(60) + '\n');

const typeCount: Record<string, number> = {};
for (const op of ops) {
  typeCount[op.type] = (typeCount[op.type] || 0) + 1;
}

console.log('类型统计:');
Object.entries(typeCount).forEach(([type, count]) => {
  const icon = type === 'curve' ? '🎯' : type === 'quad' ? '〰️' : type === 'line' ? '➖' : '⭕';
  console.log(`  ${icon} ${type.toUpperCase().padEnd(6)}: ${count}个`);
});

console.log('');

console.log('═'.repeat(60));
console.log('📋 第5步：检查控制点坐标合理性');
console.log('═'.repeat(60) + '\n');

for (let i = 0; i < ops.length; i++) {
  const op = ops[i];
  
  if (op.type === 'curve') {
    console.log(`[${i}] CUBIC BEZIER 分析:`);
    
    if (op.cp1 && op.cp2 && op.to) {
      const dx1 = Math.abs(op.to.x - op.cp1.x);
      const dy1 = Math.abs(op.to.y - op.cp1.y);
      const dx2 = Math.abs(op.to.x - op.cp2.x);
      const dy2 = Math.abs(op.to.y - op.cp2.y);
      
      console.log(`    CP1→终点距离: ${Math.sqrt(dx1*dx1 + dy1*dy1).toFixed(2)} cm`);
      console.log(`    CP2→终点距离: ${Math.sqrt(dx2*dx2 + dy2*dy2).toFixed(2)} cm`);
      
      if (dx1 < 0.5 && dy1 < 0.5 && dx2 < 0.5 && dy2 < 0.5) {
        console.log(`    ⚠️ 警告：控制点几乎与终点重合！曲线会退化为直线！`);
      }
      
      const cp1DistFromStart = Math.sqrt(
        Math.pow((ops[i-1]?.to?.x || 0) - op.cp1.x, 2) +
        Math.pow((ops[i-1]?.to?.y || 0) - op.cp1.y, 2)
      );
      
      console.log(`    起点→CP1距离: ${cp1DistFromStart.toFixed(2)} cm`);
      
      if (cp1DistFromStart < 1) {
        console.log(`    ⚠️ 警告：CP1太接近起点，曲率不明显！`);
      }
    }
    console.log('');
  }
  
  if (op.type === 'quad') {
    console.log(`[${i}] QUAD BEZIER 分析:`);
    
    if (op.cp1 && op.to) {
      const dx = Math.abs(op.to.x - op.cp1.x);
      const dy = Math.abs(op.to.y - op.cp1.y);
      
      console.log(`    CP→终点距离: ${Math.sqrt(dx*dx + dy*dy).toFixed(2)} cm`);
      
      if (dx < 0.5 && dy < 0.5) {
        console.log(`    ⚠️ 警告：控制点几乎与终点重合！`);
      }
    }
    console.log('');
  }
}

console.log('═'.repeat(60));
console.log('🎨 第6步：生成可视化SVG（含控制点和辅助线）');
console.log('═'.repeat(60) + '\n');

let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 50 90" width="500" height="900">
  <defs>
    <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
      <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#eee" stroke-width="0.3"/>
    </pattern>
  </defs>
  
  <!-- 背景 -->
  <rect x="-10" y="-10" width="50" height="90" fill="url(#grid)" />
  
  <!-- 前中折线 -->
  <line x1="0" y1="-5" x2="0" y2="80" stroke="#999" stroke-dasharray="2 2" stroke-width="0.5"/>
`;

let currentPoint: { x: number; y: number } | null = null;

for (let i = 0; i < ops.length; i++) {
  const op = ops[i];
  
  switch (op.type) {
    case 'move':
      if (op.to) {
        currentPoint = { x: op.to.x, y: op.to.y };
        svgContent += `
  <!-- [${i}] MOVE -->
  <circle cx="${op.to.x}" cy="${op.to.y}" r="1.5" fill="#e74c3c" />
  <text x="${op.to.x - 3}" y="${op.to.y - 3}" font-size="3" fill="#e74c3c">M${i}</text>
`;
      }
      break;
      
    case 'line':
      if (op.to && currentPoint) {
        svgContent += `
  <!-- [${i}] LINE -->
  <line x1="${currentPoint.x}" y1="${currentPoint.y}" x2="${op.to.x}" y2="${op.to.y}" 
        stroke="#3498db" stroke-width="0.8" />
  <circle cx="${op.to.x}" cy="${op.to.y}" r="1.2" fill="#3498db" />
`;
        currentPoint = { x: op.to.x, y: op.to.y };
      }
      break;
      
    case 'quad':
      if (op.cp1 && op.to && currentPoint) {
        svgContent += `
  <!-- [${i}] QUAD BEZIER -->
  <!-- 控制线 -->
  <line x1="${currentPoint.x}" y1="${currentPoint.y}" x2="${op.cp1.x}" y2="${op.cp1.y}" 
        stroke="#f39c12" stroke-width="0.3" stroke-dasharray="1 1" opacity="0.7"/>
  <line x1="${op.cp1.x}" y1="${op.cp1.y}" x2="${op.to.x}" y2="${op.to.y}" 
        stroke="#f39c12" stroke-width="0.3" stroke-dasharray="1 1" opacity="0.7"/>
  <!-- 控制点 -->
  <circle cx="${op.cp1.x}" cy="${op.cp1.y}" r="1.5" fill="#f39c12" />
  <text x="${op.cp1.x + 2}" y="${op.cp1.y - 1}" font-size="2.5" fill="#f39c12">CP</text>
  <!-- 曲线 -->
  <path d="M ${currentPoint.x} ${currentPoint.y} Q ${op.cp1.x} ${op.cp1.y} ${op.to.x} ${op.to.y}" 
        fill="none" stroke="#9b59b6" stroke-width="1.2" />
  <!-- 终点 -->
  <circle cx="${op.to.x}" cy="${op.to.y}" r="1.2" fill="#9b59b6" />
`;
        currentPoint = { x: op.to.x, y: op.to.y };
      }
      break;
      
    case 'curve':
      if (op.cp1 && op.cp2 && op.to && currentPoint) {
        svgContent += `
  <!-- [${i}] CUBIC BEZIER *** 重点检查 *** -->
  <!-- 控制线1: 起点→CP1 -->
  <line x1="${currentPoint.x}" y1="${currentPoint.y}" x2="${op.cp1.x}" y2="${op.cp1.y}" 
        stroke="#e74c3c" stroke-width="0.4" stroke-dasharray="1 1" opacity="0.8"/>
  <!-- 控制线2: CP1→CP2 -->
  <line x1="${op.cp1.x}" y1="${op.cp1.y}" x2="${op.cp2.x}" y2="${op.cp2.y}" 
        stroke="#c0392b" stroke-width="0.4" stroke-dasharray="1 1" opacity="0.8"/>
  <!-- 控制线3: CP2→终点 -->
  <line x1="${op.cp2.x}" y1="${op.cp2.y}" x2="${op.to.x}" y2="${op.to.y}" 
        stroke="#e74c3c" stroke-width="0.4" stroke-dasharray="1 1" opacity="0.8"/>
  <!-- 控制点1 -->
  <circle cx="${op.cp1.x}" cy="${op.cp1.y}" r="2" fill="#e74c3c" />
  <text x="${op.cp1.x + 2}" y="${op.cp1.y - 1}" font-size="2.5" fill="#e74c3c">CP1</text>
  <!-- 控制点2 -->
  <circle cx="${op.cp2.x}" cy="${op.cp2.y}" r="2" fill="#c0392b" />
  <text x="${op.cp2.x + 2}" y="${op.cp2.y - 1}" font-size="2.5" fill="#c0392b">CP2</text>
  <!-- 曲线本身 -->
  <path d="M ${currentPoint.x} ${currentPoint.y} C ${op.cp1.x} ${op.cp1.y}, ${op.cp2.x} ${op.cp2.y}, ${op.to.x} ${op.to.y}" 
        fill="none" stroke="#27ae60" stroke-width="1.5" />
  <!-- 终点 -->
  <circle cx="${op.to.x}" cy="${op.to.y}" r="1.5" fill="#27ae60" />
  <text x="${op.to.x + 2}" y="${op.to.y + 3}" font-size="2.5" fill="#27ae60">END</text>
`;
        currentPoint = { x: op.to.x, y: op.to.y };
      }
      break;
      
    case 'close':
      svgContent += `
  <!-- [${i}] CLOSE -->
  <line x1="${currentPoint?.x || 0}" y1="${currentPoint?.y || 0}" 
        x2="${ops[0]?.to?.x || 0}" y2="${ops[0]?.to?.y || 0}" 
        stroke="#3498db" stroke-width="0.8" />
`;
      break;
  }
}

svgContent += `
  <!-- 图例 -->
  <rect x="-8" y="82" width="45" height="7" fill="white" stroke="#ccc" stroke-width="0.3" rx="1"/>
  <circle cx="-6" cy="84" r="1" fill="#e74c3c"/><text x="-4" y="85" font-size="2">起点/M</text>
  <circle cx="5" cy="84" r="1" fill="#3498db"/><text x="7" y="85" font-size="2">直线/L</text>
  <circle cx="16" cy="84" r="1" fill="#9b59b6"/><text x="18" y="85" font-size="2">二次/Q</text>
  <circle cx="27" cy="84" r="1" fill="#27ae60"/><text x="29" y="85" font-size="2">三次/C</text>
  <circle cx="-6" cy="87" r="1" fill="#f39c12"/><text x="-4" y="88" font-size="2">Q-CP</text>
  <circle cx="5" cy="87" r="1" fill="#e74c3c"/><text x="7" y="88" font-size="2">C-CP1</text>
  <circle cx="16" cy="87" r="1" fill="#c0392b"/><text x="18" y="88" font-size="2">C-CP2</text>

</svg>`;

console.log('可视化SVG已生成（见下方完整输出）\n');

console.log('═'.repeat(60));
console.log('📊 最终诊断结果');
console.log('═'.repeat(60) + '\n');

const issues: string[] = [];
const passes: string[] = [];

if (hasCurve) {
  passes.push('✅ Path.ops中包含curve操作');
} else {
  issues.push('❌ Path.ops中缺少curve操作');
}

if (hasCinD) {
  passes.push('✅ SVG d属性包含C指令');
} else {
  issues.push('❌ SVG d属性缺少C指令');
}

if (hasQuad) {
  passes.push('✅ Path.ops包含quad操作（领口）');
} else {
  issues.push('❌ Path.ops缺少quad操作');
}

if (hasQinD) {
  passes.push('✅ SVG d属性包含Q指令');
} else {
  issues.push('❌ SVG d属性缺少Q指令');
}

if (!hasLineOnly) {
  passes.push('✅ 不全是直线，有曲线');
} else {
  issues.push('❌ 全部是直线，没有曲线！');
}

console.log('通过项:');
passes.forEach(p => console.log(`  ${p}`));

if (issues.length > 0) {
  console.log('\n问题项:');
  issues.forEach(i => console.log(`  ${i}`));
}

console.log('\n' + '═'.repeat(60));
console.log('📄 完整可视化SVG输出');
console.log('═'.repeat(60) + '\n');

console.log(svgContent);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ Bezier诊断完成');
console.log('═══════════════════════════════════════════════════════════════════\n');

process.exit(issues.length > 0 ? 1 : 0);
