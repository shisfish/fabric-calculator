import { getPiecesFromGarment, type RectPiece } from './core/patterns/index.js';
import { PatternPieceRenderer } from './renderers/PatternPieceRenderer.js';
import { SeamAllowanceRenderer } from './renderers/SeamAllowanceRenderer.js';
import { NestEngine } from './nesting/index.js';
import { Path, Point } from './nesting/geometry/index.js';
import type { PatternPiece } from './nesting/types.js';

interface CalcInput {
  mode: 'pattern' | 'seam' | 'nesting' | 'all';
  category?: string;
  pieces?: Array<{
    name: string;
    width: number;
    height: number;
    quantity?: number;
    onFold?: boolean;
  }>;
  seamAllowance?: number;
  fabricWidth?: number;
  options?: {
    showLabels?: boolean;
    showGrid?: boolean;
    showUtilization?: boolean;
    showPieceLabels?: boolean;
  };
}

function main() {
  const input: CalcInput = JSON.parse(process.argv[2]);

  const category = input.category || 'tshirt';
  const pieces = getPiecesFromGarment(category, input.pieces);
  
  if (pieces.length === 0) {
    process.stdout.write(JSON.stringify({ error: '没有可用的裁片数据' }));
    return;
  }

  const result: Record<string, any> = {};

  if (input.mode === 'pattern' || input.mode === 'all') {
    try {
      const patternResult = PatternPieceRenderer.render(pieces, {
        showLabels: true,
        showDimensions: true
      });
      
      result.pattern = {
        svg: patternResult.svg,
        pieces: patternResult.pieces.map(p => ({
          id: p.id,
          name: p.name,
          width: p.width,
          height: p.height,
          quantity: p.quantity,
          onFold: p.onFold,
          area: p.area,
          pathOps: p.pathOps
        })),
        totalPieces: patternResult.pieces.reduce((sum, p) => sum + p.quantity, 0),
        viewBox: patternResult.viewBox
      };
    } catch (error) {
      console.error('Error rendering pattern:', error);
      result.pattern = { error: String(error) };
    }
  }

  if (input.mode === 'seam' || input.mode === 'all') {
    const seamDist = input.seamAllowance || 1.5;  // 工业标准缝份1.5cm
    
    try {
      const seamResult = SeamAllowanceRenderer.render(pieces, seamDist, {
        showStitchLine: true,
        showCuttingLine: true,
        showSeamLabels: true
      });
      
      result.seam = {
        svg: seamResult.svg,
        pieces: seamResult.pieces.map(p => ({
          id: p.id,
          name: p.name,
          pathOps: p.stitchLineOps,
          seamAllowancePathOps: p.cuttingLineOps,
          cutCount: 1,
          onFold: pieces.find(piece => piece.id === p.id)?.onFold ?? false,
          area: (p.originalSize.width * 2) * p.originalSize.height,
          originalSize: p.originalSize,
          seamSize: p.seamSize,
          seamDistance: p.seamDistance,
          seamAllowance: seamDist
        })),
        seamDistance: seamDist,
        viewBox: seamResult.viewBox
      };
    } catch (error) {
      console.error('Error rendering seam allowance:', error);
      result.seam = { error: String(error) };
    }
  }

  if (input.mode === 'nesting' || input.mode === 'all') {
    const fabricWidth = input.fabricWidth || 145;
    const seamDist = input.seamAllowance || 1.5;

    try {
      console.error('🔍 [精确计算-排料] 开始使用CAD NestEngine');

      // 收集裁片的pathOps数据和缝份数据（从pattern和seam阶段获取）
      const piecePathOpsMap: Record<string, any[]> = {};
      const pieceSeamPathOpsMap: Record<string, any[]> = {};
      
      if (result.pattern?.pieces) {
        for (const p of result.pattern.pieces) {
          if (p.pathOps && p.pathOps.length > 0) {
            piecePathOpsMap[p.id] = p.pathOps;
            piecePathOpsMap[p.name] = p.pathOps;
          }
        }
      }
      
      if (result.seam?.pieces) {
        for (const p of result.seam.pieces) {
          if (p.seamAllowancePathOps && p.seamAllowancePathOps.length > 0) {
            pieceSeamPathOpsMap[p.id] = p.seamAllowancePathOps;
            pieceSeamPathOpsMap[p.name] = p.seamAllowancePathOps;
          }
        }
      }

      // ✅ 【核心修复】构建与CAD完全一致的PatternPiece数组
      const nestPieces: PatternPiece[] = pieces.map(p => {
        const pathOps = piecePathOpsMap[p.id] || piecePathOpsMap[p.name] || [];
        const seamOps = pieceSeamPathOpsMap[p.id] || pieceSeamPathOpsMap[p.name] || [];

        // 构建Path对象（与CAD格式一致）
        const path = new Path();
        if (pathOps.length > 0) {
          for (const op of pathOps) {
            switch (op.type) {
              case 'move':
                if (op.to) path.move(new Point(op.to.x, op.to.y));
                break;
              case 'line':
                if (op.to) path.line(new Point(op.to.x, op.to.y));
                break;
              case 'quad':
                if (op.to && op.cp1) path.quad(
                  new Point(op.cp1.x, op.cp1.y),
                  new Point(op.to.x, op.to.y)
                );
                break;
              case 'curve':
                if (op.to && op.cp1 && op.cp2) path.curve(
                  new Point(op.cp1.x, op.cp1.y),
                  new Point(op.cp2.x, op.cp2.y),
                  new Point(op.to.x, op.to.y)
                );
                break;
              case 'close':
                path.close();
                break;
            }
          }
        }

        // 构建缝份Path对象
        const seamAllowancePath = new Path();
        if (seamOps.length > 0) {
          for (const op of seamOps) {
            switch (op.type) {
              case 'move':
                if (op.to) seamAllowancePath.move(new Point(op.to.x, op.to.y));
                break;
              case 'line':
                if (op.to) seamAllowancePath.line(new Point(op.to.x, op.to.y));
                break;
              case 'quad':
                if (op.to && op.cp1) seamAllowancePath.quad(
                  new Point(op.cp1.x, op.cp1.y),
                  new Point(op.to.x, op.to.y)
                );
                break;
              case 'curve':
                if (op.to && op.cp1 && op.cp2) seamAllowancePath.curve(
                  new Point(op.cp1.x, op.cp1.y),
                  new Point(op.cp2.x, op.cp2.y),
                  new Point(op.to.x, op.to.y)
                );
                break;
              case 'close':
                seamAllowancePath.close();
                break;
            }
          }
        }

        return {
          name: p.name,
          id: p.id,
          path: path,
          seamAllowancePath: seamAllowancePath,
          points: {},  // ✅ PatternPiece必需字段（自定义裁片不需要关键点）
          cutCount: p.quantity || 1,
          onFold: p.onFold || false,
          seamAllowance: seamDist,
          _custom: true
        } as any;  // 使用any避免类型检查问题
      });

      console.error(`🔍 [精确计算-排料] 构建${nestPieces.length}个PatternPiece`);
      for (const np of nestPieces) {
        console.error(`   - ${np.name}: path.ops=${np.path?.ops?.length || 0}, seamPath.ops=${np.seamAllowancePath?.ops?.length || 0}`);
      }

      // ✅ 【关键】使用CAD的NestEngine（与CAD完全一致！）
      const engine = new NestEngine({
        fabricWidth,
        spacing: 1,
        rotations: [0, 180],
        fabricNap: false,
        fabricHeight: 1600
      });

      for (const piece of nestPieces) {
        engine.addPiece(piece);
      }

      const nestResult = engine.nest();
      const placedPolygons = engine.getPlacedPolygons();

      console.error(`🔍 [精确计算-排料] CAD引擎完成: 利用率=${nestResult.utilization?.toFixed(1)}%`);
      console.error(`🔍 [精确计算-排料] 放置了${placedPolygons.length}个多边形`);

      // ✅ 【关键】处理结果，格式与CAD完全一致
      const piecePathMap = new Map<string, any>();
      const pieceOriginalData = new Map<string, any>();

      for (const piece of nestPieces) {
        const pathOps = (piece.path?.ops || []).map((op: any) => ({
          type: op.type,
          to: op.to ? { x: op.to.x, y: op.to.y } : null,
          cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
          cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
        }));

        piecePathMap.set(piece.name, pathOps);

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
          _custom: true
        });
      }

      const piecesData: any[] = [];

      for (const piece of nestPieces) {
        const originalData = pieceOriginalData.get(piece.name);
        const cutCount = piece.cutCount || 1;
        const placedInstances = placedPolygons.filter(pp => pp.id.startsWith(piece.name + '_'));

        if (placedInstances.length > 0) {
          const originalPathOps = piecePathMap.get(piece.name) || [];
          const originalSeamOps = (originalData?.seamAllowancePathOps || []);

          let finalPathOps = originalPathOps;
          let finalSeamOps = originalSeamOps;

          if (piece.onFold) {
            console.error(`🔄 对称展开onFold裁片 "${piece.name}"...`);
            const lineStart = new Point(0, 0);
            const lineEnd = new Point(0, 1);

            const mirroredOps = originalPathOps.map((op: any) => {
              const mirroredOp: any = { type: op.type };
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

            finalPathOps = [...originalPathOps, ...mirroredOps.reverse()];

            if (originalSeamOps.length > 0) {
              const mirroredSeamOps = originalSeamOps.map((op: any) => {
                const mirroredOp: any = { type: op.type };
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

              finalSeamOps = [...originalSeamOps, ...mirroredSeamOps.reverse()];
            }
          }

          for (let i = 0; i < Math.min(cutCount, placedInstances.length); i++) {
            const inst = placedInstances[i];
            const bbox = inst.polygon.getBoundingBox();
            piecesData.push({
              name: piece.name,
              x: inst.x,
              y: inst.y,
              width: bbox.width,
              height: bbox.height,
              area: 0,  // Polygon没有getArea方法，使用0占位
              cutCount: 1,
              onFold: piece.onFold || false,
              rotation: inst.rotation || 0,
              placed: true,
              pathOps: finalPathOps,
              expandedPathOps: null,
              seamAllowance: piece.seamAllowance || 0,
              seamAllowancePathOps: finalSeamOps,
              expandedSeamAllowancePathOps: null,
              _custom: true
            });
          }
        }
      }

      const positionsData = piecesData.map(p => ({
        name: p.name,
        x: p.x,
        y: p.y,
        rotation: p.rotation
      }));

      const bounds = nestResult.bounds;

      result.nesting = {
        pieces: piecesData,
        positions: positionsData,
        bounds: bounds,
        utilization: nestResult.utilization || 0,
        totalArea: nestResult.totalArea || 0,
        usedArea: nestResult.usedArea || 0,
        fabricInfo: {
          width: fabricWidth,
          height: bounds.height,
          utilization: nestResult.utilization || 0
        },
        statistics: {
          totalPieces: piecesData.length,
          totalArea: nestResult.totalArea || 0,
          usedArea: nestResult.usedArea || 0,
          wasteArea: (nestResult.totalArea || 0) - (nestResult.usedArea || 0),
          fabricLength: bounds.height
        }
      };

      console.error(`🔍 [精确计算-排料] 最终结果: ${piecesData.length}个裁片, bounds=${JSON.stringify(bounds)}`);

    } catch (error) {
      console.error('Error in CAD NestEngine:', error);
      result.nesting = { error: String(error) };
    }
  }

  process.stdout.write(JSON.stringify(result, null, 2));
}

main();
