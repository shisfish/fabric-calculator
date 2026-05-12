实现：

工业服装CAD可视化系统。

目标：

将当前生成的 SVG Path
进行真实可视化。

技术栈：

React
TypeScript
SVG

# HARD RULES

禁止使用以下方式表示裁片：

- rect()
- width/height box
- rectangle path
- bounding box
- canvas box
- div layout

服装裁片必须：

- 非规则Bezier曲线
- 包含真实袖窿
- 包含领口曲线
- 包含肩斜线
- 包含袖山

如果生成结果接近矩形：
视为实现失败。

禁止：
“示意图式SVG”

必须：
生成真实工业裁片轮廓。

实现：

1. PatternViewer.tsx

功能：

- 显示 front/back/sleeve 裁片
- SVG Path 渲染
- 缩放
- 平移
- 显示控制点
- 显示尺寸线

2. NestingViewer.tsx

功能：

- 显示排料结果
- 布料边界
- 裁片旋转
- 利用率
- 空白区域

要求：

禁止：
- canvas矩形模拟
- png静态图

必须：

- 基于 SVG Path
- 支持Bezier曲线
- 可交互
- CAD风格

参考：

- FreeSewing
- DeepNest
- CAD Viewer