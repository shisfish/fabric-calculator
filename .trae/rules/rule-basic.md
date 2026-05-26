---
alwaysApply: false
---
# Industrial Garment CAD Reverse Engineering System

这是：

“工业服装裁片逆向恢复系统”

不是：

- 人体建模系统
- AI绘图系统
- 普通Canvas系统
- 矩形布局系统
- Rectangle Packing

---

# 业务流程

现实衣服
→ 人工测量关键尺寸
→ 参数化恢复裁片
→ SVG/DXF
→ 不规则排料
→ 排料图

---

# 输入数据

输入不是人体尺寸。

输入是：

- 成衣尺寸
- 裁片关键尺寸
- 实物测量数据

例如：

{
  chestWidth,
  shoulderWidth,
  bodyLength,
  sleeveLength,
  neckWidth,
  armholeDepth,
  cuffWidth
}

---

# 系统目标

根据成衣测量数据，
恢复真实工业裁片。

---

# 裁片规则

裁片必须：

- 非规则Bezier几何
- Point + Path构成
- 支持SVG/DXF导出

必须包含：

- shoulder slope
- neck curve
- armhole curve
- sleeve cap
- hem curve

禁止：

- rect()
- width/height box
- fake svg
- div布局思维
- 矩形模拟裁片

---

# 几何架构

必须使用：

/geometry
  Point.ts
  Path.ts
  Bezier.ts
  Polygon.ts

/patterns
  TshirtPattern.ts
  HoodiePattern.ts

/export
  SvgExporter.ts
  DxfExporter.ts

/nesting
  SAT.ts
  NFP.ts
  NestEngine.ts

---

# 排料规则

必须实现：

- Polygon Nesting
- Irregular Packing
- SAT collision
- Rotation optimization

禁止：

- Rectangle Packing
- Skyline
- MaxRects

---

# 代码要求

必须：

- TypeScript
- Strong typing
- 工程化
- 可扩展
- 参数化

禁止：

- demo代码
- 简化矩形算法
- 假工业实现

---

# 参考项目

参考：

- FreeSewing
- DeepNest
- SVGNest
- Maker.js

代码风格必须接近工业CAD系统
不能退化成普通图形系统