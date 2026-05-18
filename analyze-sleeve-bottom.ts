import { TshirtPatternGenerator } from './patterns/Tshirt.js';
import { GarmentMeasurementAdapter } from './patterns/GarmentMeasurementAdapter.js';

console.log('\n' + '='.repeat(100));
console.log('🔬 袖子下部分过大问题深度分析');
console.log('   目标：对比工业标准，找出袖口/侧缝异常原因');
console.log('='.repeat(100) + '\n');

const testParams = {
  category: 'tshirt' as const,
  frontPanel: {
    width: 29, length: 72,
    neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26,
    shoulderSlope: 5.5, armholePitchX: 0.15, hemExtension: 0
  },
  backPanel: {
    width: 29, length: 72,
    neckWidth: 9, neckDepth: 8,
    shoulderWidth: 24, armholeDepth: 26,
    shoulderSlope: 12, armholePitchX: 0.2, hemExtension: 0
  },
  sleeve: {
    bicepsWidth: 20,
    bicepWidth: 20,
    sleeveCapHeight: 14,
    sleeveLength: 58,
    cuffWidth: 18
  },
  seamAllowance: 1
};

const params = GarmentMeasurementAdapter.adapt(testParams);
const pieces = TshirtPatternGenerator.generatePattern(params);
const sleevePiece = pieces.find((p: any) => p.name === 'sleeve')!;

const pts = sleevePiece.points;

console.log('📐 第一步：当前袖子关键点位分析\n');

console.log('【袖山区域】(Y=0 到 Y=14cm)');
console.log(`   capTop:      (${pts.capTop.x.toFixed(1)}, ${pts.capTop.y.toFixed(1)})`);
console.log(`   frontAxilla: (${pts.frontAxilla.x.toFixed(1)}, ${pts.frontAxilla.y.toFixed(1)})`);
console.log(`   backAxilla:  (${pts.backAxilla.x.toFixed(1)}, ${pts.backAxilla.y.toFixed(1)})`);

const bicepWidth = pts.frontAxilla.x - pts.backAxilla.x;
console.log(`\n   腋下半围宽度: ${bicepWidth.toFixed(1)} cm (全围: ${(bicepWidth*2).toFixed(1)} cm)`);

console.log('\n【袖口区域】(Y=72cm)');
console.log(`   frontCuff: (${pts.frontCuff.x.toFixed(1)}, ${pts.frontCuff.y.toFixed(1)})`);
console.log(`   backCuff:  (${pts.backCuff.x.toFixed(1)}, ${pts.backCuff.y.toFixed(1)})`);

const cuffWidth = pts.frontCuff.x - pts.backCuff.x;
console.log(`\n   袖口半围宽度: ${cuffWidth.toFixed(1)} cm (全围: ${(cuffWidth*2).toFixed(1)} cm)`);

console.log('\n' + '-'.repeat(80));
console.log('📏 第二步：宽度变化率分析\n');

const heightDiff = pts.frontCuff.y - pts.frontAxilla.y;
const widthDiff = cuffWidth - bicepWidth;
const taperRatio = (widthDiff / heightDiff) * 100;

console.log(`袖身长度（腋下到袖口）: ${heightDiff.toFixed(1)} cm`);
console.log(`宽度变化量: ${widthDiff > 0 ? '+' : ''}${widthDiff.toFixed(1)} cm`);
console.log(`锥度比率: ${taperRatio.toFixed(2)}% (每cm长度变化${Math.abs(taperRatio).toFixed(2)}%宽度)`);

if (widthDiff > 0) {
  console.log(`\n⚠️ 问题确认：袖口比腋下宽 ${widthDiff.toFixed(1)} cm！`);
  console.log('   这导致袖子呈"外扩梯形"，不符合正常T恤袖型');
}

console.log('\n' + '-'.repeat(80));
console.log('🎯 第三步：工业标准T恤袖子对比\n');

console.log('【M号标准T恤袖子参考数据】');
console.log('');
console.log('部位          标准范围(cm)     当前值(cm)     状态');
console.log('-'.repeat(60));

