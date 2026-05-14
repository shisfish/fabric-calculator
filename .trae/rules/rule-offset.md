当前系统需要实现：

工业级缝份系统（Seam Allowance System）。

禁止：

* scale path生成缝份
* 全局统一offset
* SVG enlarge模拟缝份

必须：

基于 path segment 实现分段缝份。

真实T-shirt规则：

shoulder: 1.0cm
armhole: 1.0cm
sideSeam: 1.2cm
neckline: 0.6cm
hem: 2.5cm
sleeveHem: 2.5cm

必须修改 Path 系统：

每个 path segment 必须有：

* segmentName
* segmentType

例如：

.move()
.segment('neckline')

.line()
.segment('shoulder')

.curve()
.segment('armhole')

.line()
.segment('sideSeam')

.quad()
.segment('hem')

新增：

interface SeamAllowanceRule {

segment: string;

distance: number;

}

新增：

class SeamAllowanceGenerator {

static generate(
outline: Path,
rules: SeamAllowanceRule[]
): Path

}

算法要求：

1. flatten bezier → polyline
2. compute tangent
3. compute normal
4. outward offset
5. join corners
6. rebuild path

目标：

生成真实工业 cutting path，
用于：

* 排料
* DXF
* SVG
* 自动裁床

注意：

最终需要同时输出：

1. stitch line（净版）
2. cutting line（缝份外轮廓）
