// 简化Point类
class Point {
  constructor(public x: number, public y: number) {}
}

// 模拟SleeveCapGenerator的generateFrontCap逻辑
function testFrontCapGeneration(
  targetLength: number,
  capHeight: number,
  bicepWidth: number,
  outwardMultiplier: number = 1.0
) {
  
  const top = new Point(0, 0);
  const axilla = new Point(bicepWidth / 2, capHeight);
  const halfBicep = bicepWidth / 2;

  // Pitch point
  const pitchY = capHeight * 0.42;
  const pitchX = halfBicep * 0.35;

  // 计算straight distance
  const straightDist = Math.sqrt(
    Math.pow(axilla.x - top.x, 2) + 
    Math.pow(axilla.y - top.y, 2)
  );

  console.log(`\n📐 基础数据:`);
  console.log(`   targetLength: ${targetLength.toFixed(2)} cm`);
  console.log(`   straightDist: ${straightDist.toFixed(2)} cm`);
  console.log(`   lengthRatio: ${(targetLength / straightDist).toFixed(3)}`);

  // 计算outward
  const lengthRatio = targetLength / straightDist;
  
  let baseOutward;
  if (lengthRatio > 1.8) {
    baseOutward = halfBicep * 0.45 * (lengthRatio - 1);
    console.log(`   使用公式: halfBicep * 0.45 * (ratio-1)`);
  } else if (lengthRatio > 1.4) {
    baseOutward = halfBicep * 0.30 * (lengthRatio - 1);
    console.log(`   使用公式: halfBicep * 0.30 * (ratio-1)`);
  } else {
    baseOutward = halfBicep * 0.20 * (lengthRatio - 1);
    console.log(`   使用公式: halfBicep * 0.20 * (ratio-1)`);
  }
  
  const outward = baseOutward * outwardMultiplier;

  console.log(`\n🎯 Outward计算:`);
  console.log(`   baseOutward: ${baseOutward.toFixed(4)} cm`);
  console.log(`   outwardMultiplier: ${outwardMultiplier.toFixed(3)}`);
  console.log(`   final outward: ${outward.toFixed(4)} cm`);

  // 生成控制点
  const cp1 = new Point(
    top.x + outward * 0.55,
    top.y + capHeight * 0.25
  );

  const cp2 = new Point(
    pitchX + outward * 0.20,
    pitchY - capHeight * 0.08
  );

  console.log(`\n📍 控制点:`);
  console.log(`   CP1: (${cp1.x.toFixed(4)}, ${cp1.y.toFixed(4)})`);
  console.log(`   CP2: (${cp2.x.toFixed(4)}, ${cp2.y.toFixed(4)})`);

  // 计算曲线长度
  function calculateBezierLength(p0, p1, p2, p3, segments = 50) {
    let length = 0;
    let prevPoint = p0;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      
      const x = mt*mt*mt * p0.x + 3*mt*mt*t * p1.x + 3*mt*t*t * p2.x + t*t*t * p3.x;
      const y = mt*mt*mt * p0.y + 3*mt*mt*t * p1.y + 3*mt*t*t * p2.y + t*t*t * p3.y;
      
      const currPoint = {x, y};
      const dx = currPoint.x - prevPoint.x;
      const dy = currPoint.y - prevPoint.y;
      length += Math.sqrt(dx*dx + dy*dy);
      prevPoint = currPoint;
    }

    return length;
  }

  // 计算从top到pitch的长度
  const pitchPoint = new Point(pitchX, pitchY);
  const lenTopToPitch = calculateBezierLength(top, cp1, cp2, pitchPoint);

  console.log(`\n📏 曲线长度:`);
  console.log(`   Top → Pitch: ${lenTopToPitch.toFixed(2)} cm`);
  console.log(`   目标长度:     ${targetLength.toFixed(2)} cm`);
  console.log(`   差异:         ${(targetLength - lenTopToPitch).toFixed(2)} cm`);

  return lenTopToPitch;
}

console.log('═══════════════════════════════════════');
console.log('🔬 测试generateFrontCap的outward调整');
console.log('═══════════════════════════════════════');

// 前袖窿目标长度
const frontTargetLen = 29.20; // cm
const capHeight = 12.5;       // cm
const bicepWidth = 20;        // cm

console.log('\n=== 测试不同的outwardMultiplier ===\n');

for (const mult of [1.0, 1.15, 1.322, 1.521, 1.749]) {
  console.log(`--- multiplier = ${mult.toFixed(3)} ---`);
  testFrontCapGeneration(frontTargetLen, capHeight, bicepWidth, mult);
}

console.log('\n💡 结论:');
console.log('如果multiplier增加但长度不变，说明outward太小或计算逻辑有问题');
