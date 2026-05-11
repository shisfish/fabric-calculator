import sys
sys.path.insert(0, '.')
from polygon_nesting import polygon_nesting, detect_shape_irregularities

print(f"{'='*70}")
print(f"  二次优化功能验证 - 专门设计有优化空间的测试用例")
print(f"{'='*70}")

# 设计一个会产生真实凹陷的场景：
# - 多个不同高度的裁片混合
# - 某些行会自然形成未被遮挡的空白区域

pieces = [
    # 大裁片（会在左侧占据空间）
    {'name': '大板A', 'width': 60, 'height': 40, 'count': 2, 'shape': 'rectangle'},
    {'name': '大板B', 'width': 50, 'height': 35, 'count': 2, 'shape': 'rectangle'},
    
    # 中等裁片（可能造成行间高度差）
    {'name': '中板', 'width': 30, 'height': 25, 'count': 4, 'shape': 'rectangle'},
    
    # 小裁片（可用于填充）
    {'name': '小方块', 'width': 15, 'height': 15, 'count': 8, 'shape': 'rectangle'},
    {'name': '迷你块', 'width': 10, 'height': 10, 'count': 10, 'shape': 'rectangle'},
]

print(f"\n输入: {len(pieces)}种, 总计{sum(p['count'] for p in pieces)}片")
for p in pieces:
    print(f"  {p['name']:8s}: {p['count']}个 {p['width']}×{p['height']}")

result = polygon_nesting(pieces, fabric_width_cm=130, rotation=True)

print(f"\n{'='*70}")
print(f"  排料结果")
print(f"{'='*70}")
print(f"总长度: {result['total_length_cm']:.1f}cm")
print(f"利用率: {result['width_utilization']*100:.2f}%")

# 详细轮廓分析
detection = detect_shape_irregularities(result, 130)

print(f"\n{'─'*70}")
print(f"轮廓分析:")
print(f"{'─'*70}")
print(f"梯形度: {detection['trapezoid_ratio']:.3f}")
print(f"标准差: {detection['std_dev']:.2f}cm")
print(f"平均利用率: {detection['avg_utilization']*100:.1f}%")
print(f"优化评分: {detection['optimization_score']}/100")
print(f"是否不规则: {'是 ⚠️' if detection['is_irregular'] else '否 ✓'}")

if detection['gaps']:
    print(f"\n发现 {len(detection['gaps'])} 个真实凹陷区域:")
    total_gap_area = 0
    for i, gap in enumerate(detection['gaps'], 1):
        print(f"  {i}. Y={gap['y']:.1f}cm: {gap['width']:.1f}cm × {gap['height']:.1f}cm "
              f"= {gap['area']:.0f}cm² (利用率{gap['utilization']*100:.1f}%)")
        total_gap_area += gap['area']
    print(f"\n总可优化面积: {total_gap_area:.0f}cm²")
    potential_gain = (total_gap_area / (130 * result['total_length_cm'])) * 100
    print(f"理论最大提升: +{potential_gain:.2f}%")
else:
    print(f"\n✓ 无显著凹陷区域（或已被正确排除假凹陷）")

# 统计排入情况
placed_names = []
for row in result.get('rows', []):
    for p in row.get('pieces', []):
        placed_names.append(p['name'])

from collections import Counter
input_counts = {p['name']: p['count'] for p in pieces}
placed_counts = Counter(placed_names)

print(f"\n{'─'*70}")
print(f"裁片放置统计:")
print(f"{'─'*70}")
all_placed = True
for name in sorted(input_counts.keys()):
    inp = input_counts[name]
    placed = placed_counts.get(name, 0)
    status = "✓" if placed >= inp else f"⚠️ 只{placed}/{inp}"
    if placed < inp:
        all_placed = False
    print(f"  {name:8s}: 输入{inp:2d} → 已排{placed:2d} {status}")

if all_placed:
    print(f"\n✅ 所有裁片已成功排入!")

print(f"\n{'═'*70}")
