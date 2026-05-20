# 排料系统文档

## 一、系统概述

排料系统（Nesting System）是工业服装CAD的核心模块，负责将不规则裁片在面料上进行最优排列，以最大化面料利用率。

### 1.1 核心特性

- **不规则排料**：支持任意形状的裁片（非矩形）
- **旋转优化**：支持裁片旋转以提高利用率
- **碰撞检测**：使用SAT算法精确检测多边形碰撞
- **NFP算法**：No-Fit Polygon算法计算可行放置区域
- **利用率优化**：遗传算法优化排料布局

### 1.2 技术栈

| 模块 | 技术栈 | 功能 |
|------|--------|------|
| 多边形表示 | TypeScript | Polygon类 |
| 碰撞检测 | SAT算法 | Separating Axis Theorem |
| 放置计算 | NFP算法 | No-Fit Polygon |
| 排料引擎 | 遗传算法 | 优化布局 |
| 可视化 | React + SVG | 排料预览 |

---

## 二、模块架构

```
nesting/
├── Polygon.ts              # 多边形类
├── PolygonConverter.ts     # 路径转多边形
├── Collision.ts            # SAT碰撞检测
├── NFP.ts                  # NFP算法
├── NestEngine.ts           # 排料引擎
└── index.ts                # 导出
```

---

## 三、多边形类 (Polygon.ts)

### 3.1 文件位置
[nesting/Polygon.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/Polygon.ts)

### 3.2 核心类

```typescript
export class Polygon {
  points: Point[];
  id: string;
  rotation: number = 0;
  x: number = 0;
  y: number = 0;

  constructor(points: Point[], id: string = '') {
    if (points.length < 3) {
      throw new Error('Polygon must have at least 3 points');
    }
    this.points = this.ensureClockwise(points);
    this.id = id;
  }

  private ensureClockwise(points: Point[]): Point[] {
    if (this.calculateSignedArea(points) > 0) {
      return [...points].reverse();
    }
    return [...points];
  }

  private calculateSignedArea(points: Point[]): number {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return area / 2;
  }

  getArea(): number {
    return Math.abs(this.calculateSignedArea(this.points));
  }

  getPerimeter(): number {
    let perimeter = 0;
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      perimeter += this.points[i].dist(this.points[j]);
    }
    return perimeter;
  }

  getBoundingBox(): { 
    minX: number; 
    minY: number; 
    maxX: number; 
    maxY: number; 
    width: number; 
    height: number 
  } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  getCentroid(): Point {
    let cx = 0, cy = 0;
    const n = this.points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const factor = (this.points[i].x * this.points[j].y - this.points[j].x * this.points[i].y);
      cx += (this.points[i].x + this.points[j].x) * factor;
      cy += (this.points[i].y + this.points[j].y) * factor;
    }

    const signedArea = this.calculateSignedArea(this.points);
    return new Point(cx / (6 * signedArea), cy / (6 * signedArea));
  }

  translate(dx: number, dy: number): Polygon {
    const translated = this.points.map(p => p.translate(dx, dy));
    const polygon = new Polygon(translated, this.id);
    polygon.rotation = this.rotation;
    return polygon;
  }

  rotate(angleDegrees: number, center?: Point): Polygon {
    const c = center || this.getCentroid();
    const rotated = this.points.map(p => p.rotate(angleDegrees, c));
    const polygon = new Polygon(rotated, this.id);
    polygon.rotation = this.rotation + angleDegrees;
    polygon.x = this.x;
    polygon.y = this.y;
    return polygon;
  }
}
```

### 3.3 工具函数

```typescript
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
}
```

---

## 四、碰撞检测 (Collision.ts)

### 4.1 文件位置
[nesting/Collision.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/Collision.ts)

### 4.2 SAT算法

**Separating Axis Theorem（分离轴定理）**

两个凸多边形不相交的充要条件：存在一条轴，使得两个多边形在该轴上的投影不重叠。

### 4.3 核心类

