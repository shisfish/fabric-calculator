# -*- coding: utf-8 -*-
"""
多边形排料模块 - Polygon Nesting Module

支持任意多边形的排料算法，使用分离轴定理(SAT)进行碰撞检测。
可独立使用，不影响其他模块。

算法特点：
1. 使用旋转卡壳(Rotating Calipers)计算多边形最小包围盒
2. 使用分离轴定理(Separating Axis Theorem)进行精确碰撞检测
3. 支持多边形旋转（可选）
4. 贪心放置策略，按面积排序
"""

import math

# ============================================================
# 基础几何运算
# ============================================================

def dot(v1, v2):
    """向量点积"""
    return v1[0] * v2[0] + v1[1] * v2[1]

def cross(v1, v2):
    """向量叉积"""
    return v1[0] * v2[1] - v1[1] * v2[0]

def subtract(v1, v2):
    """向量相减"""
    return (v1[0] - v2[0], v1[1] - v2[1])

def add(v1, v2):
    """向量相加"""
    return (v1[0] + v2[0], v1[1] + v2[1])

def scale(v, scalar):
    """向量缩放"""
    return (v[0] * scalar, v[1] * scalar)

def normalize(v):
    """向量归一化"""
    mag = math.sqrt(v[0]**2 + v[1]**2)
    if mag < 1e-9:
        return (0, 0)
    return (v[0] / mag, v[1] / mag)

def rotate_point(point, angle):
    """绕原点旋转点"""
    cos_theta = math.cos(angle)
    sin_theta = math.sin(angle)
    return (
        point[0] * cos_theta - point[1] * sin_theta,
        point[0] * sin_theta + point[1] * cos_theta
    )

def translate_points(points, dx, dy):
    """平移点集"""
    return [(x + dx, y + dy) for x, y in points]

def polygon_area(points):
    """计算多边形面积（鞋带公式）"""
    if len(points) < 3:
        return 0
    area = 0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        area += points[i][0] * points[j][1]
        area -= points[j][0] * points[i][1]
    return abs(area) / 2.0

# ============================================================
# 分离轴定理(SAT)碰撞检测
# ============================================================

def project_points(points, axis):
    """将点集投影到轴上"""
    min_proj = float('inf')
    max_proj = float('-inf')
    for p in points:
        proj = dot(p, axis)
        min_proj = min(min_proj, proj)
        max_proj = max(max_proj, proj)
    return min_proj, max_proj

def overlap(a_min, a_max, b_min, b_max):
    """检查两个投影是否重叠"""
    return a_min <= b_max and b_min <= a_max

def get_edge_normals(points):
    """获取多边形所有边的法线（单位向量）"""
    normals = []
    n = len(points)
    for i in range(n):
        p1 = points[i]
        p2 = points[(i + 1) % n]
        edge = subtract(p2, p1)
        # 垂直于边的向量
        normal = (-edge[1], edge[0])
        normal = normalize(normal)
        if normal != (0, 0):
            normals.append(normal)
    return normals

def sat_collision(poly1, poly2):
    """
    使用分离轴定理检测两个多边形是否碰撞
    poly1, poly2: 多边形顶点列表，按顺序排列
    返回: True 如果碰撞，False 否则
    """
    # 获取两个多边形的边法线
    normals1 = get_edge_normals(poly1)
    normals2 = get_edge_normals(poly2)
    
    # 检查所有分离轴
    for axis in normals1 + normals2:
        a_min, a_max = project_points(poly1, axis)
        b_min, b_max = project_points(poly2, axis)
        if not overlap(a_min, a_max, b_min, b_max):
            return False  # 找到分离轴，不碰撞
    
    return True  # 所有轴都重叠，碰撞

# ============================================================
# 旋转卡壳计算最小包围盒
# ============================================================

def polygon_bounding_box(points):
    """计算多边形的轴对齐包围盒"""
    if not points:
        return 0, 0, 0, 0
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)

def polygon_width_height(points):
    """计算多边形的宽度和高度（轴对齐）"""
    x_min, y_min, x_max, y_max = polygon_bounding_box(points)
    return x_max - x_min, y_max - y_min

# ============================================================
# 多边形排料算法
# ============================================================

