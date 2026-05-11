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

def convert_to_rows(placed_rects, seam_gap_cm):
    """将 Skyline 算法的已放置矩形列表转换为前端 rows 格式
    
    按 y 坐标分组，将相近 y 的裁片归为同一行
    """
    if not placed_rects:
        return []
    
    sorted_rects = sorted(placed_rects, key=lambda r: (r["y"], r["x"]))
    rows = []
    
    for rect in sorted_rects:
        row_y = rect["y"]
        rect_bottom = row_y + rect["height"]
        
        matched_row = None
        for row in rows:
            if abs(row["y"] - row_y) < seam_gap_cm * 0.5:
                if rect_bottom > row.get("max_bottom", 0):
                    row["max_bottom"] = rect_bottom
                    row["length_cm"] = max(row["length_cm"], rect_bottom - row["y"])
                matched_row = row
                break
        
        if not matched_row:
            new_row = {
                "y": row_y,
                "length_cm": rect["height"],
                "max_bottom": rect_bottom,
                "pieces_count": 0,
                "pieces": [],
            }
            rows.append(new_row)
            matched_row = new_row
        
        piece_entry = {
            "name": rect["name"],
            "x": rect["x"],
            "y": 0,
            "width": rect["width"],
            "height": rect["height"],
            "color": rect["color"],
            "shape": rect["shape"],
            "shoulder_width": rect["shoulder_width"],
            "sleeve_cap_width": rect["sleeve_cap_width"],
            "cuff_width": rect["cuff_width"],
            "rotated": rect.get("rotated", False),
        }
        matched_row["pieces"].append(piece_entry)
        matched_row["pieces_count"] += 1
    
    for row in rows:
        row.pop("y", None)
        row.pop("max_bottom", None)
    
    return rows

