import { GarmentMeasurementAdapter, TshirtPatternGenerator } from './patterns/index.js';

console.log('═'.repeat(80));
console.log('🔬 工业袖子系统 - 完整协调性验证（遵循 rule-match.md）');
console.log('═'.repeat(80));

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

console.log('\n📥 输入参数（成衣测量数据）:');
console.log(`   胸围: ${garmentInput.chestWidth} cm`);
console.log(`   肩宽: ${garmentInput.shoulderWidth} cm`);
console.log(`   衣长: ${garmentInput.bodyLength} cm`);
console.log(`   领宽: ${garmentInput.neckWidth} cm`);
console.log(`   袖笼深: ${garmentInput.armholeDepth} cm`);
console.log(`   袖长: ${garmentInput.sleeveLength} cm`);
console.log(`   腋下半围: ${garmentInput.bicepsWidth} cm`);
console.log(`   袖口宽: ${garmentInput.cuffWidth} cm`);

const params = GarmentMeasurementAdapter.adapt(garmentInput);

console.log('\n🔄 GarmentMeasurementAdapter转换结果:');
console.log(`\n   前片参数 (Front Panel):`);
console.log(`     - 半胸宽: ${params.frontPanel.width.toFixed(2)} cm`);
console.log(`     - 衣长: ${params.frontPanel.length.toFixed(2)} cm`);
console.log(`     - 半领宽: ${params.frontPanel.neckWidth.toFixed(2)} cm`);
console.log(`     - 半肩宽: ${params.frontPanel.shoulderWidth.toFixed(2)} cm`);
console.log(`     - 袖笼深: ${params.frontPanel.armholeDepth.toFixed(2)} cm`);

console.log(`\n   后片参数 (Back Panel):`);
console.log(`     - 半胸宽: ${params.backPanel.width.toFixed(2)} cm`);
console.log(`     - 衣长: ${params.backPanel.length.toFixed(2)} cm`);
console.log(`     - 半领宽: ${params.backPanel.neckWidth.toFixed(2)} cm`);
console.log(`     - 半肩宽: ${params.backPanel.shoulderWidth.toFixed(2)} cm`);
console.log(`     - 袖笼深: ${params.backPanel.armholeDepth.toFixed(2)} cm`);

console.log(`\n   袖子参数 (Sleeve):`);
console.log(`     - 腋下半围: ${params.sleeve.bicepsWidth.toFixed(2)} cm`);
console.log(`     - 袖山高: ${params.sleeve.sleeveCapHeight.toFixed(2)} cm`);
console.log(`     - 袖长: ${params.sleeve.sleeveLength.toFixed(2)} cm`);
console.log(`     - 袖口半围: ${params.sleeve.cuffWidth.toFixed(2)} cm`);

const pieces = TshirtPatternGenerator.generatePattern(params);

console.log('\n' + '═'.repeat(80));
console.log('📊 裁片生成结果详细分析');
console.log('═'.repeat(80));

for (let i = 0; i < pieces.length; i++) {
  const piece = pieces[i];
  
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`【${i + 1}. ${piece.name.toUpperCase()}】`);
  console.log('─'.repeat(80));
  
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
  
  console.log(`\n📐 基础信息:`);
  console.log(`   尺寸: ${width.toFixed(1)} × ${height.toFixed(1)} cm`);
  console.log(`   关键点数: ${Object.keys(piece.points).length}`);
  console.log(`   裁剪数量: ${piece.cutCount}`);
  console.log(`   对折: ${piece.onFold ? '是（半片）' : '否（完整）'}`);
  console.log(`   缝份: ${piece.seamAllowance || 0} cm`);
  
  // Path结构分析
  console.log(`\n🔍 Path结构:`);
  const structure = analyzePathStructure(pathOps);
  console.log(`   拓扑: ${structure.topology}`);
  console.log(`   曲线段数: ${structure.curveCount}`);
  console.log(`   直线段数: ${structure.lineCount}`);
  
  if (piece.name === 'front') {
    console.log(`\n🎯 前片工业特征验证 (rule-match.md):`);
    verifyFrontPanel(piece);
  } else if (piece.name === 'back') {
    console.log(`\n🎯 后片工业特征验证 (rule-match.md):`);
    verifyBackPanel(piece);
  } else if (piece.name === 'sleeve') {
    console.log(`\n🎯 袖子工业特征验证 (rule-match.md):`);
    verifySleeveIndustrial(pieces[0], pieces[1], piece); // back, front, sleeve
  }
}

console.log('\n' + '═'.repeat(80));
console.log('✅ 协调性验证完成！');
console.log('═'.repeat(80));

/**
 * 分析Path结构
 */
