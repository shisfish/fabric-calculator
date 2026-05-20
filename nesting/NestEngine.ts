import { Point } from '../geometry/index.js';
import { PatternPiece } from '../patterns/index.js';
import { Polygon } from './Polygon.js';
import { PolygonConverter } from './PolygonConverter.js';
import { SATCollision } from './Collision.js';
import { logger } from '../utils/CADLogger.js';

export interface NestConfig {
  fabricWidth: number;
  fabricHeight: number;
  spacing: number;
  rotations: number[];
  populationSize: number;
  mutationRate: number;
  iterations: number;
  placementGap: number;
  fabricNap?: boolean;
}

export interface NestResult {
  positions: Array<{
    pieceId: string;
    x: number;
    y: number;
    rotation: number;
  }>;
  utilization: number;
  totalArea: number;
  usedArea: number;
  bounds: { width: number; height: number };
}

export interface NestingPiece {
  id: string;
  polygon: Polygon;
  quantity: number;
  rotations: Polygon[];
}

export const DEFAULT_NEST_CONFIG: NestConfig = {
  fabricWidth: 1500,
  fabricHeight: 3000,
  spacing: 5,
  rotations: [0, 90, 180, 270],
  populationSize: 20,
  mutationRate: 0.1,
  iterations: 100,
  placementGap: 10,
  fabricNap: false,
};

export class NestEngine {
  private config: NestConfig;
  private pieces: NestingPiece[] = [];
  private placedPieces: Array<{
    pieceId: string;
    polygon: Polygon;
    x: number;
    y: number;
    rotation: number;
  }> = [];

  constructor(config: Partial<NestConfig> = {}) {
    this.config = { ...DEFAULT_NEST_CONFIG, ...config };
  }