// 工业标准数据（基于FreeSewing、Gerber等）
const standards = {
  bicepsHalf: { min: 17, max: 21, current: bicepWidth/2, name: '腋下半围' },
  cuffHalf: { min: 15, max: 18, current: cuffWidth/2, name: '袖口半围' },
  sleeveLength: { min: 55, max: 62, current: pts.frontCuff.y - pts.capTop.y, name: '袖长' },
  capHeight: { min: 12, max: 16, current: pts.frontAxilla.y - pts.capTop.y, name: '袖山高' }
};

for (const [key, std] of Object.entries(standards)) {
  const status = std.current >= std.min && std.current <= std.max ? '✅' : 
                 std.current < std.min ? '⚠️偏小' : '❌偏大';
  console.log(`${std.name.padEnd(12)} ${std.min.toString().padStart(4)}-${std.max.toString().padEnd(4)}       ${std.current.toFixed(1).padStart(6)}       ${status}`);
}

console.log('\n【关键比例关系】');
console.log('');

// 袖口/腋下比例
const cuffToBicepRatio = (cuffWidth / bicepWidth) * 100;
console.log(`1. 袖口/腋下宽度比: ${(cuffToBicepRatio).toFixed(1)}%`);
console.log(`   工业标准: 75-90% (袖口应略小于或接近腋下)`);
console.log(`   状态: ${cuffToBicepRatio <= 90 ? '✅ 正常' : '❌ 异常（袖口过宽）'}`);

// 袖长/腋宽比例
const lenToWidthRatio = (heightDiff / bicepWidth);
console.log(`\n2. 袖身长宽比: ${lenToWidthRatio.toFixed(2)}`);
console.log(`   工业标准: 2.5-3.5 (修身的较长，宽松的较短)`);
console.log(`   状态: ${lenToWidthRatio >= 2.5 && lenToWidthRatio <= 3.5 ? '✅ 正常' : '⚠️ 需要调整'}`);

console.log('\n' + '-'.repeat(80));
console.log('🔍 第四步：侧缝倾斜角度分析\n');

// 计算前侧缝和后侧缝的角度
const frontSideAngle = Math.atan2(
  pts.frontCuff.x - pts.frontAxilla.x,
  pts.frontCuff.y - pts.frontAxilla.y
) * 180 / Math.PI;

const backSideAngle = Math.atan2(
  pts.backCuff.x - pts.backAxilla.x,
  pts.backCuff.y - pts.backAxilla.y
) * 180 / Math.PI;

console.log(`前侧缝角度: ${frontSideAngle.toFixed(1)}° (相对垂直线)`);
console.log(`后侧缝角度: ${backSideAngle.toFixed(1)}° (相对垂直线)`);

console.log('\n工业标准:');
console.log('   前侧缝: 0-5° (略微内收或垂直)');
console.log('   后侧缝: 0-3° (几乎垂直)');

console.log(`\n状态:`);
console.log(`   前侧缝: ${frontSideAngle >= 0 && frontSideAngle <= 5 ? '✅ 正常' : `❌ 异常(${frontSideAngle > 0 ? '外扩' : '过度内收'})`}`);
console.log(`   后侧缝: ${backSideAngle >= -3 && backSideAngle <= 3 ? '✅ 正常' : `❌ 异常(${backSideAngle > 3 ? '外扩' : '过度内收'})`}`);

if (frontSideAngle > 5 || backSideAngle > 3) {
  console.log('\n⚠️ 问题定位：侧缝向外倾斜，导致袖口扩大！');
}

console.log('\n' + '-'.repeat(80));
console.log('💡 第五步：问题根源假设验证\n');

console.log('【可能的原因】');
console.log('');

console.log('假设A: 用户输入的cuffWidth参数过大？');
console.log(`   用户输入: ${testParams.sleeve.cuffWidth} cm (应该是半围还是全围？)`);
console.log(`   实际生成: ${cuffWidth.toFixed(1)} cm (半围) → 全围 ${(cuffWidth*2).toFixed(1)} cm`);
console.log('');

