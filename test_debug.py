import sys
sys.path.insert(0, '.')
from polygon_nesting import polygon_nesting

pieces = [
    {'name': '后片', 'width': 50, 'height': 80, 'count': 1, 'shape': 'double_corner', 'shoulder_width': 40},
    {'name': '前片', 'width': 48, 'height': 70, 'count': 2, 'shape': 'double_corner', 'shoulder_width': 38},
    {'name': '袖子', 'width': 20, 'height': 60, 'count': 2, 'shape': 'single_corner', 'sleeve_cap_width': 20, 'cuff_width': 12},
    {'name': '其他配件', 'width': 25, 'height': 25, 'count': 9, 'shape': 'rectangle'},
    {'name': '口袋', 'width': 15, 'height': 15, 'count': 4, 'shape': 'rectangle'},
    {'name': '领口罗纹', 'width': 10, 'height': 30, 'count': 1, 'shape': 'rectangle'},
]

result = polygon_nesting(pieces, fabric_width_cm=130, rotation=True)
print(f"\n总长度: {result['total_length_cm']:.1f}cm | 利用率: {result['width_utilization']*100:.1f}%")

print("\n=== 排布详情 ===")
for i, rect in enumerate(result['placed_rects']):
    print(f"  #{i}: {rect['name']} @ ({rect['x']:.1f}, {rect['y']:.1f}) {rect['w']:.0f}x{rect['h']:.0f}")
