# 几何核心模块文档

## 一、模块概览

几何核心模块是整个工业服装CAD系统的基础，采用TypeScript实现，提供工业级几何计算能力。

| 模块 | 路径 | 功能 |
|------|------|------|
| 点类 | geometry/Point.ts | 点、向量、属性管理 |
| 路径类 | geometry/Path.ts | SVG路径操作 |
| Bezier曲线 | geometry/Bezier.ts | 曲线计算与长度 |
| 版型生成 | patterns/ | T恤、前片、袖子生成 |
| 缝份生成 | patterns/SeamAllowanceGenerator.ts | 分段缝份 |
| 尺寸适配 | patterns/GarmentMeasurementAdapter.ts | 测量数据转换 |

---

## 二、基础几何模块 (geometry/)

### 2.1 点类 (Point.ts)

#### 文件位置
[geometry/Point.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/geometry/Point.ts)

#### 核心类

**1. Point类**

```typescript
export class Point {
  x: number;
  y: number;
  attributes: Attributes;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.attributes = new Attributes();
  }

  clone(): Point {
    const cloned = new Point(this.x, this.y);
    cloned.attributes = this.attributes.clone();
    return cloned;
  }

  dist(that: Point): number {
    const dx = this.x - that.x;
    const dy = this.y - that.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  dx(that: Point): number {
    return that.x - this.x;
  }

  dy(that: Point): number {
    return that.y - this.y;
  }

  angle(that: Point): number {
    const rad = Math.atan2(-this.dy(that), this.dx(that));
    return rad < 0 ? (rad + 2 * Math.PI) * (180 / Math.PI) : rad * (180 / Math.PI);
  }

  shift(angleDegrees: number, distance: number): Point {
    const rad = angleDegrees * (Math.PI / 180);
    return new Point(
      this.x + distance * Math.cos(rad),
      this.y - distance * Math.sin(rad)
    );
  }

  rotate(angleDegrees: number, center?: Point): Point {
    const rad = angleDegrees * (Math.PI / 180);
    const cx = center ? center.x : 0;
    const cy = center ? center.y : 0;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = this.x - cx;
    const dy = this.y - cy;
    return new Point(
      cx + dx * cos - dy * sin,
      cy + dx * sin + dy * cos
    );
  }
}
```

**2. Attributes类**

```typescript
export class Attributes {
  private data: Map<string, string[]> = new Map();

  add(name: string, value: string | number): this {
    if (!this.data.has(name)) {
      this.data.set(name, []);
    }
    this.data.get(name)!.push(String(value));
    return this;
  }

  set(name: string, value: string | number): this {
    this.data.set(name, [String(value)]);
    return this;
  }

  get(name: string): string | undefined {
    const values = this.data.get(name);
    return values ? values.join(' ') : undefined;
  }
}
```

**3. 工具函数**

```typescript
export function deg2rad(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function rad2deg(radians: number): number {
  return radians * 180 / Math.PI;
}

export const GOLDEN_RATIO = 1.618033988749895;
```

---

### 2.2 Bezier曲线 (Bezier.ts)

#### 文件位置
[geometry/Bezier.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/geometry/Bezier.ts)

#### 核心类

**1. CubicBezier类（三次Bezier曲线）**

```typescript
export class CubicBezier {
  p0: Point;  // 起点
  p1: Point;  // 控制点1
  p2: Point;  // 控制点2
  p3: Point;  // 终点

  constructor(p0: Point, p1: Point, p2: Point, p3: Point) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
  }

  getPoint(t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return new Point(
      mt3 * this.p0.x + 3 * mt2 * t * this.p1.x + 3 * mt * t2 * this.p2.x + t3 * this.p3.x,
      mt3 * this.p0.y + 3 * mt2 * t * this.p1.y + 3 * mt * t2 * this.p2.y + t3 * this.p3.y
    );
  }

  getDerivative(t: number): Point {
    const t2 = t * t;
    const mt = 1 - t;
    const mt2 = mt * mt;

    return new Point(
      3 * mt2 * (this.p1.x - this.p0.x) + 6 * mt * t * (this.p2.x - this.p1.x) + 3 * t2 * (this.p3.x - this.p2.x),
      3 * mt2 * (this.p1.y - this.p0.y) + 6 * mt * t * (this.p2.y - this.p1.y) + 3 * t2 * (this.p3.y - this.p2.y)
    );
  }

  getNormal(t: number): Point {
    const derivative = this.getDerivative(t);
    const len = Math.sqrt(derivative.x ** 2 + derivative.y ** 2);
    if (len < 1e-10) return new Point(0, 1);
    return new Point(-derivative.y / len, derivative.x / len);
  }

  getTangent(t: number): Point {
    const derivative = this.getDerivative(t);
    const len = Math.sqrt(derivative.x ** 2 + derivative.y ** 2);
    if (len < 1e-10) return new Point(1, 0);
    return new Point(derivative.x / len, derivative.y / len);
  }

  getCurvature(t: number): number {
    const d = this.getDerivative(t);
    const dd = this.getSecondDerivative(t);
    const cross = d.x * dd.y - d.y * dd.x;
    const len = Math.sqrt(d.x ** 2 + d.y ** 2) ** 3;
    if (len < 1e-10) return 0;
    return cross / len;
  }

  getLength(steps: number = 200): number {
    let length = 0;
    let prev = this.getPoint(0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curr = this.getPoint(t);
      length += prev.dist(curr);
      prev = curr;
    }
    return length;
  }
}
```

