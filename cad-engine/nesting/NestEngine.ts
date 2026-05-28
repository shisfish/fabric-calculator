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
  rotations: Array<{ angle: number; polygon: Polygon }>;
  isAccessory?: boolean; // 标记是否为配件（口袋等小裁片），用于两阶段排料
}

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
        const isSmallFiller = bb.width * bb.height < 1000;
        this.pieces.push({
          id: piece.name,
          polygon: normalized,
          quantity: piece.cutCount,
          rotations,
          isAccessory: !!(piece as any).isAccessory || isSmallFiller ||
            piece.name.includes('口袋') || piece.name.includes('领') ||
            piece.name.includes('袖口') || piece.name.includes('罗纹') ||
            piece.name === '配件' || piece.name === '其他配件',
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

  nest(sortByArea: boolean = true): NestResult {
    this.placedPieces = [];
    const allPieces = sortByArea ? this.sortPiecesByArea() : [...this.pieces];

    // ===== 分离主裁片和配件 =====
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

    // Phase 1: 只放主裁片
    for (const nestingPiece of mainPieces) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        this.placePiece(nestingPiece, q);
      }
    }

    // Phase 1优化
    this.postOptimizeRotations();
    this.compactLayout();

    const phase1MaxY = Math.max(...this.placedPieces.map(p =>
      p.polygon.translate(p.x, p.y).getBoundingBox().maxY));
    logger.info(`   ✅ Phase 1 完成: 长度=${phase1MaxY.toFixed(1)}cm`);

    // Phase 2: 放入配件，优先利用主裁片形成的空位，不主动拉长排料
    for (const nestingPiece of accessoryPieces) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        this.placePiece(nestingPiece, q);
      }
    }

    // 最终优化：保留小件填缝结果，避免把配件强制下沉后拉长排料长度
    this.compactLayout();
    this.clampToBoundary();

    return this.calculateResult();
  }

  private sortPiecesByArea(): NestingPiece[] {
    return [...this.pieces].sort((a, b) => b.polygon.getArea() - a.polygon.getArea());
  }

  private getAccessoryPriority(piece: NestingPiece): number {
    if (piece.id.includes('领')) return 0;
    if (piece.id.includes('袖口') || piece.id.includes('口袋')) return 1;
    if (piece.id.includes('罗纹')) return 2;
    return 3;
  }

  private placePiece(nestingPiece: NestingPiece, index: number, preferBottom: boolean = false): boolean {
    const pieceId = `${nestingPiece.id}_${index}`;
    let bestPos: { x: number; y: number; rotation: number } | null = null;
    let bestScore = Infinity;

    // ===== 交错旋转策略：多实例时交替使用不同旋转角度以利用形状互补嵌套 =====
    const rotationOrder: number[] = [];
    if (nestingPiece.quantity >= 2 && nestingPiece.rotations.length >= 2 && !this.config.fabricNap) {
      // 偶数实例优先0度，奇数实例优先180度
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
      const pos = this.findBLPosition(poly, pieceId);

      if (pos) {
        // 评分：总长度(maxY) × 门幅 + 宽度占用(maxX) - 紧凑性奖励
        const testPoly = poly.translate(pos.x, pos.y);
        const testBb = testPoly.getBoundingBox();

        let currentMaxY = testBb.maxY;
        let currentMaxX = testBb.maxX;
        for (const placed of this.placedPieces) {
          const pb = placed.polygon.translate(placed.x, placed.y).getBoundingBox();
          currentMaxY = Math.max(currentMaxY, pb.maxY);
          currentMaxX = Math.max(currentMaxX, pb.maxX);
        }

        // 紧凑性指标：与已放置裁片的平均SAT距离（越小越紧凑）
        let compactness = 0;
        let neighborCount = 0;
        for (const placed of this.placedPieces) {
          const op = placed.polygon.translate(placed.x, placed.y);
          const dist = SATCollision.getDistance(testPoly, op);
          if (dist < 100) { // 只考虑附近的裁片
            compactness += dist;
            neighborCount++;
          }
        }
        const avgDist = neighborCount > 0 ? compactness / neighborCount : 50;
        // 紧凑性奖励：平均距离越小越好，用负值作为奖励
        const compactBonus = -avgDist * 0.3;

        const fw = this.config.fabricWidth;
        
        // 底部优先模式：配件优先选择Y更大的位置（填充下部空白）
        // 使用负的Y值作为奖励，让底部位置得分更低（更好）
        let score: number;
        if (preferBottom) {
          score = currentMaxY * fw + currentMaxX + compactBonus - pos.y * 2; // Y越大，减分越多
        } else {
          score = currentMaxY * fw + currentMaxX + compactBonus;
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

    let best: Point | null = null;
    let bestScore = Infinity;
    const evaluateCandidate = (candidate: Point): void => {
      if (candidate.x + b.minX < spacing) return;
      if (candidate.x + b.maxX > fw - spacing) return;
      if (candidate.y + b.minY < spacing) return;
      if (candidate.y + b.maxY > this.config.fabricHeight - spacing) return;

      const testPoly = polygon.translate(candidate.x, candidate.y);
      let valid = true;
      for (const placed of this.placedPieces) {
        if (placed.pieceId === pieceId) continue;
        const placedPoly = placed.polygon.translate(placed.x, placed.y);
        if (SATCollision.testCollisionRobust(testPoly, placedPoly).collides ||
            SATCollision.getDistance(testPoly, placedPoly) < spacing) {
          valid = false;
          break;
        }
      }
      if (!valid) return;

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

    const selected = best as Point | null;
    logger.info(`   ✅ findBLPosition结果: ${pieceId} → ${selected ? `(${selected.x.toFixed(1)}, ${selected.y.toFixed(1)}) score=${bestScore.toFixed(0)}` : 'NULL'}`);
    return selected;
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
          const dist = SATCollision.getDistance(testPoly, pp.poly);
          if (dist < spacing) {
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
        const result = SATCollision.testCollisionRobust(testPoly, placedPoly);

        const pb = placedPoly.getBoundingBox();
        const tb = testPoly.getBoundingBox();
        // 即使SAT未检测到碰撞，也要检查间距是否 >= spacing
        if (result.collides ||
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
              const dist = SATCollision.getDistance(tp, op);
              if (dist < spacing) {
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
              const dist = SATCollision.getDistance(tp, op);
              if (dist < spacing) {
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
        if (SATCollision.testCollisionRobust(pp, op).collides ||
            SATCollision.getDistance(pp, op) < spacing) {
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
      const pn = placed.pieceId.replace(/_\d+$/, '');
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
      const pn = p.pieceId.replace(/_\d+$/, '');
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

      const instances = this.placedPieces.filter(p => p.pieceId.startsWith(piece.id));
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
            if (SATCollision.testCollisionRobust(testPolyAtOrigin, op).collides ||
                SATCollision.getDistance(testPolyAtOrigin, op) < this.config.spacing) {
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

  static nestPieces(pieces: PatternPiece[], config: Partial<NestConfig> = {}): NestResult {
    const engine = new NestEngine(config);
    engine.addPieces(pieces);
    return engine.nest();
  }
}
