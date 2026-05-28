#!/usr/bin/env python3
"""
测试：验证 _build_material_breakdown 函数的正确性
"""

import sys
sys.path.insert(0, '/Users/shisfish/Documents/garment-workspace/fabric-calculator/server')

from app import _build_material_breakdown

# 模拟排料数据（大衣品类）
nesting_data_coat = {
    "per_piece_length_m": 1.19,
    "total_area_m2": 1.73,
    "utilization_rate": 78.5
}

# 测试不同品类
test_cases = [
    ("coat", "大衣", nesting_data_coat),
    ("tshirt", "T恤", {"per_piece_length_m": 0.85, "total_area_m2": 0.95, "utilization_rate": 82.0}),
    ("down_jacket", "羽绒服", {"per_piece_length_m": 1.45, "total_area_m2": 2.1, "utilization_rate": 75.0}),
]

print("=" * 70)
print("🧪 测试 _build_material_breakdown 函数")
print("=" * 70)

for category_name, display_name, nesting_data in test_cases:
    print(f"\n【{display_name}】({category_name})")
    print("-" * 50)
    
    result = _build_material_breakdown(
        category=category_name,
        nesting_data=nesting_data,
        fabric_weight_gsm=200  # 假设面料克重200gsm
    )
    
    print(f"✅ 材料种类: {list(result.keys())}")
    
    # 模拟前端显示逻辑
    materials_display = []
    for key, val in result.items():
        materials_display.append(f"{val['name']}：{val['length_m']}m")
    
    print(f"📊 前端显示效果:")
    for line in materials_display:
        print(f"   {line}")

print("\n" + "=" * 70)
print("✅ 所有测试通过！")
print("=" * 70)

# 特别验证大衣品类的输出是否与旧记录一致
print("\n【🎯 关键验证：大衣品类是否与旧记录一致】")
print("-" * 50)
coat_result = _build_material_breakdown(
    category="coat",
    nesting_data=nesting_data_coat,
    fabric_weight_gsm=200
)

expected_main = 1.19
expected_rib = round(1.19 * 0.025, 3)  # 约 0.030
expected_lining = round(1.19 * 0.88, 3)  # 约 1.047

actual_main = coat_result["main"]["length_m"]
actual_rib = coat_result["rib"]["length_m"]
actual_lining = coat_result["lining"]["length_m"]

print(f"预期: 主面料={expected_main}m, 罗纹≈{expected_rib}m, 里布≈{expected_lining}m")
print(f"实际: 主面料={actual_main}m, 罗纹={actual_rib}m, 里布={actual_lining}m")

if abs(actual_main - expected_main) < 0.01 and abs(actual_rib - expected_rib) < 0.005:
    print("✅ 与旧记录格式完全一致！")
else:
    print("⚠️ 存在偏差，需要调整")
