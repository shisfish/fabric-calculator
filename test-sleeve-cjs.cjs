const { SleeveCapGenerator } = require('./dist/patterns/SleeveCapGenerator.js');
const { Point, Path } = require('./dist/geometry/index.js');

// 模拟前后袖窿曲线数据（基于工业T恤标准）
const frontArmholeOps = [
  { type: 'move', to: { x: 24, y: 3 } },      // shoulder点
  { type: 'curve', cp1: { x: 30, y: 8 }, cp2: { x: 27, y: 20 }, to: { x: 29, y: 26 } },  // 袖窿曲线
];

const backArmholeOps = [
  { type: 'move', to: { x: -24, y: 2.5 } },    // back shoulder点
  { type: 'curve', cp1: { x: -29.5, y: 7 }, cp2: { x: -27.5, y: 19 }, to: { x: -29, y: 26 } }, // 后袖窿曲线
];

// 标准T恤袖子参数
const sleeveParams = {
  bicepsWidth: 38,        // 袖肥 (cm)
  sleeveCapHeight: 15,     // 袖山高 (cm)
  sleeveLength: 60,       // 袖长 (cm)
  cuffWidth: 18           // 袖口宽 (cm)
};

const ease = 1.0;  // 缝份松量

console.log('\n🧪 ===== 工业级袖山求解器 v3.0 功能测试 =====\n');

try {
  const startTime = Date.now();
  
  // 生成袖山
  const result = SleeveCapGenerator.generateFromArmhole(
    frontArmholeOps,
    backArmholeOps,
    sleeveParams,
    ease
  );
  
  const endTime = Date.now();
  
  console.log('✅ 袖山生成成功！');
  console.log(`   ⏱️ 计算时间: ${endTime - startTime}ms`);
  
  // 验证结果完整性
  console.log('\n📊 结果验证:');
  console.log(`   capPath存在: ${!!result.capPath}`);
  console.log(`   path ops数量: ${result.capPath?.ops?.length || 0}`);
  console.log(`   points数量: ${Object.keys(result.points || {}).length}`);
  
  // 长度匹配验证
  console.log('\n📏 长度匹配验证:');
  console.log(`   前袖山长度: ${result.frontCapLength.toFixed(2)} cm`);
  console.log(`   前袖窿目标: ${result.frontArmholeLength.toFixed(2)} cm`);
  console.log(`   前袖误差: ${Math.abs(result.frontCapLength - result.frontArmholeLength).toFixed(2)} cm`);
  
  console.log(`   后袖山长度: ${result.backCapLength.toFixed(2)} cm`);
  console.log(`   后袖窿目标: ${result.backArmholeLength.toFixed(2)} cm`);
  console.log(`   后袖误差: ${Math.abs(result.backCapLength - result.backArmholeLength).toFixed(2)} cm`);
  
  console.log(`   总袖山长度: ${result.totalCapLength.toFixed(2)} cm`);
  console.log(`   总目标长度: ${(result.frontArmholeLength + result.backArmholeLength + ease).toFixed(2)} cm`);
  console.log(`   总误差: ${Math.abs(result.totalCapLength - (result.frontArmholeLength + result.backArmholeLength + ease)).toFixed(2)} cm`);
  
  // 工业标准验证
  const totalError = Math.abs(result.totalCapLength - (result.frontArmholeLength + result.backArmholeLength + ease));
  console.log('\n🏭 工业标准合规性:');
  if (totalError <= 1.0) {
    console.log('   ✅ 优秀：误差≤1cm（完全符合工业标准）');
  } else if (totalError <= 3.0) {
    console.log('   ⚠️ 良好：误差≤3cm（基本符合工业标准）');
  } else {
    console.error('   ❌ 不合格：误差超出工业标准范围');
  }
  
  // 关键点输出
  console.log('\n📍 关键点坐标:');
  for (const [name, point] of Object.entries(result.points)) {
    if (point instanceof Point) {
      console.debug(`   ${name}: (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
    }
  }
  
  // Path渲染验证
  console.info('\n🎨 Path渲染验证:');
  if (result.capPath && result.capPath.ops && result.capPath.ops.length >= 9) {
    console.info('   ✅ Path结构完整（≥9个操作）');
    
    // 检查path操作类型分布
    let moveCount = 0, lineCount = 0, curveCount = 0, closeCount = 0;
    for (const op of result.capPath.ops) {
      switch (op.type) {
        case 'move': moveCount++; break;
        case 'line': lineCount++; break;
        case 'curve': curveCount++; break;
        case 'close': closeCount++; break;
      }
    }
    console.info(`   操作统计: move=${moveCount}, line=${lineCount}, curve=${curveCount}, close=${closeCount}`);
    
    if (curveCount >= 4) {
      console.info('   ✅ Bezier曲线数量充足（≥4段）');
    } else {
      console.warn(`   ⚠️ Bezier曲线数量不足：${curveCount}段（期望≥4段）`);
    }
  } else {
    console.error('   ❌ Path结构不完整或不存在');
  }
  
  // 几何合法性验证
  console.info('\n🔍 几何合法性:');
  let allPointsValid = true;
  for (const [name, point] of Object.entries(result.points)) {
    if (point instanceof Point) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        console.error(`   ❌ ${name}: 坐标无效`);
        allPointsValid = false;
      }
      if (Math.abs(point.x) > 100 || Math.abs(point.y) > 200) {
        console.warn(`   ⚠️ ${name}: 坐标越界 (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
      }
    }
  }
  
  if (allPointsValid) {
    console.info('   ✅ 所有关键点坐标有效');
  }
  
  console.info('\n🎯 测试完成！');
  
} catch (error) {
  console.error('❌ 测试失败:', error);
  process.exit(1);
}
