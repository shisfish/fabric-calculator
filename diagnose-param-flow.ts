// 诊断脚本：检查参数传递链路
const testInput = {
    chestWidth: 1,  // 用户输入1cm（极端测试）
    shoulderWidth: 1,
    bodyLength: 1,
    neckWidth: 1,
    armholeDepth: 1,
    sleeveLength: 1,
    cuffWidth: 1,
    shoulderSlope: 1
};

console.log('═══════════════════════════════════════');
console.log('🔍 参数传递诊断');
console.log('═══════════════════════════════════════');

console.log('\n【用户输入】(来自前端getGarmentInput):');
console.log(JSON.stringify(testInput, null, 2));

// 模拟_normalize_garment_input的处理（piece_generator.py）
console.log('\n【_normalize_garment_input处理后】:');
console.log('直接透传，没有转换结构');

// 模拟cad_runner.ts的调用
console.log('\n【cad_runner.ts接收到的garmentInput】:');
console.log(JSON.stringify(testInput, null, 2));

// 模拟GarmentMeasurementAdapter.adapt()的行为
import { GarmentMeasurementAdapter } from './patterns/GarmentMeasurementAdapter.js';

try {
    // 这就是问题所在！前端发送的是扁平化对象，但adapt期望嵌套结构
    const params = GarmentMeasurementAdapter.adapt(testInput as any);
    
    console.log('\n❌ adapt()处理结果（使用了错误的结构）:');
    console.log('frontPanel.width =', params.frontPanel.width);
    console.log('frontPanel.length =', params.frontPanel.length);
    console.log('frontPanel.neckWidth =', params.frontPanel.neckWidth);
    console.log('frontPanel.shoulderWidth =', params.frontPanel.shoulderWidth);
    
    if (params.frontPanel.width === 29.5) {  // DEFAULT_INPUT的半胸宽
        console.log('\n⚠️ 确认：使用的是硬编码默认值，不是用户输入！');
        console.log('原因：input对象缺少front/back/sleeve结构');
    }
} catch (error) {
    console.error('错误:', error.message);
}

// 正确的输入格式应该是：
const correctInputFormat = {
    garment: 'basic_tshirt',
    front: {
        chestWidth: testInput.chestWidth,
        bodyLength: testInput.bodyLength,
        shoulderWidth: testInput.shoulderWidth,
        neckWidth: testInput.neckWidth,
        neckDrop: testInput.neckWidth * 0.34,  // 估算
        armholeDepth: testInput.armholeDepth
    },
    back: {
        chestWidth: testInput.chestWidth,
        bodyLength: testInput.bodyLength,
        shoulderWidth: testInput.shoulderWidth,
        neckWidth: testInput.neckWidth,
        neckDrop: testInput.neckWidth * 0.1,   // 后领较浅
        armholeDepth: testInput.armholeDepth
    },
    sleeve: {
        sleeveLength: testInput.sleeveLength,
        bicepWidth: testInput.chestWidth * 0.38,
        cuffWidth: testInput.cuffWidth * 2,
        sleeveCapHeight: testInput.armholeDepth * 0.45
    }
};

console.log('\n\n【正确的输入格式】(adapt()期望的):');
console.log(JSON.stringify(correctInputFormat, null, 2));

const correctParams = GarmentMeasurementAdapter.adapt(correctInputFormat);

console.log('\n✅ 正确格式下的处理结果:');
console.log('frontPanel.width =', correctParams.frontPanel.width);  // 应该是 0.5 (1/2)
console.log('frontPanel.length =', correctParams.frontPanel.length);  // 应该是 0 (1-1)
console.log('frontPanel.neckWidth =', correctParams.frontPanel.neckWidth);  // 应该是 0.5 (1/2)

console.log('\n═══════════════════════════════════════');
console.log('🎯 问题定位完成');
console.log('═══════════════════════════════════════');
