# -*- coding: utf-8 -*-
"""
曲线衣片面积计算引擎 - Curved Piece Area Calculator
独立模块，不影响现有 calculator_engine.py 的任何功能

原理：
  将衣片建模为更贴近真实形状的参数化轮廓，用鞋带公式（Shoelace Formula）
  计算多边形面积，比矩形估算更精确。

实际衣片与矩形的差异主要在于：
  - 前片/后片：上方两侧有袖窿弧线（腋下弯弧），不是直角
  - 袖子：从袖肥到袖口逐渐收窄，袖山有弧线

支持的衣片类型：
  - front_body (前片): 矩形基础上扣除两侧袖窿弧线区域
  - back_body (后片): 类似前片，袖窿弧度略小
  - sleeve (袖子): 梯形轮廓 + 袖山弧线
"""

import math


# ============================================================
# 鞋带公式（Shoelace Formula）
# ============================================================

def shoelace_area(vertices):
    """
    用鞋带公式计算多边形面积
    vertices: [(x, y), (x, y), ...] 顶点坐标列表，按顺序排列（顺/逆时针均可）
    返回: 面积（平方单位）
    """
    n = len(vertices)
    if n < 3:
        return 0
    area = 0
    for i in range(n):
        x_i, y_i = vertices[i]
        x_j, y_j = vertices[(i + 1) % n]
        area += x_i * y_j - x_j * y_i
    return abs(area) / 2


# ============================================================
# 曲线辅助函数
# ============================================================

def _quadratic_bezier_points(p0, p1, p2, num_points=20):
    """
    二次贝塞尔曲线采样点

    p0: 起点 (x, y)
    p1: 控制点 (x, y)
    p2: 终点 (x, y)
    num_points: 采样点数（不含端点）

    返回: 曲线上的点列表（不含起点和终点）
    """
    points = []
    for i in range(1, num_points):
        t = i / num_points
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        points.append((x, y))
    return points


# ============================================================
# 曲线衣片轮廓生成
# ============================================================

def generate_front_body_vertices(length, width, shoulder_width, seam_allowance=1.5):
    """
    生成前片轮廓顶点

    前片形状建模：
      基本形状为矩形（长×宽），在左上角扣除一个领口/袖窿弧线区域。
      弧线从肩线位置过渡到左侧边，形成自然的弧形。

    参数:
      length: 裁片长度 (cm) — 从肩线到下摆
      width: 裁片宽度 (cm) — 前片半胸围
      shoulder_width: 肩宽 (cm) — 整件衣服的肩宽
      seam_allowance: 缝份 (cm)

    返回: 顶点列表 [(x, y), ...]，按顺时针排列
    """
    L = length + seam_allowance * 2
    W = width + seam_allowance * 2
    half_shoulder = shoulder_width / 2 + seam_allowance

    # 袖窿参数
    # 袖窿深度：从肩线向下延伸的距离，约为身长的 18%-22%
    armhole_depth = L * 0.20
    # 袖窿起点的 y 坐标
    armhole_y = L - armhole_depth

    # 左上角弧形控制点（向内凹）
    # 控制点位置由肩宽决定，肩宽越小弧线越深
    cp_x = half_shoulder * 0.3
    cp_y = L - armhole_depth * 0.5

    # 生成弧线点（从肩线到左侧边）
    # 起点: (half_shoulder, L) — 肩线位置
    # 终点: (0, armhole_y) — 左侧边袖窿底部
    curve_points = _quadratic_bezier_points(
        (half_shoulder, L),
        (cp_x, cp_y),
        (0, armhole_y),
        num_points=3
    )

    vertices = [
        (0, 0),              # 左下
        (W, 0),              # 右下
        (W, L),              # 右上
        (half_shoulder, L),  # 左上弧线起点（肩线位置）
    ]
    vertices.extend(curve_points)  # 弧线点
    vertices.append((0, armhole_y))  # 左侧边弧线终点（袖窿底部）

    return vertices


