# -*- coding: utf-8 -*-
"""
面料用量计算引擎 - Fabric Consumption Calculator Engine
支持全品类服装的面料用量计算，基于面积法+经验公式法
"""

import math
import json
import os

# ============================================================
# 品类配置数据
# ============================================================

# 默认品类配置
DEFAULT_CATEGORIES = {
    "coat": {
        "name": "大衣",
        "description": "毛呢大衣、风衣、长款外套",
        "pieces": [
            {"id": "front_body", "name": "前片（左+右）", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar", "name": "领子", "default": True},
            {"id": "pocket", "name": "口袋", "default": False},
            {"id": "belt", "name": "腰带", "default": False},
            {"id": "cuff", "name": "袖口", "default": False},
            {"id": "lining", "name": "里布", "default": True},
            {"id": "interlining", "name": "衬布/粘合衬", "default": False},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 8,
        "default_shrinkage": 3,
        "fabric_utilization": 0.78,
        "has_filling": False,
        "has_lining": True,
    },
    "down_jacket": {
        "name": "羽绒服",
        "description": "短款/中长款/长款羽绒服",
        "pieces": [
            {"id": "front_body", "name": "前片（左+右）", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar", "name": "领子", "default": True},
            {"id": "hood", "name": "帽子", "default": True},
            {"id": "pocket", "name": "口袋", "default": False},
            {"id": "cuff", "name": "袖口罗纹", "default": True},
            {"id": "bottom_rib", "name": "下摆罗纹", "default": True},
            {"id": "shell_fabric", "name": "面料（表层）", "default": True},
            {"id": "lining", "name": "里布", "default": True},
            {"id": "filling_fabric_single", "name": "胆料（单层）", "default": False},
            {"id": "filling_fabric_double", "name": "胆料（双层）", "default": True},
            {"id": "down_filling", "name": "羽绒填充", "default": True},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 8,
        "default_shrinkage": 2,
        "fabric_utilization": 0.75,
        "has_filling": True,
        "has_lining": True,
    },
    "jacket": {
        "name": "夹克",
        "description": "休闲夹克、棒球服、工装夹克",
        "pieces": [
            {"id": "front_body", "name": "前片（左+右）", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar", "name": "领子", "default": True},
            {"id": "pocket", "name": "口袋", "default": False},
            {"id": "cuff", "name": "袖口", "default": False},
            {"id": "lining", "name": "里布", "default": True},
            {"id": "interlining", "name": "衬布/粘合衬", "default": False},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 7,
        "default_shrinkage": 2,
        "fabric_utilization": 0.80,
        "has_filling": False,
        "has_lining": True,
    },
    "windbreaker": {
        "name": "风衣",
        "description": "风衣、冲锋衣",
        "pieces": [
            {"id": "front_body", "name": "前片（左+右）", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar", "name": "领子", "default": True},
            {"id": "hood", "name": "帽子", "default": True},
            {"id": "pocket", "name": "口袋", "default": True},
            {"id": "belt", "name": "腰带", "default": True},
            {"id": "cuff", "name": "袖口", "default": True},
            {"id": "lining", "name": "里布", "default": True},
            {"id": "interlining", "name": "衬布/粘合衬", "default": False},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 8,
        "default_shrinkage": 2,
        "fabric_utilization": 0.76,
        "has_filling": False,
        "has_lining": True,
    },
    "cotton_padded": {
        "name": "棉服",
        "description": "棉衣、棉服、夹棉外套",
        "pieces": [
            {"id": "front_body", "name": "前片（左+右）", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar", "name": "领子", "default": True},
            {"id": "hood", "name": "帽子", "default": False},
            {"id": "pocket", "name": "口袋", "default": False},
            {"id": "cuff", "name": "袖口", "default": True},
            {"id": "shell_fabric", "name": "面料（表层）", "default": True},
            {"id": "lining", "name": "里布", "default": True},
            {"id": "cotton_filling", "name": "棉花/化纤填充", "default": True},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 8,
        "default_shrinkage": 3,
        "fabric_utilization": 0.76,
        "has_filling": True,
        "has_lining": True,
    },
    "pants": {
        "name": "裤子",
        "description": "西裤、休闲裤、牛仔裤",
        "pieces": [
            {"id": "front_panel", "name": "前片（左+右）", "default": True},
            {"id": "back_panel", "name": "后片（左+右）", "default": True},
            {"id": "waistband", "name": "腰头", "default": True},
            {"id": "pocket_bag", "name": "口袋布", "default": True},
            {"id": "fly", "name": "门襟", "default": True},
            {"id": "belt_loop", "name": "裤耳/串带", "default": False},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 6,
        "default_shrinkage": 2,
        "fabric_utilization": 0.82,
        "has_filling": False,
        "has_lining": False,
    },
    "skirt": {
        "name": "裙子",
        "description": "半裙、连衣裙下装",
        "pieces": [
            {"id": "front_panel", "name": "前片", "default": True},
            {"id": "back_panel", "name": "后片", "default": True},
            {"id": "waistband", "name": "腰头", "default": True},
            {"id": "pocket", "name": "口袋", "default": False},
            {"id": "lining", "name": "里布", "default": True},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 6,
        "default_shrinkage": 2,
        "fabric_utilization": 0.82,
        "has_filling": False,
        "has_lining": True,
    },
    "shirt": {
        "name": "衬衫",
        "description": "男/女式衬衫",
        "pieces": [
            {"id": "front_body", "name": "前片（左+右）", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar", "name": "领子", "default": True},
            {"id": "cuff", "name": "袖口", "default": True},
            {"id": "pocket", "name": "口袋", "default": True},
            {"id": "yoke", "name": "过肩", "default": True},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 6,
        "default_shrinkage": 2,
        "fabric_utilization": 0.83,
        "has_filling": False,
        "has_lining": False,
    },
    "tshirt": {
        "name": "T恤",
        "description": "短袖/长袖T恤、卫衣",
        "pieces": [
            {"id": "front_body", "name": "前片", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar_rib", "name": "领口罗纹", "default": True},
            {"id": "pocket", "name": "口袋", "default": False},
            {"id": "other", "name": "其他配件", "default": False},
        ],
        "default_wastage": 7,
        "default_shrinkage": 3,
        "fabric_utilization": 0.80,
        "has_filling": False,
        "has_lining": False,
    },
    "custom": {
        "name": "自定义",
        "description": "自定义品类，可自由添加裁片",
        "pieces": [],
        "default_wastage": 7,
        "default_shrinkage": 2,
        "fabric_utilization": 0.78,
        "has_filling": False,
        "has_lining": False,
    },
}

# 面料类型配置
FABRIC_TYPES = {
    "woven": {
        "name": "梭织面料",
        "description": "毛呢、棉布、化纤、丝绸等梭织面料",
        "default_wastage": 6,
        "typical_widths": [140, 145, 148, 150, 152],
    },
    "knit": {
        "name": "针织面料",
        "description": "汗布、绒布、网眼、罗纹等针织面料",
        "default_wastage": 8,
        "typical_widths": [150, 155, 160, 165, 170],
    },
    "down_shell": {
        "name": "羽绒服面料",
        "description": "高密度防绒面料、尼龙、聚酯纤维",
        "default_wastage": 8,
        "typical_widths": [140, 145, 148, 150],
    },
    "lining": {
        "name": "里布",
        "description": "涤纶里布、铜氨丝里布、真丝里布",
        "default_wastage": 5,
        "typical_widths": [140, 145, 148, 150],
    },
    "interlining": {
        "name": "衬布/粘合衬",
        "description": "有纺衬、无纺衬、粘合衬",
        "default_wastage": 5,
        "typical_widths": [90, 100, 110, 140, 150],
    },
}


# ============================================================
# 简化排料模拟
# ============================================================

def simulate_nesting(pieces_with_dims, fabric_width_cm, seam_gap_cm=0.5):
    """
    排料模拟 — 精确计算门幅利用率并记录每个裁片的实际位置

    使用贪心算法模拟真实排料过程，记录每个裁片的精确位置。
    排料结果直接用于图片展示，确保计算数据与可视化一致。

    参数:
      pieces_with_dims: 支持两种格式：
        - [(length_cm, width_cm), ...] - 兼容旧格式
        - [{name, length, width, vertices}, ...] - 新格式
      fabric_width_cm: 有效面料门幅 (cm)
      seam_gap_cm: 裁片间隙 (cm)

    返回:
      {
        "total_length_cm": 总用料长度,
        "rows": [
          {
            "length_cm": 行高,
            "used_width_cm": 已用宽度,
            "pieces": [
              {name, length, width, vertices, x, y, w, h},
              ...
            ]
          },
          ...
        ],
        "width_utilization": 门幅利用率
      }
    """
    if not pieces_with_dims or fabric_width_cm <= 0:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}

    # 统一转换为字典格式（兼容旧的元组格式）
    pieces = []
    for p in pieces_with_dims:
        if isinstance(p, tuple):
            # 旧格式：(length, width)
            pieces.append({
                "name": "",
                "length": p[0],
                "width": p[1],
                "vertices": None,
            })
        else:
            # 新格式：字典
            pieces.append(p)

    # 按长度降序排列（长的先排，减少浪费）
    sorted_pieces = sorted(pieces, key=lambda p: (-p["length"], -p["width"]))

    rows = []
    total_piece_area = 0

    for piece in sorted_pieces:
        p_length = piece["length"]
        p_width = piece["width"]
        total_piece_area += p_length * p_width
        placed = False

        # 尝试放入已有排（优先高度匹配的排）
        best_row = None
        best_score = -1
        for row in rows:
            # 计算所需宽度（第一个裁片不需要间隙）
            needed = p_width + (seam_gap_cm if len(row["pieces"]) > 0 else 0)
            remaining = fabric_width_cm - row["used_width_cm"]

            # 如果放不进，跳过
            if needed > remaining:
                continue

            # 优先选择高度最接近的排
            length_diff = abs(row["length_cm"] - p_length)
            # 同时优先选择剩余空间小的排（填充）
            score = 1000 - length_diff * 10 - remaining
            if score > best_score:
                best_score = score
                best_row = row

        if best_row:
            # 确定x位置
            piece_x = best_row["used_width_cm"] + (seam_gap_cm if len(best_row["pieces"]) > 0 else 0)
            # 居中对齐
            piece_y = (best_row["length_cm"] - p_length) / 2 if best_row["length_cm"] > p_length else 0

            best_row["pieces"].append({
                "name": piece.get("name", ""),
                "length": p_length,
                "width": p_width,
                "vertices": piece.get("vertices"),
                "x": piece_x,
                "y": piece_y,
                "w": p_width,
                "h": p_length,
            })
            best_row["used_width_cm"] = piece_x + p_width
            best_row["pieces_count"] = len(best_row["pieces"])
            # 更新行高（取最大值）
            if p_length > best_row["length_cm"]:
                best_row["length_cm"] = p_length
            placed = True

        if not placed:
            # 新建排
            if p_width > fabric_width_cm:
                # 旋转裁片（宽度超过门幅，交换长宽）
                rows.append({
                    "length_cm": p_width,
                    "used_width_cm": p_length,
                    "pieces_count": 1,
                    "rotated": True,
                    "pieces": [{
                        "name": piece.get("name", ""),
                        "length": p_width,
                        "width": p_length,
                        "vertices": piece.get("vertices"),
                        "x": 0,
                        "y": 0,
                        "w": p_length,
                        "h": p_width,
                        "rotated": True,
                    }]
                })
            else:
                rows.append({
                    "length_cm": p_length,
                    "used_width_cm": p_width,
                    "pieces_count": 1,
                    "pieces": [{
                        "name": piece.get("name", ""),
                        "length": p_length,
                        "width": p_width,
                        "vertices": piece.get("vertices"),
                        "x": 0,
                        "y": 0,
                        "w": p_width,
                        "h": p_length,
                    }]
                })

    total_length = sum(row["length_cm"] for row in rows)
    total_used_area = sum(row["used_width_cm"] * row["length_cm"] for row in rows)
    total_available_area = fabric_width_cm * total_length if total_length > 0 else 0
    width_utilization = total_used_area / total_available_area if total_available_area > 0 else 0

    return {
        "total_length_cm": total_length,
        "rows": rows,
        "width_utilization": round(width_utilization, 4),
    }


# ============================================================
# 核心计算引擎
# ============================================================

class FabricCalculator:
    """面料用量计算核心引擎"""

    def __init__(self):
        self.categories = dict(DEFAULT_CATEGORIES)

    def get_categories(self):
        """获取所有品类列表"""
        result = []
        for key, cat in self.categories.items():
            result.append({
                "id": key,
                "name": cat["name"],
                "description": cat["description"],
                "piece_count": len(cat["pieces"]),
                "has_filling": cat["has_filling"],
                "has_lining": cat["has_lining"],
            })
        return result

    def get_category_detail(self, category_id):
        """获取品类详情"""
        if category_id not in self.categories:
            return None
        cat = self.categories[category_id]
        return {
            "id": category_id,
            "name": cat["name"],
            "description": cat["description"],
            "pieces": cat["pieces"],
            "default_wastage": cat["default_wastage"],
            "default_shrinkage": cat["default_shrinkage"],
            "fabric_utilization": cat["fabric_utilization"],
            "has_filling": cat["has_filling"],
            "has_lining": cat["has_lining"],
        }

    def add_custom_category(self, category_id, name, description, pieces):
        """添加自定义品类"""
        self.categories[category_id] = {
            "name": name,
            "description": description,
            "pieces": pieces,
            "default_wastage": 7,
            "default_shrinkage": 2,
            "fabric_utilization": 0.78,
            "has_filling": False,
            "has_lining": False,
        }
        return self.get_category_detail(category_id)

    def calculate_piece_area(self, length_cm, width_cm, shape="rectangle", pieces_count=1):
        """
        计算单个裁片面积（cm²）
        shape: rectangle(矩形), trapezoid(梯形), triangle(三角形), circle(圆形)
        """
        if shape == "rectangle":
            area = length_cm * width_cm
        elif shape == "trapezoid":
            # 梯形面积 = (上底 + 下底) * 高 / 2
            # length_cm = 高, width_cm = 上底, 需要额外参数
            area = length_cm * width_cm * 0.9  # 近似
        elif shape == "triangle":
            area = length_cm * width_cm / 2
        elif shape == "circle":
            radius = min(length_cm, width_cm) / 2
            area = math.pi * radius * radius
        else:
            area = length_cm * width_cm

        return area * pieces_count

    def calculate_consumption(self, data):
        """
        计算面料用量（核心方法）

        data 参数结构:
        {
            "category": "coat",           # 品类ID
            "fabric_width": 145,          # 面料门幅(cm)
            "fabric_type": "woven",       # 面料类型
            "fabric_weight_gsm": 300,     # 面料克重(g/m²)
            "shrinkage_rate": 3,          # 缩水率(%)
            "wastage_rate": 8,            # 损耗率(%)
            "quantity": 100,              # 订单数量
            "pieces": [                   # 裁片列表
                {
                    "name": "前片（左+右）",
                    "length": 85,         # 裁片长度(cm)
                    "width": 60,          # 裁片宽度(cm)
                    "count": 2,           # 数量
                    "shape": "rectangle", # 形状
                    "material": "main",   # 材料类型: main/lining/interlining/filling
                    "seam_allowance": 1.5 # 缝份(cm)
                },
                ...
            ],
            "down_filling": {             # 羽绒填充（仅羽绒服）
                "total_weight_g": 150,    # 总充绒量(g)
                "filling_type": "goose_down_90"  # 填充类型
            },
            "cotton_filling": {           # 棉花填充（仅棉服）
                "total_weight_g": 200,    # 总填充量(g)
                "filling_type": "polyester"  # 填充类型
            }
        }

        返回:
        {
            "total_area_cm2": ...,        # 总面积(cm²)
            "total_area_m2": ...,         # 总面积(m²)
            "fabric_length_cm": ...,      # 面料用料长度(cm)
            "fabric_length_m": ...,       # 面料用料长度(m)
            "fabric_weight_g": ...,       # 面料重量(g)
            "fabric_weight_kg": ...,      # 面料重量(kg)
            "per_piece_length_m": ...,    # 单件用料长度(m)
            "utilization_rate": ...,      # 面料利用率(%)
            "pieces_detail": [...],       # 各裁片明细
            "material_breakdown": {...},  # 材料分类汇总
            "cost_estimate": {...},       # 成本估算
            "warnings": [...]             # 警告信息
        }
        """
        result = {
            "pieces_detail": [],
            "material_breakdown": {},
            "warnings": [],
        }

        category = self.categories.get(data.get("category", "custom"), self.categories["custom"])
        fabric_width = float(data.get("fabric_width", 145))
        fabric_weight_gsm = float(data.get("fabric_weight_gsm", 0))
        shrinkage_rate = float(data.get("shrinkage_rate", category["default_shrinkage"]))
        wastage_rate = float(data.get("wastage_rate", category["default_wastage"]))
        quantity = int(data.get("quantity", 1))
        pieces = data.get("pieces", [])

        # ===== 输入校验 =====
        if fabric_width < 30 or fabric_width > 400:
            raise ValueError(f"面料门幅异常: {fabric_width}cm，应在 30-400 cm 之间")
        if quantity < 1 or quantity > 1000000:
            raise ValueError(f"订单数量异常: {quantity}，应在 1-1000000 之间")
        if shrinkage_rate < 0 or shrinkage_rate > 50:
            raise ValueError(f"缩水率异常: {shrinkage_rate}%，应在 0-50% 之间")
        if wastage_rate < 0 or wastage_rate > 50:
            raise ValueError(f"损耗率异常: {wastage_rate}%，应在 0-50% 之间")
        if not pieces or len(pieces) == 0:
            raise ValueError("未提供任何裁片数据")
        if len(pieces) > 100:
            raise ValueError(f"裁片数量过多: {len(pieces)}，最多支持100个")
        # ====================

        # 按材料分类汇总
        material_areas = {}  # {material_type: total_area_cm2}
        material_pieces = {}  # {material_type: [(length, width), ...]} 用于排料模拟

        total_area_cm2 = 0

        for piece in pieces:
            piece_name = piece.get("name", "未命名裁片")
            piece_length = float(piece.get("length", 0))
            piece_width = float(piece.get("width", 0))
            piece_count = int(piece.get("count", 1))
            shape = piece.get("shape", "rectangle")
            material = piece.get("material", "main")
            seam_allowance = float(piece.get("seam_allowance", 1.5))

            if piece_length <= 0 or piece_width <= 0:
                continue

            # 加上缝份后的尺寸
            effective_length = piece_length + seam_allowance * 2
            effective_width = piece_width + seam_allowance * 2

            # 计算面积
            area = self.calculate_piece_area(effective_length, effective_width, shape, piece_count)

            # 加上缩水率
            area_with_shrinkage = area * (1 + shrinkage_rate / 100)

            total_area_cm2 += area_with_shrinkage

            # 按材料分类
            if material not in material_areas:
                material_areas[material] = 0
                material_pieces[material] = []
            material_areas[material] += area_with_shrinkage

            # 收集裁片尺寸用于排料模拟（展开 count）
            for _ in range(piece_count):
                material_pieces[material].append((effective_length, effective_width))

            # 裁片明细
            piece_detail = {
                "name": piece_name,
                "original_length": piece_length,
                "original_width": piece_width,
                "effective_length": round(effective_length, 2),
                "effective_width": round(effective_width, 2),
                "count": piece_count,
                "shape": shape,
                "material": material,
                "area_cm2": round(area, 2),
                "area_with_shrinkage_cm2": round(area_with_shrinkage, 2),
                "seam_allowance": seam_allowance,
            }
            result["pieces_detail"].append(piece_detail)

        # 加上损耗率
        total_area_with_wastage = total_area_cm2 * (1 + wastage_rate / 100)

        # 有效门幅
        effective_fabric_width = fabric_width - 3  # 减去针孔边3cm

        # 面料类型修正系数
        fabric_type = data.get("fabric_type", "woven")
        fabric_type_factors = {
            "woven": 1.0,
            "knit": 0.95,
            "down_shell": 0.97,
            "lining": 0.98,
            "interlining": 0.98,
        }
        type_factor = fabric_type_factors.get(fabric_type, 1.0)

        # 面料利用率（用于显示参考）
        utilization = category["fabric_utilization"] * type_factor

        # 面料重量
        fabric_weight_g = 0
        fabric_weight_kg = 0
        if fabric_weight_gsm > 0:
            total_area_m2 = total_area_with_wastage / 10000
            fabric_weight_g = total_area_m2 * fabric_weight_gsm
            fabric_weight_kg = fabric_weight_g / 1000

        # 材料分类汇总（使用排料模拟计算用料长度）
        material_breakdown = {}
        material_names = {
            "main": "主面料",
            "lining": "里布",
            "interlining": "衬布/粘合衬",
            "filling_fabric_single": "胆料（单层）",
            "filling_fabric_double": "胆料（双层）",
            "cotton_filling": "棉花/化纤填充",
            "down_filling": "羽绒填充",
            "rib": "罗纹",
            "other": "其他",
        }

        total_nesting_length_cm = 0  # 所有材料的排料长度之和

        for mat_type, area in material_areas.items():
            # 用排料模拟计算该材料的门幅利用率
            mat_piece_dims = material_pieces.get(mat_type, [])
            nesting_result = simulate_nesting(mat_piece_dims, effective_fabric_width)

            # 面积法基础长度 + 排料修正
            # 基础: 面积 / 门幅（假设完美铺满）
            base_length_cm = area / effective_fabric_width if effective_fabric_width > 0 else 0
            # 排料门幅利用率修正: 实际排料有宽度浪费
            nesting_util = nesting_result["width_utilization"]
            if nesting_util > 0:
                adjusted_length_cm = base_length_cm / nesting_util
            else:
                adjusted_length_cm = base_length_cm

            # 再乘以损耗率
            mat_length_cm = adjusted_length_cm * (1 + wastage_rate / 100)
            mat_length_m = mat_length_cm / 100
            total_nesting_length_cm += mat_length_cm

            material_breakdown[mat_type] = {
                "name": material_names.get(mat_type, mat_type),
                "area_cm2": round(area, 2),
                "area_m2": round(area / 10000, 4),
                "length_cm": round(mat_length_cm, 2),
                "length_m": round(mat_length_m, 3),
                "weight_g": round(area / 10000 * fabric_weight_gsm, 2) if fabric_weight_gsm > 0 else 0,
                "weight_kg": round(area / 10000 * fabric_weight_gsm / 1000, 4) if fabric_weight_gsm > 0 else 0,
                "nesting_rows": nesting_result["rows"],
                "width_utilization": nesting_result["width_utilization"],
            }

        # 单件用料长度 = 所有材料的排料长度之和
        per_piece_length_cm = total_nesting_length_cm

        # 总用料长度（所有件数）
        total_fabric_length_cm = per_piece_length_cm * quantity

        # 羽绒填充计算
        down_filling = data.get("down_filling")
        if down_filling and category.get("has_filling"):
            total_down_g = float(down_filling.get("total_weight_g", 0))
            if total_down_g > 0:
                filling_type = down_filling.get("filling_type", "goose_down_90")
                filling_names = {
                    "goose_down_90": "90%白鹅绒",
                    "goose_down_80": "80%白鹅绒",
                    "goose_down_70": "70%白鹅绒",
                    "duck_down_90": "90%白鸭绒",
                    "duck_down_80": "80%白鸭绒",
                    "duck_down_70": "70%白鸭绒",
                    "custom": "自定义",
                }
                material_breakdown["down_filling"] = {
                    "name": "羽绒填充（" + filling_names.get(filling_type, filling_type) + "）",
                    "area_cm2": 0,
                    "area_m2": 0,
                    "length_cm": 0,
                    "length_m": 0,
                    "weight_g": total_down_g,
                    "weight_kg": round(total_down_g / 1000, 4),
                }

        # 棉花填充计算
        cotton_filling = data.get("cotton_filling")
        if cotton_filling and category.get("has_filling"):
            total_cotton_g = float(cotton_filling.get("total_weight_g", 0))
            if total_cotton_g > 0:
                material_breakdown["cotton_filling"] = {
                    "name": "棉花/化纤填充",
                    "area_cm2": 0,
                    "area_m2": 0,
                    "length_cm": 0,
                    "length_m": 0,
                    "weight_g": total_cotton_g,
                    "weight_kg": round(total_cotton_g / 1000, 4),
                }

        # 警告信息
        warnings = []
        if fabric_width < 100:
            warnings.append("面料门幅较窄（<100cm），可能导致用料增加")
        if wastage_rate > 15:
            warnings.append("损耗率设置较高（>15%），请确认是否合理")
        if wastage_rate < 3:
            warnings.append("损耗率设置较低（<3%），建议不低于5%")
        if shrinkage_rate > 5:
            warnings.append("缩水率设置较高（>5%），建议对面料进行预缩处理")
        if quantity < 50:
            warnings.append(f"订单数量较少（{quantity}件），小批量生产损耗可能偏高，建议在标准损耗基础上增加3%-6%")
        if not pieces:
            warnings.append("未输入任何裁片数据")

        result.update({
            "total_area_cm2": round(total_area_cm2, 2),
            "total_area_m2": round(total_area_cm2 / 10000, 4),
            "total_area_with_wastage_cm2": round(total_area_with_wastage, 2),
            "total_area_with_wastage_m2": round(total_area_with_wastage / 10000, 4),
            "fabric_length_cm": round(per_piece_length_cm, 2),
            "fabric_length_m": round(per_piece_length_cm / 100, 3),
            "per_piece_length_cm": round(per_piece_length_cm, 2),
            "per_piece_length_m": round(per_piece_length_cm / 100, 3),
            "total_length_cm": round(total_fabric_length_cm, 2),
            "total_length_m": round(total_fabric_length_cm / 100, 3),
            "fabric_weight_g": round(fabric_weight_g, 2),
            "fabric_weight_kg": round(fabric_weight_kg, 4),
            "utilization_rate": round(utilization * 100, 1),
            "effective_fabric_width_cm": effective_fabric_width,
            "material_breakdown": material_breakdown,
            "warnings": warnings,
            "params": {
                "category": category["name"],
                "fabric_width": fabric_width,
                "fabric_type": data.get("fabric_type", "woven"),
                "fabric_weight_gsm": fabric_weight_gsm,
                "shrinkage_rate": shrinkage_rate,
                "wastage_rate": wastage_rate,
                "quantity": quantity,
            }
        })

        return result

    def quick_estimate(self, data):
        """
        快速估算（基于经验公式，只需少量关键尺寸）

        data:
        {
            "category": "coat",
            "fabric_width": 145,
            "fabric_weight_gsm": 300,
            "quantity": 100,
            "garment_length": 90,     # 衣长(cm)
            "chest": 110,             # 胸围(cm)
            "shoulder": 45,           # 肩宽(cm)
            "sleeve_length": 62,      # 袖长(cm)
            "has_hood": false,        # 是否有帽子
            "has_lining": true,       # 是否有里布
            "style_complexity": "medium"  # simple/medium/complex
        }
        """
        category = data.get("category", "coat")
        fabric_width = float(data.get("fabric_width", 145))
        fabric_weight_gsm = float(data.get("fabric_weight_gsm", 0))
        quantity = int(data.get("quantity", 1))
        garment_length = float(data.get("garment_length", 0))
        chest = float(data.get("chest", 0))
        shoulder = float(data.get("shoulder", 0))
        sleeve_length = float(data.get("sleeve_length", 0))
        has_hood = data.get("has_hood", False)
        has_lining = data.get("has_lining", True)
        style_complexity = data.get("style_complexity", "medium")

        # ===== 输入校验 =====
        if garment_length < 10 or garment_length > 300:
            raise ValueError(f"衣长异常: {garment_length}cm，应在 10-300 cm 之间")
        if chest < 20 or chest > 300:
            raise ValueError(f"胸围异常: {chest}cm，应在 20-300 cm 之间")
        if fabric_width < 30 or fabric_width > 400:
            raise ValueError(f"面料门幅异常: {fabric_width}cm，应在 30-400 cm 之间")
        if quantity < 1 or quantity > 1000000:
            raise ValueError(f"订单数量异常: {quantity}")
        # ====================

        cat_config = self.categories.get(category, self.categories["coat"])

        # 复杂度系数
        complexity_factors = {
            "simple": 0.95,
            "medium": 1.0,
            "complex": 1.12,
        }
        complexity_factor = complexity_factors.get(style_complexity, 1.0)

        # 基于面积法的快速估算
        # 大身面积 = 衣长 × 半胸围 × 2（前+后）
        body_area = garment_length * (chest / 2) * 2

        # 袖子面积（简化为梯形）
        sleeve_width = chest / 4 + 2  # 袖肥约为胸围/4
        sleeve_area = sleeve_length * sleeve_width * 2 * 0.85  # ×2左右袖, ×0.85梯形系数

        # 领子面积
        collar_area = (shoulder * 0.6) * 8 * 2  # 领长×领高×2

        # 帽子面积
        hood_area = 0
        if has_hood:
            hood_area = 35 * 30 * 2  # 简化估算

        # 总面积（含缝份）
        seam_allowance = 1.5
        total_area = (body_area + sleeve_area + collar_area + hood_area)
        total_area_with_seam = total_area * (1 + seam_allowance * 2 / min(garment_length, 1))

        # 加缩水和损耗
        shrinkage = cat_config["default_shrinkage"]
        wastage = cat_config["default_wastage"]
        if quantity < 50:
            wastage += 4

        total_area_final = total_area_with_seam * (1 + shrinkage / 100) * (1 + wastage / 100) * complexity_factor

        # 计算用料长度
        effective_width = fabric_width - 3
        utilization = cat_config["fabric_utilization"]
        fabric_length_cm = (total_area_final / effective_width) / utilization
        per_piece_length_m = fabric_length_cm / 100 / quantity if quantity > 0 else fabric_length_cm / 100

        # 面料重量
        fabric_weight_kg = 0
        if fabric_weight_gsm > 0:
            fabric_weight_kg = (total_area_final / 10000) * fabric_weight_gsm / 1000

        # 里布估算（通常比面料少约20%-30%）
        lining_length_m = 0
        if has_lining:
            lining_length_m = per_piece_length_m * 0.75

        # 胆料估算（羽绒服，双层约为面料的1.4倍）
        filling_fabric_length_m = 0
        if category == "down_jacket":
            filling_fabric_length_m = per_piece_length_m * 1.4

        warnings = []
        if quantity < 50:
            warnings.append(f"小批量生产（{quantity}件），建议损耗率增加3%-6%")
        if style_complexity == "complex":
            warnings.append("复杂款式，建议实际打板后复核用量")

        return {
            "method": "快速估算（经验公式法）",
            "category": cat_config["name"],
            "params": {
                "garment_length": garment_length,
                "chest": chest,
                "shoulder": shoulder,
                "sleeve_length": sleeve_length,
                "has_hood": has_hood,
                "has_lining": has_lining,
                "style_complexity": style_complexity,
                "fabric_width": fabric_width,
                "fabric_weight_gsm": fabric_weight_gsm,
                "quantity": quantity,
            },
            "main_fabric": {
                "name": "主面料",
                "per_piece_length_m": round(per_piece_length_m, 3),
                "total_length_m": round(per_piece_length_m * quantity, 2),
                "total_weight_kg": round(fabric_weight_kg, 3),
            },
            "lining": {
                "name": "里布",
                "per_piece_length_m": round(lining_length_m, 3),
                "total_length_m": round(lining_length_m * quantity, 2),
            } if has_lining else None,
            "filling_fabric": {
                "name": "胆料（双层）",
                "per_piece_length_m": round(filling_fabric_length_m, 3),
                "total_length_m": round(filling_fabric_length_m * quantity, 2),
            } if category == "down_jacket" else None,
            "utilization_rate": round(utilization * 100, 1),
            "shrinkage_rate": shrinkage,
            "wastage_rate": wastage,
            "warnings": warnings,
        }


# ============================================================
# 报价计算引擎
# ============================================================

class QuotationEngine:
    """报价计算引擎"""

    def calculate_quotation(self, consumption_data, pricing_data):
        """
        计算报价

        consumption_data: FabricCalculator.calculate_consumption() 的返回值
        pricing_data: {
            "materials": [
                {"material_type": "main", "name": "主面料", "unit_price_per_m": 45.0, "supplier": "供应商A"},
                {"material_type": "lining", "name": "里布", "unit_price_per_m": 12.0, "supplier": "供应商B"},
                ...
            ],
            "labor_cost_per_piece": 35.0,     # 单件加工费
            "accessories_cost_per_piece": 8.0, # 单件辅料费（拉链、纽扣等）
            "packaging_cost_per_piece": 2.0,   # 单件包装费
            "other_cost_per_piece": 0,         # 其他费用
            "profit_margin_percent": 15,       # 利润率(%)
            "tax_rate_percent": 13,            # 税率(%)
            "quantity": 100,                   # 数量
        }
        """
        quantity = pricing_data.get("quantity", consumption_data["params"].get("quantity", 1))
        material_breakdown = consumption_data.get("material_breakdown", {})
        materials_pricing = pricing_data.get("materials", [])

        # 建立材料价格映射
        material_price_map = {}
        for mp in materials_pricing:
            material_price_map[mp["material_type"]] = mp

        # 计算各材料成本
        material_costs = []
        total_material_cost = 0

        for mat_type, mat_info in material_breakdown.items():
            pricing = material_price_map.get(mat_type, {})
            unit_price = float(pricing.get("unit_price_per_m", 0))
            supplier = pricing.get("supplier", "")
            name = pricing.get("name", mat_info.get("name", mat_type))

            # 按长度计价
            if mat_type in ["down_filling", "cotton_filling"]:
                # 填充物按重量计价
                unit_price_per_g = float(pricing.get("unit_price_per_g", unit_price / 1000))
                cost = mat_info["weight_g"] * unit_price_per_g
                unit_desc = f"{unit_price_per_g:.2f}元/g"
            else:
                cost = mat_info["length_m"] * unit_price
                unit_desc = f"{unit_price:.2f}元/米"

            material_costs.append({
                "material_type": mat_type,
                "name": name,
                "supplier": supplier,
                "length_m": mat_info.get("length_m", 0),
                "weight_kg": mat_info.get("weight_kg", 0),
                "unit_price_desc": unit_desc,
                "total_cost": round(cost, 2),
            })
            total_material_cost += cost

        # 单件材料成本
        per_piece_material_cost = total_material_cost / quantity if quantity > 0 else total_material_cost

        # 其他成本
        labor_cost = float(pricing_data.get("labor_cost_per_piece", 0))
        accessories_cost = float(pricing_data.get("accessories_cost_per_piece", 0))
        packaging_cost = float(pricing_data.get("packaging_cost_per_piece", 0))
        other_cost = float(pricing_data.get("other_cost_per_piece", 0))

        per_piece_total_cost = per_piece_material_cost + labor_cost + accessories_cost + packaging_cost + other_cost

        # 利润
        profit_margin = float(pricing_data.get("profit_margin_percent", 15))
        profit_per_piece = per_piece_total_cost * profit_margin / 100

        # 税前单价
        price_before_tax = per_piece_total_cost + profit_per_piece

        # 税
        tax_rate = float(pricing_data.get("tax_rate_percent", 13))
        tax_per_piece = price_before_tax * tax_rate / 100

        # 含税单价
        price_with_tax = price_before_tax + tax_per_piece

        # 总金额
        total_amount = price_with_tax * quantity

        return {
            "quantity": quantity,
            "material_costs": material_costs,
            "total_material_cost": round(total_material_cost, 2),
            "per_piece_material_cost": round(per_piece_material_cost, 2),
            "labor_cost_per_piece": labor_cost,
            "accessories_cost_per_piece": accessories_cost,
            "packaging_cost_per_piece": packaging_cost,
            "other_cost_per_piece": other_cost,
            "per_piece_total_cost": round(per_piece_total_cost, 2),
            "profit_margin_percent": profit_margin,
            "profit_per_piece": round(profit_per_piece, 2),
            "price_before_tax": round(price_before_tax, 2),
            "tax_rate_percent": tax_rate,
            "tax_per_piece": round(tax_per_piece, 2),
            "price_with_tax": round(price_with_tax, 2),
            "total_amount": round(total_amount, 2),
        }
