# Industrial Garment CAD Rules

这是工业服装 CAD 自动打版系统。

不是：

- 普通网页布局系统
- 图片绘制系统
- Canvas demo
- Rectangle packing
- SVG 装饰图

---

# 核心目标

实现：

人体参数
→ 参数化裁片生成
→ SVG Path
→ Polygon
→ Irregular Nesting
→ 排料图

---

# 裁片规则

所有裁片必须：

- 非规则几何图形
- Point + Path + Bezier Curve
- 可导出 SVG / DXF

禁止：

- rect()
- width / height box
- div 布局思维
- 用矩形模拟裁片
- 仅画示意图

必须包含：

- neck curve
- armhole curve
- shoulder slope
- hem curve
- sleeve cap

---

# 排料规则

必须实现：

- Polygon Nesting
- SAT collision
- No-Fit Polygon
- Rotation optimization

禁止：

- Rectangle Packing
- MaxRects
- Skyline
- Grid placement

---

# 架构要求

必须拆分：

/geometry
  Point.ts
  Path.ts
  Bezier.ts

/patterns
  Tshirt.ts
  Shirt.ts

/export
  SvgExporter.ts
  DxfExporter.ts

/nesting
  Polygon.ts
  Collision.ts
  NFP.ts
  NestEngine.ts

---

# 代码风格

必须：

- TypeScript
- Strong typing
- 可扩展
- 工程化

禁止：

- 单文件 demo
- 伪工业实现
- 简化矩形算法

---

# 参考实现

参考：

- FreeSewing
- DeepNest
- SVGNest
- Maker.js

输出必须接近工业服装 CAD
不能退化成普通图形生成
