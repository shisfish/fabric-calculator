# 工业服装CAD逆向恢复系统 - 项目架构文档

## 一、项目概述

### 1.1 项目定位

**工业服装裁片逆向恢复系统**（Industrial Garment CAD Reverse Engineering System）

这是一个专业的工业级服装CAD系统，用于：
- 根据成衣测量数据，恢复真实工业裁片
- 生成SVG/DXF格式的裁片文件
- 实现不规则排料（Polygon Nesting）
- 计算面料用量和成本

### 1.2 核心业务流程

```
现实衣服
  ↓
人工测量关键尺寸
  ↓
参数化恢复裁片
  ↓
SVG/DXF导出
  ↓
不规则排料
  ↓
排料图生成
```

### 1.3 技术栈

| 层级 | 技术栈 |
|------|--------|
| 后端服务 | Python 3.7+ / Flask |
| 前端界面 | TypeScript / React 18 |
| 几何核心 | TypeScript (Point, Path, Bezier) |
| 数据库 | MySQL 8.0 |
| 部署 | Docker / Docker Compose |
| 排料算法 | Polygon Nesting / NFP / SAT |

---

## 二、系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 精确计算  │  │ 快速估算  │  │ 报价管理  │  │ 历史记录  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ CAD预览   │  │ 排料预览  │  │ AI识别   │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│                        后端服务层                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Flask Web Application (app.py)           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 计算引擎     │  │ 图片识别     │  │ 数据库管理   │        │
│  │ calculator  │  │ image_engine │  │ db_manager  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      几何核心层 (TypeScript)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Point/Path  │  │ Bezier曲线   │  │ 版型生成     │        │
│  │ geometry/   │  │ Bezier.ts   │  │ patterns/   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 多边形排料   │  │ 碰撞检测     │  │ SVG导出     │        │
│  │ nesting/    │  │ Collision.ts │  │ export/     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        数据存储层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ MySQL 8.0   │  │ 文件存储     │  │ 图片缓存     │        │
│  │ 历史记录     │  │ 上传文件     │  │ 裁片图/排料图 │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、目录结构

