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

print(f"{'='*65}")
print(f"  排料结果: {result['total_length_cm']:.1f}cm | {result['width_utilization']*100:.1f}%")
print(f"{'='*65}")

rects = []
for row in result['rows']:
    ys = row.get('y_start', 0)
    for p in row.get('pieces', []):
        rects.append({
            'name': p['name'],
            'x': p.get('x', 0),
            'y': ys + p.get('y', 0),
            'w': p.get('width', 0),
            'h': p.get('height', 0)
        })

print(f"\n已排入裁片数: {len(rects)}")

if not rects:
    print("⚠️ 无裁片数据!")
    sys.exit(1)

total_fabric = 130 * result['total_length_cm']
total_piece_area = sum(r['w']*r['h'] for r in rects)
print(f"布料总面积: {total_fabric:.0f}cm²")
print(f"裁片总面积: {total_piece_area:.0f}cm²")
print(f"浪费面积:   {total_fabric-total_piece_area:.0f}cm² ({(1-total_piece_area/total_fabric)*100:.1f}%)")

print(f"\n{'='*65}")
print(f"  轮廓分析 - 按Y坐标分行检测空白区域")
print(f"{'='*65}")

ys_sorted = sorted(set(r['y'] for r in rects))
print(f"\n共 {len(ys_sorted)} 个不同的Y坐标层")

max_right_by_y = {}
for y in ys_sorted:
    row_rects = [r for r in rects if abs(r['y'] - y) < 0.5]
    if row_rects:
        max_right_by_y[y] = max(r['x']+r['w'] for r in row_rects)

print(f"\n{'Y坐标':>8} │ {'右缘':>6} │ {'利用率':>6} │ {'空白宽度':>7} │ {'可放入的最小裁片'}")
print(f"{'─'*8}─┼──────┼────────┼─────────┼──────────────────────────")

gaps = []
for y in sorted(max_right_by_y.keys()):
    rm = max_right_by_y[y]
    u = rm/130*100
    gap = 130 - rm
    if gap >= 10:
        can_fit = f"≥10×任意"
    elif gap >= 5:
        can_fit = "5-9cm宽"
    elif gap >= 2:
        can_fit = "2-4cm宽(小)"
    else:
        can_fit = "<2cm(无法利用)"
    
    marker = " ⚠️" if u < 90 else ""
    print(f"{y:7.1f}cm │ {rm:5.1f}cm │ {u:5.1f}% │ {gap:6.1f}cm │ {can_fit}{marker}")
    
    if gap > 5:
        gaps.append({'y': y, 'gap_w': gap, 'util': u})

print(f"\n{'='*65}")
print(f"  形状规整度评估")
print(f"{'='*65}")

right_edges = list(max_right_by_y.values())
if right_edges:
    avg_right = sum(right_edges) / len(right_edges)
    max_right = max(right_edges)
    min_right = min(right_edges)
    variance = sum((r - avg_right)**2 for r in right_edges) / len(right_edges)
    std_dev = variance ** 0.5
    
    print(f"\n右边缘统计:")
    print(f"  平均右缘: {avg_right:.1f}cm ({avg_right/130*100:.1f}%)")
    print(f"  最大右缘: {max_right:.1f}cm ({max_right/130*100:.1f}%)")
    print(f"  最小右缘: {min_right:.1f}cm ({min_right/130*100:.1f}%)")
    print(f"  标准差:   {std_dev:.1f}cm")
    
    shape_ratio = min_right / max_right if max_right > 0 else 1
    print(f"\n形状指标:")
    print(f"  梯形度 (min/max): {shape_ratio:.3f}")
    if shape_ratio < 0.85:
        print(f"  → ⚠️ 明显梯形! 左右差距 {(1-shape_ratio)*100:.1f}%")
    elif shape_ratio < 0.95:
        print(f"  → 轻微梯形，可优化")
    else:
        print(f"  → ✓ 接近矩形")
    
    if std_dev > 15:
        print(f"  → ⚠️ 轮廓不规则 (标准差>{std_dev:.1f}cm)")
    elif std_dev > 8:
        print(f"  → 中等规整度")
    else:
        print(f"  → ✓ 轮廊较整齐")

print(f"\n{'='*65}")
print(f"  可填充区域汇总")
print(f"{'='*65}")

if gaps:
    total_gap_area = sum(g['gap_w'] * 10 for g in gaps)  
    print(f"\n发现 {len(gaps)} 个显著空白区域:")
    for i, g in enumerate(gaps[:5], 1):
        print(f"  {i}. Y={g['y']:.1f}cm: 空白{g['gap_w']:.1f}cm × ~10cm ≈ {g['gap_w']*10:.0f}cm²")
    print(f"\n总可填充面积（估算）: ≥{total_gap_area:.0f}cm²")
else:
    print("\n✅ 无显著空白区域 (所有行利用率≥90%)")

print(f"\n{'='*65}")
print(f"  二次优化可行性结论")
print(f"{'='*65}")

if len(gaps) >= 2 or (gaps and gaps[0]['gap_w'] > 15):
    print(f"\n✅ 建议执行二次优化:")
    print(f"  • 存在 {len(gaps)} 个可填充区域")
    print(f"  • 最大空白宽度: {max(g['gap_w'] for g in gaps):.1f}cm")
    print(f"  • 预计可回收面积: ≥{total_gap_area:.0f}cm²")
    print(f"  • 推荐策略: 局部重排 + 小裁片填充")
elif gaps:
    print(f"\n📊 可选优化:")
    print(f"  • 空白区域较小 ({gaps[0]['gap_w']:.1f}cm)")
    print(f"  • 收益有限，可根据需求决定是否优化")
else:
    print(f"\n✓ 当前布局已较优，无需二次优化")
