import { TshirtPatternGenerator, GarmentMeasurementAdapter, FrontPatternGenerator, type GarmentParams, type FrontPatternParams } from './patterns/index.js';
import { NestEngine } from './nesting/index.js';
import { logger } from './utils/CADLogger.js';
import { Point, Path } from './geometry/index.js';

logger.info('CAD引擎启动');

/**
 * 🔧 【工业标准】对称展开 onFold 裁片
 * 
 * 将半片裁片（如后片）沿折叠线镜像，生成完整裁片
 * 用于排料时的真实形状显示
 */
function expandOnFoldPiece(
  pathOps: Array<any>,
  seamAllowancePathOps: Array<any>,
  foldAxis: 'y' | 'x' = 'y'
): { pathOps: Array<any>, seamAllowancePathOps: Array<any>, width: number } {
  if (!pathOps || pathOps.length === 0) {
    return { pathOps: [], seamAllowancePathOps: [], width: 0 };
  }
  
  // 定义折叠线（Y轴：x=0）
  const lineStart = new Point(0, 0);
  const lineEnd = foldAxis === 'y' ? new Point(0, 1) : new Point(1, 0);
  
  // 镜像路径操作
  const mirroredOps = pathOps.map(op => {
    const mirroredOp: any = { 
      type: op.type,
      segmentName: op.segmentName,
      segmentType: op.segmentType
    };
    
    if (op.to) {
      const toPoint = new Point(op.to.x, op.to.y);
      mirroredOp.to = toPoint.mirror(lineStart, lineEnd);
    }
    if (op.cp1) {
      const cp1Point = new Point(op.cp1.x, op.cp1.y);
      mirroredOp.cp1 = cp1Point.mirror(lineStart, lineEnd);
    }
    if (op.cp2) {
      const cp2Point = new Point(op.cp2.x, op.cp2.y);
      mirroredOp.cp2 = cp2Point.mirror(lineStart, lineEnd);
    }
    
    return mirroredOp;
  });
  
  // 镜像缝份路径
  const mirroredSeamOps = seamAllowancePathOps.map(op => {
    const mirroredOp: any = { type: op.type };
    
    if (op.to) {
      const toPoint = new Point(op.to.x, op.to.y);
      mirroredOp.to = toPoint.mirror(lineStart, lineEnd);
    }
    if (op.cp1) {
      const cp1Point = new Point(op.cp1.x, op.cp1.y);
      mirroredOp.cp1 = cp1Point.mirror(lineStart, lineEnd);
    }
    if (op.cp2) {
      const cp2Point = new Point(op.cp2.x, op.cp2.y);
      mirroredOp.cp2 = cp2Point.mirror(lineStart, lineEnd);
    }
    
    return mirroredOp;
  });
  
  // 计算展开后的总宽度
  let maxX = 0;
  [...pathOps, ...mirroredOps].forEach(op => {
    if (op.to && op.to.x > maxX) maxX = op.to.x;
  });
  
  logger.info(`   🔄 对称展开: ${pathOps.length} ops → ${pathOps.length + mirroredOps.length} ops (宽度: ${maxX.toFixed(1)}cm)`);
  
  return {
    pathOps: [...pathOps, ...mirroredOps],
    seamAllowancePathOps: [...seamAllowancePathOps, ...mirroredSeamOps],
    width: maxX
  };
}

const input = JSON.parse(process.argv[2]);

logger.debug('输入参数:', JSON.stringify(input).substring(0, 200));