**2. QuadraticBezier类（二次Bezier曲线）**

```typescript
export class QuadraticBezier {
  p0: Point;  // 起点
  p1: Point;  // 控制点
  p2: Point;  // 终点

  constructor(p0: Point, p1: Point, p2: Point) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
  }

  getPoint(t: number): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    return new Point(
      mt2 * this.p0.x + 2 * mt * t * this.p1.x + t2 * this.p2.x,
      mt2 * this.p0.y + 2 * mt * t * this.p1.y + t2 * this.p2.y
    );
  }

  getLength(steps: number = 100): number {
    let length = 0;
    let prev = this.getPoint(0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curr = this.getPoint(t);
      length += prev.dist(curr);
      prev = curr;
    }
    return length;
  }
}
```

**3. 工具函数**

```typescript
export function bezierLength(bezier: CubicBezier | QuadraticBezier, steps?: number): number {
  return bezier.getLength(steps);
}

export function bezierPoint(bezier: CubicBezier | QuadraticBezier, t: number): Point {
  return bezier.getPoint(t);
}
```

---

### 2.3 路径类 (Path.ts)

#### 文件位置
[geometry/Path.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/geometry/Path.ts)

#### 核心类

```typescript
export type PathOperationType = 'move' | 'line' | 'quad' | 'curve' | 'close';

export interface PathOperation {
  type: PathOperationType;
  to?: Point;
  cp1?: Point;
  cp2?: Point;
  segmentName?: string;
}

export class Path {
  ops: PathOperation[] = [];
  closed: boolean = false;

  move(to: Point): this {
    this.ops.push({ type: 'move', to });
    return this;
  }

  line(to: Point, segmentName?: string): this {
    this.ops.push({ type: 'line', to, segmentName });
    return this;
  }

  quad(to: Point, cp1: Point, segmentName?: string): this {
    this.ops.push({ type: 'quad', to, cp1, segmentName });
    return this;
  }

  curve(to: Point, cp1: Point, cp2: Point, segmentName?: string): this {
    this.ops.push({ type: 'curve', to, cp1, cp2, segmentName });
    return this;
  }

  close(): this {
    this.ops.push({ type: 'close' });
    this.closed = true;
    return this;
  }

  toSvgPath(): string {
    let d = '';
    for (const op of this.ops) {
      switch (op.type) {
        case 'move':
          d += `M ${op.to!.x} ${op.to!.y} `;
          break;
        case 'line':
          d += `L ${op.to!.x} ${op.to!.y} `;
          break;
        case 'quad':
          d += `Q ${op.cp1!.x} ${op.cp1!.y} ${op.to!.x} ${op.to!.y} `;
          break;
        case 'curve':
          d += `C ${op.cp1!.x} ${op.cp1!.y} ${op.cp2!.x} ${op.cp2!.y} ${op.to!.x} ${op.to!.y} `;
          break;
        case 'close':
          d += 'Z ';
          break;
      }
    }
    return d.trim();
  }

  getLength(): number {
    let length = 0;
    let current = this.ops[0]?.to || new Point(0, 0);

    for (const op of this.ops) {
      switch (op.type) {
        case 'line':
          length += current.dist(op.to!);
          current = op.to!;
          break;
        case 'quad':
          const quad = new QuadraticBezier(current, op.cp1!, op.to!);
          length += quad.getLength();
          current = op.to!;
          break;
        case 'curve':
          const cubic = new CubicBezier(current, op.cp1!, op.cp2!, op.to!);
          length += cubic.getLength();
          current = op.to!;
          break;
      }
    }

    return length;
  }
}
```