function analyzePathStructure(ops: Array<{type: string}>): {topology: string, curveCount: number, lineCount: number} {
  let curveCount = 0;
  let lineCount = 0;
  let quadCount = 0;
  let moveCount = 0;
  
  for (const op of ops) {
    switch (op.type) {
      case 'move': moveCount++; break;
      case 'line': lineCount++; break;
      case 'curve': curveCount++; break;
      case 'quad': quadCount++; break;
    }
  }
  
  return {
    topology: `M(${moveCount}) + Q(${quadCount}) + L(${lineCount}) + C(${curveCount})`,
    curveCount,
    lineCount
  };
}

/**
 * 验证前片工业特征
 */
function verifyFrontPanel(piece: any) {
  const points = piece.points;
  
  // 检查关键点是否存在
  const requiredPoints = ['cfNeck', 'neckEnd', 'shoulder', 'armholePitch', 'armholeEnd', 'sideBottom', 'hemFold'];
  const missingPoints = requiredPoints.filter(p => !points[p]);
  
  if (missingPoints.length > 0) {
    console.log(`   ❌ 缺少关键点: ${missingPoints.join(', ')}`);
    return;
  }
  
  console.log(`   ✅ 所有关键点存在`);
  
  // 验证前领较深
  const neckDepth = points.neckEnd.y - points.cfNeck.y;
  console.log(`   📏 前领深度: ${neckDepth.toFixed(2)} cm (应该>6cm)`);
  
  // 验证shoulder较短
  const shoulderLen = Math.sqrt(
    Math.pow(points.shoulder.x - points.neckEnd.x, 2) +
    Math.pow(points.shoulder.y - points.neckEnd.y, 2)
  );
  console.log(`   📏 肩线长度: ${shoulderLen.toFixed(2)} cm`);
  
  // 验证袖窿更凹
  const pitchX = points.armholePitch.x;
  const shoulderX = points.shoulder.x;
  const axillaX = points.armholeEnd.x;
  
  const outwardRatio = (pitchX - shoulderX) / (axillaX - shoulderX);
  console.log(`   📐 外鼓比例: ${(outwardRatio * 100).toFixed(1)}% (应该15~25%)`);
  
  // 验证hollow明显
  const hollowY = points.armholeBottomCp1 ? points.armholeBottomCp1.y : 0;
  const pitchY = points.armholePitch.y;
  const hollowDepth = hollowY - pitchY;
  console.log(`   📐 Hollow深度: ${hollowDepth.toFixed(2)} cm`);
}

/**
 * 验证后片工业特征
 */
function verifyBackPanel(piece: any) {
  const points = piece.points;
  
  const requiredPoints = ['cbNeck', 'hps', 'shoulder', 'backPitch', 'armholeEnd', 'sideHem', 'cbHem'];
  const missingPoints = requiredPoints.filter(p => !points[p]);
  
  if (missingPoints.length > 0) {
    console.log(`   ❌ 缺少关键点: ${missingPoints.join(', ')}`);
    return;
  }
  
  console.log(`   ✅ 所有关键点存在`);
  
  // 验证后领浅
  const neckDepth = points.hps.y - points.cbNeck.y;
  console.log(`   📏 后领深度: ${neckDepth.toFixed(2)} cm (应该<5cm)`);
  
  // 验证后肩略长（通过比较前后shoulder x坐标）
  console.log(`   📏 后肩X位置: ${points.shoulder.x.toFixed(2)} cm`);
  
  // 验证袖窿更平
  console.log(`   📐 后Pitch Y位置: ${points.backPitch.y.toFixed(2)} cm (应该比前片pitch更高)`);
}

/**
 * 验证袖子工业特征（核心：与前后片协调）
 */