```
fabric-calculator/
├── app.py                      # Flask主应用（后端入口）
├── calculator_engine.py        # 核心计算引擎
├── curved_engine.py            # 曲线裁片计算引擎
├── image_engine.py             # AI图片识别引擎
├── db_manager.py               # 数据库管理模块
├── polygon_nesting.py          # 多边形排料算法
├── piece_generator.py          # 裁片生成器
├── image_generator.py          # 图片生成器
│
├── geometry/                   # 几何核心模块（TypeScript）
│   ├── Point.ts                # 点类
│   ├── Path.ts                 # 路径类
│   ├── Bezier.ts               # Bezier曲线
│   └── index.ts                # 导出
│
├── patterns/                   # 版型生成模块（TypeScript）
│   ├── Tshirt.ts               # T恤版型生成器
│   ├── FrontPatternGenerator.ts # 前片生成器
│   ├── SleeveCapGenerator.ts   # 袖山生成器
│   ├── SeamAllowanceGenerator.ts # 缝份生成器
│   ├── GarmentMeasurementAdapter.ts # 尺寸适配器
│   └── index.ts                # 导出
│
├── nesting/                    # 排料引擎模块（TypeScript）
│   ├── Polygon.ts              # 多边形类
│   ├── NFP.ts                  # NFP算法
│   ├── Collision.ts            # SAT碰撞检测
│   ├── NestEngine.ts           # 排料引擎
│   ├── PolygonConverter.ts     # 多边形转换器
│   └── index.ts                # 导出
│
├── export/                     # 导出模块（TypeScript）
│   ├── SvgExporter.ts          # SVG导出器
│   ├── IndustrialSvgExporter.ts # 工业级SVG导出器
│   └── index.ts                # 导出
│
├── static/                     # 静态资源
│   ├── css/                    # 样式表
│   │   ├── style.css           # 主样式
│   │   └── cad-viewer.css      # CAD预览样式
│   ├── js/                     # JavaScript/TypeScript
│   │   ├── cad/                # CAD可视化模块（React）
│   │   │   ├── App.tsx         # 主应用组件
│   │   │   ├── PatternViewer.tsx # 裁片预览组件
│   │   │   ├── NestingViewer.tsx # 排料预览组件
│   │   │   ├── svgUtils.ts     # SVG工具函数
│   │   │   ├── types.ts        # 类型定义
│   │   │   └── bundle.js       # 编译后的bundle
│   │   ├── app.js              # 精确计算页面逻辑
│   │   ├── quick.js            # 快速估算页面逻辑
│   │   ├── quotation.js        # 报价管理页面逻辑
│   │   ├── history.js          # 历史记录页面逻辑
│   │   └── curves.js           # 曲线模型页面逻辑
│   └── calc_images/            # 裁片图片缓存
│
├── templates/                  # HTML模板
│   ├── index.html              # 精确计算页面
│   ├── quick.html              # 快速估算页面
│   ├── quotation.html          # 报价管理页面
│   ├── history.html            # 历史记录页面
│   ├── detail.html             # 历史记录详情页面
│   ├── curves.html             # 曲线模型页面
│   ├── cad.html                # CAD预览页面
│   ├── polygon_nesting.html    # 多边形排料页面
│   └── includes/
│       └── navbar.html         # 导航栏组件
│
├── utils/                      # 工具模块
│   └── CADLogger.ts            # CAD日志工具
│
├── example/                    # 示例数据
│   ├── front-basic.json        # 前片基础数据
│   ├── front-basic.svg         # 前片SVG示例
│   ├── measurements.json       # 测量数据
│   └── oversize-front.json     # Oversize前片数据
│
├── .trae/rules/                # 项目规则文档
│   ├── rule-basic.md           # 基础规则
│   ├── rule-match.md           # 版型匹配规则
│   ├── rule-offset.md          # 缝份规则
│   ├── rule-size.md            # 尺寸规则
│   ├── rule-svg.md             # SVG规则
│   └── rule-template.md        # 模板规则
│
├── requirements.txt            # Python依赖
├── package.json                # Node.js依赖
├── tsconfig.json               # TypeScript配置
├── Dockerfile                  # Docker镜像构建
├── docker-compose.yml          # Docker Compose配置
├── init.sql                    # MySQL初始化脚本
├── start.sh                    # 一键启动脚本
└── README.md                   # 项目说明文档
```

---

## 四、模块划分

### 4.1 后端模块（Python）

| 模块文件 | 功能描述 | 主要类/函数 |
|---------|---------|-----------|
| [app.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/app.py) | Flask Web服务主程序 | Flask路由、API接口 |
| [calculator_engine.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/calculator_engine.py) | 核心计算引擎 | FabricCalculator, QuotationEngine |
| [curved_engine.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/curved_engine.py) | 曲线裁片计算引擎 | CurvedPieceCalculator |
| [image_engine.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/image_engine.py) | AI图片识别引擎 | MeasurementEngine |
| [db_manager.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/db_manager.py) | 数据库管理模块 | DBManager |
| [polygon_nesting.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/polygon_nesting.py) | 多边形排料算法 | polygon_nesting() |
| [piece_generator.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/piece_generator.py) | 裁片生成器 | generate_all_pieces_images() |
| [image_generator.py](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/image_generator.py) | 图片生成器 | generate_piece_image(), generate_nesting_image() |

### 4.2 前端模块（TypeScript/React）