---

## 三、版型生成模块 (patterns/)

### 3.1 T恤版型生成器 (Tshirt.ts)

#### 文件位置
[patterns/Tshirt.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/Tshirt.ts)

#### 核心类

```typescript
export interface PatternPiece {
  name: string;
  path: Path;
  points: Record<string, Point>;
  seamAllowance?: number;
  seamAllowancePath?: Path;
  grainline?: { start: Point; end: Point };
  notches?: Point[];
  cutCount: number;
  onFold: boolean;
  
  // 袖山特有属性（工业长度匹配）
  frontCapLength?: number;
  backCapLength?: number;
  totalCapLength?: number;
  frontArmholeLength?: number;
  backArmholeLength?: number;
  ease?: number;
}

export class TshirtPatternGenerator {
  static generatePattern(params: GarmentParams): PatternPiece[] {
    const pieces: PatternPiece[] = [];
    
    const backPiece = this.generateBackPanel(params.backPanel, params.seamAllowance);
    const frontPiece = this.generateFrontPanel(params.frontPanel, params.seamAllowance);
    
    // 提取前后袖窿曲线用于生成袖子
    const frontArmholeOps = this.extractArmholeOps(frontPiece.path);
    const backArmholeOps = this.extractArmholeOps(backPiece.path);
    
    // 使用工业袖山生成器
    const sleevePiece = this.generateSleeveFromArmhole(
      params.sleeve,
      params.seamAllowance,
      frontArmholeOps,
      backArmholeOps,
      (params.frontPanel.armholeDepth + params.backPanel.armholeDepth) / 2
    );

    // 生成缝份
    if (params.seamAllowance && params.seamAllowance > 0) {
      const seamDist = params.seamAllowance;
      
      const backRules = [
        { segment: 'neckline', distance: seamDist },
        { segment: 'shoulder', distance: seamDist },
        { segment: 'armhole', distance: seamDist },
        { segment: 'sideSeam', distance: seamDist },
        { segment: 'hem', distance: seamDist }
      ];
      
      const frontRules = [
        { segment: 'neckline', distance: seamDist },
        { segment: 'shoulder', distance: seamDist },
        { segment: 'armhole', distance: seamDist },
        { segment: 'sideSeam', distance: seamDist },
        { segment: 'hem', distance: seamDist },
        { segment: 'closure', distance: seamDist }
      ];
      
      const sleeveRules = [
        { segment: 'sleeveCap', distance: seamDist },
        { segment: 'frontSeam', distance: seamDist },
        { segment: 'backSeam', distance: seamDist },
        { segment: 'sleeveHem', distance: seamDist }
      ];

      backPiece.seamAllowancePath = SeamAllowanceGenerator.generate(backPiece.path, backRules);
      frontPiece.seamAllowancePath = SeamAllowanceGenerator.generate(frontPiece.path, frontRules);
      sleevePiece.seamAllowancePath = SeamAllowanceGenerator.generate(sleevePiece.path, sleeveRules);
    }
    
    pieces.push(backPiece, frontPiece, sleevePiece);
    
    return pieces;
  }

  private static generateBackPanel(bp: BackPanelParams, seamAllowance: number): PatternPiece {
    const points: Record<string, Point> = {};
    const path = new Path();

    // 后片关键点定义
    points.cbNeck = new Point(0, nD);
    points.hps = new Point(nW, 0);
    points.shoulder = new Point(sW, sDrop);
    points.armholePitch = new Point(W * 0.85, aD * 0.35);
    points.underarm = new Point(W, aD);
    points.sideBottom = new Point(W, L);
    points.cbHem = new Point(0, L);

    // 构建路径
    path.move(points.cbNeck)
        .quad(points.hps, new Point(nW * 0.3, 0), 'neckline')
        .line(points.shoulder, 'shoulder')
        .curve(points.underarm, points.armholePitch, new Point(W * 0.92, aD * 0.65), 'armhole')
        .line(points.sideBottom, 'sideSeam')
        .quad(points.cbHem, new Point(W * 0.5, L + 1), 'hem')
        .close();

    return {
      name: 'Back Panel',
      path,
      points,
      cutCount: 1,
      onFold: true
    };
  }

  private static generateFrontPanel(fp: FrontPanelParams, seamAllowance: number): PatternPiece {
    // 前片生成逻辑（类似后片）
  }

  private static generateSleeveFromArmhole(
    sp: SleeveParams,
    seamAllowance: number,
    frontArmholeOps: any[],
    backArmholeOps: any[],
    avgArmholeDepth: number
  ): PatternPiece {
    // 袖子生成逻辑（基于袖窿反推）
  }
}
```

