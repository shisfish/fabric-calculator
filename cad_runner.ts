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