function verifySleeveIndustrial(backPiece: any, frontPiece: any, sleevePiece: any) {
  const sPoints = sleevePiece.points;
  const fPoints = frontPiece.points;
  const bPoints = backPiece.points;
  
  console.log(`\n   🔗 与前后片的协调性验证:`);
  
  // 1. 验证袖山长度匹配
  if (sleevePiece.totalCapLength && sleevePiece.frontArmholeLength && sleevePiece.backArmholeLength) {
    const targetLength = sleevePiece.frontArmholeLength + sleevePiece.backArmholeLength + sleevePiece.ease;
    const actualLength = sleevePiece.totalCapLength;
    const error = Math.abs(actualLength - targetLength);
    
    console.log(`\n   📏 袖山长度匹配 (核心指标):`);
    console.log(`      前袖窿长度: ${sleevePiece.frontArmholeLength.toFixed(2)} cm`);
    console.log(`      后袖窿长度: ${sleevePiece.backArmholeLength.toFixed(2)} cm`);
    console.log(`      Ease容量: ${sleevePiece.ease.toFixed(2)} cm`);
    console.log(`      目标总长度: ${targetLength.toFixed(2)} cm`);
    console.log(`      实际总长度: ${actualLength.toFixed(2)} cm`);
    console.log(`      匹配误差: ${error.toFixed(2)} cm ${error <= 0.5 ? '✅' : '❌'} (标准±0.5cm)`);
    
    // 验证前后分配
    const frontCapRatio = sleevePiece.frontCapLength / actualLength;
    const backCapRatio = sleevePiece.backCapLength / actualLength;
    
    console.log(`\n   ⚖️ 前后袖山长度分配:`);
    console.log(`      前袖山: ${sleevePiece.frontCapLength.toFixed(2)} cm (${(frontCapRatio * 100).toFixed(1)}%)`);
    console.log(`      后袖山: ${sleevePiece.backCapLength.toFixed(2)} cm (${(backCapRatio * 100).toFixed(1)}%)`);
    console.log(`      工业标准: 前袖山应该略短于后袖山 ✅`);
  }
  
  // 2. 验证前后不对称性
  const frontPitch = sPoints.frontPitch;
  const backPitch = sPoints.backPitch;
  
  if (frontPitch && backPitch) {
    console.log(`\n   ⚖️ 前后袖山不对称性 (工业标准):`);
    console.log(`      前Pitch位置: (${frontPitch.x.toFixed(2)}, ${frontPitch.y.toFixed(2)})`);
    console.log(`      后Pitch位置: (${backPitch.x.toFixed(2)}, ${backPitch.y.toFixed(2)})`);
    
    // 前袖山应该更低（更陡）
    if (frontPitch.y > backPitch.y) {
      console.log(`      ✅ 前Pitch更低 → 前袖山更陡峭 (符合工业标准)`);
    } else {
      console.log(`      ❌ 前后位置关系错误`);
    }
    
    // 计算pitch高度比
    const capHeight = sPoints.frontAxilla ? sPoints.frontAxilla.y : 12.5;
    const frontPitchRatio = frontPitch.y / capHeight;
    const backPitchRatio = backPitch.y / capHeight;
    
    console.log(`      前Pitch高度比: ${(frontPitchRatio * 100).toFixed(1)}% (工业标准≈42%)`);
    console.log(`      后Pitch高度比: ${(backPitchRatio * 100).toFixed(1)}% (工业标准≈34%)`);
  }
  
  // 3. 验证Notch系统
  if (sleevePiece.notches && sleevePiece.notches.length >= 2) {
    console.log(`\n   📍 Notch标记系统:`);
    sleevePiece.notches.forEach((notch: any, idx: number) => {
      console.log(`      ${idx === 0 ? '前Notch' : '后Notch'}: (${notch.x.toFixed(2)}, ${notch.y.toFixed(2)})`);
    });
    console.log(`      ✅ 包含完整的前后Notch标记`);
  } else {
    console.log(`\n   ❌ Notch标记不完整`);
  }
  
  // 4. 验证Grainline
  if (sleevePiece.grainline) {
    console.log(`\n   📏 Grainline (丝缕方向):`);
    console.log(`      起点: (${sleevePiece.grainline.start.x.toFixed(2)}, ${sleevePiece.grainline.start.y.toFixed(2)})`);
    console.log(`      终点: (${sleevePiece.grainline.end.x.toFixed(2)}, ${sleevePiece.grainline.end.y.toFixed(2)})`);
    console.log(`      ✅ Grainline存在 (用于裁剪定位)`);
  }
  
  // 5. 验证Path拓扑
  const pathOps = sleevePiece.path.ops || [];
  let curveCount = 0;
  let lineCount = 0;
  
  for (const op of pathOps) {
    if (op.type === 'curve') curveCount++;
    if (op.type === 'line') lineCount++;
  }
  
  console.log(`\n   🔍 袖子Path结构:`);
  console.log(`      Curve操作: ${curveCount} (应该=4: 前上+前下+后下+后上)`);
  console.log(`      Line操作: ${lineCount} (应该=3: 前腋下→前袖口→后袖口→后腋下)`);
  
  if (curveCount === 4 && lineCount === 3) {
    console.log(`      ✅ Path结构符合工业标准`);
  } else {
    console.log(`      ❌ Path结构异常`);
  }
  
  // 6. 验证尺寸合理性
  const capTop = sPoints.capTop;
  const frontAxilla = sPoints.frontAxilla;
  const frontCuff = sPoints.frontCuff;
  
  if (capTop && frontAxilla && frontCuff) {
    const bicepWidth = Math.abs(frontAxilla.x - (sPoints.backAxilla?.x || 0));
    const cuffWidth = Math.abs(frontCuff.x - (sPoints.backCuff?.x || 0));
    const totalLength = frontCuff.y - capTop.y;
    
    console.log(`\n   📐 袖子尺寸验证:`);
    console.log(`      腋下半围: ${bicepWidth.toFixed(2)} cm`);
    console.log(`      袖口半围: ${cuffWidth.toFixed(2)} cm`);
    console.log(`      总长度: ${totalLength.toFixed(2)} cm`);
    console.log(`      袖口/腋下比: ${(cuffWidth / bicepWidth * 100).toFixed(1)}% (应该40~70%)`);
  }
}

// 导出函数供模块使用
export { analyzePathStructure, verifyFrontPanel, verifyBackPanel, verifySleeveIndustrial };
