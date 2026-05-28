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
print('【独立NestEngine测试】')
print('=' * 80)

if result.get('success'):
    nesting = result.get('nesting', {})
    pieces = nesting.get('pieces', [])
    
    print(f'\n✅ 成功！')
    print(f'📦 裁片数量: {len(pieces)}')
    print(f'📍 位置数量: {len(nesting.get("positions", []))}')
    print(f'📐 bounds: {nesting.get("bounds")}')
    print(f'📊 利用率: {nesting.get("utilization", 0):.1f}%')
    
    for i, p in enumerate(pieces[:3]):
        print(f'  {i+1}. {p.get("name")}: ({p.get("x"):.1f}, {p.get("y"):.1f}) {p.get("width")}×{p.get("height")} seam={p.get("seamAllowance")}cm')
else:
    print('❌ 失败:', result)
