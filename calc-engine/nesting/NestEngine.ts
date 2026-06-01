import { Point } from './geometry/index.js';
import type { PatternPiece } from './types.js';
import { Polygon } from './Polygon.js';
import { PolygonConverter } from './PolygonConverter.js';
import { SATCollision } from './Collision.js';

const logger = {
  info: (...args: any[]) => console.error('[CalcNest]', ...args),
  warn: (...args: any[]) => console.warn('[CalcNest]', ...args),
  error: (...args: any[]) => console.error('[CalcNest-ERR]', ...args)
};

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
  nfpCandidates?: boolean;
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
  rotations: Array<{ angle: number; polygon: Polygon }>;
  isAccessory?: boolean;
  _geometryScore?: number;
}

interface PieceClassification {
  category: 'main' | 'accessory' | 'long_narrow' | 'small_filler';
  isAccessory: boolean;
  isLongNarrow: boolean;
  placementPriority: number;
}

type BoundingBox = ReturnType<Polygon['getBoundingBox']>;

type PlacedPiece = {
  pieceId: string;
  polygon: Polygon;
  x: number;
  y: number;
  rotation: number;
};

export const DEFAULT_NEST_CONFIG: NestConfig = {
  fabricWidth: 1500,
  fabricHeight: 3000,
  spacing: 5,
  rotations: [0, 180],
  populationSize: 20,
  mutationRate: 0.1,
  iterations: 100,
  placementGap: 10,
  fabricNap: false,
  nfpCandidates: true,
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
  private polygonOffsets: Map<string, Point> = new Map();
  private pieceOnFold = new Map<string, boolean>();
  private useNfpCandidates = true;

  constructor(config: Partial<NestConfig> = {}) {
    this.config = { ...DEFAULT_NEST_CONFIG, ...config };
  }

  addPiece(piece: PatternPiece): void {
    try {
      if (piece.path && piece.path.ops) {
        let polygon = PolygonConverter.pathToPolygon(piece.seamAllowancePath || piece.path, piece.name);

        // Expand on-fold half-pieces to full pieces by mirroring across fold (x=0)
        if (piece.onFold) {
          const pts = polygon.points;
          const mirrored = pts.map(p => new Point(-p.x, p.y)).reverse();
          polygon = new Polygon([...pts, ...mirrored], piece.name);
        }

        const simplified = PolygonConverter.simplifyPolygon(polygon, 0.3);

        // 归一化缝份多边形坐标：将minX/minY平移到0，消除缝份负坐标导致的空白偏移
        const normBB = simplified.getBoundingBox();
        const offsetX = Math.max(0, -normBB.minX);
        const offsetY = Math.max(0, -normBB.minY);
        const normalized = (offsetX > 0 || offsetY > 0)
          ? simplified.translate(offsetX, offsetY)
          : simplified;
        this.polygonOffsets.set(piece.name, new Point(offsetX, offsetY));

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

        const rotations = effectiveRotations.map(angle => ({
          angle,
          polygon: normalized.rotate(angle)
        }));

        const bb = normalized.getBoundingBox();
        const area = bb.width * bb.height;
        
        const aspectRatio = Math.max(bb.width, bb.height) / Math.min(bb.width, bb.height);
        const pieceType = this.classifyPieceByGeometry(area, aspectRatio, piece.name);
        
        if (pieceType.isLongNarrow) {
          logger.info(`   📏 裁片"${piece.name}" 长宽比=${aspectRatio.toFixed(1)} (${bb.width.toFixed(1)}×${bb.height.toFixed(1)}), 类型=${pieceType.category}`);
        }
        
        this.pieces.push({
          id: piece.name,
          polygon: normalized,
          quantity: piece.cutCount,
          rotations,
          isAccessory: pieceType.isAccessory,
          _geometryScore: pieceType.placementPriority,
        });
        this.pieceOnFold.set(piece.name, piece.onFold ?? false);
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

  nest(sortByArea: boolean = true, numRestarts: number = 5): NestResult {
    if (numRestarts <= 1) {
      return this.executeNesting(sortByArea);
    }

    logger.info(`\n🎲 === 随机重启优化 (${numRestarts}次) ===`);
    
    let bestResult: NestResult | null = null;
    let bestHeight = Infinity;
    const results: Array<{ attempt: number; height: number; utilization: number; mode: string }> = [];

    for (let attempt = 0; attempt < numRestarts; attempt++) {
      logger.info(`\n   🔄 尝试 ${attempt + 1}/${numRestarts}`);
      
      this.placedPieces = [];
      this.useNfpCandidates = this.config.nfpCandidates !== false && attempt > 0 && attempt % 2 === 0;
      
      let result: NestResult;
      if (attempt === 0) {
        result = this.executeNesting(sortByArea);
      } else {
        result = this.executeNestingWithShuffle();
      }

      const currentHeight = result.bounds.height;
      const currentUtilization = result.utilization;
      
      results.push({
        attempt: attempt + 1,
        height: currentHeight,
        utilization: currentUtilization,
        mode: this.useNfpCandidates ? 'nfp' : 'baseline'
      });

      logger.info(`   📊 结果 ${attempt + 1}: 长度=${currentHeight.toFixed(1)}cm, 利用率=${(currentUtilization * 100).toFixed(1)}%`);

      if (currentHeight < bestHeight) {
        bestHeight = currentHeight;
        bestResult = result;
        
        if (attempt > 0) {
          logger.info(`   ✨ 发现更优解! 长度 ${bestHeight.toFixed(1)}cm`);
        }
      }
    }

    logger.info(`\n🏆 === 随机重启完成 ===`);
    logger.info(`   最佳结果: 长度=${bestHeight.toFixed(1)}cm, 利用率=${((bestResult as NestResult).utilization * 100).toFixed(1)}%`);
    
    results.sort((a, b) => a.height - b.height);
    logger.info(`   所有尝试:`);
    for (const r of results) {
      const marker = r.height === bestHeight ? '🏆' : '  ';
      logger.info(`     ${marker} 尝试${r.attempt}: ${r.height.toFixed(1)}cm (${(r.utilization * 100).toFixed(1)}%)`);
    }

    this.useNfpCandidates = this.config.nfpCandidates !== false;
    return bestResult!;
  }

  private executeNesting(sortByArea: boolean): NestResult {
    const allPieces = sortByArea ? this.sortPiecesByArea() : [...this.pieces];

    const mainPieces: NestingPiece[] = [];
    const accessoryPieces: NestingPiece[] = [];
    for (const p of allPieces) {
      if (p.isAccessory) accessoryPieces.push(p);
      else mainPieces.push(p);
    }
    accessoryPieces.sort((a, b) => {
      const pa = this.getAccessoryPriority(a);
      const pb = this.getAccessoryPriority(b);
      if (pa !== pb) return pa - pb;
      return b.polygon.getArea() - a.polygon.getArea();
    });

    logger.info(`\n📦 === 两阶段排料 ===`);
    logger.info(`   Phase 1 主裁片: ${mainPieces.map(p => `${p.id}×${p.quantity}`).join(', ')}`);
    logger.info(`   Phase 2 配件: ${accessoryPieces.map(p => `${p.id}×${p.quantity}`).join(', ') || '无'}`);

    for (const nestingPiece of mainPieces) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        this.placePiece(nestingPiece, q);
      }
    }

    this.postOptimizeRotations();
    this.compactLayout();

    const phase1MaxY = this.placedPieces.length > 0
      ? Math.max(...this.placedPieces.map(p =>
        p.polygon.translate(p.x, p.y).getBoundingBox().maxY))
      : 0;
    logger.info(`   ✅ Phase 1 完成: 长度=${phase1MaxY.toFixed(1)}cm`);

    for (const nestingPiece of accessoryPieces) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        this.placePiece(nestingPiece, q);
      }
    }

    this.localOptimize();
    this.compactLayout();
    this.clampToBoundary();

    return this.calculateResult();
  }

  private executeNestingWithShuffle(): NestResult {
    const shuffledMain = this.shuffleArray(
      this.pieces.filter(p => !p.isAccessory)
    );
    const shuffledAccessories = this.shuffleArray(
      this.pieces.filter(p => p.isAccessory)
    );

    logger.info(`   🔀 打乱顺序: 主裁片=[${shuffledMain.map(p => p.id).join(',')}], 配件=[${shuffledAccessories.map(p => p.id).join(',')}]`);

    for (const nestingPiece of shuffledMain) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        this.placePiece(nestingPiece, q);
      }
    }

    this.postOptimizeRotations();
    this.compactLayout();

    for (const nestingPiece of shuffledAccessories) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        this.placePiece(nestingPiece, q);
      }
    }

    this.localOptimize();
    this.compactLayout();
    this.clampToBoundary();

    return this.calculateResult();
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private sortPiecesByArea(): NestingPiece[] {
    return [...this.pieces].sort((a, b) => b.polygon.getArea() - a.polygon.getArea());
  }

  private getAccessoryPriority(piece: NestingPiece): number {
    return piece._geometryScore ?? this.calculateGeometryScore(piece);
  }

  private calculateGeometryScore(piece: NestingPiece): number {
    const bb = piece.polygon.getBoundingBox();
    const area = bb.width * bb.height;
    const aspectRatio = Math.max(bb.width, bb.height) / Math.min(bb.width, bb.height);

    let score = 0;
    
    if (aspectRatio > 10) score -= 100;
    else if (aspectRatio > 6) score -= 60;
    else if (aspectRatio > 4) score -= 30;

    if (area < 500) score += 20;
    else if (area < 1000) score += 10;

    const fabricWidth = this.config.fabricWidth / 10;
    if (bb.width > fabricWidth * 0.8) score -= 40;

    return score;
  }

  private classifyPieceByGeometry(area: number, aspectRatio: number, name: string): PieceClassification {
    const isLongNarrow = aspectRatio > 5;
    const isVeryLongNarrow = aspectRatio > 10;
    const isSmall = area < 1200;
    const isVerySmall = area < 600;

    let category: PieceClassification['category'];
    let isAccessory: boolean;
    let placementPriority: number;

    if (isVeryLongNarrow) {
      category = 'long_narrow';
      isAccessory = true;
      placementPriority = -150;
    } else if (isLongNarrow) {
      category = 'long_narrow';
      isAccessory = true;
      placementPriority = -100;
    } else if (isVerySmall) {
      category = 'small_filler';
      isAccessory = true;
      placementPriority = 15;
    } else if (isSmall) {
      category = 'small_filler';
      isAccessory = true;
      placementPriority = 8;
    } else {
      category = 'main';
      isAccessory = false;
      placementPriority = 50 + (area / 100);
    }

    return { category, isAccessory, isLongNarrow, placementPriority };
  }

  private placePiece(nestingPiece: NestingPiece, index: number, preferBottom: boolean = false): boolean {
    const pieceId = `${nestingPiece.id}_${index}`;
    let bestPos: { x: number; y: number; rotation: number } | null = null;
    let bestScore = Infinity;

    const bb = nestingPiece.polygon.getBoundingBox();
    const aspectRatio = Math.max(bb.width, bb.height) / Math.min(bb.width, bb.height);
    const isLongNarrow = aspectRatio > 5;

    const rotationOrder: number[] = [];
    if (nestingPiece.quantity >= 2 && nestingPiece.rotations.length >= 2 && !this.config.fabricNap) {
      const preferredRi = index % nestingPiece.rotations.length;
      rotationOrder.push(preferredRi);
      for (let ri = 0; ri < nestingPiece.rotations.length; ri++) {
        if (ri !== preferredRi) rotationOrder.push(ri);
      }
    } else {
      for (let ri = 0; ri < nestingPiece.rotations.length; ri++) rotationOrder.push(ri);
    }

    for (const ri of rotationOrder) {
      const rotationOption = nestingPiece.rotations[ri];
      const poly = rotationOption.polygon;
      const rotation = rotationOption.angle;
      
      let pos;
      if (isLongNarrow) {
        pos = this.findBestFitPosition(poly, pieceId);
      } else {
        pos = this.findBLPosition(poly, pieceId);
      }

      if (pos) {
        const testPoly = poly.translate(pos.x, pos.y);
        const testBb = testPoly.getBoundingBox();

        let currentMaxY = testBb.maxY;
        let currentMaxX = testBb.maxX;
        for (const placed of this.placedPieces) {
          const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
          currentMaxY = Math.max(currentMaxY, pb.maxY);
          currentMaxX = Math.max(currentMaxX, pb.maxX);
        }

        let compactness = 0;
        let neighborCount = 0;
        for (const placed of this.placedPieces) {
          const op = placed.polygon.translate(placed.x, placed.y);
          const dist = SATCollision.getDistance(testPoly, op);
          if (dist < 100) {
            compactness += dist;
            neighborCount++;
          }
        }
        const avgDist = neighborCount > 0 ? compactness / neighborCount : 50;
        const compactBonus = -avgDist * 0.3;

        const fw = this.config.fabricWidth;
        
        const boundingBoxIncrease = this.calculateBoundingBoxIncrease(testBb);
        
        let score: number;
        if (preferBottom || isLongNarrow) {
          score = boundingBoxIncrease * fw + currentMaxX * 0.5 + compactBonus - (neighborCount > 0 ? neighborCount * 5 : 0);
        } else {
          score = boundingBoxIncrease * fw + currentMaxX + compactBonus;
        }

        if (score < bestScore) {
          bestScore = score;
          bestPos = { x: pos.x, y: pos.y, rotation };
        }
      }
    }

    if (bestPos) {
      const rotationOption = nestingPiece.rotations.find(r => r.angle === bestPos.rotation) ?? nestingPiece.rotations[0];
      const poly = rotationOption.polygon;
      this.placedPieces.push({ pieceId, polygon: poly, x: bestPos.x, y: bestPos.y, rotation: bestPos.rotation });
      return true;
    }
    return false;
  }

  private calculateBoundingBoxIncrease(newBb: BoundingBox): number {
    let currentMaxY = 0;
    for (const placed of this.placedPieces) {
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      currentMaxY = Math.max(currentMaxY, pb.maxY);
    }
    
    if (newBb.maxY > currentMaxY) {
      return newBb.maxY - currentMaxY;
    }
    return 0;
  }

  private findBestFitPosition(polygon: Polygon, pieceId: string): Point | null {
    const spacing = this.config.spacing;
    const fw = this.config.fabricWidth;
    const b = polygon.getBoundingBox();

    logger.info(`   🔍 Best-Fit搜索: ${pieceId}, 尺寸=${b.width.toFixed(1)}×${b.height.toFixed(1)}`);

    const candidates: Array<{ pos: Point; waste: number; yLevel: number }> = [];

    const yLevels = new Set<number>();
    yLevels.add(spacing - b.minY);

    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      yLevels.add(pb.maxY + spacing - b.minY);
      yLevels.add(pb.minY - spacing - b.maxY);
    }

    for (const cy of yLevels) {
      if (cy + b.minY < spacing || cy + b.maxY > this.config.fabricHeight - spacing) continue;

      const xPositions = this.findValidXPositions(polygon, pieceId, cy);
      
      for (const cx of xPositions) {
        const testPoly = polygon.translate(cx, cy);
        if (!this.isValidPlacement(testPoly, pieceId, spacing)) continue;

        const waste = this.calculateWaste(testPoly, cx, cy);
        candidates.push({ 
          pos: new Point(cx, cy), 
          waste,
          yLevel: cy
        });
      }
    }

    if (candidates.length === 0) {
      return this.findBLPosition(polygon, pieceId);
    }

    candidates.sort((a, b) => {
      if (Math.abs(a.waste - b.waste) > 10) return a.waste - b.waste;
      return a.yLevel - b.yLevel;
    });

    const best = candidates[0];
    logger.info(`   ✅ Best-Fit结果: ${pieceId} → (${best.pos.x.toFixed(1)}, ${best.pos.y.toFixed(1)}) waste=${best.waste.toFixed(1)}`);
    return best.pos;
  }

  private findValidXPositions(polygon: Polygon, pieceId: string, cy: number): number[] {
    const spacing = this.config.spacing;
    const fw = this.config.fabricWidth;
    const b = polygon.getBoundingBox();

    const xCands = new Set<number>();
    xCands.add(spacing - b.minX);

    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      
      if (!(cy + b.maxY < pb.minY - spacing || cy + b.minY > pb.maxY + spacing)) {
        xCands.add(pb.maxX + spacing - b.minX);
        xCands.add(pb.minX - spacing - b.maxX);
      }
    }

    const validPositions: number[] = [];
    for (const cx of xCands) {
      if (cx + b.minX < spacing || cx + b.maxX > fw - spacing) continue;
      
      const testPoly = polygon.translate(cx, cy);
      if (this.isValidPlacement(testPoly, pieceId, spacing)) {
        validPositions.push(cx);
      }
    }

    return validPositions.sort((a, b) => a - b);
  }

  private calculateWaste(poly: Polygon, x: number, y: number): number {
    const b = poly.getBoundingBox();
    let waste = 0;
    
    const placedBoxes = this.placedPieces
      .filter(p => p.pieceId !== poly.id)
      .map(p => ({
        box: p.polygon.translate(p.x, p.y).getBoundingBox(),
        id: p.pieceId
      }));

    for (const pb of placedBoxes) {
      if (b.maxX <= pb.box.minX || b.minX >= pb.box.maxX ||
          b.maxY <= pb.box.minY || b.minY >= pb.box.maxY) {
        continue;
      }

      const overlapX = Math.min(b.maxX, pb.box.maxX) - Math.max(b.minX, pb.box.minX);
      const overlapY = Math.min(b.maxY, pb.box.maxY) - Math.max(b.minY, pb.box.minY);
      waste += overlapX * overlapY;
    }

    const rightSpace = (this.config.fabricWidth / 10) - b.maxX;
    const bottomSpace = this.config.fabricHeight - b.maxY;
    
    waste += rightSpace * b.height * 0.6;
    waste += bottomSpace * b.width * 0.8;

    const topSpace = b.minY - this.config.spacing;
    if (topSpace > 0) {
      waste += topSpace * b.width * 0.2;
    }

    return waste;
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
    const directCands: Point[] = [];
    xCands.add(spacing - b.minX);

    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      xCands.add(pb.maxX + spacing - b.minX);
      xCands.add(pb.minX - spacing - b.maxX);
      directCands.push(
        new Point(pb.maxX + spacing - b.minX, pb.minY - b.minY),
        new Point(pb.minX - spacing - b.maxX, pb.minY - b.minY),
        new Point(pb.minX - b.minX, pb.maxY + spacing - b.minY),
        new Point(pb.maxX - b.maxX, pb.maxY + spacing - b.minY)
      );
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

    // ===== 缝隙扫描：对小裁片检测大裁片内部的空白区域 =====
    const pieceArea = b.width * b.height;
    const isSmallPiece = pieceArea < 800;
    const gapDirectCandidates: Point[] = [];
    logger.info(`   🔍 缝隙扫描: pieceId=${pieceId}, 尺寸=${b.width.toFixed(1)}×${b.height.toFixed(1)}, 面积=${pieceArea.toFixed(0)}, isSmall=${isSmallPiece}`);
    if (isSmallPiece && this.placedPieces.length > 0) {
      const gapCandidates = this.scanGapPositions(polygon, pieceId, spacing, fw);
      logger.info(`   📍 找到${gapCandidates.length}个缝隙候选点: ${gapCandidates.map(g => `(${g.x.toFixed(1)},${g.y.toFixed(1)})`).join(' | ')}`);
      for (const gc of gapCandidates) {
        xCands.add(gc.x);
        gapDirectCandidates.push(gc); // 保存完整坐标用于直接评分
      }
    }

    const nfpContactCandidates = this.useNfpCandidates
      ? this.generateNFPContactCandidates(polygon, pieceId)
      : [];
    logger.info(`   NFP接触候选: pieceId=${pieceId}, candidates=${nfpContactCandidates.length}`);

    let best: Point | null = null;
    let bestScore = Infinity;
    const evaluateCandidate = (candidate: Point): void => {
      if (candidate.x + b.minX < spacing) return;
      if (candidate.x + b.maxX > fw - spacing) return;
      if (candidate.y + b.minY < spacing) return;
      if (candidate.y + b.maxY > this.config.fabricHeight - spacing) return;

      const testPoly = polygon.translate(candidate.x, candidate.y);
      if (!this.isValidPlacement(testPoly, pieceId, spacing)) return;

      const tb = testPoly.getBoundingBox();
      let currentMaxY = tb.maxY;
      let currentMaxX = tb.maxX;
      for (const placed of this.placedPieces) {
        if (placed.pieceId === pieceId) continue;
        const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
        currentMaxY = Math.max(currentMaxY, pb.maxY);
        currentMaxX = Math.max(currentMaxX, pb.maxX);
      }

      const score = currentMaxY * fw + currentMaxX + candidate.y * 0.1 + candidate.x * 0.01;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    };

    for (const cx of xCands) {
      if (cx + b.minX < spacing) continue;
      if (cx + b.maxX > fw - spacing) continue;

      const cy = this.dropY(polygon, cx, pieceId);
      if (cy !== null) {
        evaluateCandidate(new Point(cx, cy));
      }
    }

    for (const dc of directCands) {
      evaluateCandidate(dc);
    }

    // 缝隙扫描的直接候选位置也参与评分（已通过SAT验证）
    for (const gc of gapDirectCandidates) {
      evaluateCandidate(gc);
    }

    for (const nfpCandidate of nfpContactCandidates) {
      evaluateCandidate(nfpCandidate);
    }

    const selected = best as Point | null;
    logger.info(`   ✅ findBLPosition结果: ${pieceId} → ${selected ? `(${selected.x.toFixed(1)}, ${selected.y.toFixed(1)}) score=${bestScore.toFixed(0)}` : 'NULL'}`);
    return selected;
  }

  /**
   * NFP-style contact candidates.
   *
   * A full NFP solver builds the complete forbidden-position polygon for every
   * placed/active pair. This lighter version samples the most valuable points on
   * that boundary: vertex-to-vertex contacts and bbox/edge contacts against
   * already placed polygons. Every candidate is still validated by SAT, so these
   * points can only improve search coverage; they cannot introduce overlaps.
   */
  private generateNFPContactCandidates(polygon: Polygon, pieceId: string): Point[] {
    if (this.placedPieces.length === 0) return [];

    const spacing = this.config.spacing;
    const fw = this.config.fabricWidth;
    const fh = this.config.fabricHeight;
    const localBb = polygon.getBoundingBox();
    const candidates: Point[] = [];

    const addCandidate = (x: number, y: number): void => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const testPoly = polygon.translate(x, y);
      const bb = testPoly.getBoundingBox();
      if (bb.minX < spacing || bb.maxX > fw - spacing) return;
      if (bb.minY < spacing || bb.maxY > fh - spacing) return;
      if (!this.isValidPlacement(testPoly, pieceId, spacing)) return;

      candidates.push(new Point(x, y));
    };

    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;

      const placedPoly = placed.polygon.translate(placed.x, placed.y);
      const placedBb = placedPoly.getBoundingBox();

      // Classical left/right/top/bottom contact lines are cheap and often hit
      // useful no-fit boundary points for rectangular and near-rectangular parts.
      const xContacts = [
        placedBb.maxX + spacing - localBb.minX,
        placedBb.minX - spacing - localBb.maxX,
        placedBb.minX - localBb.minX,
        placedBb.maxX - localBb.maxX,
        (placedBb.minX + placedBb.maxX) / 2 - (localBb.minX + localBb.maxX) / 2,
      ];
      const yContacts = [
        placedBb.maxY + spacing - localBb.minY,
        placedBb.minY - spacing - localBb.maxY,
        placedBb.minY - localBb.minY,
        placedBb.maxY - localBb.maxY,
        (placedBb.minY + placedBb.maxY) / 2 - (localBb.minY + localBb.maxY) / 2,
      ];

      for (const x of xContacts) {
        for (const y of yContacts) {
          addCandidate(x, y);
        }
      }

      // Vertex-to-vertex contacts approximate the outer NFP boundary for
      // irregular polygons and unlock placements missed by x-only BL dropping.
      for (const placedVertex of placedPoly.points) {
        for (const activeVertex of polygon.points) {
          addCandidate(
            placedVertex.x + spacing - activeVertex.x,
            placedVertex.y - activeVertex.y
          );
          addCandidate(
            placedVertex.x - spacing - activeVertex.x,
            placedVertex.y - activeVertex.y
          );
          addCandidate(
            placedVertex.x - activeVertex.x,
            placedVertex.y + spacing - activeVertex.y
          );
          addCandidate(
            placedVertex.x - activeVertex.x,
            placedVertex.y - spacing - activeVertex.y
          );
        }
      }
    }

    const unique = new Map<string, Point>();
    for (const candidate of candidates) {
      const key = `${Math.round(candidate.x * 10)},${Math.round(candidate.y * 10)}`;
      const old = unique.get(key);
      if (!old || this.scoreCandidateForCompaction(candidate, polygon) < this.scoreCandidateForCompaction(old, polygon)) {
        unique.set(key, candidate);
      }
    }

    return Array.from(unique.values())
      .sort((a, b) => this.scoreCandidateForCompaction(a, polygon) - this.scoreCandidateForCompaction(b, polygon))
      .slice(0, 80);
  }

  private scoreCandidateForCompaction(candidate: Point, polygon: Polygon): number {
    const bb = polygon.translate(candidate.x, candidate.y).getBoundingBox();
    let maxY = bb.maxY;
    let maxX = bb.maxX;

    for (const placed of this.placedPieces) {
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      maxY = Math.max(maxY, pb.maxY);
      maxX = Math.max(maxX, pb.maxX);
    }

    return maxY * this.config.fabricWidth + maxX + candidate.y * 0.1 + candidate.x * 0.01;
  }

  /**
   * 缝隙扫描：对小裁片检测已放置大裁片内部的空白区域
   * 通过网格采样找到可以放入小裁片的缝隙位置
   */
  private scanGapPositions(polygon: Polygon, pieceId: string, spacing: number, fw: number): Point[] {
    const b = polygon.getBoundingBox();
    const results: Point[] = [];
    const placedPolys = this.placedPieces
      .filter(p => p.pieceId !== pieceId)
      .map(p => ({ poly: p.polygon.translate(p.x, p.y), bb: p.polygon.translate(p.x, p.y).getBoundingBox() }));

    if (placedPolys.length === 0) return results;

    // 计算所有已放置裁片的联合边界框
    let unionMinX = Infinity, unionMinY = Infinity, unionMaxX = -Infinity, unionMaxY = -Infinity;
    for (const pp of placedPolys) {
      unionMinX = Math.min(unionMinX, pp.bb.minX);
      unionMinY = Math.min(unionMinY, pp.bb.minY);
      unionMaxX = Math.max(unionMaxX, pp.bb.maxX);
      unionMaxY = Math.max(unionMaxY, pp.bb.maxY);
    }

    // 网格步长：基于小裁片尺寸，确保覆盖所有可能的放置位置
    const stepX = Math.max(b.width * 0.3, 3);
    const stepY = Math.max(b.height * 0.3, 3);

    // 在联合边界框内进行网格扫描
    for (let gx = unionMinX + spacing; gx <= unionMaxX - b.width - spacing; gx += stepX) {
      for (let gy = unionMinY + spacing; gy <= unionMaxY - b.height - spacing; gy += stepY) {
        // 边界检查
        if (gx + b.minX < spacing || gx + b.maxX > fw - spacing) continue;
        if (gy + b.minY < spacing) continue;

        const testPoly = polygon.translate(gx, gy);
        const testBb = testPoly.getBoundingBox();

        // 快速排除：检查是否与任何已放置裁片的边界框重叠
        let boxOverlap = false;
        for (const pp of placedPolys) {
          if (testBb.minX < pp.bb.maxX + spacing && testBb.maxX > pp.bb.minX - spacing &&
              testBb.minY < pp.bb.maxY + spacing && testBb.maxY > pp.bb.minY - spacing) {
            boxOverlap = true;
            break;
          }
        }
        if (!boxOverlap) continue;

        // 精确碰撞检测（SAT）
        let collides = false;
        for (const pp of placedPolys) {
          if (!this.isValidAgainstPlaced(testPoly, pp.poly, spacing)) {
            collides = true;
            break;
          }
        }

        if (!collides) {
          results.push(new Point(gx, gy));
        }
      }
    }

    // 去重并按Y+X排序（优先左下角）
    const unique = new Map<string, Point>();
    for (const r of results) {
      const key = `${Math.round(r.x)},${Math.round(r.y)}`;
      if (!unique.has(key) || (r.y * fw + r.x) < (unique.get(key)!.y * fw + unique.get(key)!.x)) {
        unique.set(key, r);
      }
    }

    return Array.from(unique.values())
      .sort((a, b) => (a.y * fw + a.x) - (b.y * fw + b.x))
      .slice(0, 20); // 限制候选数量避免性能问题
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

      let needsPush = false;
      let lowestBelow = Infinity;

      for (const placed of this.placedPieces) {
        if (placed.pieceId === pieceId) continue;
        const placedPoly = placed.polygon.translate(placed.x, placed.y);
        const pb = placedPoly.getBoundingBox();
        const tb = testPoly.getBoundingBox();
        // 即使SAT未检测到碰撞，也要检查间距是否 >= spacing
        if (!this.isValidAgainstPlaced(testPoly, placedPoly, spacing) ||
            (tb.minX < pb.maxX && tb.maxX > pb.minX && tb.minY - pb.maxY < spacing)) {
          needsPush = true;
          const newY = pb.maxY + spacing - b.minY + 1.0;
          if (newY < lowestBelow) lowestBelow = newY;
        }
      }

      if (!needsPush) return testY;
      if (lowestBelow > testY + 0.01) {
        testY = Math.max(lowestBelow, 0);
      } else {
        break;
      }
    }
    return null;
  }

  /**
   * 强制配件下沉：让配件尽可能往下移动，填充下半部分空白
   * 只对isAccessory标记的裁片生效，不影响主裁片位置
   */
  private sinkAccessories(): void {
    const spacing = this.config.spacing;
    const accessoryIds = new Set<string>();
    for (const p of this.pieces) {
      if (p.isAccessory) accessoryIds.add(p.id);
    }
    if (accessoryIds.size === 0) return;

    logger.info(`   📍 下沉配件: ${Array.from(accessoryIds).join(', ')}`);

    for (let iter = 0; iter < 20; iter++) {
      let moved = false;
      for (const inst of this.placedPieces) {
        const baseId = this.getBasePieceId(inst.pieceId);
        if (!accessoryIds.has(baseId)) continue;

        // 尝试向下移动
        let ny = inst.y + 0.5;
        const tp = inst.polygon.translate(inst.x, ny);
        const tb = tp.getBoundingBox();
        let ok = true;

        for (const other of this.placedPieces) {
          if (other === inst) continue;
          const op = other.polygon.translate(other.x, other.y);
          if (!this.isValidAgainstPlaced(tp, op, spacing)) { ok = false; break; }
        }

        if (ok && tb.maxY <= this.config.fabricHeight - spacing) {
          inst.y = ny;
          moved = true;
        }
      }
      if (!moved) break;
    }

    // 下沉后也尝试左推
    for (let iter = 0; iter < 20; iter++) {
      let moved = false;
      for (const inst of this.placedPieces) {
        const baseId = this.getBasePieceId(inst.pieceId);
        if (!accessoryIds.has(baseId)) continue;

        let nx = inst.x - 0.5;
        const tp = inst.polygon.translate(nx, inst.y);
        const tb = tp.getBoundingBox();
        let ok = true;

        if (tb.minX < spacing) { ok = false; }
        else {
          for (const other of this.placedPieces) {
            if (other === inst) continue;
            const op = other.polygon.translate(other.x, other.y);
            if (!this.isValidAgainstPlaced(tp, op, spacing)) { ok = false; break; }
          }
        }

        if (ok && tb.minX >= spacing) {
          inst.x = nx;
          moved = true;
        }
      }
      if (!moved) break;
    }
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

        // Push left (0.5 steps, max 100 steps)
        let pushSteps = 0;
        let moved = true;
        while (moved && pushSteps < 100) {
          pushSteps++;
          moved = false;
          const nx = curX - 0.5;
          const tp = r.polygon.translate(nx, curY);
          const tpb = tp.getBoundingBox();
          if (tpb.minX >= spacing) {
            let ok = true;
            for (const o of this.placedPieces) {
              if (o === r) continue;
              const op = o.polygon.translate(o.x, o.y);
              if (!this.isValidAgainstPlaced(tp, op, spacing)) {
                ok = false; break;
              }
            }
            if (ok) { curX = nx; moved = true; improved = true; }
          }
        }

        // Push up (0.5 steps, max 100 steps)
        pushSteps = 0;
        moved = true;
        while (moved && pushSteps < 100) {
          pushSteps++;
          moved = false;
          const ny = curY - 0.5;
          const tp = r.polygon.translate(curX, ny);
          const tpb = tp.getBoundingBox();
          if (tpb.minY >= spacing) {
            let ok = true;
            for (const o of this.placedPieces) {
              if (o === r) continue;
              const op = o.polygon.translate(o.x, o.y);
              if (!this.isValidAgainstPlaced(tp, op, spacing)) {
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
        if (!this.isValidAgainstPlaced(pp, op, spacing)) {
            // Revert to pre-compaction position
          // Revert to pre-compaction position
          const orig = origPositions.get(p);
          if (orig) { p.x = orig.x; p.y = orig.y; }
          const origO = origPositions.get(o);
          if (origO) { o.x = origO.x; o.y = origO.y; }
        }
      }
    }
  }

  private localOptimize(): void {
    logger.info(`\n🔧 === 局部优化 (Local Optimization) ===`);
    
    let improved = true;
    let iteration = 0;
    const maxIterations = 3;
    let totalImprovements = 0;

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;
      let iterImprovements = 0;

      const currentHeight = this.getCurrentHeight();
      logger.info(`   📍 迭代 ${iteration}/${maxIterations}, 当前高度=${currentHeight.toFixed(1)}cm`);

      for (let i = this.placedPieces.length - 1; i >= 0; i--) {
        const piece = this.placedPieces[i];
        const bb = piece.polygon.getBoundingBox();
        const area = bb.width * bb.height;
        
        if (area > 3000) continue;

        const originalX = piece.x;
        const originalY = piece.y;

        this.placedPieces.splice(i, 1);

        const betterPos = this.findBetterPosition(piece, currentHeight);
        
        if (betterPos && this.isPositionBetter(betterPos, originalX, originalY)) {
          piece.x = betterPos.x;
          piece.y = betterPos.y;
          this.placedPieces.splice(i, 0, piece);
          improved = true;
          iterImprovements++;
          totalImprovements++;
          
          if (iterImprovements <= 3) {
            logger.info(`   ✅ 优化: ${piece.pieceId} (${originalX.toFixed(1)},${originalY.toFixed(1)}) → (${betterPos.x.toFixed(1)},${betterPos.y.toFixed(1)})`);
          }
        } else {
          this.placedPieces.splice(i, 0, piece);
        }
      }

      if (iterImprovements > 0) {
        const newHeight = this.getCurrentHeight();
        logger.info(`   📊 迭代 ${iteration} 完成: 改进${iterImprovements}处, 高度 ${currentHeight.toFixed(1)} → ${newHeight.toFixed(1)}cm`);
      }
    }

    logger.info(`   ✅ 局部优化完成: 共改进${totalImprovements}处, 最终高度=${this.getCurrentHeight().toFixed(1)}cm`);
  }

  private getCurrentHeight(): number {
    if (this.placedPieces.length === 0) return 0;
    return Math.max(...this.placedPieces.map(p => 
      p.polygon.translate(p.x, p.y).getBoundingBox().maxY
    ));
  }

  private findBetterPosition(piece: PlacedPiece, currentHeight: number): { x: number; y: number } | null {
    const poly = piece.polygon;
    const bb = poly.getBoundingBox();
    const spacing = this.config.spacing;
    
    let bestPos: { x: number; y: number } | null = null;
    let bestScore = Infinity;

    const yLevels = new Set<number>();
    yLevels.add(spacing - bb.minY);

    for (const placed of this.placedPieces) {
      if (placed.pieceId === piece.pieceId) continue;
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      yLevels.add(pb.maxY + spacing - bb.minY);
      yLevels.add(pb.minY - spacing - bb.maxY);
      yLevels.add((pb.minY + pb.maxY) / 2 - (bb.minY + bb.maxY) / 2);
    }

    for (const cy of Array.from(yLevels).sort((a, b) => a - b)) {
      if (cy + bb.minY < spacing || cy + bb.maxY > this.config.fabricHeight) continue;

      const xPositions = this.findValidXPositionsForPiece(poly, piece.pieceId, cy);
      
      for (const cx of xPositions) {
        const testPoly = poly.translate(cx, cy);
        
        if (!this.isValidPlacement(testPoly, piece.pieceId, spacing)) continue;

        const testBb = testPoly.getBoundingBox();
        const score = this.evaluatePositionScore(testBb, cx, cy, currentHeight);
        
        if (score < bestScore) {
          bestScore = score;
          bestPos = { x: cx, y: cy };
        }
      }
    }

    const nfpContactCandidates = this.useNfpCandidates
      ? this.generateNFPContactCandidates(poly, piece.pieceId)
      : [];
    for (const candidate of nfpContactCandidates) {
      const testPoly = poly.translate(candidate.x, candidate.y);
      if (!this.isValidPlacement(testPoly, piece.pieceId, spacing)) continue;

      const testBb = testPoly.getBoundingBox();
      const score = this.evaluatePositionScore(testBb, candidate.x, candidate.y, currentHeight);

      if (score < bestScore) {
        bestScore = score;
        bestPos = { x: candidate.x, y: candidate.y };
      }
    }

    return bestPos;
  }

  private findValidXPositionsForPiece(polygon: Polygon, pieceId: string, cy: number): number[] {
    const spacing = this.config.spacing;
    const fw = this.config.fabricWidth;
    const b = polygon.getBoundingBox();

    const xCands = new Set<number>();
    xCands.add(spacing - b.minX);

    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      
      if (!(cy + b.maxY < pb.minY - spacing || cy + b.minY > pb.maxY + spacing)) {
        xCands.add(pb.maxX + spacing - b.minX);
        xCands.add(pb.minX - spacing - b.maxX);
      }
      
      const midX = (pb.minX + pb.maxX) / 2;
      xCands.add(midX - (b.minX + b.maxX) / 2);
    }

    const validPositions: number[] = [];
    for (const cx of xCands) {
      if (cx + b.minX < spacing || cx + b.maxX > fw - spacing) continue;
      
      const testPoly = polygon.translate(cx, cy);
      if (this.isValidPlacement(testPoly, pieceId, spacing)) {
        validPositions.push(cx);
      }
    }

    return validPositions.sort((a, b) => a - b);
  }

  private evaluatePositionScore(bb: BoundingBox, x: number, y: number, currentHeight: number): number {
    let maxY = bb.maxY;
    for (const placed of this.placedPieces) {
      const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
      maxY = Math.max(maxY, pb.maxY);
    }

    const heightIncrease = Math.max(0, maxY - currentHeight);
    const rightSpace = (this.config.fabricWidth / 10) - bb.maxX;
    
    let score = heightIncrease * 1000;
    score += y * 2;
    score += rightSpace * 0.5;
    
    let neighborDist = 0;
    let neighborCount = 0;
    for (const placed of this.placedPieces) {
      const dist = Math.abs(placed.x - x) + Math.abs(placed.y - y);
      if (dist < 80) {
        neighborDist += dist;
        neighborCount++;
      }
    }
    
    if (neighborCount > 0) {
      score -= neighborCount * 10;
    }

    return score;
  }

  private isPositionBetter(newPos: { x: number; y: number }, oldX: number, oldY: number): boolean {
    const threshold = 0.5;
    
    if (newPos.y < oldY - threshold) return true;
    if (Math.abs(newPos.y - oldY) < threshold && newPos.x < oldX - threshold) return true;
    
    return false;
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


      // 加上归一化偏移量，使输出位置对应原始缝份路径
      const pn = this.getBasePieceId(placed.pieceId);
      const off = this.polygonOffsets.get(pn);
      positions.push({
        pieceId: placed.pieceId,
        x: off ? placed.x + off.x : placed.x,
        y: off ? placed.y + off.y : placed.y,
        rotation: placed.rotation,
      });
    }

    // 实际使用尺寸：宽度=门幅方向最大值，长度=排料方向最大值
    const bw = maxX + this.config.spacing;
    const bh = maxY + this.config.spacing;

    // 利用率计算：总面积 = 门幅 × 排料长度
    // 这是工业标准：布料面积 = 门幅宽度 × 实际使用长度
    const fabricArea = this.config.fabricWidth * bh;

    return {
      positions,
      utilization: fabricArea > 0 ? (usedArea / fabricArea) * 100 : 0,
      totalArea,
      usedArea,
      bounds: { width: bw, height: bh },
    };
  }

  getPlacedPolygons(): Array<{ id: string; polygon: Polygon; x: number; y: number; rotation: number }> {
    return this.placedPieces.map(p => {
      const pn = this.getBasePieceId(p.pieceId);
      const off = this.polygonOffsets.get(pn);
      return {
        id: p.pieceId,
        polygon: off ? p.polygon.translate(-off.x, -off.y) : p.polygon,
        x: off ? p.x + off.x : p.x,
        y: off ? p.y + off.y : p.y,
        rotation: p.rotation,
      };
    });
  }

  optimize(iterations: number = 10): NestResult {
    let bestResult = this.nest();
    let bestUtil = bestResult.utilization;

    for (let i = 0; i < iterations; i++) {
      this.shufflePieces();
      const r = this.nest(false);  // 使用随机顺序（不按面积排序），使旋转组合多样化
      if (r.utilization > bestUtil) {
        bestResult = r;
        bestUtil = r.utilization;
      }
    }
    return bestResult;
  }

  /**
   * 多实例裁片的旋转组合优化
   * 对 quantity >= 2 的裁片（如袖子×2、前片×2），尝试交换/翻转各实例的旋转角度，
   * 使裁片之间能够交错排列，减少总排料长度。
   */
  private postOptimizeRotations(): void {
    for (const piece of this.pieces) {
      if (piece.quantity < 2 || piece.rotations.length < 2) continue;

      const instances = this.placedPieces.filter(p => p.pieceId.startsWith(`${piece.id}_`));
      if (instances.length < 2) continue;

      logger.info(`   🔄 旋转优化: ${piece.id} (${instances.length}个实例, ${piece.rotations.length}种旋转)`);

      for (let iter = 0; iter < 8; iter++) {
        let improved = false;

        for (const inst of instances) {
          const currentRi = piece.rotations.findIndex(r => r.angle === inst.rotation);
          if (currentRi < 0 || piece.rotations.length <= 1) continue;

          // 尝试另一个旋转角度
          const otherRi = (currentRi + 1) % piece.rotations.length;
          if (otherRi === currentRi) continue;

          const altOption = piece.rotations[otherRi];
          const altPoly = altOption.polygon;
          const altAngle = altOption.angle;

          // 先尝试原位旋转（快速路径）
          const testPolyAtOrigin = altPoly.translate(inst.x, inst.y);
          let originOk = true;
          for (const other of this.placedPieces) {
            if (other === inst) continue;
            const op = other.polygon.translate(other.x, other.y);
            if (!this.isValidAgainstPlaced(testPolyAtOrigin, op, this.config.spacing)) {
              originOk = false;
              break;
            }
          }

          if (originOk) {
            // 原位OK，检查是否改善
            const beforeMaxY = Math.max(...this.placedPieces.map(p =>
              p.polygon.translate(p.x, p.y).getBoundingBox().maxY));
            const afterBb = testPolyAtOrigin.getBoundingBox();
            const otherMaxY = Math.max(...this.placedPieces.filter(p => p !== inst).map(p =>
              p.polygon.translate(p.x, p.y).getBoundingBox().maxY));
            const afterMaxY = Math.max(afterBb.maxY, otherMaxY);

            if (afterMaxY <= beforeMaxY + 0.5) {
              inst.polygon = altPoly;
              inst.rotation = altAngle;
              improved = true;
              logger.info(`      ✅ ${inst.pieceId}: 原位旋转 ${inst.rotation}° → ${altAngle}°`);
              continue;
            }
          }

          // 原位不行或没改善 → 尝试重新寻找位置
          const newPos = this.findBLPosition(altPoly, inst.pieceId + '_reopt');
          if (newPos) {
            // 计算新位置的score
            const newTestPoly = altPoly.translate(newPos.x, newPos.y);
            const newBb = newTestPoly.getBoundingBox();
            let newMaxY = newBb.maxY;
            let newMaxX = newBb.maxX;
            for (const placed of this.placedPieces) {
              if (placed === inst) continue;
              const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
              newMaxY = Math.max(newMaxY, pb.maxY);
              newMaxX = Math.max(newMaxX, pb.maxX);
            }
            const newScore = newMaxY * this.config.fabricWidth + newMaxX;

            // 当前位置的score
            const curTestPoly = inst.polygon.translate(inst.x, inst.y);
            const curBb = curTestPoly.getBoundingBox();
            let curMaxY = curBb.maxY;
            let curMaxX = curBb.maxX;
            for (const placed of this.placedPieces) {
              if (placed === inst) continue;
              const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
              curMaxY = Math.max(curMaxY, pb.maxY);
              curMaxX = Math.max(curMaxX, pb.maxX);
            }
            const curScore = curMaxY * this.config.fabricWidth + curMaxX;

            if (newScore < curScore - 1) { // 至少改善1分才切换
              inst.polygon = altPoly;
              inst.x = newPos.x;
              inst.y = newPos.y;
              inst.rotation = altAngle;
              improved = true;
              logger.info(`      ✅ ${inst.pieceId}: 重定位+旋转 → (${newPos.x.toFixed(1)},${newPos.y.toFixed(1)}) ${altAngle}° score ${curScore.toFixed(0)}→${newScore.toFixed(0)}`);
            }
          }
        }

        if (!improved) break;
      }
    }
  }

  private shufflePieces(): void {
    for (let i = this.pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
    }
  }

  private getBasePieceId(pieceId: string): string {
    return pieceId.replace(/_\d+(?:_.*)?$/, '');
  }

  private isValidAgainstPlaced(candidate: Polygon, placed: Polygon, spacing: number): boolean {
    const cb = candidate.getBoundingBox();
    const pb = placed.getBoundingBox();

    if (cb.maxX + spacing <= pb.minX || cb.minX - spacing >= pb.maxX ||
        cb.maxY + spacing <= pb.minY || cb.minY - spacing >= pb.maxY) {
      return true;
    }

    if (SATCollision.testCollisionRobust(candidate, placed).collides) {
      return false;
    }

    return SATCollision.getDistance(candidate, placed) >= spacing;
  }

  private isValidPlacement(candidate: Polygon, pieceId: string, spacing: number): boolean {
    for (const placed of this.placedPieces) {
      if (placed.pieceId === pieceId) continue;
      const placedPoly = placed.polygon.translate(placed.x, placed.y);
      if (!this.isValidAgainstPlaced(candidate, placedPoly, spacing)) {
        return false;
      }
    }
    return true;
  }

  static nestPieces(pieces: PatternPiece[], config: Partial<NestConfig> = {}): NestResult {
    const engine = new NestEngine(config);
    engine.addPieces(pieces);
    return engine.nest();
  }
}