---

### 3.2 缝份生成器 (SeamAllowanceGenerator.ts)

#### 文件位置
[patterns/SeamAllowanceGenerator.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/SeamAllowanceGenerator.ts)

#### 核心类

```typescript
export interface SeamAllowanceRule {
  segment: string;    // 路径段名称
  distance: number;   // 缝份距离（厘米）
}

export class SeamAllowanceGenerator {
  static generate(outline: Path, rules: SeamAllowanceRule[]): Path {
    const offsetPath = new Path();
    
    // 1. 将Bezier曲线转换为折线
    const flattened = this.flattenPath(outline);
    
    // 2. 为每个段计算偏移
    for (let i = 0; i < flattened.length; i++) {
      const segment = flattened[i];
      const rule = rules.find(r => r.segment === segment.segmentName);
      const distance = rule ? rule.distance : 0;
      
      if (distance > 0) {
        // 计算法向量
        const normal = this.calculateNormal(segment);
        
        // 偏移点
        const offsetPoint = new Point(
          segment.to.x + normal.x * distance,
          segment.to.y + normal.y * distance
        );
        
        offsetPath.line(offsetPoint, segment.segmentName);
      }
    }
    
    // 3. 连接角点
    this.joinCorners(offsetPath);
    
    return offsetPath;
  }

  private static flattenPath(path: Path): PathOperation[] {
    const flattened: PathOperation[] = [];
    
    for (const op of path.ops) {
      if (op.type === 'curve') {
        // 将三次Bezier曲线转换为折线
        const bezier = new CubicBezier(currentPoint, op.cp1!, op.cp2!, op.to!);
        const points = this.flattenBezier(bezier, 10);
        
        for (const point of points) {
          flattened.push({ type: 'line', to: point, segmentName: op.segmentName });
        }
      } else {
        flattened.push(op);
      }
    }
    
    return flattened;
  }

  private static calculateNormal(segment: PathOperation): Point {
    // 计算线段的法向量
    // ...
  }

  private static joinCorners(path: Path): void {
    // 处理角点连接
    // ...
  }
}
```

#### 缝份规则示例

```typescript
const seamRules: SeamAllowanceRule[] = [
  { segment: 'neckline', distance: 0.6 },    // 领口：0.6cm
  { segment: 'shoulder', distance: 1.0 },    // 肩缝：1.0cm
  { segment: 'armhole', distance: 1.0 },     // 袖窿：1.0cm
  { segment: 'sideSeam', distance: 1.2 },    // 侧缝：1.2cm
  { segment: 'hem', distance: 2.5 },         // 下摆：2.5cm
];
```

---

### 3.3 袖山生成器 (SleeveCapGenerator.ts)

#### 文件位置
[patterns/SleeveCapGenerator.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/SleeveCapGenerator.ts)

#### 核心功能

基于袖窿曲线反推袖山，确保袖山长度与袖窿长度匹配。

```typescript
export class SleeveCapGenerator {
  static generateFromArmhole(
    frontArmholeOps: PathOperation[],
    backArmholeOps: PathOperation[],
    sleeveWidth: number,
    ease: number = 1.5
  ): { path: Path; frontLength: number; backLength: number } {
    
    // 1. 计算前后袖窿长度
    const frontArmholeLength = this.calculatePathLength(frontArmholeOps);
    const backArmholeLength = this.calculatePathLength(backArmholeOps);
    
    // 2. 计算袖山长度（袖窿长度 + ease）
    const frontCapLength = frontArmholeLength + ease;
    const backCapLength = backArmholeLength + ease;
    
    // 3. 生成袖山曲线
    const capPath = this.generateCapCurve(
      sleeveWidth,
      frontCapLength,
      backCapLength
    );
    
    return {
      path: capPath,
      frontLength: frontCapLength,
      backLength: backCapLength
    };
  }

  private static calculatePathLength(ops: PathOperation[]): number {
    let length = 0;
    let current = ops[0]?.to || new Point(0, 0);
    
    for (const op of ops) {
      if (op.type === 'curve') {
        const bezier = new CubicBezier(current, op.cp1!, op.cp2!, op.to!);
        length += bezier.getLength();
      } else if (op.type === 'line') {
        length += current.dist(op.to!);
      }
      current = op.to!;
    }
    
    return length;
  }

  private static generateCapCurve(
    width: number,
    frontLength: number,
    backLength: number
  ): Path {
    const path = new Path();
    
    // 袖山曲线生成逻辑
    // 前袖山：更陡、更深
    // 后袖山：更平、更长
    
    return path;
  }
}
```