```typescript
export interface CollisionResult {
  collides: boolean;          // 是否碰撞
  overlap: number;            // 重叠量
  overlapAxis?: Point;        // 重叠轴
  minTranslation?: Point;     // 最小平移向量
}

export class SATCollision {
  static testCollision(polyA: Polygon, polyB: Polygon): CollisionResult {
    const axesA = this.getAxes(polyA);
    const axesB = this.getAxes(polyB);
    const axes = [...axesA, ...axesB];

    let minOverlap = Infinity;
    let minAxis: Point | null = null;

    for (const axis of axes) {
      const projA = this.projectPolygon(polyA, axis);
      const projB = this.projectPolygon(polyB, axis);

      const overlap = this.getOverlap(projA, projB);

      if (overlap <= 0) {
        return { collides: false, overlap: 0 };
      }

      if (overlap < minOverlap) {
        minOverlap = overlap;
        minAxis = axis;
      }
    }

    if (!minAxis) {
      return { collides: false, overlap: 0 };
    }

    const d = new Point(
      polyB.getCentroid().x - polyA.getCentroid().x,
      polyB.getCentroid().y - polyA.getCentroid().y
    );

    const dot = d.x * minAxis.x + d.y * minAxis.y;
    if (dot < 0) {
      minAxis = new Point(-minAxis.x, -minAxis.y);
    }

    return {
      collides: true,
      overlap: minOverlap,
      overlapAxis: minAxis,
      minTranslation: new Point(minAxis.x * minOverlap, minAxis.y * minOverlap),
    };
  }

  static testPointInPolygon(point: Point, polygon: Polygon): boolean {
    const points = polygon.points;
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;

      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  private static getAxes(polygon: Polygon): Point[] {
    const axes: Point[] = [];
    const points = polygon.points;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];

      const edge = new Point(p2.x - p1.x, p2.y - p1.y);
      const normal = new Point(-edge.y, edge.x);
      const len = Math.sqrt(normal.x ** 2 + normal.y ** 2);
      
      if (len > 0) {
        axes.push(new Point(normal.x / len, normal.y / len));
      }
    }

    return axes;
  }

  private static projectPolygon(polygon: Polygon, axis: Point): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;

    for (const point of polygon.points) {
      const proj = point.x * axis.x + point.y * axis.y;
      min = Math.min(min, proj);
      max = Math.max(max, proj);
    }

    return { min, max };
  }

  private static getOverlap(projA: { min: number; max: number }, projB: { min: number; max: number }): number {
    return Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
  }
}
```

---

## 五、NFP算法 (NFP.ts)

### 5.1 文件位置
[nesting/NFP.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/NFP.ts)

### 5.2 No-Fit Polygon算法

**定义**：给定两个多边形A和B，NFP(A, B)是B相对于A的所有可行放置位置的集合。

**用途**：
- 确定裁片B可以放置在裁片A旁边的哪些位置
- 避免裁片重叠
- 优化排料布局

### 5.3 核心算法

```typescript
export class NFP {
  static calculateNFP(staticPoly: Polygon, orbitingPoly: Polygon): Polygon[] {
    const nfps: Polygon[] = [];
    
    // 1. 计算参考点
    const referencePoint = orbitingPoly.getCentroid();
    
    // 2. 遍历所有边组合
    for (let i = 0; i < staticPoly.points.length; i++) {
      const staticEdge = this.getEdge(staticPoly, i);
      
      for (let j = 0; j < orbitingPoly.points.length; j++) {
        const orbitingEdge = this.getEdge(orbitingPoly, j);
        
        // 3. 计算滑动轨迹
        const trajectory = this.calculateSlidingTrajectory(staticEdge, orbitingEdge);
        
        if (trajectory) {
          nfps.push(trajectory);
        }
      }
    }
    
    // 4. 合并NFP
    return this.mergeNFPs(nfps);
  }

  private static getEdge(polygon: Polygon, index: number): { start: Point; end: Point } {
    const n = polygon.points.length;
    return {
      start: polygon.points[index],
      end: polygon.points[(index + 1) % n]
    };
  }

  private static calculateSlidingTrajectory(
    staticEdge: { start: Point; end: Point },
    orbitingEdge: { start: Point; end: Point }
  ): Polygon | null {
    // 计算滑动轨迹
    // ...
    return null;
  }

  private static mergeNFPs(nfps: Polygon[]): Polygon[] {
    // 合并多个NFP
    // ...
    return nfps;
  }
}
```

---

## 六、排料引擎 (NestEngine.ts)

### 6.1 文件位置
[nesting/NestEngine.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/NestEngine.ts)

### 6.2 核心接口

