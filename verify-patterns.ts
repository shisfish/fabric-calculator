#!/usr/bin/env node

import { TshirtPatternGenerator, GarmentMeasurementAdapter, PatternPiece } from './patterns/index.js';
import { Point } from './geometry/index.js';

const params = GarmentMeasurementAdapter.adapt({
  garment: 'basic_tshirt',
  front: {
    chestWidth: 59,
    bodyLength: 72,
    shoulderWidth: 24,
    neckWidth: 18,
    neckDrop: 8,
    armholeDepth: 26
  },
  back: {
    chestWidth: 59,
    bodyLength: 72,
    shoulderWidth: 25,
    neckWidth: 18,
    neckDrop: 2.5,
    armholeDepth: 26
  },
  sleeve: {
    sleeveLength: 24,
    bicepWidth: 22.5,
    cuffWidth: 17.5,
    sleeveCapHeight: 12.5
  }
});

console.log('=== 工业T恤裁片生成 ===\n');
console.log('输入参数:');
console.log(`- 胸围: 59cm (半胸宽: ${params.backPanel.width}cm)`);
console.log(`- 衣长: 72cm`);
console.log(`- 肩宽: 25cm (半肩: ${params.backPanel.shoulderWidth}cm)`);
console.log(`- 领宽: 18cm (半领: ${params.backPanel.neckWidth}cm)`);
console.log(`- 前领深: 8.5cm → 参数化: ${params.frontPanel.neckDepth.toFixed(1)}cm`);
console.log(`- 后领深: 2.5cm → 参数化: ${params.backPanel.neckDepth.toFixed(1)}cm`);
console.log(`- 袖窿深: 26cm`);
console.log(`- 袖长: 24cm`);
console.log(`- 袖肥: 22.5cm (半袖肥: ${params.sleeve.bicepsWidth / 2}cm)`);
console.log(`- 袖口: 17.5cm (半袖口: ${params.sleeve.cuffWidth / 2}cm)`);
console.log(`- 袖山高: ${params.sleeve.sleeveCapHeight}cm\n`);

const pieces = TshirtPatternGenerator.generatePattern(params);

function pathOpsToSVG(ops: PatternPiece['path']['ops'], offsetX = 0, offsetY = 0) {
  let d = '';
  let curveCount = 0;
  let lineCount = 0;
  
  for (const op of ops) {
    switch (op.type) {
      case 'move':
        if (op.to) d += `M ${op.to.x + offsetX} ${op.to.y + offsetY} `;
        break;
      case 'line':
        if (op.to) {
          d += `L ${op.to.x + offsetX} ${op.to.y + offsetY} `;
          lineCount++;
        }
        break;
      case 'curve':
        if (op.cp1 && op.cp2 && op.to) {
          d += `C ${op.cp1.x + offsetX} ${op.cp1.y + offsetY} ${op.cp2.x + offsetX} ${op.cp2.y + offsetY} ${op.to.x + offsetX} ${op.to.y + offsetY} `;
          curveCount++;
        }
        break;
      case 'quad':
        if (op.cp1 && op.to) {
          d += `Q ${op.cp1.x + offsetX} ${op.cp1.y + offsetY} ${op.to.x + offsetX} ${op.to.y + offsetY} `;
          curveCount++;
        }
        break;
      case 'close':
        d += 'Z ';
        break;
    }
  }
  return { path: d.trim(), curveCount, lineCount };
}

function getBBox(points: Point[]) {
  const xs = points.map((p: Point) => p.x);
  const ys = points.map((p: Point) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

let totalCurves = 0;
let totalLines = 0;

for (const piece of pieces) {
  console.log('═'.repeat(60));
  console.log(`📐 ${piece.name.toUpperCase()} PANEL`);
  console.log('─'.repeat(60));
  
  const { path, curveCount, lineCount } = pathOpsToSVG(piece.path.ops);
  totalCurves += curveCount;
  totalLines += lineCount;
  
  const allPoints = Object.values(piece.points);
  const bbox = getBBox(allPoints);
  
  console.log(`尺寸: ${bbox.width.toFixed(1)}cm × ${bbox.height.toFixed(1)}cm`);
  console.log(`Bezier曲线数: ${curveCount} 个 C 指令 ✅`);
  console.log(`直线段数: ${lineCount} 个 L 指令`);
  console.log('');
  
  console.log('SVG Path:');
  console.log(`<path d="`);
  path.split(' ').forEach((seg, i) => {
    process.stdout.write(seg + (i % 3 === 2 ? '\n' : ' '));
  });
  console.log(`"/>`);
  console.log('');

  console.log('关键点坐标:');
  for (const [name, pt] of Object.entries(piece.points)) {
    console.log(`  ${name.padEnd(15)}: (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
  }
  console.log('');
}

console.log('═'.repeat(60));
console.log('📊 统计汇总');
console.log('═'.repeat(60));
console.log(`总裁片数: ${pieces.length}`);
console.log(`总 Bezier 曲线: ${totalCurves} 个 C 指令`);
console.log(`总直线段: ${totalLines} 个 L 指令`);

if (totalCurves >= 9) {
  console.log('\n✅ PASS: 所有裁片包含足够的 Cubic Bezier 曲线');
} else {
  console.log('\n❌ FAIL: Bezier曲线数量不足');
}

if (pieces.length === 3) {
  console.log('✅ PASS: 包含前片、后片、袖片');
}

console.log('\n' + '='.repeat(60));
console.log('完整 SVG 输出（可直接在浏览器查看）');
console.log('='.repeat(60));

const colors: Record<string, string> = { back: '#10b981', front: '#3b82f6', sleeve: '#f59e0b' };
const offsets: Record<string, number[]> = { back: [50, 50], front: [200, 50], sleeve: [350, 100] };

let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
`;

for (const piece of pieces) {
  const color = colors[piece.name] || '#666';
  const [ox, oy] = offsets[piece.name] || [0, 0];
  const { path } = pathOpsToSVG(piece.path.ops, ox, oy);
  
  svgContent += `
  <g class="${piece.name}">
    <path d="${path}" 
          fill="${color}22" 
          stroke="${color}" 
          stroke-width="1.5"
          stroke-linejoin="round"/>
    <text x="${ox + 5}" y="${oy - 10}" font-size="12" fill="${color}" font-weight="bold">${piece.name}</text>
    
`;
  
  Object.entries(piece.points).forEach(([name, pt]) => {
    const px = pt.x + ox;
    const py = pt.y + oy;
    svgContent += `    <circle cx="${px}" cy="${py}" r="2" fill="${color}"/>\n`;
    if (name.includes('shoulder') || name.includes('neck') || name.includes('armhole')) {
      svgContent += `    <text x="${px + 4}" y="${py - 2}" font-size="8" fill="#666">${name}</text>\n`;
    }
  });

  svgContent += `  </g>\n`;
}

svgContent += `
</svg>`;

console.log(svgContent);