---

### 3.4 尺寸适配器 (GarmentMeasurementAdapter.ts)

#### 文件位置
[patterns/GarmentMeasurementAdapter.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/GarmentMeasurementAdapter.ts)

#### 核心接口

```typescript
export interface GarmentMeasurementInput {
  chestWidth: number;      // 胸围
  shoulderWidth: number;   // 肩宽
  bodyLength: number;      // 衣长
  sleeveLength: number;    // 袖长
  neckWidth: number;       // 领宽
  armholeDepth: number;    // 袖窿深
  cuffWidth?: number;      // 袖口宽
  ease?: number;           // 松量
}

export interface GarmentParams {
  backPanel: BackPanelParams;
  frontPanel: FrontPanelParams;
  sleeve: SleeveParams;
  seamAllowance: number;
}

export class GarmentMeasurementAdapter {
  static adapt(input: GarmentMeasurementInput): GarmentParams {
    const ease = input.ease || 4;
    
    return {
      backPanel: {
        width: input.chestWidth / 4 + ease / 4,
        length: input.bodyLength,
        neckWidth: input.neckWidth / 2,
        neckDepth: 2.5,
        shoulderWidth: input.shoulderWidth / 2,
        armholeDepth: input.armholeDepth,
        shoulderSlope: 12
      },
      frontPanel: {
        width: input.chestWidth / 4 + ease / 4,
        length: input.bodyLength,
        neckWidth: input.neckWidth / 2,
        neckDepth: input.neckWidth * 0.8,
        shoulderWidth: input.shoulderWidth / 2,
        armholeDepth: input.armholeDepth,
        shoulderSlope: 10
      },
      sleeve: {
        length: input.sleeveLength,
        width: input.armholeDepth * 0.4 + ease / 2,
        cuffWidth: input.cuffWidth || 12
      },
      seamAllowance: 1.0
    };
  }
}
```

---

## 四、工业几何规则

### 4.1 裁片拓扑结构

**前片（半片）固定结构**

```
CF Top (前中领口)
  ↓
Neck Curve (领口曲线)
  ↓
Shoulder (肩线)
  ↓
Armhole Upper (袖窿上段)
  ↓
Pitch (袖窿高点)
  ↓
Hollow (袖窿凹陷)
  ↓
Armhole Bottom (袖窿底点)
  ↓
Side Seam (侧缝)
  ↓
Hem (下摆)
  ↓
CF Hem (前中下摆)
  ↓
Close (闭合)
```

**SVG Path结构**

```
M  → Q → L → C → C → C → L → Q → Z
```

含义：
- M = 前中领口起点
- Q = 前领口Bezier
- L = 肩线
- C = 袖窿上段
- C = 袖窿中段
- C = 袖窿下段
- L = 侧缝
- Q = 下摆轻微弧线
- Z = 闭合

### 4.2 袖窿几何规则

**袖窿不是一条斜线，必须：先外鼓，再内收**

正确趋势：
```
shoulder
  → outward curve (外鼓)
  → hollow (凹陷)
  → underarm (腋下)
```

**控制点规则**

禁止：
- 控制点共线
- Bezier退化为直线

必须：
- CP1 必须比肩点更外
- CP2 必须内收

**比例系统**

```typescript
// 外鼓比例
cp1.x = shoulder.x + (W - shoulder.x) * outwardRatio;

// 修身：0.18~0.25
// 常规：0.28~0.35
// oversize：0.38~0.48

// 凹陷比例
cp2.x = underarm.x - (W * hollowRatio);

// 修身：0.10~0.14
// 常规：0.06~0.10
// oversize：0.02~0.06
```

### 4.3 袖山匹配规则

**袖山长度约束**

```
sleeveCapLength = frontArmholeLength + backArmholeLength + ease
```

其中：
- ease: 1~4 cm

**袖山规则**

- 前袖山：更深、更陡
- 后袖山：更平、更长

**必须存在**

- front notch（前袖对位标记）
- back notch（后袖对位标记）