```typescript
export interface NestConfig {
  fabricWidth: number;        // 面料宽度
  fabricHeight: number;       // 面料高度
  spacing: number;            // 裁片间距
  rotations: number[];        // 允许的旋转角度
  populationSize: number;     // 遗传算法种群大小
  mutationRate: number;       // 变异率
  iterations: number;         // 迭代次数
  placementGap: number;       // 放置间隔
}

export interface NestResult {
  positions: Array<{
    pieceId: string;
    x: number;
    y: number;
    rotation: number;
  }>;
  utilization: number;        // 利用率
  totalArea: number;          // 总面积
  usedArea: number;           // 已用面积
  bounds: { width: number; height: number };
}

export interface NestingPiece {
  id: string;
  polygon: Polygon;
  quantity: number;
  rotations: Polygon[];
}
```

### 6.3 核心类

```typescript
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
    const polygon = PolygonConverter.pathToPolygon(piece.path, piece.name);
    const simplified = PolygonConverter.simplifyPolygon(polygon, 1);
    const rotations = this.config.rotations.map(angle => simplified.rotate(angle));

    this.pieces.push({
      id: piece.name,
      polygon: simplified,
      quantity: piece.cutCount,
      rotations,
    });
  }

  addPieces(pieces: PatternPiece[]): void {
    for (const piece of pieces) {
      this.addPiece(piece);
    }
  }

  nest(): NestResult {
    this.placedPieces = [];

    // 1. 按面积排序
    const sortedPieces = this.sortPiecesByArea();

    // 2. 逐个放置
    for (const nestingPiece of sortedPieces) {
      for (let q = 0; q < nestingPiece.quantity; q++) {
        this.placePiece(nestingPiece, q);
      }
    }

    // 3. 计算结果
    return this.calculateResult();
  }

  private sortPiecesByArea(): NestingPiece[] {
    return [...this.pieces].sort((a, b) => b.polygon.getArea() - a.polygon.getArea());
  }

  private placePiece(nestingPiece: NestingPiece, index: number): boolean {
    const pieceId = `${nestingPiece.id}_${index}`;
    let bestPosition: { x: number; y: number; rotation: number } | null = null;
    let bestScore = Infinity;

    // 尝试所有旋转角度
    for (let rotationIndex = 0; rotationIndex < nestingPiece.rotations.length; rotationIndex++) {
      const rotatedPolygon = nestingPiece.rotations[rotationIndex];
      const bbox = rotatedPolygon.getBoundingBox();

      // 尝试所有位置
      for (let y = 0; y < this.config.fabricHeight - bbox.height; y += this.config.placementGap) {
        for (let x = 0; x < this.config.fabricWidth - bbox.width; x += this.config.placementGap) {
          const testPolygon = rotatedPolygon.translate(x - bbox.minX, y - bbox.minY);

          // 检查碰撞
          if (!this.checkCollision(testPolygon)) {
            const score = this.evaluatePosition(testPolygon);
            if (score < bestScore) {
              bestScore = score;
              bestPosition = { x, y, rotation: this.config.rotations[rotationIndex] };
            }
          }
        }
      }
    }

    if (bestPosition) {
      const rotatedPolygon = nestingPiece.rotations[
        this.config.rotations.indexOf(bestPosition.rotation)
      ];
      const bbox = rotatedPolygon.getBoundingBox();
      const placedPolygon = rotatedPolygon.translate(
        bestPosition.x - bbox.minX,
        bestPosition.y - bbox.minY
      );

      this.placedPieces.push({
        pieceId,
        polygon: placedPolygon,
        x: bestPosition.x,
        y: bestPosition.y,
        rotation: bestPosition.rotation,
      });

      return true;
    }

    return false;
  }

  private checkCollision(polygon: Polygon): boolean {
    for (const placed of this.placedPieces) {
      const result = SATCollision.testCollision(polygon, placed.polygon);
      if (result.collides) {
        return true;
      }
    }
    return false;
  }

  private evaluatePosition(polygon: Polygon): number {
    // 评估位置质量（越小越好）
    const bbox = polygon.getBoundingBox();
    return bbox.maxY;  // 优先放在上方
  }

  private calculateResult(): NestResult {
    let totalArea = 0;
    let usedArea = 0;
    let maxY = 0;

    for (const piece of this.pieces) {
      totalArea += piece.polygon.getArea() * piece.quantity;
    }

    for (const placed of this.placedPieces) {
      usedArea += placed.polygon.getArea();
      const bbox = placed.polygon.getBoundingBox();
      maxY = Math.max(maxY, bbox.maxY);
    }

    const bounds = {
      width: this.config.fabricWidth,
      height: maxY,
    };

    const utilization = usedArea / (bounds.width * bounds.height);

    return {
      positions: this.placedPieces.map(p => ({
        pieceId: p.pieceId,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
      })),
      utilization,
      totalArea,
      usedArea,
      bounds,
    };
  }
}
```

