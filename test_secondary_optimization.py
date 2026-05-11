import sys
sys.path.insert(0, '.')
from polygon_nesting import polygon_nesting, detect_shape_irregularities

pieces = [
    {'name': '前片', 'width': 50, 'height': 60, 'count': 2, 'shape': 'single_corner', 'shoulder_width': 10},
    {'name': '后片', 'width': 50, 'height': 120, 'count': 1, 'shape': 'double_corner', 'shoulder_width': 10},
    {'name': '袖子(左*', 'width': 40, 'height': 10, 'count': 2, 'shape': 'double_corner'},
    {'name': '领口罗纹', 'width': 40, 'height': 10, 'count': 1, 'shape': 'rectangle'},
    {'name': '口袋', 'width': 20, 'height': 12, 'count': 4, 'shape': 'rectangle'},
    {'name': '其他配件', 'width': 34, 'height': 34, 'count': 10, 'shape': 'rectangle'},
    {'name': '小', 'width': 10, 'height': 10, 'count': 5, 'shape': 'rectangle'},
]

print(f"{'='*70}")
print(f"  二次优化功能测试")
print(f"{'='*70}")

print(f"\n输入裁片: {len(pieces)}种, 总计{sum(p['count'] for p in pieces)}片")

result = polygon_nesting(pieces, fabric_width_cm=130, rotation=True)

print(f"\n{'='*70}")
print(f"  最终结果")
print(f"{'='*70}")
print(f"总长度: {result['total_length_cm']:.1f}cm")
print(f"利用率: {result['width_utilization']*100:.2f}%")

total_input_area = sum(p['width']*p['height']*p['count'] for p in pieces)
theoretical_min = total_input_area / 130
print(f"理论最短: {theoretical_min:.1f}cm (100%利用率)")

# 统计排入的裁片
placed_names = []
for row in result.get('rows', []):
    for p in row.get('pieces', []):
        placed_names.append(p['name'])

from collections import Counter
input_counts = {p['name']: p['count'] for p in pieces}
placed_counts = Counter(placed_names)

print(f"\n{'─'*70}")
print(f"{'裁片名称':<12} │ {'输入':>4} │ {'已排':>4} │ {'状态'}")
print(f"{'─'*12}─┼──────┼──────┼────────────────────")

all_placed = True
for name in sorted(input_counts.keys()):
    inp = input_counts[name]
    placed = placed_counts.get(name, 0)
    status = "✅ 全部排入" if placed >= inp else f"⚠️ 只排了{placed}/{inp}"
    if placed < inp:
        all_placed = False
    print(f"{name:<12} │ {inp:4d} │ {placed:4d} │ {status}")

if all_placed:
    print(f"\n✅ 所有裁片已成功排入!")
else:
    print(f"\n⚠️ 部分裁片未排入（可能因空间限制）")

# 详细轮廓分析
print(f"\n{'='*70}")
print(f"  轮廓分析详情")
print(f"{'='*70}")

detection = detect_shape_irregularities(result, 130)

print(f"\n形状指标:")
print(f"  梯形度: {detection['trapezoid_ratio']:.3f}", end="")
if detection['trapezoid_ratio'] < 0.90:
    print(f" ⚠️ 明显梯形", end="")
elif detection['trapezoid_ratio'] < 0.95:
    print(f" 📊 轻微梯形", end="")
else:
    print(f" ✓ 接近矩形", end="")
print()

print(f"  标准差: {detection['std_dev']:.2f}cm", end="")
if detection['std_dev'] > 15:
    print(f" ⚠️ 很不规则", end="")
elif detection['std_dev'] > 8:
    print(f" 📊 中等规整", end="")
else:
    print(f" ✓ 较整齐", end="")
print()

print(f"  平均利用率: {detection['avg_utilization']*100:.1f}%")
print(f"  优化评分: {detection['optimization_score']}/100", end="")
if detection['optimization_score'] > 30:
    print(f" (急需优化)", end="")
elif detection['optimization_score'] > 20:
    print(f" (建议优化)", end="")
else:
    print(f" (良好)", end="")
print()

if detection['gaps']:
    print(f"\n凹陷区域 ({len(detection['gaps'])}):")
    for i, gap in enumerate(detection['gaps'], 1):
        print(f"  {i}. Y={gap['y']:.1f}cm: 空白{gap['width']:.1f}cm×{gap['height']:.1f}cm"
              f" = {gap['area']:.0f}cm² (利用率{gap['utilization']*100:.1f}%)")
else:
    print(f"\n✓ 无显著凹陷区域")

# 行级详细分析
print(f"\n{'='*70}")
print(f"  各行详细信息")
print(f"{'='*70}")

from collections import defaultdict
by_y = defaultdict(list)
for row in result.get('rows', []):
    ys = row.get('y_start', 0)
    for p in row.get('pieces', []):
        by_y[ys].append({
            'name': p['name'],
            'x': p.get('x', 0),
            'w': p.get('width', 0),
            'h': p.get('height', 0),
            'rel_y': p.get('y', 0)
        })

print(f"\n{'Y起点':>8} │ {'右缘':>6} │ {'利用率':>6} │ {'裁片数':>5} │ 主要裁片")
print(f"{'─'*8}─┼──────┼────────┼────────┼──────────────────────────────────────")

for ys in sorted(by_y.keys()):
    r = by_y[ys]
    rm = max(x['x']+x['w'] for x in r) if r else 0
    u = rm/130*100 if rm > 0 else 0
    names = [x['name'] for x in sorted(r, key=lambda x: (x['rel_y'], x['x']))]
    
    marker = ""
    if u < 85:
        marker = " ⚠️ 低效"
    elif u < 92:
        marker = " 📊 一般"
    else:
        marker = " ✓"
    
    main_pieces = ', '.join(names[:6])
    if len(names) > 6:
        main_pieces += f"...(+{len(names)-6})"
    
    print(f"{ys:7.1f}cm │ {rm:5.1f}cm │ {u:5.1f}% │ {len(r):4d} │ {main_pieces}{marker}")

# 总结
print(f"\n{'='*70}")
print(f"  测试总结")
print(f"{'='*70}")

improvement_possible = detection['optimization_score'] > 20 and len(detection['gaps']) > 0

if improvement_possible:
    total_gap_area = sum(g['area'] for g in detection['gaps'])
    potential_improvement = (total_gap_area / (130 * result['total_length_cm'])) * 100
    
    print(f"\n📌 发现可优化空间:")
    print(f"  • 凹陷区域总面积: {total_gap_area:.0f}cm²")
    print(f"  • 理论最大提升: +{potential_improvement:.2f}%")
    print(f"  • 二次优化模块已集成并自动执行")
else:
    print(f"\n✓ 当前布局已较优，无需额外优化")

print(f"\n{'═'*70}")
