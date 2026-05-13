当前版型 outline 已经稳定。

禁止继续修改裁片控制点。

下一步实现：

工业缝份系统（Seam Allowance Engine）。

目标：

输入：
- outline path
- seam allowance distance

输出：
- offset cutting path

严格要求：

1. 禁止 scale path 生成缝份
2. 必须使用 geometric offset
3. Bezier curve 必须先 flatten/sample
4. 每个采样点计算 tangent
5. 使用法线 normal outward offset
6. 最终重建 offset path

实现结构：

class SeamAllowanceGenerator {

  static generate(
    outline: Path,
    distance: number
  ): Path

}

步骤：

1. flattenBezier(path, segments=50)
2. computeTangents(points)
3. computeNormals(tangents)
4. offsetPoints(points, normals, distance)
5. rebuildPath(points)

目标：

生成真实工业裁剪边界，
用于：
- 排料
- SVG输出
- DXF输出
- 工业裁床