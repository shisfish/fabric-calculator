import sys
sys.path.insert(0, '.')
from polygon_nesting import polygon_nesting, detect_shape_irregularities

print(f"{'='*70}")
print(f"  二次优化功能验证 - 极端不规则场景")
print(f"{'='*70}")

# 故意设计会产生明显凹陷的场景：
# - 使用高度差异极大的裁片
# - 某些行会很短，造成明显的梯形轮廓

pieces = [
    # 超高裁片（会在左侧形成高墙）
    {'name': '高板', 'width': 45, 'height': 80, 'count': 1, 'shape': 'rectangle'},
    
    # 中等裁片（会在右侧形成较短的行）
    {'name': '中板A', 'width': 40, 'height': 30, 'count': 3, 'shape': 'rectangle'},
    {'name': '中板B', 'width': 35, 'height': 25, 'count': 2, 'shape': 'rectangle'},
    
    # 矮裁片（会形成很矮的行）
    {'name': '矮板', 'width': 25, 'height': 15, 'count': 4, 'shape': 'rectangle'},
    
    # 大量小裁片（可用于填充）
    {'name': '小方块', 'width': 12, 'height': 12, 'count': 12, 'shape': 'rectangle'},
    {'name': '迷你块', 'width': 8, 'height': 8, 'count': 15, 'shape': 'rectangle'},
]

print(f"\n输入: {len(pieces)}种, 总计{sum(p['count'] for p in pieces)}片")

result = polygon_nesting(pieces, fabric_width_cm=130, rotation=True)

print(f"\n{'='*70}")
print(f"  排料结果")
print(f"{'='*70}")
print(f"总长度: {result['total_length_cm']:.1f}cm")
print(f"利用率: {result['width_utilization']*100:.2f}%")

detection = detect_shape_irregularities(result, 130)

print(f"\n{'─'*70}")
print(f"轮廓分析:")
print(f"{'─'*70}")
print(f"梯形度: {detection['trapezoid_ratio']:.3f} {'⚠️' if detection['trapezoid_ratio'] < 0.9 else '✓'}")
print(f"标准差: {detection['std_dev']:.2f}cm {'⚠️' if detection['std_dev'] > 8 else '✓'}")
print(f"优化评分: {detection['optimization_score']}/100 {'⚠️需优化' if detection['optimization_score'] > 20 else '✓良好'}")

if detection['gaps']:
    print(f"\n✅ 发现 {len(detection['gaps'])} 个真实凹陷:")
    for i, gap in enumerate(detection['gaps'], 1):
        print(f"  {i}. Y={gap['y']:.1f}cm: {gap['width']:.1f}×{gap['height']:.1f} "
              f"= {gap['area']:.0f}cm² (利用{gap['utilization']*100:.1f}%)")
else:
    print(f"\n无显著凹陷（或已被遮挡排除）")

# 显示各行详情
from collections import defaultdict
by_y = defaultdict(list)
for row in result.get('rows', []):
    ys = row.get('y_start', 0)
    for p in row.get('pieces', []):
        by_y[ys].append({
            'name': p['name'],
            'x': p.get('x', 0),
            'w': p.get('width', 0),
            'h': p.get('height', 0)
        })

print(f"\n{'─'*70}")
print(f"各Y层右边缘分布:")
print(f"{'─'*70}")

for y in sorted(by_y.keys()):
    r = by_y[y]
    rm = max(x['x']+x['w'] for x in r) if r else 0
    u = rm/130*100
    marker = "⚠️" if u < 90 else "✓"
    print(f"  Y={y:6.1f}cm → 右缘={rm:5.1f}cm ({u:5.1f}%) {marker} "
          f"[{len(r)}片]")

print(f"\n{'═'*70}")
