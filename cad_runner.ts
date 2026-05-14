import { TshirtPatternGenerator, GarmentMeasurementAdapter, FrontPatternGenerator, type GarmentParams, type FrontPatternParams } from './patterns/index.js';
import { NestEngine } from './nesting/index.js';

/**
 * 错误处理包装器 - 确保始终输出有效JSON
 */
function safeExecute<T>(fn: () => T, errorMessage: string): T {
  try {
    return fn();
  } catch (error) {
    const errorInfo = {
      error: true,
      message: errorMessage,
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    // 始终输出JSON格式的错误信息
    console.log(JSON.stringify(errorInfo));
    
    // 重新抛出以便外部捕获
    throw error;
  }
}

const input = JSON.parse(process.argv[2]);

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
  pieces = safeExecute(
    () => TshirtPatternGenerator.generatePattern(params),
    'TshirtPatternGenerator生成失败'
  );
}

const fabricWidth = input.fabricWidth || 145;

if (input.mode === 'preview') {
    safeExecute(() => {
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
      console.log(JSON.stringify(result));
    }, 'Preview模式生成失败');
} else {
    safeExecute(() => {
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

      console.log(JSON.stringify({
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
    }, 'Nesting排料计算失败');
}
