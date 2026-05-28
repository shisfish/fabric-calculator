import sys
sys.path.insert(0, '/Users/shisfish/Documents/garment-workspace/fabric-calculator')
from calc_engine import generate_all_modules
import json

result = generate_all_modules(
    measurements={'category':'tshirt','pieces':[{'name':'前片','width':50,'height':50,'quantity':2},{'name':'后片','width':50,'height':50,'quantity':1}]},
    fabric_width=145,
    seam_allowance=1.5
)

print('=' * 80)
print('【统计字段验证】')
print('=' * 80)

if result.get('success'):
    nesting = result.get('nesting', {})

    print(f'\n📊 nesting顶级字段:')
    for key in ['utilization', 'totalArea', 'usedArea', 'utilization_rate', 'per_piece_length_m', 'total_area_m2']:
        val = nesting.get(key, '❌ 缺失')
        print(f'   {key}: {val}')

    stats = nesting.get('statistics', {})
    print(f'\n📈 statistics字段 (前端使用):')
    for key in ['totalPieces', 'totalArea', 'usedArea', 'wasteArea', 'fabricLength', 'utilization']:
        val = stats.get(key, '❌ 缺失')
        if isinstance(val, float):
            print(f'   {key}: {val:.2f}')
        else:
            print(f'   {key}: {val}')

    print(f'\n✅ 前端显示验证:')
    utilization = stats.get('utilization', 0)
    fabricLength = stats.get('fabricLength', 0)

    print(f'   利用率: {utilization:.1f}% ← 应该>0')
    print(f'   用料长度: {fabricLength:.2f} cm ← 应该>0')
    print(f'   排料长度: {fabricLength/100:.3f} m ← 应该>0')
    print(f'   门幅利用率: {utilization:.1f}% ← 应该>0')

else:
    print('❌ 错误:', result)