def generate_back_body_vertices(length, width, shoulder_width, seam_allowance=1.5):
    """
    生成后片轮廓顶点

    后片形状建模：
      基本形状为矩形，在顶部左右两侧各有一个内凹弧线（袖窿）。
      左右两个弧线使顶部形成肩线，与前片形状匹配但弧度更浅更平。

    参数: 同前片
    返回: 顶点列表 [(x, y), ...]，按顺时针排列
    """
    L = length + seam_allowance * 2
    W = width + seam_allowance * 2
    half_shoulder = shoulder_width / 2 + seam_allowance

    # 后片袖窿比前片浅约 15%
    armhole_depth = L * 0.17
    armhole_y = L - armhole_depth

    # 右侧袖窿弧线控制点（向内凹，比前片更平缓）
    cp_x_right = W - (W - half_shoulder) * 0.35
    cp_y_right = L - armhole_depth * 0.45

    # 左侧袖窿弧线控制点（向内凹，比前片更平缓）
    cp_x_left = half_shoulder * 0.35
    cp_y_left = L - armhole_depth * 0.45

    # 右侧弧线点（从右侧袖窿底部向上到右肩）
    right_curve = _quadratic_bezier_points(
        (W, armhole_y),
        (cp_x_right, cp_y_right),
        (W - half_shoulder, L),
        num_points=3
    )

    # 左侧弧线点（从左肩向下到左侧袖窿底部）
    left_curve = _quadratic_bezier_points(
        (half_shoulder, L),
        (cp_x_left, cp_y_left),
        (0, armhole_y),
        num_points=3
    )

    vertices = [
        (0, 0),                    # 1. 左下
        (W, 0),                    # 2. 右下
        (W, armhole_y),            # 3. 右侧袖窿底部（向上）
    ]
    vertices.extend(right_curve)   # 4. 右侧弧线（向内向上）
    vertices.append((W - half_shoulder, L))  # 5. 右肩
    vertices.append((half_shoulder, L))      # 6. 左肩（肩线）
    vertices.extend(left_curve)    # 7. 左侧弧线（向内向下）
    vertices.append((0, armhole_y))            # 8. 左侧袖窿底部

    return vertices


def generate_sleeve_vertices(length, width, bicep_width, cuff_width, seam_allowance=1.5):
    """
    生成袖子轮廓顶点

    袖子形状建模：
      - 袖山（顶部）：宽度 = bicep_width（袖肥），有向上凸的弧线
      - 袖口（底部）：宽度 = cuff_width（袖口宽）
      - 两侧：从袖肥到袖口的自然收窄曲线

    参数:
      length: 袖长 (cm)
      width: 袖宽 (cm)，备用参考
      bicep_width: 袖肥 (cm)，袖子最宽处（袖山宽度）
      cuff_width: 袖口宽 (cm)
      seam_allowance: 缝份 (cm)

    返回: 顶点列表 [(x, y), ...]
    """
    L = length + seam_allowance * 2
    BW = bicep_width + seam_allowance * 2   # 袖肥 + 缝份
    CW = cuff_width + seam_allowance * 2    # 袖口宽 + 缝份

    # 确保 CW 不超过 BW
    CW = min(CW, BW)

    vertices = []

    # 从左下角开始，顺时针方向

    # 1. 袖口底边（左下 → 右下）
    vertices.append((0, 0))
    vertices.append((CW, 0))

    # 2. 右侧边（袖口 → 袖肥，自然收窄的曲线）
    # 从 (CW, 0) 到 (BW, L)
    # 控制点使侧面略带弧度（袖肘处可能微凸）
    elbow_bulge = (BW - CW) * 0.06  # 微凸量
    cp_right = ((CW + BW) / 2 + elbow_bulge, L * 0.45)
    right_side = _quadratic_bezier_points(
        (CW, 0),
        cp_right,
        (BW, L),
        num_points=20
    )
    vertices.extend(right_side)

    # 3. 袖山顶部弧线（从右袖山到左袖山）
    # 袖山是向上凸的弧形
    crown_height = BW * 0.10  # 袖山高约为袖肥的 10%
    cp_crown = (BW / 2, L + crown_height)
    crown = _quadratic_bezier_points(
        (BW, L),
        cp_crown,
        (0, L),
        num_points=25
    )
    vertices.extend(crown)

    # 4. 左侧边（袖肥 → 袖口）
    cp_left = ((CW + 0) / 2 - elbow_bulge, L * 0.45)
    left_side = _quadratic_bezier_points(
        (0, L),
        cp_left,
        (0, 0),
        num_points=20
    )
    vertices.extend(left_side)

    return vertices


