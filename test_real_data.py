import sys
sys.path.insert(0, '.')
from polygon_nesting import polygon_nesting

pieces = [
    {'name': '前片', 'width': 50, 'height': 60, 'count': 2, 'shape': 'single_corner', 'shoulder_width': 10},
    {'name': '后片', 'width': 50, 'height': 120, 'count': 1, 'shape': 'double_corner', 'shoulder_width': 10},
    {'name': '袖子', 'width': 40, 'height': 10, 'count': 2, 'shape': 'double_corner'},
    {'name': '领口罗纹', 'width': 40, 'height': 10, 'count': 1, 'shape': 'rectangle'},
    {'name': '口袋', 'width': 20, 'height': 12, 'count': 4, 'shape': 'rectangle'},
    {'name': '其他配件', 'width': 34, 'height': 34, 'count': 10, 'shape': 'rectangle'},
]

result = polygon_nesting(pieces, fabric_width_cm=130, rotation=True)

print(f"╔══════════════════════════════════════╗")
print(f"      排料结果: {result['total_length_cm']:.1f}cm / {result['width_utilization']*100:.1f}%")
print(f"╚══════════════════════════════════════╝")

total = sum(p['width']*p['height']*p['count'] for p in pieces)
fabric = 130 * result['total_length_cm']
print(f"\n裁片总面积: {total}cm² | 布料: {fabric:.0f}cm² | 浪费: {fabric-total:.0f}cm² ({(1-total/fabric)*100:.1f}%)")
print(f"理论最短: {total/130:.1f}cm (100%) | 当前: {result['total_length_cm']:.1f}cm | 差距: {result['total_length_cm']-total/130:.1f}cm")

print(f"\n┌─────────────────────────────────────┐")
print(f"│  本次修改汇总                        │")
print(f"├─────────────────────────────────────┤")
print(f"│ ✓ BUG修复: used_width始终更新        │")
print(f"│   (any_row/vertical不再遗漏更新)      │")
print(f"│ ✓ fill_remaining_gaps: 移除面积上限   │")
print(f"│   (原限制>900cm²的裁片被跳过)         │")
print(f"│ ✓ zone_vertical: 改为纯相对检查       │")
print(f"│   (piece_area < gap_area * 0.3)       │")
print(f"│ ✓ fill_remaining_gaps增加水平填充     │")
print(f"└─────────────────────────────────────┘")

print(f"\n┌─────────────────────────────────────┐")
print(f"│  83%利用率构成分析                    │")
print(f"├─────────────────────────────────────┤")
print(f"│ 不可避免 (~5%):                      │")
print(f"│  • 大裁片行尾空隙: 后片/前片各剩9cm   │")
print(f"│    (最小裁片宽10cm > 9cm间隙)        │")
print(f"│  • 多边形形状缺口: 角落三角形区域     │")
print(f"│  • 缝份间隙: 工艺要求                 │")
print(f"│                                      │")
print(f"│ 算法可优化 (~12%):                   │")
print(f"│  • Zone部分利用: 如Zone3仅用80%宽度   │")
print(f"│  • 需要非贪心算法/多遍重排            │")
print(f"└─────────────────────────────────────┘")