---

## 五、坐标系统

### 5.1 工业CAD坐标

```
x: 向右增加
y: 向下增加

前中线(FOLD): x = 0
```

### 5.2 禁止

- 负Y坐标
- 使用矩形模拟裁片
- 写死固定值（如 +6cm）

### 5.3 必须使用比例

```typescript
// 正确
pitchX = shoulderX + spanX * 0.32;

// 错误
pitchX = shoulderX + 6;
```

---

## 六、导出模块

### 6.1 SVG导出器 (SvgExporter.ts)

#### 文件位置
[export/SvgExporter.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/export/SvgExporter.ts)

#### 核心类

```typescript
export interface SvgExportOptions {
  width: number;
  height: number;
  viewBox?: string;
  strokeWidth?: number;
  stroke?: string;
  fill?: string;
  showGrid?: boolean;
  showLabels?: boolean;
}

export class SvgExporter {
  static exportPatternPiece(piece: PatternPiece, options: SvgExportOptions): string {
    const svg = this.createSvgElement(options);
    
    // 主路径
    const pathElement = this.createPathElement(piece.path, options);
    svg.appendChild(pathElement);
    
    // 缝份路径
    if (piece.seamAllowancePath) {
      const seamPathElement = this.createPathElement(piece.seamAllowancePath, {
        ...options,
        stroke: '#999',
        strokeDasharray: '5,5'
      });
      svg.appendChild(seamPathElement);
    }
    
    // 标签
    if (options.showLabels) {
      const label = this.createLabel(piece.name, piece.points);
      svg.appendChild(label);
    }
    
    return svg.outerHTML;
  }

  static exportMultiplePieces(pieces: PatternPiece[], options: SvgExportOptions): string {
    const svg = this.createSvgElement(options);
    
    for (const piece of pieces) {
      const group = this.createGroup(piece);
      svg.appendChild(group);
    }
    
    return svg.outerHTML;
  }
}
```

---

## 七、依赖关系图

```
geometry/
  ├── Point.ts
  ├── Bezier.ts (依赖 Point)
  └── Path.ts (依赖 Point, Bezier)

patterns/
  ├── Tshirt.ts (依赖 geometry/*, SeamAllowanceGenerator, SleeveCapGenerator)
  ├── SeamAllowanceGenerator.ts (依赖 geometry/*)
  ├── SleeveCapGenerator.ts (依赖 geometry/*)
  └── GarmentMeasurementAdapter.ts

export/
  └── SvgExporter.ts (依赖 geometry/*, patterns/*)
```

---

## 八、测试与验证

### 8.1 几何验证

- 所有裁片必须可缝合
- 所有曲线长度可计算
- 所有控制点来自人体结构逻辑

### 8.2 工业验证

- 袖山长度 = 袖窿长度 + ease
- 前后片肩线长度匹配
- 侧缝长度匹配

---

## 九、性能优化

### 9.1 Bezier长度计算

使用自适应积分法提高精度：

```typescript
getLength(tolerance: number = 0.01): number {
  return this.adaptiveSimpsons(0, 1, tolerance);
}

private adaptiveSimpsons(a: number, b: number, tol: number): number {
  const c = (a + b) / 2;
  const fa = this.arcLengthIntegrand(a);
  const fb = this.arcLengthIntegrand(b);
  const fc = this.arcLengthIntegrand(c);
  
  const S = (b - a) / 6 * (fa + 4 * fc + fb);
  const S2 = (b - a) / 12 * (fa + 4 * this.arcLengthIntegrand((a + c) / 2) + 2 * fc + 4 * this.arcLengthIntegrand((c + b) / 2) + fb);
  
  if (Math.abs(S2 - S) < 15 * tol) {
    return S2 + (S2 - S) / 15;
  }
  
  return this.adaptiveSimpsons(a, c, tol / 2) + this.adaptiveSimpsons(c, b, tol / 2);
}
```

### 9.2 路径缓存

缓存路径长度计算结果：

```typescript
private _lengthCache: number | null = null;

getLength(): number {
  if (this._lengthCache !== null) {
    return this._lengthCache;
  }
  this._lengthCache = this.calculateLength();
  return this._lengthCache;
}
```

---

## 十、未来扩展

### 10.1 计划功能

- 3D裁片可视化
- 自动对位标记生成
- 曲线优化算法
- DXF导出

### 10.2 技术升级

- WebAssembly加速
- GPU加速曲线计算
- 实时协作编辑