# ============================================================
# 曲线计算引擎
# ============================================================

class CurvedPieceCalculator:
    """
    曲线衣片面积计算引擎

    与现有 FabricCalculator 完全独立，通过新增的 API 接口调用。
    当用户提供了曲线参数（肩宽、袖肥、袖口宽）时，使用本引擎计算更精确的面积。
    未提供曲线参数的裁片，自动回退到矩形计算。
    """

    def calculate_piece_area_curved(self, piece):
        """
        计算单个裁片的面积（优先使用曲线模型，无参数时回退矩形）

        参数:
          piece: dict, 包含裁片信息及可选的曲线参数

        返回:
          dict: 包含面积和计算方法信息
        """
        piece_id = piece.get('id', '')
        length = float(piece.get('length', 0))
        width = float(piece.get('width', 0))
        count = int(piece.get('count', 1))
        shape = piece.get('shape', 'rectangle')
        seam_allowance = float(piece.get('seam_allowance', 1.5))

        if length <= 0 or width <= 0:
            return {"area": 0, "method": "none", "vertices": None}

        # 尝试使用曲线模型
        curved_result = self._try_curved_calculation(piece_id, piece, length, width, seam_allowance)
        if curved_result:
            area = curved_result["area"] * count
            curved_result["area"] = round(area, 2)
            return curved_result

        # 回退到原有形状计算
        effective_length = length + seam_allowance * 2
        effective_width = width + seam_allowance * 2

        if shape == "rectangle":
            area = effective_length * effective_width
        elif shape == "trapezoid":
            area = effective_length * effective_width * 0.9
        elif shape == "triangle":
            area = effective_length * effective_width / 2
        elif shape == "circle":
            radius = min(effective_length, effective_width) / 2
            area = math.pi * radius * radius
        else:
            area = effective_length * effective_width

        return {
            "area": round(area * count, 2),
            "method": shape,
            "vertices": None,
        }

    def _try_curved_calculation(self, piece_id, piece, length, width, seam_allowance):
        """
        使用曲线模型计算面积。
        自动推导曲线参数，无需额外输入肩宽/袖肥/袖口。
        """
        vertices = None

        if piece_id in ('front_body', 'back_body'):
            shoulder_width = piece.get('shoulder_width')
            if shoulder_width is not None and shoulder_width != '':
                try:
                    shoulder_width = float(shoulder_width)
                    if shoulder_width > 0:
                        pass
                    else:
                        shoulder_width = None
                except (ValueError, TypeError):
                    shoulder_width = None
            else:
                shoulder_width = None
            
            if shoulder_width is None:
                shoulder_width = width * 0.85
                
            if piece_id == 'front_body':
                vertices = generate_front_body_vertices(length, width, shoulder_width, seam_allowance)
            else:
                vertices = generate_back_body_vertices(length, width, shoulder_width, seam_allowance)

        elif piece_id == 'sleeve':
            bicep_width = piece.get('bicep_width')
            cuff_width = piece.get('cuff_width')
            
            if bicep_width is not None and bicep_width != '':
                try:
                    bicep_width = float(bicep_width)
                    if bicep_width <= 0:
                        bicep_width = None
                except (ValueError, TypeError):
                    bicep_width = None
            else:
                bicep_width = None
                
            if bicep_width is None:
                bicep_width = width
                
            if cuff_width is not None and cuff_width != '':
                try:
                    cuff_width = float(cuff_width)
                    if cuff_width <= 0:
                        cuff_width = None
                except (ValueError, TypeError):
                    cuff_width = None
            else:
                cuff_width = None
                
            if cuff_width is None:
                cuff_width = width * 0.7
                
            vertices = generate_sleeve_vertices(length, width, bicep_width, cuff_width, seam_allowance)

        if vertices is None or len(vertices) < 3:
            return None

        # 用鞋带公式计算面积
        curved_area = shoelace_area(vertices)

        # 矩形面积（用于对比，统一用 length × width）
        effective_length = length + seam_allowance * 2
        effective_width = width + seam_allowance * 2
        rect_area = effective_length * effective_width

        return {
            "area": round(curved_area, 2),
            "method": "curved",
            "vertices": vertices,
            "vertices_count": len(vertices),
            "rectangle_area": round(rect_area, 2),
            "difference_cm2": round(rect_area - curved_area, 2),
            "difference_percent": round((rect_area - curved_area) / rect_area * 100, 1) if rect_area > 0 else 0,
        }

    def calculate_consumption_curved(self, data):
        """
        曲线模式下的面料用量计算（完整流程）

        接口与 FabricCalculator.calculate_consumption() 兼容，
        但对前片/后片/袖子使用曲线面积计算。

        参数 data 结构同 calculate_consumption()，pieces 中可包含额外字段：
          - shoulder_width: 肩宽（前片/后片）
          - bicep_width: 袖肥（袖子）
          - cuff_width: 袖口宽（袖子）

        返回: 与 calculate_consumption() 相同结构的结果字典，
              额外在 pieces_detail 中包含 method 和 savings 信息。
        """
        from calculator_engine import FabricCalculator

        # 使用现有引擎获取品类配置
        base_calculator = FabricCalculator()
        category = base_calculator.categories.get(data.get("category", "custom"), base_calculator.categories["custom"])

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

        result = {
            "pieces_detail": [],
            "material_breakdown": {},
            "warnings": [],
            "calculation_method": "curved",
        }

        material_areas = {}
        material_pieces = {}  # 用于排料模拟
        material_piece_details = {}  # 用于排料图：{material: [(piece_name, length, width), ...]}
        total_area_cm2 = 0
        curved_count = 0

        # 收集裁片顶点和信息用于图片生成
        piece_image_data = []  # [(piece_info, vertices), ...]

        for piece in pieces:
            piece_name = piece.get("name", "未命名裁片")
            piece_length = float(piece.get("length", 0))
            piece_width = float(piece.get("width", 0))
            piece_count = int(piece.get("count", 1))
            material = piece.get("material", "main")
            seam_allowance = float(piece.get("seam_allowance", 1.5))

            if piece_length <= 0 or piece_width <= 0:
                continue

            # 使用曲线引擎计算面积
            calc_result = self.calculate_piece_area_curved(piece)
            area = calc_result["area"]
            method = calc_result["method"]
            vertices = calc_result.get("vertices")

            if method == "curved":
                curved_count += 1

            # 加上缩水率
            area_with_shrinkage = area * (1 + shrinkage_rate / 100)
            total_area_cm2 += area_with_shrinkage

            # 按材料分类
            if material not in material_areas:
                material_areas[material] = 0
                material_pieces[material] = []
                material_piece_details[material] = []
            material_areas[material] += area_with_shrinkage

            # 收集裁片尺寸用于排料模拟
            effective_length = piece_length + seam_allowance * 2
            effective_width = piece_width + seam_allowance * 2
            for _ in range(piece_count):
                material_pieces[material].append((effective_length, effective_width))
                material_piece_details[material].append({
                    "name": piece_name,
                    "length": effective_length,
                    "width": effective_width,
                    "vertices": vertices if method == "curved" else None,
                })

            # 收集裁片信息用于图片生成
            piece_info_for_image = {
                "id": piece.get("id", ""),
                "name": piece_name,
                "count": piece_count,
                "length": piece_length,
                "width": piece_width,
                "seam_allowance": seam_allowance,
                "calc_method": method,
                "area_cm2": round(area, 2),
            }
            if method == "curved":
                piece_info_for_image["rectangle_area_cm2"] = calc_result.get("rectangle_area", 0)
                piece_info_for_image["difference_cm2"] = calc_result.get("difference_cm2", 0)
                piece_info_for_image["difference_percent"] = calc_result.get("difference_percent", 0)
            piece_image_data.append((piece_info_for_image, vertices))

            # 裁片明细
            effective_length = piece_length + seam_allowance * 2
            effective_width = piece_width + seam_allowance * 2

            piece_detail = {
                "name": piece_name,
                "original_length": piece_length,
                "original_width": piece_width,
                "effective_length": round(effective_length, 2),
                "effective_width": round(effective_width, 2),
                "count": piece_count,
                "material": material,
                "area_cm2": round(area, 2),
                "area_with_shrinkage_cm2": round(area_with_shrinkage, 2),
                "seam_allowance": seam_allowance,
                "calc_method": method,
            }

            # 曲线计算的额外信息
            if method == "curved":
                piece_detail["rectangle_area_cm2"] = calc_result.get("rectangle_area", 0)
                piece_detail["difference_cm2"] = calc_result.get("difference_cm2", 0)
                piece_detail["difference_percent"] = calc_result.get("difference_percent", 0)

            result["pieces_detail"].append(piece_detail)

        # 加上损耗率
        total_area_with_wastage = total_area_cm2 * (1 + wastage_rate / 100)

        # 有效门幅
        effective_fabric_width = fabric_width - 3

        # 面料利用率（显示用）
        utilization = category["fabric_utilization"]
        fabric_type = data.get("fabric_type", "woven")
        fabric_type_factors = {
            "woven": 1.0,
            "knit": 0.95,
            "down_shell": 0.97,
            "lining": 0.98,
            "interlining": 0.98,
        }
        type_factor = fabric_type_factors.get(fabric_type, 1.0)
        utilization = utilization * type_factor

        # per_piece_length_cm 和 total_fabric_length_cm 在材料分类汇总后计算
        fabric_length_cm = 0  # 占位，后面会被覆盖

        # 面料重量
        fabric_weight_g = 0
        fabric_weight_kg = 0
        if fabric_weight_gsm > 0:
            total_area_m2 = total_area_with_wastage / 10000
            fabric_weight_g = total_area_m2 * fabric_weight_gsm
            fabric_weight_kg = fabric_weight_g / 1000

        # 材料分类汇总
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

        for mat_type, area in material_areas.items():
            # 用排料模拟计算该材料的门幅利用率
            from calculator_engine import simulate_nesting
            mat_piece_dims = material_pieces.get(mat_type, [])
            nesting_result = simulate_nesting(mat_piece_dims, effective_fabric_width)

            # 面积法 + 排料修正
            base_length_cm = area / effective_fabric_width if effective_fabric_width > 0 else 0
            nesting_util = nesting_result["width_utilization"]
            if nesting_util > 0:
                adjusted_length_cm = base_length_cm / nesting_util
            else:
                adjusted_length_cm = base_length_cm

            mat_length_cm = adjusted_length_cm * (1 + wastage_rate / 100)
            mat_length_m = mat_length_cm / 100
            material_breakdown[mat_type] = {
                "name": material_names.get(mat_type, mat_type),
                "area_cm2": round(area, 2),
                "area_m2": round(area / 10000, 4),
                "length_cm": round(mat_length_cm, 2),
                "length_m": round(mat_length_m, 3),
                "weight_g": round(area / 10000 * fabric_weight_gsm, 2) if fabric_weight_gsm > 0 else 0,
                "weight_kg": round(area / 10000 * fabric_weight_gsm / 1000, 4) if fabric_weight_gsm > 0 else 0,
                "width_utilization": nesting_result["width_utilization"],
            }

        # 总用料长度 = 所有材料的排料长度之和
        total_nesting_length_cm = sum(
            material_breakdown[mt]["length_cm"] for mt in material_breakdown
        )
        per_piece_length_cm = total_nesting_length_cm
        total_fabric_length_cm = per_piece_length_cm * quantity

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
        if curved_count > 0:
            warnings.append(f"本次有 {curved_count} 个裁片使用曲线模型计算，面积比矩形估算更精确")

        result.update({
            "total_area_cm2": round(total_area_cm2, 2),
            "total_area_m2": round(total_area_cm2 / 10000, 4),
            "total_area_with_wastage_cm2": round(total_area_with_wastage, 2),
            "total_area_with_wastage_m2": round(total_area_with_wastage / 10000, 4),
            "fabric_length_cm": round(fabric_length_cm, 2),
            "fabric_length_m": round(fabric_length_cm / 100, 3),
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
            "curved_pieces_count": curved_count,
            "params": {
                "category": category["name"],
                "fabric_width": fabric_width,
                "fabric_type": data.get("fabric_type", "woven"),
                "fabric_weight_gsm": fabric_weight_gsm,
                "shrinkage_rate": shrinkage_rate,
                "wastage_rate": wastage_rate,
                "quantity": quantity,
                "calculation_method": "曲线模型",
            }
        })

        # 返回裁片图片生成所需的数据（由 app.py 负责生成和保存）
        result["_piece_image_data"] = piece_image_data
        result["_material_piece_details"] = material_piece_details

        return result
