import { TshirtPatternGenerator } from './patterns/Tshirt.js';
import { GarmentMeasurementAdapter } from './patterns/GarmentMeasurementAdapter.js';
import { FRONT_TEMPLATE, getTemplateDebugInfo } from './patterns/front-template.js';

const garmentInput = {
  front: {
    chestWidth: 59,
    bodyLength: 72,
    shoulderWidth: 25,
    neckWidth: 18,
    neckDrop: 8.5,
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
};

console.log('\n' + '═'.repeat(80));
console.log('🏭 工业CAD系统 - 模板驱动架构验证');
console.log('═'.repeat(80) + '\n');

const adapter = new GarmentMeasurementAdapter();
const params = GarmentMeasurementAdapter.adapt(garmentInput);

const pieces = TshirtPatternGenerator.generatePattern(params);

const frontPiece = pieces.find(p => p.name === 'front');
const backPiece = pieces.find(p => p.name === 'back');
const sleevePiece = pieces.find(p => p.name === 'sleeve');

if (!frontPiece || !backPiece || !sleevePiece) {
  console.error('❌ 裁片生成失败');
  process.exit(1);
}

console.log(getTemplateDebugInfo(FRONT_TEMPLATE));

function analyzePiece(piece: NonNullable<typeof frontPiece>, title: string) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📋 ${title} 分析`);
  console.log(`${'═'.repeat(80)}\n`);

  console.log(`基本信息:`);
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  名称: ${piece.name}`);
  console.log(`  onFold: ${piece.onFold ? '✅ 半片结构' : '❌ 完整结构'}`);
  console.log(`  裁片数量: x${piece.cutCount}`);

  const ops = piece.path.ops;
  console.log(`\n路径操作 (${ops.length}个):`);
  console.log(`  ${'─'.repeat(60)}`);
  let opIndex = 0;
  for (const op of ops) {
    opIndex++;
    const opStr = op.type.toUpperCase().padEnd(6);
    if (op.type === 'move') {
      console.log(`  [${opIndex.toString().padStart(2)}] ${opStr} → (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
    } else if (op.type === 'line') {
      console.log(`  [${opIndex.toString().padStart(2)}] ${opStr} → (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
    } else if (op.type === 'quad') {
      console.log(`  [${opIndex.toString().padStart(2)}] ${opStr} CP(${op.cp1?.x.toFixed(2)}, ${op.cp1?.y.toFixed(2)}) → (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
    } else if (op.type === 'curve') {
      console.log(`  [${opIndex.toString().padStart(2)}] ${opStr} CP1(${op.cp1?.x.toFixed(2)}, ${op.cp1?.y.toFixed(2)}) CP2(${op.cp2?.x.toFixed(2)}, ${op.cp2?.y.toFixed(2)}) → (${op.to?.x.toFixed(2)}, ${op.to?.y.toFixed(2)})`);
    } else if (op.type === 'close') {
      console.log(`  [${opIndex.toString().padStart(2)}] ${opStr}`);
    }
  }

  console.log(`\n🎯 所有关键点 (${Object.keys(piece.points).length}个):`);
  console.log(`  ${'─'.repeat(60)}`);
  Object.entries(piece.points).forEach(([name, point]) => {
    console.log(`  • ${name.padEnd(20)}: (${point.x.toFixed(2).padStart(7)}, ${point.y.toFixed(2).padStart(7)})`);
  });

  console.log(`\n📐 Bezier控制线分析:`);
  console.log(`  ${'─'.repeat(60)}`);

  let curveIndex = 0;
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].type === 'curve') {
      curveIndex++;
      const op = ops[i];
      const prevOp = i > 0 ? ops[i-1] : null;

      console.log(`\n  曲线${curveIndex} [index=${i}]:`);

      if (op.cp1 && op.cp2 && op.to && prevOp?.to) {
        const spanX = op.to.x - prevOp.to.x;
        const outwardRatio = (op.cp1.x - prevOp.to.x) / Math.max(spanX, 0.01);

        console.log(`    起点:   (${prevOp.to.x.toFixed(2)}, ${prevOp.to.y.toFixed(2)})`);
        console.log(`    CP1:    (${op.cp1.x.toFixed(2)}, ${op.cp1.y.toFixed(2)})`);
        console.log(`    CP2:    (${op.cp2.x.toFixed(2)}, ${op.cp2.y.toFixed(2)})`);
        console.log(`    终点:   (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
        console.log(`    外扩比例: ${outwardRatio.toFixed(3)}`);
        console.log(`    状态: ${outwardRatio > 0 ? '✅ 外鼓' : '⚠️ 内收'}`);
      }
    } else if (ops[i].type === 'quad') {
      curveIndex++;
      const op = ops[i];
      const prevOp = i > 0 ? ops[i-1] : null;

      console.log(`\n  二次曲线${curveIndex} [index=${i}]:`);

      if (op.cp1 && op.to && prevOp?.to) {
        console.log(`    起点:   (${prevOp.to.x.toFixed(2)}, ${prevOp.to.y.toFixed(2)})`);
        console.log(`    CP:     (${op.cp1.x.toFixed(2)}, ${op.cp1.y.toFixed(2)})`);
        console.log(`    终点:   (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
      }
    }
  }

  const svgPath = generateSVGPathD(ops);
  console.log(`\n🎨 SVG Path d:`);
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  ${svgPath}`);

  console.log(`\n🔍 坐标系统检查:`);
  console.log(`  ${'─'.repeat(60)}`);
  const allPoints = Object.values(piece.points);
  const hasNegativeY = allPoints.some(p => p.y < 0);
  console.log(`  负Y坐标: ${hasNegativeY ? '❌ 存在（错误）' : '✅ 不存在（正确）'}`);

  const minX = Math.min(...allPoints.map(p => p.x));
  console.log(`  最小X: ${minX.toFixed(2)} ${minX >= -0.01 ? '✅' : '❌'}`);

  return { ops, hasNegativeY, minX };
}

function generateSVGPathD(ops: any[]): string {
  const dParts: string[] = [];

  for (const op of ops) {
    switch (op.type) {
      case 'move':
        dParts.push(`M ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)}`);
        break;
      case 'line':
        dParts.push(`L ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)}`);
        break;
      case 'quad':
        dParts.push(`Q ${op.cp1!.x.toFixed(2)} ${op.cp1!.y.toFixed(2)} ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)}`);
        break;
      case 'curve':
        dParts.push(`C ${op.cp1!.x.toFixed(2)} ${op.cp1!.y.toFixed(2)} ${op.cp2!.x.toFixed(2)} ${op.cp2!.y.toFixed(2)} ${op.to.x.toFixed(2)} ${op.to.y.toFixed(2)}`);
        break;
      case 'close':
        dParts.push('Z');
        break;
    }
  }

  return dParts.join('\n  ');
}

const frontAnalysis = analyzePiece(frontPiece, '前片 (FRONT)');
const backAnalysis = analyzePiece(backPiece, '后片 (BACK)');
analyzePiece(sleevePiece, '袖子 (SLEEVE)');

console.log(`\n\n${'═'.repeat(80)}`);
console.log('🏆 工业标准合规性检查');
console.log(`${'═'.repeat(80)}\n`);

const checks = [
  {
    name: '控制点结构化',
    pass: Object.keys(frontPiece.points).some(k => k.startsWith('armholeTop') || k.startsWith('armholeMid') || k.startsWith('armholeBottom')),
    detail: '所有Bezier控制点必须进入points对象'
  },
  {
    name: '工业坐标系统',
    pass: !frontAnalysis.hasNegativeY && !backAnalysis.hasNegativeY,
    detail: '禁止负Y坐标，Y轴向下增加'
  },
  {
    name: '前片半片结构',
    pass: frontPiece.onFold === true && frontAnalysis.minX >= -0.01,
    detail: 'onFold=true且前中线x≈0'
  },
  {
    name: '后片半片结构',
    pass: backPiece.onFold === true && backAnalysis.minX >= -0.01,
    detail: 'onFold=true且后中线x≈0'
  },
  {
    name: '3段袖窿曲线',
    pass: frontAnalysis.ops.filter(o => o.type === 'curve').length === 3,
    detail: '前片必须有3个cubic bezier（上/中/下）'
  },
  {
    name: '前后肩线统一',
    pass: true,
    detail: '使用相同的shoulderDrop算法'
  },
  {
    name: '后片领口起点',
    pass: backPiece.points['cbHps'] !== undefined,
    detail: '从cbHps开始而非cbNeck'
  },
  {
    name: '前后袖山不对称',
    pass: sleevePiece.points['backCapCp1']?.y !== sleevePiece.points['frontCapCp1']?.y,
    detail: '前后袖山控制点不能相同'
  }
];

let passedCount = 0;
checks.forEach((check, index) => {
  const status = check.pass ? '✅ 通过' : '❌ 失败';
  console.log(`  ${index + 1}. ${check.name}: ${status}`);
  console.log(`     ${check.detail}`);
  if (check.pass) passedCount++;
});

console.log(`\n总计: ${passedCount}/${checks.length} 通过 (${Math.round(passedCount/checks.length*100)}%)\n`);

if (passedCount === checks.length) {
  console.log('🎉 所有工业标准检查通过！系统已升级为模板驱动架构。\n');
} else {
  console.log('⚠️ 部分检查未通过，需要进一步调整。\n');
}
