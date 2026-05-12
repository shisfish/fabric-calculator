import { TshirtPatternGenerator, GarmentMeasurementAdapter, type GarmentParams } from './patterns/index.js';
import { NestEngine } from './nesting/index.js';

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

const pieces = TshirtPatternGenerator.generatePattern(params);
const fabricWidth = input.fabricWidth || 145;

if (input.mode === 'preview') {
    const result = pieces.map(piece => ({
        name: piece.name,
        points: Object.entries(piece.points).map(([key, p]) => ({
            key,
            x: p.x,
            y: p.y
        })),
        pathOps: piece.path.ops.map(op => ({
            type: op.type,
            to: op.to ? { x: op.to.x, y: op.to.y } : null,
            cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
            cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
        })),
        cutCount: piece.cutCount,
        onFold: piece.onFold
    }));
    console.log(JSON.stringify(result));
} else {
    const engine = new NestEngine({ fabricWidth });

    for (const piece of pieces) {
        engine.addPiece(piece);
    }

    const result = engine.nest();
    const placedPolygons = engine.getPlacedPolygons();

    const piecesData = placedPolygons.map(pp => {
        const bbox = pp.polygon.translate(pp.x, pp.y).getBoundingBox();
        return {
            name: pp.id.replace(/_\d+$/, ''),
            x: pp.x,
            y: pp.y,
            width: bbox.width,
            height: bbox.height,
            area: pp.polygon.getArea(),
            cutCount: 1,
            onFold: false,
            rotation: pp.rotation
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
}