  addPiece(piece: PatternPiece): void {
    try {
      if (piece.path && piece.path.ops) {
        let polygon = PolygonConverter.pathToPolygon(piece.path, piece.name);

        // Expand on-fold half-pieces to full pieces by mirroring across fold (x=0)
        if (piece.onFold) {
          const pts = polygon.points;
          const mirrored = pts.map(p => new Point(-p.x, p.y)).reverse();
          polygon = new Polygon([...pts, ...mirrored], piece.name);
        }

        const simplified = PolygonConverter.simplifyPolygon(polygon, 0.3);

        // 根据布纹线方向约束过滤允许的旋转角度
        // 优先级: fabricNap(顺毛) > piece.allowedRotations > config.rotations
        let allowedRotations: number[];
        if (this.config.fabricNap) {
          allowedRotations = [0];
        } else if (piece.allowedRotations && piece.allowedRotations.length > 0) {
          allowedRotations = piece.allowedRotations;
        } else {
          allowedRotations = this.config.rotations;
        }

        // 与全局配置做交集，确保安全
        const effectiveRotations = allowedRotations.filter(
          a => this.config.rotations.includes(a)
        );

        if (effectiveRotations.length === 0) {
          const errorMsg = `方向违规：裁片${piece.name}旋转角度[${this.config.rotations.join(',')}]不被允许`;
          logger.error(`   ❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        logger.info(`   ✅ 裁片"${piece.name}" 允许旋转角度: [${effectiveRotations.join(', ')}]`);

        const rotations = effectiveRotations.map(angle => simplified.rotate(angle));

        this.pieces.push({
          id: piece.name,
          polygon: simplified,
          quantity: piece.cutCount,
          rotations,
        });
      } else {
        logger.error(`   ❌ piece "${piece.name}" 的path无效或不存在！`);
      }
    } catch (e) {
      logger.error(`   ❌ 添加piece "${piece.name}" 时出错:`, e);
      throw e;
    }
  }

  addPieces(pieces: PatternPiece[]): void {
    for (const piece of pieces) {
      this.addPiece(piece);
    }
  }

  nest(): NestResult {
    this.placedPieces = [];
    const sortedPieces = this.sortPiecesByArea();

    for (const nestingPiece of sortedPieces) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        const success = this.placePiece(nestingPiece, q);
        if (!success) {
          logger.error(`      ❌ 实例${q+1}: ${nestingPiece.id} 放置失败`);
        }
      }
    }

    this.compactLayout(); // Final compaction pass
    this.clampToBoundary();

    return this.calculateResult();
  }

  private sortPiecesByArea(): NestingPiece[] {
    return [...this.pieces].sort((a, b) => b.polygon.getArea() - a.polygon.getArea());
  }

  private placePiece(nestingPiece: NestingPiece, index: number): boolean {
    const pieceId = `${nestingPiece.id}_${index}`;
    let bestPos: { x: number; y: number; rotation: number } | null = null;
    let bestScore = Infinity;

    for (let ri = 0; ri < nestingPiece.rotations.length; ri++) {
      const poly = nestingPiece.rotations[ri];
      const rotation = this.config.rotations[ri];
      const pos = this.findBLPosition(poly, pieceId);

      if (pos) {
        // 评分：优先最小化总长度(maxY)，其次优化宽度利用率(maxX)
        // 实际用料 = 裁片面积 / (总长度 × 门幅宽)，总长度对利用率影响最大
        const testPoly = poly.translate(pos.x, pos.y);
        const testBb = testPoly.getBoundingBox();

        let currentMaxY = testBb.maxY;
        let currentMaxX = testBb.maxX;
        for (const placed of this.placedPieces) {
          const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
          currentMaxY = Math.max(currentMaxY, pb.maxY);
          currentMaxX = Math.max(currentMaxX, pb.maxX);
        }

        // 主要: 总长度(maxY) × 门幅权重, 次要: 宽度占用(maxX)作为tiebreaker
        const fw = this.config.fabricWidth;
        const score = currentMaxY * fw + currentMaxX;

        if (score < bestScore) {
          bestScore = score;
          bestPos = { x: pos.x, y: pos.y, rotation };
        }
      }
    }

    if (bestPos) {
      const ri = this.config.rotations.indexOf(bestPos.rotation);
      const poly = nestingPiece.rotations[ri >= 0 ? ri : 0];
      this.placedPieces.push({ pieceId, polygon: poly, x: bestPos.x, y: bestPos.y, rotation: bestPos.rotation });
      return true;
    }
    return false;
  }

  /**
   * Bottom-Left Fill placement.
   * Uses polygon-local bounding box to compute correct global boundaries.
   *
   * Piece origin = (x, y). Actual occupied area:
   *   left   = x + localBbox.minX
   *   right  = x + localBbox.maxX
   *   top    = y + localBbox.minY
   *   bottom = y + localBbox.maxY
   */
  private findBLPosition(polygon: Polygon, pieceId: string): Point | null {
    const spacing = this.config.spacing;
    const fw = this.config.fabricWidth;
    const b = polygon.getBoundingBox();

    if (b.width + spacing * 2 > fw) return null;

    const xCands = new Set<number>();
    xCands.add(spacing - b.minX);

    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      xCands.add(pb.maxX + spacing - b.minX);
      xCands.add(pb.minX - spacing - b.maxX);
    }

    // Also try intermediate positions between placed pieces (gap filling)
    const placedBoxes = this.placedPieces
      .filter(p => p.pieceId !== pieceId)
      .map(p => p.polygon.translate(p.x, p.y).getBoundingBox());
    for (let i = 0; i < placedBoxes.length; i++) {
      for (let j = i + 1; j < placedBoxes.length; j++) {
        const left = placedBoxes[i].maxX < placedBoxes[j].maxX ? placedBoxes[i] : placedBoxes[j];
        const right = placedBoxes[i].maxX < placedBoxes[j].maxX ? placedBoxes[j] : placedBoxes[i];
        const gap = right.minX - left.maxX;
        if (gap > b.width + spacing * 2) {
          xCands.add((left.maxX + right.minX) / 2 - (b.minX + b.maxX) / 2);
        }
      }
    }

    let best: Point | null = null;
    let bestScore = Infinity;

    for (const cx of xCands) {
      if (cx + b.minX < spacing) continue;
      if (cx + b.maxX > fw - spacing) continue;

      const cy = this.dropY(polygon, cx, pieceId);
      if (cy !== null) {
        const score = cy * fw + cx;
        if (score < bestScore) {
          bestScore = score;
          best = new Point(cx, cy);
        }
      }
    }
    return best;
  }

  private dropY(polygon: Polygon, baseX: number, pieceId: string): number | null {
    const spacing = this.config.spacing;
    const b = polygon.getBoundingBox();
    const fw = this.config.fabricWidth;
    const fh = this.config.fabricHeight;

    let testY = Math.max(spacing - b.minY, 0);

    // Quick reject: piece too tall for fabric
    if (b.height + spacing * 2 > fh) return null;

    const visited = new Set<number>();

    while (testY < fh) {
      const yKey = Math.round(testY * 10);
      if (visited.has(yKey)) break;
      visited.add(yKey);

      // Top boundary: piece's top edge must be >= spacing
      if (testY + b.minY < spacing) {
        testY = spacing - b.minY;
        continue;
      }
      // Bottom boundary: piece's bottom edge must be <= fh - spacing
      if (testY + b.maxY > fh - spacing) break;

      const testPoly = polygon.translate(baseX, testY);
      // Validate with actual translated bounding box
      const bb = testPoly.getBoundingBox();
      if (bb.minX < spacing || bb.maxX > fw - spacing || bb.minY < spacing || bb.maxY > fh - spacing) {
        testY += 10;
        continue;
      }

      let collides = false;
      let lowestBelow = Infinity;

      for (const placed of this.placedPieces) {
        if (placed.pieceId === pieceId) continue;
        const placedPoly = placed.polygon.translate(placed.x, placed.y);
        const result = SATCollision.testCollisionRobust(testPoly, placedPoly);
        if (result.collides) {
          collides = true;
          // Jump below the placed piece + spacing gap, using bbox
          const pb = placedPoly.getBoundingBox();
          const newY = pb.maxY + spacing - b.minY + 1.0;
          if (newY < lowestBelow) lowestBelow = newY;
        }
      }

      if (!collides) return testY;
      if (lowestBelow > testY + 0.01) {
        testY = Math.max(lowestBelow, 0);
      } else {
        break;
      }
    }
    return null;
  }

  private clampToBoundary(): void {
    const spacing = this.config.spacing;
    const fw = this.config.fabricWidth;
    for (const p of this.placedPieces) {
      const b = p.polygon.getBoundingBox();
      const pb = p.polygon.translate(p.x, p.y).getBoundingBox();
      if (pb.minY < spacing) p.y = spacing - b.minY;
      if (pb.minX < spacing) p.x = spacing - b.minX;
      if (pb.maxX > fw - spacing) p.x = fw - spacing - b.maxX;
    }
  }

  private compactLayout(): void {
    const spacing = this.config.spacing;
    let improved = true;

    // Store original positions to revert if compaction causes collision
    const origPositions = new Map<any, { x: number; y: number }>();

    for (let iter = 0; iter < 15 && improved; iter++) {
      improved = false;

      const sorted = this.placedPieces
        .map((p, i) => ({ i, y: p.polygon.translate(p.x, p.y).getBoundingBox().minY }))
        .sort((a, b) => a.y - b.y);

      for (const { i: idx } of sorted) {
        const r = this.placedPieces[idx];
        if (!origPositions.has(r)) {
          origPositions.set(r, { x: r.x, y: r.y });
        }

        let curX = r.x;
        let curY = r.y;

        // Push left (0.5 steps)
        let moved = true;
        while (moved) {
          moved = false;
          const nx = curX - 0.5;
          const tp = r.polygon.translate(nx, curY);
          const tpb = tp.getBoundingBox();
          if (tpb.minX >= spacing) {
            let ok = true;
            for (const o of this.placedPieces) {
              if (o === r) continue;
              const op = o.polygon.translate(o.x, o.y);
              // Use direct SAT collision (no offset) — spacing is maintained
              // by the boundary check and step size
              if (SATCollision.testCollisionRobust(tp, op).collides) {
                ok = false; break;
              }
            }
            if (ok) { curX = nx; moved = true; improved = true; }
          }
        }

        // Push up (0.5 steps)
        moved = true;
        while (moved) {
          moved = false;
          const ny = curY - 0.5;
          const tp = r.polygon.translate(curX, ny);
          const tpb = tp.getBoundingBox();
          if (tpb.minY >= spacing) {
            let ok = true;
            for (const o of this.placedPieces) {
              if (o === r) continue;
              const op = o.polygon.translate(o.x, o.y);
              if (SATCollision.testCollisionRobust(tp, op).collides) {
                ok = false; break;
              }
            }
            if (ok) { curY = ny; moved = true; improved = true; }
          }
        }

        r.x = curX;
        r.y = curY;
      }
    }

    // Post-validation: revert any piece that ended up overlapping
    for (const p of this.placedPieces) {
      for (const o of this.placedPieces) {
        if (p === o) continue;
        const pp = p.polygon.translate(p.x, p.y);
        const op = o.polygon.translate(o.x, o.y);
        if (SATCollision.testCollisionRobust(pp, op).collides) {
          // Revert to pre-compaction position
          const orig = origPositions.get(p);
          if (orig) { p.x = orig.x; p.y = orig.y; }
          const origO = origPositions.get(o);
          if (origO) { o.x = origO.x; o.y = origO.y; }
        }
      }
    }
  }

  private calculateResult(): NestResult {
    let totalArea = 0;
    let usedArea = 0;
    let maxX = 0;
    let maxY = 0;

    for (const p of this.pieces) {
      totalArea += p.polygon.getArea() * p.quantity;
    }

    const positions: NestResult['positions'] = [];

    for (const placed of this.placedPieces) {
      usedArea += placed.polygon.getArea();
      const bb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      maxX = Math.max(maxX, bb.maxX);
      maxY = Math.max(maxY, bb.maxY);

      positions.push({
        pieceId: placed.pieceId,
        x: placed.x,
        y: placed.y,
        rotation: placed.rotation,
      });
    }

    const bw = maxX + this.config.spacing;
    const bh = maxY + this.config.spacing;
    const fa = bw * bh;

    return {
      positions,
      utilization: fa > 0 ? (usedArea / fa) * 100 : 0,
      totalArea,
      usedArea,
      bounds: { width: bw, height: bh },
    };
  }

  getPlacedPolygons(): Array<{ id: string; polygon: Polygon; x: number; y: number; rotation: number }> {
    return this.placedPieces.map(p => ({
      id: p.pieceId,
      polygon: p.polygon,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
    }));
  }

  optimize(iterations: number = 10): NestResult {
    let bestResult = this.nest();
    let bestUtil = bestResult.utilization;

    for (let i = 0; i < iterations; i++) {
      this.shufflePieces();
      const r = this.nest();
      if (r.utilization > bestUtil) {
        bestResult = r;
        bestUtil = r.utilization;
      }
    }
    return bestResult;
  }

  private shufflePieces(): void {
    for (let i = this.pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
    }
  }

  static nestPieces(pieces: PatternPiece[], config: Partial<NestConfig> = {}): NestResult {
    const engine = new NestEngine(config);
    engine.addPieces(pieces);
    return engine.nest();
  }
}