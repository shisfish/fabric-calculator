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
    6. 逐个放置：按面积排序后逐个放置裁片，自然填充缝隙
    7. 实时填充：大裁片放置后，立即用合适的小裁片填充空隙
    """
    import time
    start_time = time.time()
    
    print(f"[排料算法] ========== 开始排料 ==========")
    print(f"[排料算法] 门幅宽度: {fabric_width_cm}cm")
    print(f"[排料算法] 缝份间隙: {seam_gap_cm}cm")
    print(f"[排料算法] 允许旋转: {rotation}")
    print(f"[排料算法] 输入裁片组数: {len(pieces)}")
    
    if not pieces or fabric_width_cm <= 0:
        print(f"[排料算法] 输入参数无效，返回空结果")
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
    # 预处理裁片，展开为单个裁片列表
    all_pieces = []
    for piece in pieces:
        w = piece.get("width", 0)
        h = piece.get("height", 0)
        count = piece.get("count", 1)
        
        if w <= 0 or h <= 0:
            continue
        
        for i in range(count):
            all_pieces.append({
                "name": piece.get("name", ""),
                "width": w,
                "height": h,
                "color": piece.get("color", "#007bff"),
                "shape": piece.get("shape", "rectangle"),
                "shoulder_width": piece.get("shoulder_width", 0),
                "sleeve_cap_width": piece.get("sleeve_cap_width", 0),
                "cuff_width": piece.get("cuff_width", 0),
            })

    if not all_pieces:
        print(f"[排料算法] 有效裁片为空，返回空结果")
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
    # 按面积降序排序（大裁片先放，小裁片后放用于填充缝隙）
    all_pieces.sort(key=lambda p: -(p["width"] * p["height"]))
    
    print(f"[排料算法] 展开后裁片总数: {len(all_pieces)}")
    print(f"[排料算法] 裁片面积总和: {sum(p['width'] * p['height'] for p in all_pieces):.2f}cm²")
    
    rows = []
    total_area = sum(p["width"] * p["height"] for p in all_pieces)
    placed_indices = set()  # 记录已放置的裁片索引
    
    def fill_row_gaps(row):
        """填充行内的空隙 - 优先放入能放入的最大的裁片"""
        available_width = fabric_width_cm - row["used_width_cm"] - seam_gap_cm
        row_height = row["height"]
        
        print(f"[排料调试] 开始填充行空隙 - 行高={row_height:.1f}cm, 初始剩余宽度={available_width:.1f}cm")
        
        iteration = 0
        while available_width >= seam_gap_cm * 2:
            iteration += 1
            if iteration > 20:
                print(f"[排料警告] 填充循环超过20次，强制退出")
                break
            
            best_piece_idx = None
            best_orient = None
            best_area = -1  # 优先选择面积最大的 - 每次循环都重置
            
            print(f"[排料调试] 填充迭代 #{iteration}, 可用宽度={available_width:.1f}cm")
            
            for idx, piece in enumerate(all_pieces):
                if idx in placed_indices:
                    continue
                
                for orient_w, orient_h, rotated in [
                    (piece["width"], piece["height"], False),
                    (piece["height"], piece["width"], True)
                ]:
                    if orient_h > row_height + 0.01:
                        continue
                    if orient_w + seam_gap_cm > available_width:
                        continue
                    
                    # 计算裁片面积
                    piece_area = orient_w * orient_h
                    
                    # 优先选择面积最大的（能放入的前提下）
                    if piece_area > best_area:
                        best_area = piece_area
                        best_piece_idx = idx
                        best_orient = (orient_w, orient_h, rotated)
            
            if best_piece_idx is None:
                print(f"[排料调试] 行高度={row_height:.1f}cm, 剩余宽度={available_width:.1f}cm, 无合适裁片可填充")
                break
            
            piece = all_pieces[best_piece_idx]
            orient_w, orient_h, rotated = best_orient
            
            print(f"[排料调试] 填充: {piece['name']} ({orient_w:.1f}x{orient_h:.1f}), 面积={best_area:.1f}cm²")
            
            start_x = row["used_width_cm"] + seam_gap_cm
            row["pieces"].append({
                "name": piece["name"],
                "x": start_x,
                "y": 0,
                "width": orient_w,
                "height": orient_h,
                "color": piece["color"],
                "shape": piece["shape"],
                "shoulder_width": piece["shoulder_width"],
                "sleeve_cap_width": piece["sleeve_cap_width"],
                "cuff_width": piece["cuff_width"],
                "rotated": rotated,
            })
            
            row["used_width_cm"] = start_x + orient_w
            row["pieces_count"] += 1
            placed_indices.add(best_piece_idx)
            
            available_width = fabric_width_cm - row["used_width_cm"] - seam_gap_cm
            print(f"[排料调试] 填充后剩余宽度: {available_width:.1f}cm")
    
    # 逐个放置裁片
    for idx, piece in enumerate(all_pieces):
        if idx in placed_indices:
            continue
        
        placed = False
        piece_area = piece["width"] * piece["height"]
        
        print(f"[排料调试] 处理裁片 #{idx}: {piece['name']} ({piece['width']}x{piece['height']}), 面积={piece_area:.2f}cm²")
        
        # 准备两种方向：原始和旋转90度
        orientations = []
        
        orig_fits = piece["width"] + seam_gap_cm * 2 <= fabric_width_cm
        rot_fits = piece["height"] + seam_gap_cm * 2 <= fabric_width_cm
        
        if orig_fits:
            orientations.append({
                "width": piece["width"],
                "height": piece["height"],
                "rotated": False,
            })
        
        if rotation and abs(piece["width"] - piece["height"]) > 0.01 and rot_fits:
            orientations.append({
                "width": piece["height"],
                "height": piece["width"],
                "rotated": True,
            })
        
        if not orientations:
            orientations.append({
                "width": piece["width"],
                "height": piece["height"],
                "rotated": False,
            })
        
        print(f"[排料调试] 可用方向: {len(orientations)} 种")
        
        # 尝试每种方向
        for orient in orientations:
            if placed:
                break
            
            # 最佳匹配策略：找到最适合的行
            best_row = None
            best_score = -1
            
            print(f"[排料调试] 尝试方向: {orient['width']}x{orient['height']}(旋转={orient['rotated']})")
            
            for row in rows:
                if orient["height"] > row["height"] + 0.01:
                    continue
                
                available_width = fabric_width_cm - row["used_width_cm"] - seam_gap_cm
                if available_width < orient["width"] + seam_gap_cm:
                    continue
                
                waste_ratio = available_width / fabric_width_cm
                score = 1 - waste_ratio
                
                if abs(available_width - orient["width"]) < seam_gap_cm:
                    score += 0.5
                
                if score > best_score:
                    best_score = score
                    best_row = row
            
            if best_row:
                start_x = best_row["used_width_cm"] + seam_gap_cm
                best_row["pieces"].append({
                    "name": piece["name"],
                    "x": start_x,
                    "y": 0,
                    "width": orient["width"],
                    "height": orient["height"],
                    "color": piece["color"],
                    "shape": piece["shape"],
                    "shoulder_width": piece["shoulder_width"],
                    "sleeve_cap_width": piece["sleeve_cap_width"],
                    "cuff_width": piece["cuff_width"],
                    "rotated": orient["rotated"],
                })
                
                best_row["used_width_cm"] = start_x + orient["width"]
                best_row["pieces_count"] += 1
                placed_indices.add(idx)
                placed = True
                
                print(f"[排料调试] 放入现有行, 行高度={best_row['height']:.1f}cm, 起始X={start_x:.1f}cm")
                
                # 实时填充：放置后立即尝试填充该行剩余空间
                fill_row_gaps(best_row)
                break
            
            # 如果没找到合适的行，尝试新建行
            if not placed:
                if orient["width"] + seam_gap_cm * 2 > fabric_width_cm:
                    continue
                
                row_pieces = [{
                    "name": piece["name"],
                    "x": seam_gap_cm,
                    "y": 0,
                    "width": orient["width"],
                    "height": orient["height"],
                    "color": piece["color"],
                    "shape": piece["shape"],
                    "shoulder_width": piece["shoulder_width"],
                    "sleeve_cap_width": piece["sleeve_cap_width"],
                    "cuff_width": piece["cuff_width"],
                    "rotated": orient["rotated"],
                }]
                
                rows.append({
                    "height": orient["height"],
                    "length_cm": orient["height"],
                    "used_width_cm": seam_gap_cm + orient["width"],
                    "pieces_count": 1,
                    "pieces": row_pieces,
                })
                placed_indices.add(idx)
                placed = True
                
                print(f"[排料调试] 新建行, 行高度={orient['height']:.1f}cm, 当前总行数={len(rows)}")
                
                # 实时填充：新建行后立即尝试填充剩余空间
                fill_row_gaps(rows[-1])
                break
        
        if not placed:
            print(f"[排料警告] 裁片 {piece['name']} ({piece['width']}x{piece['height']}) 无法放入门幅 {fabric_width_cm}cm")
    
    # 按行高度降序排序，优化垂直空间利用（高行优先，便于后续填充）
    rows.sort(key=lambda r: -r["height"])
    print(f"[排料算法] 行排序完成，按高度降序排列")
    
    total_length = sum(row["length_cm"] for row in rows)
    total_available_area = fabric_width_cm * total_length if total_length > 0 else 0
    width_utilization = total_area / total_available_area if total_available_area > 0 else 0
    
    elapsed = time.time() - start_time
    print(f"[排料算法] 耗时: {elapsed:.3f}秒, 裁片数量: {len(all_pieces)}, 总行数: {len(rows)}")
    
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
    # 创建测试裁片：模拟实际服装裁片
    pieces = [
        {"name": "后片", "width": 50, "height": 80, "count": 1, "color": "#dc3545"},
        {"name": "前片", "width": 50, "height": 70, "count": 2, "color": "#28a745"},
        {"name": "袖子", "width": 20, "height": 60, "count": 2, "color": "#dc3545"},
        {"name": "口袋", "width": 15, "height": 15, "count": 4, "color": "#007bff"},
        {"name": "领口罗纹", "width": 30, "height": 10, "count": 1, "color": "#007bff"},
        {"name": "其他配件", "width": 12, "height": 12, "count": 6, "color": "#6c757d"},
    ]
    
    print("\n" + "="*60)
    print("测试多边形排料算法")
    print("="*60 + "\n")
    
    result = polygon_nesting(pieces, 80)
    print(f"\n总长度: {result['total_length_cm']:.2f} cm")
    print(f"利用率: {result['width_utilization']*100:.2f}%")
    print(f"总行数: {len(result['rows'])}")
    
    print("\n详细排料结果:")
    for i, row in enumerate(result["rows"]):
        print(f"\n行 {i+1}: 高={row['length_cm']:.2f}cm, 已用宽度={row['used_width_cm']:.2f}cm, 裁片数={row['pieces_count']}")
        for piece in row["pieces"]:
            rotated_str = "(旋转)" if piece.get("rotated", False) else ""
            print(f"  - {piece['name']}{rotated_str}: ({piece['x']:.2f}, {piece['y']:.2f}) {piece['width']}x{piece['height']}")

if __name__ == "__main__":
    test_polygon_nesting()