| 模块文件 | 功能描述 | 主要组件/函数 |
|---------|---------|-------------|
| [static/js/cad/App.tsx](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/App.tsx) | CAD主应用组件 | CADApp |
| [static/js/cad/PatternViewer.tsx](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/PatternViewer.tsx) | 裁片预览组件 | PatternViewer |
| [static/js/cad/NestingViewer.tsx](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/NestingViewer.tsx) | 排料预览组件 | NestingViewer |
| [static/js/cad/svgUtils.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/svgUtils.ts) | SVG工具函数 | SVG渲染辅助函数 |
| [static/js/cad/types.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/static/js/cad/types.ts) | 类型定义 | PatternPiece, NestingResult等 |

### 4.3 几何核心模块（TypeScript）

| 模块路径 | 功能描述 | 主要类 |
|---------|---------|--------|
| [geometry/Point.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/geometry/Point.ts) | 点类与几何工具 | Point |
| [geometry/Path.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/geometry/Path.ts) | 路径类（SVG Path） | Path |
| [geometry/Bezier.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/geometry/Bezier.ts) | Bezier曲线 | CubicBezier, QuadraticBezier |
| [patterns/Tshirt.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/Tshirt.ts) | T恤版型生成器 | TshirtPatternGenerator |
| [patterns/FrontPatternGenerator.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/FrontPatternGenerator.ts) | 前片生成器 | FrontPatternGenerator |
| [patterns/SleeveCapGenerator.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/SleeveCapGenerator.ts) | 袖山生成器 | SleeveCapGenerator |
| [patterns/SeamAllowanceGenerator.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/patterns/SeamAllowanceGenerator.ts) | 缝份生成器 | SeamAllowanceGenerator |

### 4.4 排料引擎模块（TypeScript）

| 模块路径 | 功能描述 | 主要类/函数 |
|---------|---------|-----------|
| [nesting/Polygon.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/Polygon.ts) | 多边形类 | Polygon, polygonArea() |
| [nesting/NFP.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/NFP.ts) | NFP算法 | NFP计算 |
| [nesting/Collision.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/Collision.ts) | SAT碰撞检测 | SATCollision |
| [nesting/NestEngine.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/NestEngine.ts) | 排料引擎 | NestEngine |
| [nesting/PolygonConverter.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/nesting/PolygonConverter.ts) | 多边形转换器 | PolygonConverter |

### 4.5 导出模块（TypeScript）