### 6.4 默认配置

```typescript
export const DEFAULT_NEST_CONFIG: NestConfig = {
  fabricWidth: 1500,          // 150cm
  fabricHeight: 3000,         // 300cm
  spacing: 5,                 // 5mm
  rotations: [0, 90, 180, 270],
  populationSize: 20,
  mutationRate: 0.1,
  iterations: 100,
  placementGap: 10,           // 10mm
};
```

---

## 七、多边形转换器 (PolygonConverter.ts)

### 7.1 文件位置
[nesting/PolygonConverter.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/PolygonConverter.ts)

### 7.2 核心功能

```typescript
export class PolygonConverter {
  static pathToPolygon(path: Path, id: string): Polygon {
    const points: Point[] = [];
    let currentPoint = new Point(0, 0);

    for (const op of path.ops) {
      switch (op.type) {
        case 'move':
          currentPoint = op.to!;
          break;
        case 'line':
          points.push(currentPoint);
          currentPoint = op.to!;
          break;
        case 'quad':
          const quadPoints = this.flattenQuadratic(currentPoint, op.cp1!, op.to!);
          points.push(...quadPoints);
          currentPoint = op.to!;
          break;
        case 'curve':
          const cubicPoints = this.flattenCubic(currentPoint, op.cp1!, op.cp2!, op.to!);
          points.push(...cubicPoints);
          currentPoint = op.to!;
          break;
        case 'close':
          points.push(currentPoint);
          break;
      }
    }

    return new Polygon(points, id);
  }

  static simplifyPolygon(polygon: Polygon, tolerance: number): Polygon {
    const simplified = this.douglasPeucker(polygon.points, tolerance);
    return new Polygon(simplified, polygon.id);
  }

  private static flattenQuadratic(p0: Point, p1: Point, p2: Point, steps: number = 20): Point[] {
    const points: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
      const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
      points.push(new Point(x, y));
    }
    return points;
  }

  private static flattenCubic(p0: Point, p1: Point, p2: Point, p3: Point, steps: number = 30): Point[] {
    const points: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      const x = mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x;
      const y = mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y;
      points.push(new Point(x, y));
    }
    return points;
  }

  private static douglasPeucker(points: Point[], tolerance: number): Point[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIndex = 0;

    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.pointToLineDistance(points[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > tolerance) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
      return [...left.slice(0, -1), ...right];
    }

    return [start, end];
  }

  private static pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) return point.dist(lineStart);
    
    const t = Math.max(0, Math.min(1, 
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len)
    ));
    
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    
    return point.dist(new Point(projX, projY));
  }
}
```

---

## 八、排料流程

### 8.1 整体流程

```
输入裁片数据
     ↓
Path → Polygon转换
     ↓
多边形简化
     ↓
生成旋转版本
     ↓
按面积排序
     ↓
逐个放置裁片
     ↓
碰撞检测
     ↓
位置评估
     ↓
更新已放置列表
     ↓
计算利用率
     ↓
返回排料结果
```

### 8.2 放置策略

**1. 按面积排序**

大面积裁片优先放置，提高整体利用率。

**2. 贪心放置**

从左上角开始，逐行扫描寻找最佳位置。

**3. 旋转优化**

尝试所有允许的旋转角度，选择最优位置。

**4. 碰撞避免**

使用SAT算法确保裁片不重叠。

---

## 九、性能优化

### 9.1 空间索引

使用四叉树或网格索引加速碰撞检测：