console.log('假设B: 袖子生成算法中cuffWidth使用错误？');
console.log(`   检查代码中是否将cuffWidth当作全围处理...`);

console.log('\n假设C: 袖侧缝计算逻辑有问题？');
console.log(`   当前: frontCuff.x = ${pts.frontCuff.x}, backCuff.x = ${pts.backCuff.x}`);
console.log(`   预期: 应该基于cuffWidth=${testParams.sleeve.cuffWidth}计算`);

console.log('\n' + '-'.repeat(80));
console.log('📊 第六步：可视化尺寸标注\n');

console.log('┌─────────────────────────────┐');
console.log(`│  袖子轮廓图 (单位: cm)        │`);
console.log('│                             │');
console.log(`│     capTop (0, 0)            │`);
console.log(`│        ●                     │`);
console.log(`│       ╱ ╲                    │`);
console.log(`│      ╱   ╲                   │`);
console.log(`│  BA●───────●FA               │`);
console.log(`│   │       │                  │`);
console.log(`│   │       │  ${heightDiff.toFixed(0)}cm           │`);
console.log(`│   │       │                  │`);
console.log(`│  BC●───────●FC               │`);
console.log(`│                             │`);
console.log(`└─────────────────────────────┘`);
console.log('');
console.log(`BA = Back Axilla  (${pts.backAxilla.x.toFixed(1)}, ${pts.backAxilla.y.toFixed(1)})`);
console.log(`FA = Front Axilla (${pts.frontAxilla.x.toFixed(1)}, ${pts.frontAxilla.y.toFixed(1)})`);
console.log(`BC = Back Cuff   (${pts.backCuff.x.toFixed(1)}, ${pts.backCuff.y.toFixed(1)})`);
console.log(`FC = Front Cuff  (${pts.frontCuff.x.toFixed(1)}, ${pts.frontCuff.y.toFixed(1)})`);
console.log('');
console.log(`腋下宽度: ${bicepWidth.toFixed(1)} cm`);
console.log(`袖口宽度: ${cuffWidth.toFixed(1)} cm`);
console.log(`差异: ${widthDiff > 0 ? '+' : ''}${widthDiff.toFixed(1)} cm (${((cuffWidth/bicepWidth-1)*100).toFixed(1)}%)`);

console.log('\n' + '='.repeat(100));
console.log('🎯 诊断结论\n');

let issues = [];
let suggestions = [];

if (cuffWidth > bicepWidth) {
  issues.push(`❌ 袖口(${cuffWidth.toFixed(1)}cm) > 腋下(${bicepWidth.toFixed(1)}cm)，呈倒梯形`);
  suggestions.push('1. 检查cuffWidth是否被误用为全围而非半围');
}

if (frontSideAngle > 5) {
  issues.push(`❌ 前侧缝外扩角度过大(${frontSideAngle.toFixed(1)}°)`);
  suggestions.push('2. 调整frontCuff.x坐标，使其≤frontAxilla.x');
}

if (backSideAngle < -5) {
  issues.push(`❌ 后侧缝内收角度过大(${Math.abs(backSideAngle).toFixed(1)}°)`);
  suggestions.push('3. 调整backCuff.x坐标，使其≥backAxilla.x');
}

if (issues.length === 0) {
  console.log('✅ 未发现明显问题，袖子比例基本正常');
} else {
  console.log('发现以下问题:\n');
  for (const issue of issues) {
    console.log(`  ${issue}`);
  }
  
  console.log('\n建议修改方向:\n');
  for (const sug of suggestions) {
    console.log(`  ${sug}`);
  }
}

console.log('\n💡 最可能的根本原因:');
console.log('   在SleeveCapGenerator.generateSleeveCap()中，');
console.log('   cuffWidth参数可能被当作"全围"直接使用，');
console.log('   导致实际袖口宽度 = 用户输入值 × 2（或类似错误）');
console.log('');
console.log('   或者：袖侧缝端点的X坐标计算公式有误，');
console.log('   没有正确基于cuffWidth限制袖口宽度');

console.log('\n' + '='.repeat(100) + '\n');