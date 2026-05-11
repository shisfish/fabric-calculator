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
total_area = sum(p['width']*p['height']*p['count'] for p in pieces)

print(f"{'='*55}")
print(f"  最终结果: {result['total_length_cm']:.1f}cm | {result['width_utilization']*100:.1f}%")
print(f"  理论最短: {total_area/130:.1f}cm (100%)")
print(f"{'='*55}")

from collections import defaultdict
by_zone = defaultdict(list)
for row in result['rows']:
    ys = row.get('y_start', 0)
    for p in row.get('pieces', []):
        by_zone[ys].append({'n': p['name'], 'x': p.get('x',0), 'w': p.get('width',0), 'rel_y': p.get('y',0)})

print(f"\n{'Zone起点':>8} │ {'右缘':>6} │ {'利用率':>6} │ 裁片数")
print(f"{'─'*8}─┼─{'─'*6}─┼─{'─'*6}─┼─{'─'*40}")
for ys in sorted(by_zone.keys()):
    r = by_zone[ys]
    rm = max(x['x']+x['w'] for x in r) if r else 0
    u = rm/130*100 if rm > 0 else 0
    print(f"{ys:7.1f}cm │ {rm:5.1f}cm │ {u:5.1f}% │ {len(r):2d}片")

print(f"\n✅ 紧凑性优化已生效 - 每次放置后自动填充行内空隙")
