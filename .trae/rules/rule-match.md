---
alwaysApply: false
---
你现在不是“自由绘制 SVG”。

你是在实现：

工业服装 CAD 几何系统。

禁止：
- AI自由发挥版型
- 随机Bezier
- 随机控制点
- 凭感觉画袖窿
- 使用矩形代替裁片
- 为了“好看”修改曲线

必须：
- 所有裁片基于工业几何约束
- 所有曲线必须可缝合
- 所有控制点必须来自人体结构逻辑
- 所有长度必须可计算
- 所有裁片必须能组成真实服装

========================
【当前阶段目标】
========================

当前只做：

1. Front Panel（前片）
2. Back Panel（后片）
3. Sleeve（袖子）

目标不是“像图”。

目标是：

前后片 + 袖子
可以真实缝合。

========================
【核心几何规则】
========================

# 1. Front Panel（前片）

结构顺序固定：

CF Top
→ Neck Curve
→ Shoulder
→ Armhole Upper
→ Pitch
→ Hollow
→ Armhole Bottom
→ Side Seam
→ Hem
→ CF Hem
→ Close

禁止：
- 修改path拓扑
- 删除armhole关键点
- 把袖窿简化成一条curve
- 使用polygon代替

前片规则：

1. 前领较深
2. 袖窿更凹
3. hollow明显
4. shoulder较短

工业逻辑：

前片袖窿：
前倾
更深
更弯

========================

# 2. Back Panel（后片）

后片不是复制前片。

后片规则：

1. 后领浅
2. 后肩略长
3. 袖窿更平
4. hollow更弱
5. pitch更高

后片结构：

CB Top
→ Back Neck
→ Shoulder
→ Back Armhole
→ Side Seam
→ Hem
→ CB Hem
→ Close

必须：

后片袖窿长度
略大于前片。

========================

# 3. Sleeve（袖子）

禁止：
- 对称半圆
- 随机Bezier
- 简化成椭圆

必须：

袖山长度
≈
前袖窿 + 后袖窿 + ease

其中：

ease:
1~4 cm

袖山规则：

前袖山：
更深
更陡

后袖山：
更平
更长

必须存在：

front notch
back notch

========================
【新增几何系统】
========================

必须新增：

1. Bezier Length
2. Path Length
3. Tangent
4. Normal
5. Curve Split
6. Offset Curve

原因：

工业裁片不是“图形”。

而是：

可计算几何。

========================
【Bezier Length】
========================

必须实现：

Line Length
Quadratic Bezier Length
Cubic Bezier Length

用途：

1. 袖窿长度计算
2. 袖山匹配
3. 缝合验证
4. 排料统计

禁止：
- 使用直线距离代替曲线长度

========================
【袖窿匹配规则】
========================

必须计算：

frontArmholeLength
backArmholeLength
sleeveCapLength

约束：

sleeveCapLength
=
frontArmholeLength
+
backArmholeLength
+
ease

否则：

裁片不可缝合。

========================
【Notch系统】
========================

必须支持：

notches: Point[]

用途：

1. 前后袖识别
2. 缝合定位
3. 工业裁剪标记

必须：

Front Armhole Notch
Back Armhole Notch
Sleeve Front Notch
Sleeve Back Notch

========================
【控制点规则】
========================

禁止：

写死：
+6cm
-2cm

必须：

使用比例：

spanX * ratio
spanY * ratio

例如：

pitchX = shoulderX + spanX * 0.32

而不是：

pitchX = shoulderX + 6

========================
【代码规则】
========================

禁止：

- 超过3段curve的袖窿
- 自由Bezier
- AI随机path
- SVG硬编码
- “看起来差不多”

必须：

- 所有关键点具名
- 所有控制点具名
- 所有比例可解释
- 所有path拓扑固定

========================
【当前开发顺序】
========================

STEP 1
稳定：
front panel
back panel

STEP 2
实现：
Bezier Length System

STEP 3
实现：
Sleeve Matching

STEP 4
实现：
Seam Allowance

STEP 5
实现：
DXF Export

STEP 6
实现：
Nesting

========================
【当前最重要目标】
========================

不是：

“生成SVG”

而是：

建立：

可工业化服装几何内核。