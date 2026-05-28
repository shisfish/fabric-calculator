import { TshirtPatternGenerator, FrontPatternGenerator, type PatternPiece, type FrontPatternParams } from './patterns/tshirt/index.js';
import { WindbreakerPatternGenerator, adaptWindbreakerInput } from './patterns/windbreaker/index.js';
import { GarmentMeasurementAdapter, type GarmentParams } from './patterns/GarmentMeasurementAdapter.js';
import { NestEngine } from './nesting/index.js';
import { ShrinkageCompensator, type PieceShrinkageMetadata, type ShrinkageConfig } from './shrinkage/index.js';
import { logger } from './utils/CADLogger.js';
import { Point, Path } from './geometry/index.js';

logger.info('CAD引擎启动');

/**
 * 品类策略接口 - 定义各品类的裁片生成逻辑
 */
interface GarmentStrategy {
  category: string;
  generatePieces(garmentInput: any, measurements: any, seamAllowance: number): PatternPiece[];
}

/**
 * T恤品类策略
 */
class TshirtStrategy implements GarmentStrategy {
  category = 'tshirt';

  generatePieces(garmentInput: any, measurements: any, _seamAllowance: number): PatternPiece[] {
    let params: GarmentParams;

    if (garmentInput) {
      params = GarmentMeasurementAdapter.adapt(garmentInput);
    } else if (measurements) {
      params = GarmentMeasurementAdapter.fromLegacyMeasurements(measurements);
    } else {
      params = GarmentMeasurementAdapter.adapt();
    }

    logger.info(`   使用T恤版型生成器`);
    return TshirtPatternGenerator.generatePattern(params);
  }
}

/**
 * 风衣品类策略
 */
class WindbreakerStrategy implements GarmentStrategy {
  category = 'windbreaker';

  generatePieces(garmentInput: any, _measurements: any, seamAllowance: number): PatternPiece[] {
    logger.info(`   使用风衣版型生成器`);
    const wbParams = adaptWindbreakerInput(garmentInput, seamAllowance);
    return WindbreakerPatternGenerator.generatePattern(wbParams);
  }
}

/**
 * 品类策略工厂
 */
const garmentStrategies: Map<string, GarmentStrategy> = new Map([
  ['tshirt', new TshirtStrategy()],
  ['windbreaker', new WindbreakerStrategy()],
]);

function getGarmentStrategy(category: string): GarmentStrategy {
  const strategy = garmentStrategies.get(category);
  if (!strategy) {
    logger.warn(`   未知的品类 "${category}"，回退到T恤`);
    return garmentStrategies.get('tshirt')!;
  }
  return strategy;
}

/**
 * 🔧 【工业标准】对称展开 onFold 裁片
 */
function expandOnFoldPiece(
  pathOps: Array<any>,
  seamAllowancePathOps: Array<any>,
  foldAxis: 'y' | 'x' = 'y'
): { pathOps: Array<any>, seamAllowancePathOps: Array<any>, width: number } {
  if (!pathOps || pathOps.length === 0) {
    return { pathOps: [], seamAllowancePathOps: [], width: 0 };
  }

  const lineStart = new Point(0, 0);
  const lineEnd = foldAxis === 'y' ? new Point(0, 1) : new Point(1, 0);

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
      mirroredOp.cp1 = new Point(op.cp1.x, op.cp1.y).mirror(lineStart, lineEnd);
    }
    if (op.cp2) {
      mirroredOp.cp2 = new Point(op.cp2.x, op.cp2.y).mirror(lineStart, lineEnd);
    }

    return mirroredOp;
  });

  const mirroredSeamOps = seamAllowancePathOps.map(op => {
    const mirroredOp: any = { type: op.type };

    if (op.to) {
      mirroredOp.to = new Point(op.to.x, op.to.y).mirror(lineStart, lineEnd);
    }
    if (op.cp1) {
      mirroredOp.cp1 = new Point(op.cp1.x, op.cp1.y).mirror(lineStart, lineEnd);
    }
    if (op.cp2) {
      mirroredOp.cp2 = new Point(op.cp2.x, op.cp2.y).mirror(lineStart, lineEnd);
    }

    return mirroredOp;
  });

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

const category = input.category || 'tshirt';
logger.info(`\n🏷️ 品类: ${category}`);

const strategy = getGarmentStrategy(category);
let pieces: PatternPiece[];

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
  pieces = strategy.generatePieces(input.garmentInput, input.measurements, input.seamAllowance || 1);
}

if (input.garmentParams && category === 'tshirt') {
  logger.info('   应用 garmentParams 覆盖（仅T恤）');
}