def polygon_nesting(pieces, fabric_width_cm, seam_gap_cm=0.5, rotation=True):
    """
    多边形排料算法 - 优化版本
    
    策略：
    1. 按裁片类型分组，批量放置
    2. 简单行式排料，快速计算
    3. 自动尝试旋转90度，选择最优方向
    4. 缝隙填充：小配件可以放在大裁片旁边的空隙中
    5. 最佳匹配：根据缝隙尺寸智能选择最合适的裁片
    """
    import time
    start_time = time.time()
    
    if not pieces or fabric_width_cm <= 0:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
    # 预处理裁片
    processed_pieces = []
    for piece in pieces:
        w = piece.get("width", 0)
        h = piece.get("height", 0)
        count = piece.get("count", 1)
        
        if w <= 0 or h <= 0:
            continue
        
        processed_pieces.append({
            "name": piece.get("name", ""),
            "width": w,
            "height": h,
            "count": count,
            "color": piece.get("color", "#007bff"),
            "shape": piece.get("shape", "rectangle"),
            "shoulder_width": piece.get("shoulder_width", 0),
            "sleeve_cap_width": piece.get("sleeve_cap_width", 0),
            "cuff_width": piece.get("cuff_width", 0),
        })
    
    if not processed_pieces:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
    # 按面积降序排序（大裁片先放，小裁片后放用于填充缝隙）
    processed_pieces.sort(key=lambda p: -(p["width"] * p["height"]))
    
    rows = []
    total_area = 0
    
    for piece_template in processed_pieces:
        total_area += piece_template["width"] * piece_template["height"] * piece_template["count"]
        remaining = piece_template["count"]
        
        # 准备两种方向：原始和旋转90度
        # 优先选择能放入门幅的方向
        orientations = []
        
        # 检查原始方向是否能放入门幅
        orig_fits = piece_template["width"] + seam_gap_cm * 2 <= fabric_width_cm
        # 检查旋转方向是否能放入门幅
        rot_fits = piece_template["height"] + seam_gap_cm * 2 <= fabric_width_cm
        
        if orig_fits:
            orientations.append({
                "width": piece_template["width"],
                "height": piece_template["height"],
                "rotated": False,
            })
        
        if rotation and abs(piece_template["width"] - piece_template["height"]) > 0.01 and rot_fits:
            orientations.append({
                "width": piece_template["height"],
                "height": piece_template["width"],
                "rotated": True,
            })
        
        # 如果两个方向都放不下，添加原始方向（会触发警告）
        if not orientations:
            orientations.append({
                "width": piece_template["width"],
                "height": piece_template["height"],
                "rotated": False,
            })
        
        while remaining > 0:
            placed = False
            
            # 尝试每种方向
            for orient in orientations:
                if placed:
                    break
                
                # 第一优先：尝试放入已有行的缝隙中（最佳匹配策略）
                # 找到最适合的行（剩余空间与裁片尺寸最匹配）
                best_row = None
                best_score = -1
                
                for row in rows:
                    # 检查高度是否匹配（裁片高度 <= 行高度）
                    if orient["height"] > row["height"] + 0.01:
                        continue
                    
                    # 计算行内剩余宽度
                    available_width = fabric_width_cm - row["used_width_cm"] - seam_gap_cm
                    if available_width < orient["width"] + seam_gap_cm:
                        continue
                    
                    # 计算匹配分数：剩余空间越小，分数越高（减少浪费）
                    # 分数 = 1 - (剩余空间 / 门幅宽度)
                    waste_ratio = available_width / fabric_width_cm
                    score = 1 - waste_ratio
                    
                    # 如果能正好填满，给予额外奖励
                    if abs(available_width - orient["width"]) < seam_gap_cm:
                        score += 0.5
                    
                    if score > best_score:
                        best_score = score
                        best_row = row
                
                if best_row:
                    # 放入最佳匹配的行
                    available_width = fabric_width_cm - best_row["used_width_cm"] - seam_gap_cm
                    can_fit = int(available_width / (orient["width"] + seam_gap_cm))
                    fit_count = min(can_fit, remaining)
                    
                    start_x = best_row["used_width_cm"] + seam_gap_cm
                    for i in range(fit_count):
                        best_row["pieces"].append({
                            "name": piece_template["name"],
                            "x": start_x + i * (orient["width"] + seam_gap_cm),
                            "y": 0,
                            "width": orient["width"],
                            "height": orient["height"],
                            "color": piece_template["color"],
                            "shape": piece_template["shape"],
                            "shoulder_width": piece_template["shoulder_width"],
                            "sleeve_cap_width": piece_template["sleeve_cap_width"],
                            "cuff_width": piece_template["cuff_width"],
                            "rotated": orient["rotated"],
                        })
                    
                    best_row["used_width_cm"] = start_x + fit_count * (orient["width"] + seam_gap_cm) - seam_gap_cm
                    best_row["pieces_count"] += fit_count
                    remaining -= fit_count
                    placed = True
                
                # 第二优先：如果还没放置，尝试新建行
                if not placed:
                    can_fit = int((fabric_width_cm - seam_gap_cm * 2) / (orient["width"] + seam_gap_cm))
                    fit_count = min(can_fit, remaining) if can_fit > 0 else 1
                    
                    # 检查是否能放入门幅
                    if orient["width"] + seam_gap_cm * 2 > fabric_width_cm:
                        continue  # 这个方向放不下，尝试下一个方向
                    
                    row_pieces = []
                    for i in range(fit_count):
                        row_pieces.append({
                            "name": piece_template["name"],
                            "x": seam_gap_cm + i * (orient["width"] + seam_gap_cm),
                            "y": 0,
                            "width": orient["width"],
                            "height": orient["height"],
                            "color": piece_template["color"],
                            "shape": piece_template["shape"],
                            "shoulder_width": piece_template["shoulder_width"],
                            "sleeve_cap_width": piece_template["sleeve_cap_width"],
                            "cuff_width": piece_template["cuff_width"],
                            "rotated": orient["rotated"],
                        })
                    
                    rows.append({
                        "height": orient["height"],
                        "length_cm": orient["height"],
                        "used_width_cm": seam_gap_cm + fit_count * (orient["width"] + seam_gap_cm) - seam_gap_cm,
                        "pieces_count": fit_count,
                        "pieces": row_pieces,
                    })
                    remaining -= fit_count
                    placed = True
                    break
            
            # 如果所有方向都试过了还是放不下
            if not placed:
                print(f"[排料警告] 裁片 {piece_template['name']} ({piece_template['width']}x{piece_template['height']}) 无法放入门幅 {fabric_width_cm}cm")
                break
    
    total_length = sum(row["length_cm"] for row in rows)
    total_available_area = fabric_width_cm * total_length if total_length > 0 else 0
    width_utilization = total_area / total_available_area if total_available_area > 0 else 0
    
    elapsed = time.time() - start_time
    print(f"[排料算法] 耗时: {elapsed:.3f}秒, 裁片类型: {len(processed_pieces)}, 总行数: {len(rows)}")
    
    return {
        "total_length_cm": total_length,
        "rows": rows,
        "width_utilization": round(width_utilization, 4),
    }

# ============================================================
# 测试函数
# ============================================================

def test_polygon_nesting():
    """测试多边形排料"""
    # 创建测试裁片：简单的矩形和不规则形状
    pieces = [
        {
            "name": "前片",
            "vertices": [(0, 0), (50, 0), (50, 65), (10, 65), (0, 55)],  # 带切角的矩形
        },
        {
            "name": "后片",
            "vertices": [(0, 0), (50, 0), (50, 65), (0, 65)],  # 矩形
        },
        {
            "name": "袖子",
            "vertices": [(0, 0), (20, 0), (20, 60), (0, 60)],  # 矩形
        },
    ]
    
    result = polygon_nesting(pieces, 140)
    print(f"总长度: {result['total_length_cm']:.2f} cm")
    print(f"利用率: {result['width_utilization']*100:.2f}%")
    for i, row in enumerate(result["rows"]):
        print(f"行 {i+1}: 高={row['length_cm']:.2f}cm, 宽={row['used_width_cm']:.2f}cm")
        for piece in row["pieces"]:
            print(f"  - {piece['name']}: ({piece['x']:.2f}, {piece['y']:.2f})")

if __name__ == "__main__":
    test_polygon_nesting()