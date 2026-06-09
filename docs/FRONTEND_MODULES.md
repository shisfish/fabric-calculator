# 前端模块文档

## 一、模块概览

前端采用TypeScript + React 18架构，提供工业级CAD可视化界面。主要包含以下模块：

| 模块 | 路径 | 技术栈 | 功能 |
|------|------|--------|------|
| CAD主应用 | static/js/cad/App.tsx | React 18 | 主应用组件 |
| 裁片预览 | static/js/cad/PatternViewer.tsx | React + SVG | 裁片可视化 |
| 排料预览 | static/js/cad/NestingViewer.tsx | React + SVG | 排料可视化 |
| SVG工具 | static/js/cad/svgUtils.ts | TypeScript | SVG渲染辅助 |
| 类型定义 | static/js/cad/types.ts | TypeScript | 类型系统 |
| 页面逻辑 | static/js/*.js | JavaScript | 各页面交互逻辑 |

---

## 二、CAD可视化模块

### 2.1 模块架构

```
static/js/cad/
├── App.tsx              # 主应用组件
├── PatternViewer.tsx    # 裁片预览组件
├── NestingViewer.tsx    # 排料预览组件
├── svgUtils.ts          # SVG工具函数
├── types.ts             # 类型定义
├── index.ts             # 入口文件
├── tsconfig.json        # TypeScript配置
└── bundle.js            # 编译后的bundle
```

### 2.2 主应用组件 (App.tsx)

#### 文件位置
[static/js/cad/App.tsx](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/App.tsx)

#### 组件职责

- 根据模式切换显示裁片预览或排料预览
- 管理全局状态
- 暴露全局渲染接口

#### 核心代码

```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PatternViewer } from './PatternViewer';
import { NestingViewer } from './NestingViewer';
import type { PatternPiece, NestingResult } from './types';

interface CADAppProps {
  pieces: PatternPiece[];
  nestingResult: NestingResult | null;
  fabricWidth: number;
  mode: 'preview' | 'nesting';
}

const CADApp: React.FC<CADAppProps> = ({ pieces, nestingResult, fabricWidth, mode }) => {
  if (mode === 'preview' && pieces.length > 0) {
    return (
      <div className="cad-viewer">
        <PatternViewer
          pieces={pieces}
          width={800}
          height={500}
          showControlPoints={false}
          showDimensionLines={true}
          showLabels={true}
        />
      </div>
    );
  }

  if (mode === 'nesting' && nestingResult) {
    return (
      <div className="cad-viewer">
        <NestingViewer
          result={nestingResult}
          pieces={pieces}
          fabricWidth={fabricWidth}
          width={800}
          height={600}
          showGrid={true}
          showUtilization={true}
        />
      </div>
    );
  }

  return <div>暂无数据</div>;
};

// 暴露全局渲染接口
window.renderPatternPreview = (pieces: PatternPiece[]) => { ... };
window.renderNestingResult = (pieces: PatternPiece[], result: NestingResult, fabricWidth: number) => { ... };
```

#### 全局接口

```typescript
declare global {
  interface Window {
    renderPatternPreview: (pieces: PatternPiece[]) => void;
    renderNestingResult: (pieces: PatternPiece[], result: NestingResult, fabricWidth: number) => void;
  }
}
```

---

### 2.3 裁片预览组件 (PatternViewer.tsx)

#### 文件位置
[static/js/cad/PatternViewer.tsx](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/PatternViewer.tsx)

#### 组件职责

- 渲染裁片SVG图形
- 显示控制点
- 显示尺寸线
- 支持缩放和平移

#### Props接口

```typescript
interface PatternViewerProps {
  pieces: PatternPiece[];        // 裁片数据
  width: number;                 // 组件宽度
  height: number;                // 组件高度
  showControlPoints?: boolean;   // 是否显示控制点
  showDimensionLines?: boolean;  // 是否显示尺寸线
  showLabels?: boolean;          // 是否显示标签
  scale?: number;                // 缩放比例
}
```

#### 核心功能

**1. SVG渲染**

```typescript
const renderPiece = (piece: PatternPiece) => {
  return (
    <g key={piece.name} transform={`translate(${piece.offsetX || 0}, ${piece.offsetY || 0})`}>
      <path
        d={piece.path}
        fill={piece.fill || '#f0f0f0'}
        stroke={piece.stroke || '#333'}
        strokeWidth={piece.strokeWidth || 1}
      />
      {showControlPoints && renderControlPoints(piece)}
      {showDimensionLines && renderDimensionLines(piece)}
      {showLabels && renderLabels(piece)}
    </g>
  );
};
```

**2. 控制点显示**

```typescript
const renderControlPoints = (piece: PatternPiece) => {
  return piece.controlPoints?.map((point, index) => (
    <circle
      key={index}
      cx={point.x}
      cy={point.y}
      r={3}
      fill="red"
      stroke="none"
    />
  ));
};
```

**3. 尺寸线显示**

```typescript
const renderDimensionLines = (piece: PatternPiece) => {
  return (
    <g className="dimension-lines">
      <line x1={0} y1={0} x2={piece.width} y2={0} stroke="#999" strokeDasharray="5,5" />
      <text x={piece.width / 2} y={-10} textAnchor="middle" fontSize="12">
        {piece.width}cm
      </text>
    </g>
  );
};
```

---

### 2.4 排料预览组件 (NestingViewer.tsx)

#### 文件位置
[static/js/cad/NestingViewer.tsx](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/NestingViewer.tsx)

#### 组件职责

- 渲染排料图
- 显示面料边界
- 显示利用率统计
- 支持网格显示

#### Props接口

```typescript
interface NestingViewerProps {
  result: NestingResult;         // 排料结果
  pieces: PatternPiece[];        // 裁片数据
  fabricWidth: number;           // 面料门幅
  width: number;                 // 组件宽度
  height: number;                // 组件高度
  showGrid?: boolean;            // 是否显示网格
  showUtilization?: boolean;     // 是否显示利用率
}
```

#### 核心功能

**1. 排料图渲染**

```typescript
const renderNestingLayout = () => {
  return (
    <g>
      {result.rows.map((row, rowIndex) => (
        <g key={rowIndex} transform={`translate(0, ${row.y})`}>
          {row.pieces.map((piece, pieceIndex) => (
            <g key={pieceIndex} transform={`translate(${piece.x}, 0)`}>
              <path d={piece.path} fill={piece.fill} stroke="#333" />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
};
```

**2. 面料边界**

```typescript
const renderFabricBoundary = () => {
  return (
    <rect
      x={0}
      y={0}
      width={fabricWidth}
      height={result.totalLength}
      fill="none"
      stroke="#000"
      strokeWidth={2}
    />
  );
};
```

**3. 利用率统计**

```typescript
const renderUtilizationStats = () => {
  return (
    <div className="utilization-stats">
      <div>利用率: {(result.utilization * 100).toFixed(1)}%</div>
      <div>总长度: {result.totalLength.toFixed(1)}cm</div>
      <div>裁片数量: {result.pieceCount}</div>
    </div>
  );
};
```

---

### 2.5 SVG工具模块 (svgUtils.ts)

#### 文件位置
[static/js/cad/svgUtils.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/svgUtils.ts)

#### 模块职责

- SVG路径生成
- 坐标变换
- 样式计算

#### 核心函数

```typescript
export function generatePathD(points: Point[]): string {
  if (points.length === 0) return '';
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  d += ' Z';
  return d;
}

export function calculateBoundingBox(points: Point[]): BoundingBox {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

export function transformPoint(point: Point, transform: Transform): Point {
  return {
    x: point.x * transform.scale + transform.translateX,
    y: point.y * transform.scale + transform.translateY
  };
}
```

---

### 2.6 类型定义 (types.ts)

#### 文件位置
[static/js/cad/types.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/types.ts)

#### 核心类型

```typescript
export interface Point {
  x: number;
  y: number;
}

export interface PatternPiece {
  name: string;                  // 裁片名称
  path: string;                  // SVG路径
  width: number;                 // 宽度
  height: number;                // 高度
  fill?: string;                 // 填充色
  stroke?: string;               // 边框色
  strokeWidth?: number;          // 边框宽度
  controlPoints?: Point[];       // 控制点
  offsetX?: number;              // X偏移
  offsetY?: number;              // Y偏移
  rotation?: number;             // 旋转角度
  material?: string;             // 材料类型
}

export interface NestingResult {
  totalLength: number;           // 总长度
  utilization: number;           // 利用率
  pieceCount: number;            // 裁片数量
  rows: NestingRow[];            // 排料行
}

export interface NestingRow {
  y: number;                     // Y坐标
  height: number;                // 行高
  pieces_count: number;          // 裁片数量
  pieces: NestingPiece[];        // 裁片列表
}

export interface NestingPiece {
  name: string;                  // 裁片名称
  x: number;                     // X坐标
  y: number;                     // Y坐标
  width: number;                 // 宽度
  height: number;                // 高度
  rotation?: number;             // 旋转角度
  path: string;                  // SVG路径
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}
```

---

## 三、页面逻辑模块

### 3.1 精确计算页面 (app.js)

#### 文件位置
[static/js/app.js](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/app.js)

#### 功能职责

- 品类选择
- 裁片数据录入
- 参数设置
- 计算请求
- 结果展示

#### 核心功能

```javascript
class FabricCalculator {
  constructor() {
    this.pieces = [];
    this.category = null;
  }

  async loadCategories() {
    const response = await fetch('/api/categories');
    const data = await response.json();
    this.renderCategories(data.data);
  }

  async calculate() {
    const data = {
      category: this.category,
      pieces: this.pieces,
      fabric_width: document.getElementById('fabric-width').value,
      shrinkage_rate: document.getElementById('shrinkage-rate').value,
      wastage_rate: document.getElementById('wastage-rate').value
    };

    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });

    const result = await response.json();
    this.renderResult(result.data);
  }

  renderResult(data) {
    document.getElementById('result-length').textContent = data.per_piece_length_m;
    document.getElementById('result-area').textContent = data.total_area_m2;
    document.getElementById('result-utilization').textContent = data.utilization_rate;
  }
}
```

---

### 3.2 快速估算页面 (quick.js)

#### 文件位置
[static/js/quick.js](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/quick.js)

#### 功能职责

- 快速估算表单
- 关键尺寸输入
- 估算结果展示

#### 核心功能

```javascript
class QuickEstimator {
  async estimate() {
    const data = {
      category: document.getElementById('category').value,
      body_length: document.getElementById('body-length').value,
      chest: document.getElementById('chest').value,
      shoulder: document.getElementById('shoulder').value,
      sleeve_length: document.getElementById('sleeve-length').value
    };

    const response = await fetch('/api/quick-estimate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });

    const result = await response.json();
    this.renderEstimate(result.data);
  }
}
```

---

### 3.3 报价管理页面 (quotation.js)

#### 文件位置
[static/js/quotation.js](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/quotation.js)

#### 功能职责

- 报价单生成
- 价格计算
- 导出报价单

---

### 3.4 历史记录页面 (history.js)

#### 文件位置
[static/js/history.js](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/history.js)

#### 功能职责

- 历史记录列表
- 记录详情查看
- 记录删除

---

### 3.5 曲线模型页面 (curves.js)

#### 文件位置
[static/js/curves.js](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/curves.js)

#### 功能职责

- 曲线裁片数据录入
- 顶点坐标输入
- 曲线计算

---

## 四、样式模块

### 4.1 主样式 (style.css)

#### 文件位置
[static/css/style.css](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/css/style.css)

#### 样式内容

- 全局样式
- 表单样式
- 按钮样式
- 布局样式

### 4.2 CAD预览样式 (cad-viewer.css)

#### 文件位置
[static/css/cad-viewer.css](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/css/cad-viewer.css)

#### 样式内容

- CAD预览容器样式
- SVG样式
- 控制点样式
- 尺寸线样式

---

## 五、构建与部署

### 5.1 TypeScript编译

```bash
npm run build
```

编译配置：
- [tsconfig.json](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/tsconfig.json)
- [static/js/cad/tsconfig.json](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/tsconfig.json)

### 5.2 前端打包

```bash
npm run build:frontend
```

打包工具：esbuild
打包输出：[static/js/cad/bundle.js](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/bundle.js)

---

## 六、依赖关系

```
App.tsx
  ├── PatternViewer.tsx
  │     ├── svgUtils.ts
  │     └── types.ts
  ├── NestingViewer.tsx
  │     ├── svgUtils.ts
  │     └── types.ts
  └── types.ts

app.js
  └── 后端API (/api/calculate)

quick.js
  └── 后端API (/api/quick-estimate)
```

---

## 七、性能优化

### 7.1 React优化

- 使用`React.memo`避免不必要的重渲染
- 使用`useMemo`缓存计算结果
- 使用`useCallback`缓存回调函数

### 7.2 SVG优化

- 使用`transform`属性批量变换
- 避免频繁的DOM操作
- 使用`requestAnimationFrame`优化动画

---

## 八、浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

---

## 九、调试技巧

### 9.1 React DevTools

安装React Developer Tools浏览器扩展，用于：
- 组件树查看
- Props/State检查
- 性能分析

### 9.2 控制台调试

```javascript
// 查看全局渲染函数
console.log(window.renderPatternPreview);
console.log(window.renderNestingResult);

// 手动调用渲染
window.renderPatternPreview([piece1, piece2]);
```

---

## 十、未来扩展

### 10.1 计划功能

- 3D裁片预览
- 实时协作编辑
- 版本控制
- 导出PDF

### 10.2 技术升级

- 升级到React 19
- 使用TypeScript 5.x
- 引入状态管理（Zustand/Jotai）
- 使用Vite构建工具