// ===== 自定义裁片 =====
if (input.customPieces && Array.isArray(input.customPieces)) {
  logger.info(`\n📦 处理自定义裁片: ${input.customPieces.length} 种`);
  for (const cp of input.customPieces) {
    const w = parseFloat(cp.width) || 10;
    const h = parseFloat(cp.height) || 10;
    const count = parseInt(cp.count) || 1;
    const name = cp.name || '配件';

    const rectPath = Path.rectangle(w, h);
    const seam = 1.5;
    const seamPath = new Path()
      .move(new Point(-seam, -seam))
      .line(new Point(w + seam, -seam))
      .line(new Point(w + seam, h + seam))
      .line(new Point(-seam, h + seam))
      .close();

    pieces.push({
      name,
      path: rectPath,
      points: {},
      cutCount: count,
      onFold: false,
      seamAllowance: seam,
      seamAllowancePath: seamPath,
      allowedRotations: [0, 180],
      _custom: true,
    });

    logger.info(`   ➕ 添加自定义裁片: "${name}" ${w}×${h}cm ×${count}`);
  }
}

// ===== 按订单数量排料 =====
const qtyNestMode = input.qtyNestMode === true || input.qtyNestMode === 'true';
const nestQuantity = parseInt(input.quantity) || 1;
if (qtyNestMode && nestQuantity > 1) {
  logger.info(`\n📦 按订单数量排料模式: quantity=${nestQuantity}`);
  for (const piece of pieces) {
    const original = piece.cutCount;
    piece.cutCount = original * nestQuantity;
    logger.info(`   🔄 ${piece.name}: ${original} → ${piece.cutCount}`);
  }
}

const fabricWidth = input.fabricWidth || 145;
const fabricNap = input.fabricNap === true || input.fabricNap === 'true';
const shrinkageInput: ShrinkageConfig | undefined = input.shrinkage || input.fabricShrinkage;
const shrinkageResult = ShrinkageCompensator.apply(pieces, shrinkageInput);
pieces = shrinkageResult.pieces;
const shrinkageMetadataByPiece = new Map<string, PieceShrinkageMetadata>(
  shrinkageResult.pieceMetadata.map(meta => [meta.pieceName, meta])
);

if (shrinkageResult.config.enabled) {
  logger.info(`\n   Shrinkage preprocessing: warp=${shrinkageResult.config.warpPercent}% weft=${shrinkageResult.config.weftPercent}%`);
  logger.info(`   Applied before nesting to outlines, seam allowance paths, notches, grainlines, and construction points.`);
}