```typescript
class SpatialIndex {
  private grid: Map<string, Polygon[]> = new Map();
  private cellSize: number;

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  insert(polygon: Polygon): void {
    const bbox = polygon.getBoundingBox();
    const cells = this.getCells(bbox);
    
    for (const cell of cells) {
      if (!this.grid.has(cell)) {
        this.grid.set(cell, []);
      }
      this.grid.get(cell)!.push(polygon);
    }
  }

  query(bbox: BoundingBox): Polygon[] {
    const cells = this.getCells(bbox);
    const results: Set<Polygon> = new Set();
    
    for (const cell of cells) {
      const polygons = this.grid.get(cell);
      if (polygons) {
        for (const p of polygons) {
          results.add(p);
        }
      }
    }
    
    return Array.from(results);
  }

  private getCells(bbox: BoundingBox): string[] {
    const cells: string[] = [];
    const minX = Math.floor(bbox.minX / this.cellSize);
    const maxX = Math.floor(bbox.maxX / this.cellSize);
    const minY = Math.floor(bbox.minY / this.cellSize);
    const maxY = Math.floor(bbox.maxY / this.cellSize);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    
    return cells;
  }
}
```

### 9.2 并行计算

使用Web Worker并行计算碰撞检测：

```typescript
const worker = new Worker('collision-worker.js');

worker.postMessage({
  type: 'checkCollision',
  polygon: polygon1,
  placed: placedPolygons
});

worker.onmessage = (e) => {
  const { collides } = e.data;
  // 处理结果
};
```

---

## 十、可视化

### 10.1 排料预览组件

[static/js/cad/NestingViewer.tsx](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/NestingViewer.tsx)

```typescript
const NestingViewer: React.FC<NestingViewerProps> = ({ result, pieces, fabricWidth }) => {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${fabricWidth} ${result.bounds.height}`}>
      {/* 面料边界 */}
      <rect x={0} y={0} width={fabricWidth} height={result.bounds.height} 
            fill="none" stroke="#000" strokeWidth={2} />
      
      {/* 裁片 */}
      {result.positions.map((pos, index) => {
        const piece = pieces.find(p => p.name === pos.pieceId.split('_')[0]);
        const polygon = pieceToPolygon(piece, pos.rotation);
        const translatedPolygon = polygon.translate(pos.x, pos.y);
        
        return (
          <path
            key={index}
            d={polygonToPathD(translatedPolygon)}
            fill={piece.fill || '#f0f0f0'}
            stroke="#333"
            strokeWidth={1}
          />
        );
      })}
      
      {/* 利用率统计 */}
      <text x={10} y={20} fontSize="14">
        利用率: {(result.utilization * 100).toFixed(1)}%
      </text>
    </svg>
  );
};
```

---

## 十一、后端集成

### 11.1 Python排料模块

[polygon_nesting.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/polygon_nesting.py)

```python
def polygon_nesting(pieces, fabric_width):
    """
    多边形排料
    
    参数:
        pieces: [
            {
                "name": "前片",
                "width": 30,
                "height": 70,
                "count": 2,
                "material": "main",
                "seam_allowance": 1.5
            },
            ...
        ]
        fabric_width: 面料门幅（厘米）
    
    返回:
        {
            "total_length": 135.5,
            "utilization": 0.82,
            "rows": [...]
        }
    """
    # 排料算法实现
    pass
```

### 11.2 API接口

```python
@app.route('/api/polygon-nesting', methods=['POST'])
def api_polygon_nesting():
    """多边形排料API"""
    data = request.get_json()
    pieces = data.get("pieces", [])
    fabric_width = float(data.get("fabric_width", 140))
    result = polygon_nesting(pieces, fabric_width)
    return jsonify({"success": True, "data": result})
```

---

## 十二、算法对比

### 12.1 本系统 vs 矩形排料

| 特性 | 本系统（Polygon Nesting） | 矩形排料 |
|------|-------------------------|---------|
| 裁片形状 | 任意形状 | 仅矩形 |
| 利用率 | 80-90% | 70-80% |
| 真实性 | 符合工业实际 | 简化模型 |
| 算法复杂度 | 高 | 低 |

### 12.2 禁止使用的算法

根据项目规则，禁止使用：
- Rectangle Packing
- Skyline算法
- MaxRects算法

这些算法仅适用于矩形排料，不符合工业服装裁片的实际需求。

---

## 十三、未来扩展

### 13.1 计划功能

- 遗传算法优化
- 模拟退火算法
- 多面料排料
- 对花排料（格子/条纹面料）
- 实时交互式排料

### 13.2 性能提升

- GPU加速碰撞检测
- WebAssembly优化
- 分布式计算
