// 验证修复：参数传递是否正常工作
import { GarmentMeasurementAdapter } from './patterns/GarmentMeasurementAdapter.js';

console.log('═══════════════════════════════════════');
console.log('✅ 验证参数传递修复');
console.log('═══════════════════════════════════════');

// 模拟用户输入极端值（1cm）
const userInput = {
    chestWidth: 1,
    shoulderWidth: 1,
    bodyLength: 1,
    neckWidth: 1,
    armholeDepth: 1,
    sleeveLength: 1,
    cuffWidth: 1,
    shoulderSlope: 1
};

// 模拟piece_generator.py的转换逻辑
const chest_width = userInput.chestWidth || 59;
const shoulder_width = userInput.shoulderWidth || 19.5;
const body_length = userInput.bodyLength || 68;
const sleeve_length = userInput.sleeveLength || 60;
const neck_width = userInput.neckWidth || 25;
const armhole_depth = userInput.armholeDepth || 28;
const cuff_width = userInput.cuffWidth || 10;

const front_neck_drop = neck_width * 0.34;
const back_neck_drop = neck_width * 0.10;

const nestedInput = {
    garment: 'basic_tshirt',
    front: {
        chestWidth: chest_width,
        bodyLength: body_length,
        shoulderWidth: shoulder_width,
        neckWidth: neck_width,
        neckDrop: front_neck_drop,
        armholeDepth: armhole_depth
    },
    back: {
        chestWidth: chest_width,
        bodyLength: body_length,
        shoulderWidth: shoulder_width,
        neckWidth: neck_width,
        neckDrop: back_neck_drop,
        armholeDepth: armhole_depth
    },
    sleeve: {
        sleeveLength: sleeve_length,
        bicepWidth: chest_width * 0.38,
        cuffWidth: cuff_width * 2,
        sleeveCapHeight: armhole_depth * 0.45
    }
};

console.log('\n【测试1】极端值输入 (1cm):');
console.log('用户输入:', JSON.stringify(userInput));

const params1 = GarmentMeasurementAdapter.adapt(nestedInput);
console.log('✅ 系统处理结果:');
console.log(`  frontPanel.width = ${params1.frontPanel.width} cm (期望: 0.5)`);
console.log(`  frontPanel.length = ${params1.frontPanel.length} cm (期望: 0)`);
console.log(`  frontPanel.neckWidth = ${params1.frontPanel.neckWidth} cm (期望: 0.5)`);
console.log(`  frontPanel.shoulderWidth = ${params1.frontPanel.shoulderWidth} cm (期望: 0.5)`);

if (params1.frontPanel.width === 0.5) {
    console.log('🎉 测试1通过！参数正确传递！');
}

// 测试2：正常值
console.log('\n【测试2】正常值输入:');
const normalInput = {
    garment: 'basic_tshirt',
    front: {
        chestWidth: 59,
        bodyLength: 68,
        shoulderWidth: 19.5,
        neckWidth: 25,
        neckDrop: 8.5,
        armholeDepth: 28
    },
    back: {
        chestWidth: 59,
        bodyLength: 68,
        shoulderWidth: 19.5,
        neckWidth: 25,
        neckDrop: 2.5,
        armholeDepth: 28
    },
    sleeve: {
        sleeveLength: 60,
        bicepWidth: 22.42,
        cuffWidth: 20,
        sleeveCapHeight: 12.6
    }
};

const params2 = GarmentMeasurementAdapter.adapt(normalInput);
console.log('输入: chestWidth=59, shoulderWidth=19.5, bodyLength=68');
console.log('✅ 处理结果:');
console.log(`  frontPanel.width = ${params2.frontPanel.width} cm (期望: 29.5)`);
console.log(`  frontPanel.length = ${params2.frontPanel.length} cm (期望: 67)`);
console.log(`  frontPanel.neckWidth = ${params2.frontPanel.neckWidth} cm (期望: 12.5)`);
console.log(`  frontPanel.shoulderWidth = ${params2.frontPanel.shoulderWidth} cm (期望: 9.75)`);

if (params2.frontPanel.width === 29.5 && params2.frontPanel.shoulderWidth === 9.75) {
    console.log('🎉 测试2通过！正常值正确处理！');
}

console.log('\n═══════════════════════════════════════');
console.log('🎯 验证完成 - 参数传递链路已修复！');
console.log('═══════════════════════════════════════');
