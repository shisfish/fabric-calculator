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
      logger.debug(`\n🔧 NestEngine.addPiece: ${piece.name}`);
      logger.debug(`   cutCount: ${piece.cutCount}`);
      logger.debug(`   path存在: ${!!piece.path}`);
      
      if (piece.path && piece.path.ops) {
        logger.debug(`   path.ops数量: ${piece.path.ops.length}`);
        
        const polygon = PolygonConverter.pathToPolygon(piece.path, piece.name);
        logger.debug(`   转换后polygon点数: ${polygon.points.length}`);
        logger.debug(`   polygon面积: ${polygon.getArea().toFixed(2)}`);
        
        const simplified = PolygonConverter.simplifyPolygon(polygon, 1);
        logger.debug(`   简化后polygon点数: ${simplified.points.length}`);
        
        const rotations = this.config.rotations.map(angle => simplified.rotate(angle));
        logger.debug(`   生成${rotations.length}个旋转版本`);

        this.pieces.push({
          id: piece.name,
          polygon: simplified,
          quantity: piece.cutCount,
          rotations,
        });
        
        logger.debug(`   ✅ piece "${piece.name}" 添加成功`);
      } else {
        logger.error(`   ❌ piece "${piece.name}" 的path无效或不存在！`);
      }
    } catch (e) {
      logger.error(`   ❌ 添加piece "${piece.name}" 时出错:`, e);
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

    logger.debug('\n===== NestEngine 开始排料 =====');
    logger.debug(`   待排料pieces数量: ${sortedPieces.length}`);
    logger.debug(`   fabricWidth: ${this.config.fabricWidth}, fabricHeight: ${this.config.fabricHeight}`);

    for (const nestingPiece of sortedPieces) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        const success = this.placePiece(nestingPiece, q);
        if (!success) {
          logger.error(`      ❌ 实例${q+1}: 放置失败！无法找到合适位置`);
        }
      }
    }

    // 后置压缩
    this.compactLayout();

    logger.debug(`\n📊 排料结果: 成功放置${this.placedPieces.length}个实例`);

    return this.calculateResult();
  }

  private sortPiecesByArea(): NestingPiece[] {
    return [...this.pieces].sort((a, b) => b.polygon.getArea() - a.polygon.getArea());
  }

  private placePiece(nestingPiece: NestingPiece, index: number): boolean {
    const pieceId = `${nestingPiece.id}_${index}`;
    let bestPosition: { x: number; y: number; rotation: number } | null = null;
    let bestScore = Infinity;

    for (let rotationIndex = 0; rotationIndex < nestingPiece.rotations.length; rotationIndex++) {
      const rotatedPolygon = nestingPiece.rotations[rotationIndex];
      const rotation = this.config.rotations[rotationIndex];

      const position = this.findBestPosition(rotatedPolygon, pieceId);

      if (position) {
        const score = position.y * this.config.fabricWidth + position.x;
        if (score < bestScore) {
          bestScore = score;
          bestPosition = { x: position.x, y: position.y, rotation };
        }
      }
    }

    if (bestPosition) {
      const rotationIndex = this.config.rotations.indexOf(bestPosition.rotation);
      const rotatedPolygon = nestingPiece.rotations[rotationIndex >= 0 ? rotationIndex : 0];

      this.placedPieces.push({
        pieceId,
        polygon: rotatedPolygon,
        x: bestPosition.x,
        y: bestPosition.y,
        rotation: bestPosition.rotation,
      });

      return true;
    }

    return false;
  }

  private findBestPosition(polygon: Polygon, pieceId: string): Point | null {
    const bbox = polygon.getBoundingBox();
    const spacing = this.config.spacing;
    const fw = this.config.fabricWidth;
    const pw = bbox.width;

    if (pw + spacing * 2 > fw) return null;

    // Collect X candidates: left edge, right edges of placed pieces, left edges minus width
    const candidates = new Set<number>();
    candidates.add(spacing);
    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      candidates.add(pb.maxX + spacing);
      candidates.add(pb.minX - pw - spacing);
    }

    let bestPos: Point | null = null;
    let bestScore = Infinity;

    for (const cx of candidates) {
      if (cx < spacing || cx + pw + spacing > fw) continue;
      const cy = this.findLowestYAtX(polygon, cx, pieceId);
      if (cy !== null) {
        const score = cy * fw + cx;
        if (score < bestScore) {
          bestScore = score;
          bestPos = new Point(cx, cy);
        }
      }
    }
    return bestPos;
  }

  private findLowestYAtX(polygon: Polygon, baseX: number, pieceId: string): number | null {
    const spacing = this.config.spacing;
    const bbox = polygon.getBoundingBox();
    const pw = bbox.width;

    if (baseX < spacing || baseX + pw + spacing > this.config.fabricWidth) return null;

    const visited = new Set<number>();
    let testY = spacing;
    const fh = this.config.fabricHeight;

    while (testY < fh) {
      const yKey = Math.round(testY * 10);
      if (visited.has(yKey)) break;
      visited.add(yKey);

      const testPoly = polygon.translate(baseX, testY);
      let collision = false;
      let lowestBelow = Infinity;

      for (const placed of this.placedPieces) {
        if (placed.pieceId === pieceId) continue;
        const placedPoly = placed.polygon.translate(placed.x, placed.y);
        const expanded = placedPoly.offset(spacing);
        const result = SATCollision.testCollision(testPoly, expanded);
        if (result.collides) {
          collision = true;
          const pb = placedPoly.getBoundingBox();
          const newY = pb.maxY + spacing;
          if (newY < lowestBelow) lowestBelow = newY;
        }
      }

      if (!collision) return testY;
      if (lowestBelow > testY + 0.01) {
        testY = lowestBelow;
      } else {
        break;
      }
    }
    return null;
  }

  private compactLayout(): void {
    const spacing = this.config.spacing;
    let improved = true;

    for (let iteration = 0; iteration < 15 && improved; iteration++) {
      improved = false;

      // Sort: process pieces from top to bottom
      const sortedIndices = this.placedPieces
        .map((p, i) => ({ i, y: p.polygon.translate(p.x, p.y).getBoundingBox().minY }))
        .sort((a, b) => a.y - b.y);

      for (const { i: idx } of sortedIndices) {
        const r = this.placedPieces[idx];
        let curX = r.x;
        let curY = r.y;

        // Push left (0.5mm steps)
        let moved = true;
        while (moved) {
          moved = false;
          const newX = curX - 0.5;
          if (newX >= spacing) {
            const testPoly = r.polygon.translate(newX, curY);
            let valid = true;
            for (const other of this.placedPieces) {
              if (other === r) continue;
              const otherPoly = other.polygon.translate(other.x, other.y);
              const expanded = otherPoly.offset(spacing);
              if (SATCollision.testCollision(testPoly, expanded).collides) {
                valid = false;
                break;
              }
            }
            if (valid) { curX = newX; moved = true; improved = true; }
          }
        }

        // Push up (0.5mm steps)
        moved = true;
        while (moved) {
          moved = false;
          const newY = curY - 0.5;
          if (newY >= spacing) {
            const testPoly = r.polygon.translate(curX, newY);
            let valid = true;
            for (const other of this.placedPieces) {
              if (other === r) continue;
              const otherPoly = other.polygon.translate(other.x, other.y);
              const expanded = otherPoly.offset(spacing);
              if (SATCollision.testCollision(testPoly, expanded).collides) {
                valid = false;
                break;
              }
            }
            if (valid) { curY = newY; moved = true; improved = true; }
          }
        }

        r.x = curX;
        r.y = curY;
      }
    }
  }

  private calculateResult(): NestResult {
    let totalArea = 0;
    let usedArea = 0;
    let maxX = 0;
    let maxY = 0;

    for (const nestingPiece of this.pieces) {
      totalArea += nestingPiece.polygon.getArea() * nestingPiece.quantity;
    }

    const positions: NestResult['positions'] = [];

    for (const placed of this.placedPieces) {
      usedArea += placed.polygon.getArea();
      const bbox = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      maxX = Math.max(maxX, bbox.maxX);
      maxY = Math.max(maxY, bbox.maxY);

      positions.push({
        pieceId: placed.pieceId,
        x: placed.x,
        y: placed.y,
        rotation: placed.rotation,
      });
    }

    const boundsWidth = maxX + this.config.spacing;
    const boundsHeight = maxY + this.config.spacing;
    const fabricArea = boundsWidth * boundsHeight;

    return {
      positions,
      utilization: fabricArea > 0 ? (usedArea / fabricArea) * 100 : 0,
      totalArea,
      usedArea,
      bounds: { width: boundsWidth, height: boundsHeight },
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
    let bestUtilization = bestResult.utilization;

    for (let i = 0; i < iterations; i++) {
      this.shufflePieces();
      const result = this.nest();

      if (result.utilization > bestUtilization) {
        bestResult = result;
        bestUtilization = result.utilization;
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

  static nestPieces(
    pieces: PatternPiece[],
    config: Partial<NestConfig> = {}
  ): NestResult {
    const engine = new NestEngine(config);
    engine.addPieces(pieces);
    return engine.nest();
  }
}
