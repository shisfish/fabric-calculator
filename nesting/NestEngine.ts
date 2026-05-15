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

    logger.debug('\n🏭 ===== NestEngine 开始排料 =====');
    logger.debug(`   待排料pieces数量: ${sortedPieces.length}`);
    logger.debug(`   fabricWidth: ${this.config.fabricWidth}, fabricHeight: ${this.config.fabricHeight}`);
    
    for (const nestingPiece of sortedPieces) {
      logger.debug(`\n   📦 处理piece: ${nestingPiece.id}, quantity=${nestingPiece.quantity}`);
      logger.debug(`      polygon面积: ${nestingPiece.polygon.getArea().toFixed(2)}`);
      logger.debug(`      polygon点数: ${nestingPiece.polygon.points.length}`);
      
      const bbox = nestingPiece.polygon.getBoundingBox();
      logger.debug(`      bounding box: ${bbox.width.toFixed(2)} x ${bbox.height.toFixed(2)}`);
      
      for (let q = 0; q < nestingPiece.quantity; q++) {
        const success = this.placePiece(nestingPiece, q);
        if (success) {
          logger.debug(`      ✅ 实例${q+1}: 放置成功`);
        } else {
          logger.error(`      ❌ 实例${q+1}: 放置失败！无法找到合适位置`);
        }
      }
    }

    logger.debug(`\n📊 排料结果: 成功放置${this.placedPieces.length}个实例`);
    const placedNames = this.placedPieces.map(p => p.pieceId);
    logger.debug(`   放置的pieces: ${placedNames.join(', ')}`);
    
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

    const startX = spacing;
    const startY = spacing;
    const endX = this.config.fabricWidth - bbox.width - spacing;
    const endY = this.config.fabricHeight - bbox.height - spacing;

    if (endX < startX || endY < startY) {
      return null;
    }

    const stepSize = this.config.placementGap;

    let bestPosition: Point | null = null;
    let bestY = Infinity;

    for (let y = startY; y <= endY; y += stepSize) {
      for (let x = startX; x <= endX; x += stepSize) {
        if (this.canPlaceAt(polygon, x, y, pieceId)) {
          if (y < bestY || (y === bestY && (!bestPosition || x < bestPosition.x))) {
            bestY = y;
            bestPosition = new Point(x, y);
          }
        }
      }

      if (bestPosition && bestY === y) {
        break;
      }
    }

    return bestPosition;
  }

  private canPlaceAt(polygon: Polygon, x: number, y: number, pieceId: string): boolean {
    const translated = polygon.translate(x, y);
    const spacing = this.config.spacing;

    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;

      const placedTranslated = placed.polygon.translate(placed.x, placed.y);

      const expanded = placedTranslated.offset(spacing);
      const collision = SATCollision.testCollision(translated, expanded);

      if (collision.collides) {
        return false;
      }
    }

    const bbox = translated.getBoundingBox();
    if (bbox.maxX > this.config.fabricWidth - spacing) return false;
    if (bbox.maxY > this.config.fabricHeight - spacing) return false;

    return true;
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