// 🔍 [参数追踪] 打印原始输入中的袖子参数
if (input.garmentInput) {
  logger.info('\n🔍 [CAD-RUNNER] 原始输入 garmentInput:');
  if (input.garmentInput.sleeve) {
    logger.info(`   sleeve.cuffWidth: ${input.garmentInput.sleeve.cuffWidth}`);
    logger.info(`   sleeve.bicepWidth: ${input.garmentInput.sleeve.bicepWidth}`);
    logger.info(`   sleeve.sleeveLength: ${input.garmentInput.sleeve.sleeveLength}`);
    logger.info(`   sleeve.sleeveCapHeight: ${input.garmentInput.sleeve.sleeveCapHeight}`);
  } else if (input.garmentInput.cuffWidth !== undefined) {
    logger.info(`   扁平格式 cuffWidth: ${input.garmentInput.cuffWidth}`);
  }
}

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
        seamAllowancePathOps: (piece.seamAllowancePath?.ops || [])
            .map((op: any) => ({
                type: op.type,
                to: (op.to && typeof op.to.x === 'number' && typeof op.to.y === 'number' && Number.isFinite(op.to.x) && Number.isFinite(op.to.y)) 
                    ? { x: op.to.x, y: op.to.y } 
                    : null,
                cp1: (op.cp1 && typeof op.cp1.x === 'number' && typeof op.cp1.y === 'number' && Number.isFinite(op.cp1.x) && Number.isFinite(op.cp1.y)) 
                    ? { x: op.cp1.x, y: op.cp1.y } 
                    : null,
                cp2: (op.cp2 && typeof op.cp2.x === 'number' && typeof op.cp2.y === 'number' && Number.isFinite(op.cp2.x) && Number.isFinite(op.cp2.y)) 
                    ? { x: op.cp2.x, y: op.cp2.y } 
                    : null
            }))
            // 🔧 【工业标准】过滤掉无效操作（to 为 null 的操作）
            .filter((op: any) => op.to !== null),
        cutCount: piece.cutCount,
        onFold: piece.onFold
    }));

    logger.info(`Preview模式: 生成${result.length}个裁片`);
    
    // 🔍 【缝份调试】检查每个裁片的seamAllowance值
    for (let i = 0; i < result.length; i++) {
        const p = result[i];
        logger.info(`   [${i}] ${p.name}: seamAllowance=${p.seamAllowance}, seamAllowancePathOps数量=${p.seamAllowancePathOps?.length || 0}`);
        if (p.seamAllowancePathOps && p.seamAllowancePathOps.length > 0) {
            logger.info(`       ✅ 缝份路径已生成 (${p.seamAllowancePathOps.length} 个操作)`);
        } else {
            logger.error(`       ❌ 缝份路径为空！params.seamAllowance=${params.seamAllowance}`);
        }
    }
    
    console.log(JSON.stringify(result)); // 唯一的stdout输出点 - API响应
} else {
    const engine = new NestEngine({ fabricWidth });

    for (const piece of pieces) {
        engine.addPiece(piece);
    }

    const result = engine.nest();
    const placedPolygons = engine.getPlacedPolygons();

    // 🔧 【关键修复】构建完整的pathOps映射
    const piecePathMap = new Map<string, any>();
    const pieceOriginalData = new Map<string, any>();  // 保存原始piece数据
    
    for (const piece of pieces) {
        const pathOps = (piece.path?.ops || []).map((op: any) => ({
            type: op.type,
            to: op.to ? { x: op.to.x, y: op.to.y } : null,
            cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
            cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
        }));
        
        piecePathMap.set(piece.name, pathOps);
        
        // 保存原始数据用于未排料时的fallback（包含缝份数据）
        pieceOriginalData.set(piece.name, {
            cutCount: piece.cutCount || 1,
            onFold: piece.onFold || false,
            seamAllowance: piece.seamAllowance || 0,
            seamAllowancePathOps: (piece.seamAllowancePath?.ops || [])
                .map((op: any) => ({
                    type: op.type,
                    to: (op.to && typeof op.to.x === 'number' && typeof op.to.y === 'number' && Number.isFinite(op.to.x) && Number.isFinite(op.to.y)) 
                        ? { x: op.to.x, y: op.to.y } 
                        : null,
                    cp1: (op.cp1 && typeof op.cp1.x === 'number' && typeof op.cp1.y === 'number' && Number.isFinite(op.cp1.x) && Number.isFinite(op.cp1.y)) 
                        ? { x: op.cp1.x, y: op.cp1.y } 
                        : null,
                    cp2: (op.cp2 && typeof op.cp2.x === 'number' && typeof op.cp2.y === 'number' && Number.isFinite(op.cp2.x) && Number.isFinite(op.cp2.y)) 
                        ? { x: op.cp2.x, y: op.cp2.y } 
                        : null
                }))
                .filter((op: any) => op.to !== null),
            points: piece.points || {}
        });
    }

    // 🔧 【关键修复】为每个原始piece生成数据（包括未排料的）
    const piecesData: any[] = [];
    
    for (const piece of pieces) {
        // 查找该piece的所有已放置实例
        const placedInstances = placedPolygons.filter(pp => 
            pp.id.startsWith(piece.name + '_')
        );
        
        if (placedInstances.length > 0) {
            // ✅ 已成功排料：使用实际位置
            for (const pp of placedInstances) {
                const bbox = pp.polygon.translate(pp.x, pp.y).getBoundingBox();
                const originalData = pieceOriginalData.get(piece.name);
                
                // 🔧 【工业标准】处理 onFold 裁片的对称展开
                let finalPathOps = piecePathMap.get(piece.name) || [];
                let finalSeamOps = (originalData?.seamAllowancePathOps || []);
                let finalWidth = bbox.width;
                let isExpanded = false;
                
                if (piece.onFold) {
                    logger.info(`   🔄 检测到 onFold 裁片 "${piece.name}"，进行对称展开...`);
                    const expanded = expandOnFoldPiece(finalPathOps, finalSeamOps, 'y');
                    finalPathOps = expanded.pathOps;
                    finalSeamOps = expanded.seamAllowancePathOps;
                    finalWidth = expanded.width;
                    isExpanded = true;
                }
                
                piecesData.push({
                    name: piece.name,
                    x: pp.x,
                    y: pp.y,
                    width: isExpanded ? finalWidth : bbox.width,
                    height: bbox.height,
                    area: pp.polygon.getArea(),
                    cutCount: 1,
                    onFold: isExpanded ? false : piece.onFold,  // 展开后不再是 onFold
                    rotation: pp.rotation,
                    placed: true,  // 标记为已放置
                    pathOps: finalPathOps,
                    // 🔧 【缝份修复】添加缝份数据
                    seamAllowance: originalData?.seamAllowance || 0,
                    seamAllowancePathOps: finalSeamOps
                });
            }
        } else {
            // ❌ 未排料成功：强制保留，使用默认位置
            logger.warn(`⚠️ Piece "${piece.name}" 未成功排料，强制保留到结果中`);
            
            const originalPiece = pieceOriginalData.get(piece.name);
            
            // 计算bounding box（从pathOps估算）
            let estimatedWidth = 0;
            let estimatedHeight = 0;
            const pathOps = piecePathMap.get(piece.name) || [];
            
            if (pathOps.length > 0) {
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;
                
                for (const op of pathOps) {
                    if (op.to) {
                        minX = Math.min(minX, op.to.x);
                        minY = Math.min(minY, op.to.y);
                        maxX = Math.max(maxX, op.to.x);
                        maxY = Math.max(maxY, op.to.y);
                    }
                    if (op.cp1) {
                        minX = Math.min(minX, op.cp1.x);
                        minY = Math.min(minY, op.cp1.y);
                        maxX = Math.max(maxX, op.cp1.x);
                        maxY = Math.max(maxY, op.cp1.y);
                    }
                    if (op.cp2) {
                        minX = Math.min(minX, op.cp2.x);
                        minY = Math.min(minY, op.cp2.y);
                        maxX = Math.max(maxX, op.cp2.x);
                        maxY = Math.max(maxY, op.cp2.y);
                    }
                }
                
                estimatedWidth = maxX - minX;
                estimatedHeight = maxY - minY;
            }
            
            // 根据cutCount生成对应数量的实例
            const count = originalPiece.cutCount || 1;
            for (let i = 0; i < count; i++) {
                piecesData.push({
                    name: piece.name,
                    x: 0,  // 默认位置
                    y: 0,
                    width: estimatedWidth,
                    height: estimatedHeight,
                    area: estimatedWidth * estimatedHeight,
                    cutCount: 1,
                    onFold: originalPiece.onFold,
                    rotation: 0,
                    placed: false,  // 标记为未放置
                    pathOps: pathOps,
                    // 🔧 【缝份修复】添加缝份数据
                    seamAllowance: originalPiece.seamAllowance || 0,
                    seamAllowancePathOps: originalPiece.seamAllowancePathOps || []
                });
            }
        }
    }

    logger.info(`Nesting模式: 排料完成，总共${piecesData.length}个pieces（含${placedPolygons.length}个已排料）, 利用率${result.utilization?.toFixed(1)}%`);
    
    // 🔍 【调试日志】最终返回数据完整性检查
    logger.debug('\n🔍 ===== 最终API返回数据检查 =====');
    logger.debug(`   原始pieces数量: ${pieces.length}`);
    logger.debug(`   已排料pieces数量: ${placedPolygons.length}`);
    logger.debug(`   返回的piecesData数量: ${piecesData.length}`);
    logger.debug(`   pieces名称列表:`);
    for (let i = 0; i < piecesData.length; i++) {
        const piece = piecesData[i];
        logger.debug(`     [${i}] ${piece.name} (${piece.placed ? '✅已排料' : '❌未排料'}):`);
        logger.debug(`         x: ${piece.x}, y: ${piece.y}`);
        logger.debug(`         width: ${piece.width?.toFixed(2)}, height: ${piece.height?.toFixed(2)}`);
        logger.debug(`         area: ${piece.area?.toFixed(2)}`);
        logger.debug(`         pathOps数量: ${piece.pathOps?.length || 0}`);
        
        // 检查sleeve的详细信息
        if (piece.name === 'sleeve') {
            logger.debug(`         🎯 SLEEVE 详细信息:`);
            if (piece.pathOps && piece.pathOps.length > 0) {
                logger.debug(`           pathOps类型（前5个）:`);
                for (let j = 0; j < Math.min(piece.pathOps.length, 5); j++) {
                    const op = piece.pathOps[j];
                    if (op.type === 'move' || op.type === 'line') {
                        logger.debug(`             [${j}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)})`);
                    } else if (op.type === 'curve' || op.type === 'quad') {
                        logger.debug(`             [${j}] ${op.type} → (${op.to?.x?.toFixed(2)}, ${op.to?.y?.toFixed(2)}) [cp1:(${op.cp1?.x?.toFixed(2)},${op.cp1?.y?.toFixed(2)})]`);
                    } else {
                        logger.debug(`             [${j}] ${op.type}`);
                    }
                }
                if (piece.pathOps.length > 5) {
                    logger.debug(`             ... 共${piece.pathOps.length}个操作`);
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
            
            logger.info(`           排料状态: ${piece.placed ? '✅ 成功' : '⚠️ 未排料（但已保留）'}`);
            
            // 🔧 【缝份调试】检查缝份数据
            logger.debug(`         🧵 缝份数据:`);
            logger.debug(`            seamAllowance: ${piece.seamAllowance}`);
            logger.debug(`            seamAllowancePathOps数量: ${piece.seamAllowancePathOps?.length || 0}`);
            if (piece.seamAllowancePathOps && piece.seamAllowancePathOps.length > 0) {
                logger.info(`           ✅ 缝份路径已包含 (${piece.seamAllowancePathOps.length} ops)`);
            } else {
                logger.error(`           ❌ 缺少缝份路径数据！`);
            }
        }
    }
    
    // 统计sleeve数量
    const sleeveCount = piecesData.filter(p => p.name === 'sleeve').length;
    const placedSleeveCount = piecesData.filter(p => p.name === 'sleeve' && p.placed).length;
    logger.debug(`\n📊 袖子统计:`);
    logger.debug(`   sleeve总数: ${sleeveCount} (期望: 2)`);
    logger.debug(`   已排料sleeve: ${placedSleeveCount}`);
    logger.debug(`   未排料sleeve: ${sleeveCount - placedSleeveCount}`);
    
    if (sleeveCount >= 2) {
        logger.info(`   ✅ 找到${sleeveCount}个sleeve（符合预期）`);
        if (placedSleeveCount < sleeveCount) {
            logger.warn(`   ⚠️ 其中${sleeveCount - placedSleeveCount}个未成功排料，但已保留在结果中`);
        }
    } else if (sleeveCount > 0) {
        logger.warn(`   ⚠️ 只找到${sleeveCount}个sleeve（期望2个）`);
    } else {
        logger.error(`   ❌ 没有找到任何sleeve pieces！`);
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