| 模块路径 | 功能描述 | 主要类 |
|---------|---------|--------|
| [export/SvgExporter.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/export/SvgExporter.ts) | SVG导出器 | SvgExporter |
| [export/IndustrialSvgExporter.ts](file:///Users/shisfish/Documents/garment-workspace/fabric-calculator/export/IndustrialSvgExporter.ts) | 工业级SVG导出器 | IndustrialSvgExporter |

---

## 五、数据流图

### 5.1 计算流程

```
用户输入测量数据
       ↓
前端表单验证
       ↓
POST /api/calculate-curved
       ↓
curved_engine.py 计算裁片面积
       ↓
piece_generator.py 生成裁片图片
       ↓
polygon_nesting.py 排料算法
       ↓
image_generator.py 生成排料图
       ↓
db_manager.py 保存历史记录
       ↓
返回JSON结果 + 图片URL
       ↓
前端渲染结果
```

### 5.2 CAD预览流程

```
用户选择版型类型
       ↓
前端调用TypeScript几何核心
       ↓
TshirtPatternGenerator.generate()
       ↓
生成PatternPiece对象
       ↓
PatternViewer.tsx 渲染SVG
       ↓
用户查看裁片预览
```

### 5.3 排料预览流程

```
用户上传裁片数据
       ↓
NestEngine.nest()
       ↓
PolygonConverter 转换裁片为多边形
       ↓
NFP计算可行放置区域
       ↓
SATCollision 碰撞检测
       ↓
优化排料布局
       ↓
NestingViewer.tsx 渲染排料图
       ↓
显示利用率统计
```

---

## 六、关键技术点

### 6.1 工业级裁片生成

- **非矩形裁片**：使用Bezier曲线生成真实工业裁片轮廓
- **参数化设计**：基于成衣测量数据，参数化生成版型
- **缝份系统**：分段缝份，不同部位不同缝份量
- **工业拓扑**：固定裁片结构（领口、肩线、袖窿、侧缝、下摆）

### 6.2 不规则排料算法

- **Polygon Nesting**：非矩形排料，支持任意形状裁片
- **NFP（No-Fit Polygon）**：计算可行放置区域
- **SAT碰撞检测**：精确的多边形碰撞检测
- **旋转优化**：支持裁片旋转以优化利用率

### 6.3 AI图片识别

- **参照物标定**：使用已知尺寸参照物校准图片比例
- **区域测量**：框选裁片区域自动计算尺寸
- **自动填表**：测量结果自动填入计算表单

---

## 七、部署架构

### 7.1 Docker部署

```yaml
services:
  fabric-calculator:
    build: .
    ports:
      - "5000:5000"
    environment:
      - MYSQL_HOST=mysql
      - MYSQL_PORT=3306
      - MYSQL_USER=fabric
      - MYSQL_PASSWORD=fabric123
      - MYSQL_DATABASE=fabric_calculator
    volumes:
      - /opt/fabric-data:/opt/fabric-data
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=fabric_root_123
      - MYSQL_DATABASE=fabric_calculator
      - MYSQL_USER=fabric
      - MYSQL_PASSWORD=fabric123
    volumes:
      - /opt/fabric-mysql-data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

### 7.2 数据持久化

| 数据类型 | 存储位置 | 说明 |
|---------|---------|------|
| 历史记录 | MySQL数据库 | calculation_history表 |
| 上传图片 | /opt/fabric-data/uploads | 用户上传的图片 |
| 裁片图片 | static/calc_images/ | 生成的裁片预览图 |
| 排料图 | static/calc_images/ | 生成的排料预览图 |

---

## 八、API接口概览

### 8.1 计算相关API

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/calculate` | POST | 精确计算面料用量 |
| `/api/quick-estimate` | POST | 快速估算面料用量 |
| `/api/calculate-curved` | POST | 曲线模型计算 |
| `/api/quotation` | POST | 计算报价 |
| `/api/polygon-nesting` | POST | 多边形排料 |

### 8.2 数据查询API

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/categories` | GET | 获取所有品类 |
| `/api/categories/<id>` | GET | 获取品类详情 |
| `/api/fabric-types` | GET | 获取面料类型 |
| `/api/dictionaries` | GET | 获取系统字典 |

### 8.3 历史记录API

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/history` | GET | 获取历史记录列表 |
| `/api/history/<id>` | GET | 获取单条记录详情 |
| `/api/history/<id>` | DELETE | 删除记录 |
| `/api/history/clear` | POST | 清空历史记录 |

### 8.4 AI图片识别API

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/image/upload` | POST | 上传图片 |
| `/api/image/calibrate` | POST | 标定参照物 |
| `/api/image/measure` | POST | 测量裁片区域 |
| `/api/image/annotate` | POST | 获取标注图片 |

---

## 九、开发规范

### 9.1 代码规范

- **后端**：Python PEP 8
- **前端**：TypeScript严格模式
- **几何核心**：强类型、工程化、可扩展

### 9.2 工业CAD规则

- **禁止**：矩形模拟裁片、随机Bezier、AI自由发挥版型
- **必须**：固定工业拓扑、参数化设计、可计算几何、真实缝合验证

### 9.3 测试与验证

- 所有裁片必须可缝合
- 所有曲线长度可计算
- 所有控制点来自人体结构逻辑

---

## 十、相关文档

- [后端模块文档](./BACKEND_MODULES.md)
- [前端模块文档](./FRONTEND_MODULES.md)
- [几何核心文档](./GEOMETRY_CORE.md)
- [排料系统文档](./NESTING_SYSTEM.md)
- [参数指南](./PARAMETER_GUIDE.md)
- [技术文档](./PATTERN_TECHNICAL_DOC.md)
