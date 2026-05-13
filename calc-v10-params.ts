// 临时脚本：基于最新Tshirt.ts逻辑计算v10参数
const W = 29.5;  // 胸宽（半胸围）
const L = 68;    // 衣长
const neckW = 12.5;  // 领宽（半领宽）
const neckD = neckW * 0.57;  // 领深（估算）
const shoulderW = 19.5;  // 肩长
const armholeD = 28;  // 袖窿深
const shoulderSlopeDeg = 5.5;  // 肩斜角

console.log('═══════════════════════════════════════');
console.log('📐 Tshirt.ts v10 参数计算');
console.log('═══════════════════════════════════════');

// 基础几何
const shoulderSlopeRad = (shoulderSlopeDeg * Math.PI) / 180;
const shoulderDrop = Math.tan(shoulderSlopeRad) * shoulderW;

console.log(`\n基础参数:`);
console.log(`  W (胸宽) = ${W} cm`);
console.log(`  L (衣长) = ${L} cm`);
console.log(`  neckW (领宽) = ${neckW} cm`);
console.log(`  neckD (领深) = ${neckD.toFixed(2)} cm`);
console.log(`  shoulderW (肩长) = ${shoulderW} cm`);
console.log(`  armholeD (袖窿深) = ${armholeD} cm`);
console.log(`  shoulderSlope = ${shoulderSlopeDeg}°`);

console.log(`\n计算结果:`);
console.log(`  shoulderDrop = tan(${shoulderSlopeDeg}°) × ${shoulderW} = ${shoulderDrop.toFixed(4)} cm`);

// 关键点计算（基于Tshirt.ts generateFrontPanel）
const cfNeck = { x: 0, y: neckD };
const neckEnd = { x: neckW, y: 0 };
const neckCp = { x: neckW * 0.42, y: neckD };
const shoulder = { x: shoulderW, y: shoulderDrop };
const armholeEnd = { x: W, y: armholeD };
const sideBottom = { x: W, y: L };
const hemFold = { x: 0, y: L };
const hemCp = { x: W * 0.48, y: L + 1 };

console.log(`\n关键点:`);
console.log(`  cfNeck     = (${cfNeck.x.toFixed(2)}, ${cfNeck.y.toFixed(2)})`);
console.log(`  neckEnd    = (${neckEnd.x.toFixed(2)}, ${neckEnd.y.toFixed(2)})`);
console.log(`  neckCp     = (${neckCp.x.toFixed(2)}, ${neckCp.y.toFixed(2)})`);
console.log(`  shoulder   = (${shoulder.x.toFixed(2)}, ${shoulder.y.toFixed(2)})`);
console.log(`  armholeEnd = (${armholeEnd.x.toFixed(2)}, ${armholeEnd.y.toFixed(2)})`);
console.log(`  sideBottom = (${sideBottom.x.toFixed(2)}, ${sideBottom.y.toFixed(2)})`);
console.log(`  hemFold    = (${hemFold.x.toFixed(2)}, ${hemFold.y.toFixed(2)})`);
console.log(`  hemCp      = (${hemCp.x.toFixed(2)}, ${hemCp.y.toFixed(2)})`);

// 袖窿核心计算
const armholeW = W - shoulderW;
const armholeH = armholeD - shoulderDrop;

console.log(`\n袖窿跨度:`);
console.log(`  armholeW = ${W} - ${shoulderW} = ${armholeW.toFixed(2)} cm`);
console.log(`  armholeH = ${armholeD} - ${shoulderDrop.toFixed(4)} = ${armholeH.toFixed(4)} cm`);

// Pitch点
const armholePitch = {
  x: shoulderW + armholeW * 0.15,
  y: shoulderDrop + armholeH * 0.35
};

console.log(`\nPitch点 (袖窿最大外鼓点):`);
console.log(`  x = ${shoulderW} + ${armholeW.toFixed(2)} × 0.15 = ${armholePitch.x.toFixed(4)} cm`);
console.log(`  y = ${shoulderDrop.toFixed(4)} + ${armholeH.toFixed(4)} × 0.35 = ${armholePitch.y.toFixed(4)} cm`);
console.log(`  armholePitch = (${armholePitch.x.toFixed(2)}, ${armholePitch.y.toFixed(2)})`);

// 第一段曲线控制点：Shoulder -> Pitch
const armholeTopCp1 = {
  x: shoulder.x + armholeW * 0.05,
  y: shoulder.y + armholeH * 0.15
};
const armholeTopCp2 = {
  x: armholePitch.x - armholeW * 0.1,
  y: armholePitch.y - armholeH * 0.15
};

console.log(`\n第一段曲线控制点 (Shoulder → Pitch):`);
console.log(`  armholeTopCp1 = (${armholeTopCp1.x.toFixed(2)}, ${armholeTopCp1.y.toFixed(2)})`);
console.log(`  armholeTopCp2 = (${armholeTopCp2.x.toFixed(2)}, ${armholeTopCp2.y.toFixed(2)})`);

// 第二段曲线控制点：Pitch -> ArmholeEnd
const tangentX = armholePitch.x - armholeTopCp2.x;
const tangentY = armholePitch.y - armholeTopCp2.y;
const armholeBottomCp1 = {
  x: armholePitch.x + tangentX * 1.5,
  y: armholePitch.y + tangentY * 1.5
};
const armholeBottomCp2 = {
  x: armholeEnd.x - armholeW * 0.45,
  y: armholeEnd.y
};

console.log(`\n第二段曲线控制点 (Pitch → ArmholeEnd):`);
console.log(`  tangentX = ${armholePitch.x.toFixed(2)} - ${armholeTopCp2.x.toFixed(2)} = ${tangentX.toFixed(4)}`);
console.log(`  tangentY = ${armholePitch.y.toFixed(2)} - ${armholeTopCp2.y.toFixed(2)} = ${tangentY.toFixed(4)}`);
console.log(`  armholeBottomCp1 = (${armholeBottomCp1.x.toFixed(2)}, ${armholeBottomCp1.y.toFixed(2)})`);
console.log(`  armholeBottomCp2 = (${armholeBottomCp2.x.toFixed(2)}, ${armholeBottomCp2.y.toFixed(2)})`);

// 输出最终结果
console.log('\n═══════════════════════════════════════');
console.log('✅ v10 完整Path操作数组:');
console.log('═══════════════════════════════════════');

const ops = [
  { type: 'move', to: cfNeck },
  { type: 'quad', cp1: neckCp, to: neckEnd },
  { type: 'line', to: shoulder },
  { type: 'curve', cp1: armholeTopCp1, cp2: armholeTopCp2, to: armholePitch },
  { type: 'curve', cp1: armholeBottomCp1, cp2: armholeBottomCp2, to: armholeEnd },
  { type: 'line', to: sideBottom },
  { type: 'quad', cp1: hemCp, to: hemFold },
  { type: 'close' }
];

ops.forEach((op, i) => {
  console.log(`\n[${i}] ${op.type.toUpperCase()}:`);
  if (op.to) console.log(`  to: (${op.to.x.toFixed(2)}, ${op.to.y.toFixed(2)})`);
  if (op.cp1) console.log(`  cp1: (${op.cp1.x.toFixed(2)}, ${op.cp1.y.toFixed(2)})`);
  if (op.cp2) console.log(`  cp2: (${op.cp2.x.toFixed(2)}, ${op.cp2.y.toFixed(2)})`);
});

console.log('\n═══════════════════════════════════════');
console.log('🎯 拓扑结构: M Q L C C L Q Z (2段袖窿)');
console.log('═══════════════════════════════════════');