if (input.mode === 'preview') {
  const result = pieces.map((piece: any) => ({
    name: piece.name,
    dimensions: shrinkageMetadataByPiece.get(piece.name),
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
        to: (op.to && Number.isFinite(op.to.x) && Number.isFinite(op.to.y)) ? { x: op.to.x, y: op.to.y } : null,
        cp1: (op.cp1 && Number.isFinite(op.cp1.x) && Number.isFinite(op.cp1.y)) ? { x: op.cp1.x, y: op.cp1.y } : null,
        cp2: (op.cp2 && Number.isFinite(op.cp2.x) && Number.isFinite(op.cp2.y)) ? { x: op.cp2.x, y: op.cp2.y } : null
      }))
      .filter((op: any) => op.to !== null),
    cutCount: piece.cutCount,
    onFold: piece.onFold
  }));

  logger.info(`Preview模式: 生成${result.length}个单片裁片`);
  console.log(JSON.stringify(result));
} else {
  const engine = new NestEngine({ fabricWidth, spacing: 1, rotations: [0, 180], fabricNap, fabricHeight: 1600 });

  try {
    for (const piece of pieces) {
      engine.addPiece(piece);
    }
  } catch (e: any) {
    console.log(JSON.stringify({ error: e.message || '排料引擎初始化错误', errorType: 'GRAIN_LINE_VIOLATION' }));
    process.exit(0);
  }

  const result = engine.nest();
  logger.info(`   📐 排料完成: 利用率${result.utilization?.toFixed(1)}%`);
  const placedPolygons = engine.getPlacedPolygons();

  const piecePathMap = new Map<string, any>();
  const pieceOriginalData = new Map<string, any>();

  for (const piece of pieces) {
    const pathOps = (piece.path?.ops || []).map((op: any) => ({
      type: op.type,
      to: op.to ? { x: op.to.x, y: op.to.y } : null,
      cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
      cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
    }));

    piecePathMap.set(piece.name, pathOps);

    const isCustom = (piece as any)._custom === true;
    pieceOriginalData.set(piece.name, {
      cutCount: piece.cutCount || 1,
      onFold: piece.onFold || false,
      seamAllowance: piece.seamAllowance || 0,
      seamAllowancePathOps: (piece.seamAllowancePath?.ops || [])
        .map((op: any) => ({
          type: op.type,
          to: (op.to && Number.isFinite(op.to.x) && Number.isFinite(op.to.y)) ? { x: op.to.x, y: op.to.y } : null,
          cp1: (op.cp1 && Number.isFinite(op.cp1.x) && Number.isFinite(op.cp1.y)) ? { x: op.cp1.x, y: op.cp1.y } : null,
          cp2: (op.cp2 && Number.isFinite(op.cp2.x) && Number.isFinite(op.cp2.y)) ? { x: op.cp2.x, y: op.cp2.y } : null
        }))
        .filter((op: any) => op.to !== null),
      points: piece.points || {},
      _custom: isCustom
    });
  }

  const piecesData: any[] = [];

  for (const piece of pieces) {
    const originalData = pieceOriginalData.get(piece.name);
    const cutCount = piece.cutCount || 1;
    const placedInstances = placedPolygons.filter(pp => pp.id.startsWith(piece.name + '_'));

    if (placedInstances.length > 0) {
      const originalPathOps = piecePathMap.get(piece.name) || [];
      const originalSeamOps = (originalData?.seamAllowancePathOps || []);

      let finalPathOps = originalPathOps;
      let finalSeamOps = originalSeamOps;

      if (piece.onFold) {
        logger.info(`   🔄 检测到 onFold 裁片 "${piece.name}"，进行对称展开...`);
        const expanded = expandOnFoldPiece(finalPathOps, finalSeamOps, 'y');
        finalPathOps = expanded.pathOps;
        finalSeamOps = expanded.seamAllowancePathOps;
      }

      for (let i = 0; i < cutCount; i++) {
        const pp = placedInstances[i];
        if (!pp) continue;

        const bbox = pp.polygon.translate(pp.x, pp.y).getBoundingBox();
        piecesData.push({
          name: piece.name,
          x: pp.x,
          y: pp.y,
          width: piece.onFold ? (expandOnFoldPiece(finalPathOps, [], 'y').width) : bbox.width,
          height: bbox.height,
          area: pp.polygon.getArea(),
          dimensions: shrinkageMetadataByPiece.get(piece.name),
          cutCount: 1,
          onFold: piece.onFold,
          rotation: pp.rotation,
          placed: true,
          pathOps: originalPathOps,
          expandedPathOps: piece.onFold ? finalPathOps : null,
          seamAllowance: originalData?.seamAllowance || 0,
          seamAllowancePathOps: originalSeamOps,
          expandedSeamAllowancePathOps: piece.onFold ? finalSeamOps : null,
          _custom: (originalData?._custom) || false,
        });
      }
    } else {
      logger.warn(`⚠️ Piece "${piece.name}" 未成功排料，强制保留`);

      const originalPiece = pieceOriginalData.get(piece.name);
      let estimatedWidth = 0;
      let estimatedHeight = 0;
      const pathOps = piecePathMap.get(piece.name) || [];

      if (pathOps.length > 0) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const op of pathOps) {
          if (op.to) {
            minX = Math.min(minX, op.to.x); minY = Math.min(minY, op.to.y);
            maxX = Math.max(maxX, op.to.x); maxY = Math.max(maxY, op.to.y);
          }
          if (op.cp1) {
            minX = Math.min(minX, op.cp1.x); minY = Math.min(minY, op.cp1.y);
            maxX = Math.max(maxX, op.cp1.x); maxY = Math.max(maxY, op.cp1.y);
          }
          if (op.cp2) {
            minX = Math.min(minX, op.cp2.x); minY = Math.min(minY, op.cp2.y);
            maxX = Math.max(maxX, op.cp2.x); maxY = Math.max(maxY, op.cp2.y);
          }
        }

        estimatedWidth = maxX - minX;
        estimatedHeight = maxY - minY;
      }

      const count = originalPiece?.cutCount || 1;
      for (let i = 0; i < count; i++) {
        piecesData.push({
          name: piece.name,
          x: 0, y: 0,
          width: estimatedWidth,
          height: estimatedHeight,
          area: estimatedWidth * estimatedHeight,
          dimensions: shrinkageMetadataByPiece.get(piece.name),
          cutCount: 1,
          onFold: originalPiece?.onFold,
          rotation: 0,
          placed: false,
          pathOps: pathOps,
          seamAllowance: originalPiece?.seamAllowance || 0,
          seamAllowancePathOps: originalPiece?.seamAllowancePathOps || [],
          _custom: (originalPiece as any)?._custom || false,
        });
      }
    }
  }

  const normalizedPositions = result.positions.map(pos => ({
    name: pos.pieceId.replace(/_\d+$/, ''),
    x: pos.x,
    y: pos.y,
    rotation: pos.rotation,
  }));

  logger.info(`Nesting模式: 排料完成，总共${piecesData.length}个pieces`);

  console.log(JSON.stringify({
    pieces: piecesData,
    positions: normalizedPositions,
    utilization: result.utilization,
    actualNestingUtilization: result.utilization,
    totalArea: result.totalArea,
    usedArea: result.usedArea,
    bounds: result.bounds,
    shrinkage: {
      config: shrinkageResult.config,
      pieces: shrinkageResult.pieceMetadata,
    },
  }));
}
