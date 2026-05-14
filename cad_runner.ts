import { TshirtPatternGenerator, GarmentMeasurementAdapter, FrontPatternGenerator, type GarmentParams, type FrontPatternParams } from './patterns/index.js';
import { NestEngine } from './nesting/index.js';
import { logger } from './utils/CADLogger.js';

logger.info('CAD引擎启动');

const input = JSON.parse(process.argv[2]);

logger.debug('输入参数:', JSON.stringify(input).substring(0, 200));

let params: GarmentParams;

if (input.garmentInput) {
  params = GarmentMeasurementAdapter.adapt(input.garmentInput);
} else if (input.measurements) {
  params = GarmentMeasurementAdapter.fromLegacyMeasurements(input.measurements);
} else {
  params = GarmentMeasurementAdapter.adapt();
}

if (input.garmentParams) {
  params = { ...params, ...input.garmentParams };
}

let pieces: any[];

if (input.frontOnly && input.frontParams) {
  const frontPath = FrontPatternGenerator.generate(input.frontParams as FrontPatternParams);
  pieces = [{
    name: 'front',
    path: frontPath,
    points: {},
    cutCount: 1,
    onFold: false,
    seamAllowance: 0
  }];
} else {
  pieces = TshirtPatternGenerator.generatePattern(params);
}

// 🔍 【关键验证】检查TshirtPatternGenerator返回的原始pieces
logger.debug('\n🔍 ===== TshirtPatternGenerator 原始输出验证 =====');
logger.debug(`   原始pieces数量: ${pieces.length}`);
logger.debug(`   pieces名称及cutCount:`);
for (let i = 0; i < pieces.length; i++) {
  const p = pieces[i];
  logger.debug(`     [${i}] ${p.name}: cutCount=${p.cutCount}, pathOps数量=${p.path?.ops?.length || 0}`);
}
if (pieces.length < 3) {
  logger.error(`   ❌ 原始pieces数量不足3！期望: [back, front, sleeve], 实际: ${pieces.map(p => p.name)}`);
} else {
  logger.info(`   ✅ 原始pieces包含${pieces.length}个裁片（含sleeve）`);
}
logger.debug('=============================================\n');

const fabricWidth = input.fabricWidth || 145;

if (input.mode === 'preview') {
    const result = pieces.map((piece: any) => ({
        name: piece.name,
        points: Object.entries(piece.points || {}).map(([key, p]: [string, any]) => ({
            key,
            x: p.x,
            y: p.y
        })),
        pathOps: (piece.path?.ops || []).map((op: any) => ({
            type: op.type,
            to: op.to ? { x: op.to.x, y: op.to.y } : null,
            cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
            cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
        })),
        seamAllowance: piece.seamAllowance || 0,
        seamAllowancePathOps: (piece.seamAllowancePath?.ops || []).map((op: any) => ({
            type: op.type,
            to: op.to ? { x: op.to.x, y: op.to.y } : null,
            cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
            cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
        })),
        cutCount: piece.cutCount,
        onFold: piece.onFold
    }));

    logger.info(`Preview模式: 生成${result.length}个裁片`);
    console.log(JSON.stringify(result)); // 唯一的stdout输出点 - API响应
} else {
    const engine = new NestEngine({ fabricWidth });

    for (const piece of pieces) {
        engine.addPiece(piece);
    }

    const result = engine.nest();
    const placedPolygons = engine.getPlacedPolygons();

    const piecePathMap = new Map<string, any>();
    for (const piece of pieces) {
        piecePathMap.set(piece.name, (piece.path?.ops || []).map((op: any) => ({
            type: op.type,
            to: op.to ? { x: op.to.x, y: op.to.y } : null,
            cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
            cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
        })));
    }

    const piecesData = placedPolygons.map(pp => {
        const bbox = pp.polygon.translate(pp.x, pp.y).getBoundingBox();
        const name = pp.id.replace(/_\d+$/, '');
        return {
            name,
            x: pp.x,
            y: pp.y,
            width: bbox.width,
            height: bbox.height,
            area: pp.polygon.getArea(),
            cutCount: 1,
            onFold: false,
            rotation: pp.rotation,
            pathOps: piecePathMap.get(name) || []
        };
    });

    logger.info(`Nesting模式: 排料完成，${piecesData.length}个pieces, 利用率${result.utilization?.toFixed(1)}%`);
    
    // 🔍 【调试日志】最终返回数据完整性检查
    logger.debug('\n🔍 ===== 最终API返回数据检查 =====');
    logger.debug(`   piecesData数量: ${piecesData.length}`);
    logger.debug(`   pieces名称列表:`);
    for (let i = 0; i < piecesData.length; i++) {
        const piece = piecesData[i];
        logger.debug(`     [${i}] ${piece.name}:`);
        logger.debug(`         x: ${piece.x}, y: ${piece.y}`);
        logger.debug(`         width: ${piece.width?.toFixed(2)}, height: ${piece.height?.toFixed(2)}`);
        logger.debug(`         area: ${piece.area?.toFixed(2)}`);
        logger.debug(`         pathOps数量: ${piece.pathOps?.length || 0}`);
        
        // 检查sleeve的pathOps详情
        if (piece.name === 'sleeve') {
            logger.debug(`         🎯 SLEEVE 详细信息:`);
            if (piece.pathOps && piece.pathOps.length > 0) {
                logger.debug(`           pathOps类型:`);
                for (let j = 0; j < Math.min(piece.pathOps.length, 10); j++) {
                    const op = piece.pathOps[j];
                    if (op.type === 'move' || op.type === 'line') {
                        logger.debug(`             [${j}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)})`);
                    } else if (op.type === 'curve' || op.type === 'quad') {
                        logger.debug(`             [${j}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)}) [cp1:(${op.cp1?.x?.toFixed(2)},${op.cp1?.y?.toFixed(2)})]`);
                    } else {
                        logger.debug(`             [${j}] ${op.type}`);
                    }
                }
            } else {
                logger.error(`           ❌ pathOps为空或不存在！`);
            }
            
            // 检查几何尺寸是否合理
            if (!piece.width || !piece.height || piece.width < 1 || piece.height < 1) {
                logger.error(`           ❌ 几何尺寸异常！width=${piece.width}, height=${piece.height}`);
            } else {
                logger.info(`           ✅ 几何尺寸正常: ${piece.width.toFixed(1)} x ${piece.height.toFixed(1)} cm`);
            }
        }
    }
    
    // 统计sleeve数量
    const sleeveCount = piecesData.filter(p => p.name === 'sleeve').length;
    logger.debug(`\n📊 袖子统计:`);
    logger.debug(`   sleeve数量: ${sleeveCount}`);
    if (sleeveCount === 0) {
        logger.error(`   ❌ 没有找到sleeve pieces！`);
    } else if (sleeveCount === 2) {
        logger.info(`   ✅ 找到2个sleeve（正确）`);
    } else {
        logger.warn(`   ⚠️ 找到${sleeveCount}个sleeve（期望2个）`);
    }
    
    logger.debug('=========================================\n');
    
    console.log(JSON.stringify({ // 唯一的stdout输出点 - API响应
        pieces: piecesData,
        positions: result.positions.map(p => ({
            name: p.pieceId.replace(/_\d+$/, ''),
            x: p.x,
            y: p.y,
            rotation: p.rotation
        })),
        utilization: result.utilization,
        bounds: {
            width: result.bounds.width,
            height: result.bounds.height
        },
        totalArea: result.totalArea,
        usedArea: result.usedArea
    }));
}
