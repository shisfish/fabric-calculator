// 临时脚本：使用新参数计算坐标
const W = 29.5;  // 胸宽（半胸围）
const L = 68;    // 衣长
const neckW = 12.5;  // 领宽（半领宽）
const neckD = neckW * 0.57;  // 领深（估算）
const shoulderW = 19.5;  // 肩长
const armholeD = 28;  // 袖窿深
const shoulderSlopeDeg = 5.5;  // 肩斜角

// 基础几何
const shoulderSlope = Math.tan(shoulderSlopeDeg * Math.PI / 180);
const shoulderDrop = shoulderSlope * shoulderW;

console.log('═══════════════════════════════════════');
console.log('📐 新参数计算结果');
console.log('═══════════════════════════════════════');
console.log(`\n基础参数:`);
console.log(`  W (胸宽) = ${W} cm`);
console.log(`  L (衣长) = ${L} cm`);
console.log(`  neckW (领宽) = ${neckW} cm`);
console.log(`  neckD (领深) = ${neckD.toFixed(2)} cm`);
console.log(`  shoulderW (肩长) = ${shoulderW} cm`);
console.log(`  armholeD (袖窿深) = ${armholeD} cm`);
console.log(`  shoulderSlope = ${shoulderSlopeDeg}°`);

console.log(`\n计算结果:`);
console.log(`  shoulderDrop = tan(${shoulderSlopeDeg}°) × ${shoulderW} = ${shoulderDrop.toFixed(2)} cm`);

// 关键点
const cfTop = { x: 0, y: 0 };
const neckPoint = { x: neckW, y: neckD };
const shoulderPoint = { x: shoulderW, y: shoulderDrop };
const armholeBottom = { x: W, y: armholeD };
const sideHem = { x: W, y: L };
const cfHem = { x: 0, y: L };

// 领口控制点
const neckCp = { x: neckW * 0.45, y: 0 };

// 袖窿跨度
const spanX = W - shoulderW;
const spanY = armholeD - shoulderDrop;

console.log(`\n袖窿跨度:`);
console.log(`  spanX = ${W} - ${shoulderW} = ${spanX.toFixed(2)} cm`);
console.log(`  spanY = ${armholeD} - ${shoulderDrop.toFixed(2)} = ${spanY.toFixed(2)} cm`);

// Pitch和Hollow
const pitch = {
  x: shoulderW + spanX * 0.32,
  y: shoulderDrop + spanY * 0.28
};
const hollow = {
  x: shoulderW + spanX * 0.72,
  y: shoulderDrop + spanY * 0.72
};

console.log(`\n关键点:`);
console.log(`  cfTop      = (${cfTop.x.toFixed(2)}, ${cfTop.y.toFixed(2)})`);
console.log(`  neckPoint  = (${neckPoint.x.toFixed(2)}, ${neckPoint.y.toFixed(2)})`);
console.log(`  shoulderPoint = (${shoulderPoint.x.toFixed(2)}, ${shoulderPoint.y.toFixed(2)})`);
console.log(`  pitch      = (${pitch.x.toFixed(2)}, ${pitch.y.toFixed(2)})`);
console.log(`  hollow     = (${hollow.x.toFixed(2)}, ${hollow.y.toFixed(2)})`);
console.log(`  armholeBottom = (${armholeBottom.x.toFixed(2)}, ${armholeBottom.y.toFixed(2)})`);
console.log(`  sideHem    = (${sideHem.x.toFixed(2)}, ${sideHem.y.toFixed(2)})`);
console.log(`  cfHem      = (${cfHem.x.toFixed(2)}, ${cfHem.y.toFixed(2)})`);

// 控制点
const cp1a = {
  x: shoulderW + spanX * 0.10,
  y: shoulderDrop + spanY * 0.02
};
const cp1b = {
  x: pitch.x - spanX * 0.12,
  y: pitch.y - spanY * 0.10
};
const cp2a = {
  x: pitch.x + spanX * 0.10,
  y: pitch.y + spanY * 0.12
};
const cp2b = {
  x: hollow.x - spanX * 0.12,
  y: hollow.y - spanY * 0.08
};
const cp3a = {
  x: hollow.x + spanX * 0.04,
  y: hollow.y + spanY * 0.10
};
const cp3b = {
  x: W - spanX * 0.06,
  y: armholeD - spanY * 0.04
};

const hemCp = {
  x: W * 0.50,
  y: L + 1.2
};

console.log(`\n控制点:`);
console.log(`  neckCp = (${neckCp.x.toFixed(2)}, ${neckCp.y.toFixed(2)})`);
console.log(`  cp1a   = (${cp1a.x.toFixed(2)}, ${cp1a.y.toFixed(2)})`);
console.log(`  cp1b   = (${cp1b.x.toFixed(2)}, ${cp1b.y.toFixed(2)})`);
console.log(`  cp2a   = (${cp2a.x.toFixed(2)}, ${cp2a.y.toFixed(2)})`);
console.log(`  cp2b   = (${cp2b.x.toFixed(2)}, ${cp2b.y.toFixed(2)})`);
console.log(`  cp3a   = (${cp3a.x.toFixed(2)}, ${cp3a.y.toFixed(2)})`);
console.log(`  cp3b   = (${cp3b.x.toFixed(2)}, ${cp3b.y.toFixed(2)})`);
console.log(`  hemCp  = (${hemCp.x.toFixed(2)}, ${hemCp.y.toFixed(2)})`);

console.log('\n═══════════════════════════════════════');