def polygon_nesting(pieces, fabric_width_cm, seam_gap_cm=0.5, rotation=True):
    """
    多边形排料算法 - Skyline（天际线）版本
    
    核心策略：使用 Skyline/Bottom-Left 算法进行 2D 矩形装箱
    不再按"行"划分，而是维护已放置矩形列表，新裁片可以放在任何已有矩形的旁边或上方，
    充分利用垂直空间。
    
    特点：
    1. 大裁片先放（按面积降序），奠定基础轮廓
    2. 小裁片填充到大裁片旁边的水平和垂直缝隙中
    3. 支持90度旋转自动选择最优方向
    4. 底部优先策略：优先选择 y 坐标最低的可用位置
    """
    import time
    start_time = time.time()
    
    print(f"[排料算法] ========== 开始排料 (Skyline模式) ==========")
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
    
    total_area = sum(p["width"] * p["height"] for p in all_pieces)
    placed_rects = []  # 已放置矩形列表: [{x, y, width, height, name, ...}]
    placed_indices = set()
    
    def rects_overlap(r1, r2):
        """检查两个矩形是否重叠（含缝份间隙）"""
        gap = seam_gap_cm
        not_overlapping = (
            r1["x"] + r1["width"] + gap <= r2["x"] or
            r2["x"] + r2["width"] + gap <= r1["x"] or
            r1["y"] + r1["height"] + gap <= r2["y"] or
            r2["y"] + r2["height"] + gap <= r1["y"]
        )
        return not not_overlapping
    
    def can_place(x, y, w, h):
        """检查在 (x,y) 位置放置 w×h 的矩形是否可行"""
        if x < 0 or y < 0:
            return False
        if x + w > fabric_width_cm:
            return False
        new_rect = {"x": x, "y": y, "width": w, "height": h}
        for rect in placed_rects:
            if rects_overlap(new_rect, rect):
                return False
        return True
    
    def get_skyline_at_x(x_pos, w):
        """获取在 x_pos 到 x_pos+w 范围内的天际线高度"""
        max_y = 0
        for rect in placed_rects:
            rx, ry, rw, rh = rect["x"], rect["y"], rect["width"], rect["height"]
            if x_pos < rx + rw + seam_gap_cm and x_pos + w + seam_gap_cm > rx:
                top = ry + rh
                if top > max_y:
                    max_y = top
        return max_y
    
    def find_best_position(piece_w, piece_h):
        """使用 Skyline 策略找到最佳放置位置
        
        候选位置来源：
        1. 原点 (0, 0) 或当前最底行的左侧起始
        2. 每个已放置矩形的右侧边缘
        3. 每个已放置矩形的顶部边缘
        
        选择标准：y 坐标最低（底部优先），同 y 时 x 最小
        """
        candidates = set()
        
        candidates.add((seam_gap_cm, 0))
        
        for rect in placed_rects:
            candidates.add((rect["x"] + rect["width"] + seam_gap_cm, rect["y"]))
            candidates.add((seam_gap_cm, rect["y"] + rect["height"] + seam_gap_cm))
            candidates.add((rect["x"], rect["y"] + rect["height"] + seam_gap_cm))
        
        best_pos = None
        best_y = float('inf')
        best_x = float('inf')
        
        for cx, cy in candidates:
            skyline_y = get_skyline_at_x(cx, piece_w)
            place_y = max(cy, skyline_y)
            
            if can_place(cx, place_y, piece_w, piece_h):
                if place_y < best_y or (place_y == best_y and cx < best_x):
                    best_pos = (cx, place_y)
                    best_y = place_y
                    best_x = cx
        
        return best_pos
    
    def get_total_height():
        """获取当前已放置内容的总高度"""
        if not placed_rects:
            return 0
        return max(r["y"] + r["height"] for r in placed_rects)
    
    # 逐个放置裁片
    for idx, piece in enumerate(all_pieces):
        if idx in placed_indices:
            continue
        
        piece_area = piece["width"] * piece["height"]
        print(f"[排料调试] 处理裁片 #{idx}: {piece['name']} ({piece['width']}x{piece['height']}), 面积={piece_area:.2f}cm²")
        
        # 准备两种方向
        orientations = []
        orig_fits = piece["width"] + seam_gap_cm * 2 <= fabric_width_cm
        rot_fits = piece["height"] + seam_gap_cm * 2 <= fabric_width_cm
        
        if orig_fits:
            orientations.append((piece["width"], piece["height"], False))
        if rotation and abs(piece["width"] - piece["height"]) > 0.01 and rot_fits:
            orientations.append((piece["height"], piece["width"], True))
        if not orientations:
            orientations.append((piece["width"], piece["height"], False))
        
        placed = False
        best_result = None
        best_place_y = float('inf')
        
        for orient_w, orient_h, rotated in orientations:
            pos = find_best_position(orient_w, orient_h)
            if pos is not None:
                px, py = pos
                if py < best_place_y or (py == best_place_y and best_result is None):
                    best_place_y = py
                    best_result = (px, py, orient_w, orient_h, rotated)
        
        if best_result:
            px, py, pw, ph, rot = best_result
            new_rect = {
                "name": piece["name"],
                "x": px,
                "y": py,
                "width": pw,
                "height": ph,
                "color": piece["color"],
                "shape": piece["shape"],
                "shoulder_width": piece["shoulder_width"],
                "sleeve_cap_width": piece["sleeve_cap_width"],
                "cuff_width": piece["cuff_width"],
                "rotated": rot,
            }
            placed_rects.append(new_rect)
            placed_indices.add(idx)
            placed = True
            current_h = get_total_height()
            print(f"[排料调试] 已放置: {piece['name']} at ({px:.1f},{py:.1f}) {pw}x{ph}, 当前总高={current_h:.1f}cm")
        
        if not placed:
            print(f"[排料警告] 裁片 {piece['name']} ({piece['width']}x{piece['height']}) 无法放入门幅 {fabric_width_cm}cm")
    
    # 将 placed_rects 转换为前端需要的 rows 格式
    rows = convert_to_rows(placed_rects, seam_gap_cm)
    
    total_length = get_total_height()
    total_available_area = fabric_width_cm * total_length if total_length > 0 else 0
    width_utilization = total_area / total_available_area if total_available_area > 0 else 0
    
    elapsed = time.time() - start_time
    print(f"[排料算法] 耗时: {elapsed:.3f}秒, 裁片数量: {len(all_pieces)}, 已放置: {len(placed_rects)}, 总长度: {total_length:.2f}cm")
    
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
        max_x = max((p['x'] + p['width'] for p in row["pieces"]), default=0)
        print(f"\n行 {i+1}: 高={row['length_cm']:.2f}cm, 已用宽度={max_x:.2f}cm, 裁片数={row['pieces_count']}")
        for piece in row["pieces"]:
            rotated_str = "(旋转)" if piece.get("rotated", False) else ""
            print(f"  - {piece['name']}{rotated_str}: ({piece['x']:.2f}, {piece['y']:.2f}) {piece['width']}x{piece['height']}")

if __name__ == "__main__":
    test_polygon_nesting()