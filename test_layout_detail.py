import sys
sys.path.insert(0, '.')
from polygon_nesting import polygon_nesting

pieces = [
    {'name': '前片', 'width': 50, 'height': 60, 'count': 2, 'shape': 'single_corner', 'shoulder_width': 10},
    {'name': '后片', 'width': 50, 'height': 120, 'count': 1, 'shape': 'double_corner', 'shoulder_width': 10},
    {'name': '袖子(左*', 'width': 40, 'height': 10, 'count': 2, 'shape': 'double_corner'},
    {'name': '领口罗纹', 'width': 40, 'height': 10, 'count': 1, 'shape': 'rectangle'},
    {'name': '口袋', 'width': 20, 'height': 12, 'count': 4, 'shape': 'rectangle'},
    {'name': '其他配件', 'width': 34, 'height': 34, 'count': 10, 'shape': 'rectangle'},
    {'name': '小', 'width': 10, 'height': 10, 'count': 5, 'shape': 'rectangle'},
]

result = polygon_nesting(pieces, fabric_width_cm=130, rotation=True)

print(f"\n{'='*70}")
print(f"  实际布局分析")
print(f"{'='*70}")

# 提取所有已放置的裁片
all_placed = []
for row_idx, row in enumerate(result.get('rows', [])):
    y_start = row.get('y_start', 0)
    for p in row.get('pieces', []):
        all_placed.append({
            'name': p['name'],
            'x': p.get('x', 0),
            'y_abs': y_start + p.get('y', 0),
            'w': p.get('width', 0),
            'h': p.get('height', 0),
            'row': row_idx
        })

# 按Y坐标排序显示
print(f"\n共放置 {len(all_placed)} 个裁片:")
print(f"{'名称':8s} | {'X':>6s} | {'Y(绝对)':>8s} | {'W×H':>8s} | {'右缘':>6s}")
print(f"{'-'*55}")

for p in sorted(all_placed, key=lambda x: (x['y_abs'], x['x'])):
    right = p['x'] + p['w']
    print(f"{p['name']:8s} | {p['x']:6.1f} | {p['y_abs']:8.1f} | {p['w']:.0f}×{p['h']:.0f} | {right:6.1f}")

# 统计各Y层的右边缘
from collections import defaultdict
by_y = defaultdict(list)
for p in all_placed:
    by_y[round(p['y_abs'], 1)].append(p)

print(f"\n{'='*70}")
print(f"  各Y层分析（这是关键！）")
print(f"{'='*70}")

for y in sorted(by_y.keys()):
    rects = by_y[y]
    max_right = max(r['x'] + r['w'] for r in rects)
    min_right = min(r['x'] + r['w'] for r in rects)
    util = max_right / 130 * 100
    
    print(f"\nY={y:6.1f}cm ({len(rects)}个裁片):")
    print(f"  右缘范围: {min_right:.1f} ~ {max_right:.1f}cm (利用率{util:.1f}%)")
    
    # 显示该层最右侧的3个裁片
    rightmost = sorted(rects, key=lambda x: -(x['x']+x['w']))[:3]
    print(f"  最右侧: ", end="")
    for r in rightmost:
        print(f"{r['name']}({r['x']+r['w']:.0f}) ", end="")
    print()
