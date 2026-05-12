import { TshirtPatternGenerator } from './patterns/index.js';
import { NestEngine } from './nesting/index.js';

const input = JSON.parse(process.argv[2]);

const measurements = input.measurements || {};
const options = input.options || {};
const fabricWidth = (input.fabricWidth || 145) * 10;

const generator = new TshirtPatternGenerator(measurements, options);
const pieces = generator.generate();

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
            x: pp.x / 10,
            y: pp.y / 10,
            width: bbox.width / 10,
            height: bbox.height / 10,
            area: pp.polygon.getArea() * 100,
            cutCount: 1,
            onFold: false,
            rotation: pp.rotation
        };
    });

    console.log(JSON.stringify({
        pieces: piecesData,
        positions: result.positions.map(p => ({
            name: p.pieceId.replace(/_\d+$/, ''),
            x: p.x / 10,
            y: p.y / 10,
            rotation: p.rotation
        })),
        utilization: result.utilization,
        bounds: {
            width: result.bounds.width / 10,
            height: result.bounds.height / 10
        },
        totalArea: result.totalArea * 100,
        usedArea: result.usedArea * 100
    }));
}
