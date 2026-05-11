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
    多边形排料算法 - 改进行式布局 + 垂直空间复用
    
    策略（专为服装排料优化）：
    1. 大裁片先放（按面积降序），形成基础布局
    2. 小裁片优先填充到同行/同区域的水平缝隙
    3. 垂直空间复用：当区域内存在高度差时，小裁片可放在矮裁片上方
    4. 支持90度旋转自动选择最优方向
    """
    import time
    start_time = time.time()
    
    print(f"[排料算法] ========== 开始排料 (改进行式+垂直填充) ==========")
    print(f"[排料算法] 门幅宽度: {fabric_width_cm}cm")
    print(f"[排料算法] 缝份间隙: {seam_gap_cm}cm")
    print(f"[排料算法] 允许旋转: {rotation}")
    print(f"[排料算法] 输入裁片组数: {len(pieces)}")
    
    if not pieces or fabric_width_cm <= 0:
        print(f"[排料算法] 输入参数无效，返回空结果")
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
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
    
    # 按面积降序排序（大裁片先放）
    all_pieces.sort(key=lambda p: -(p["width"] * p["height"]))
    
    print(f"[排料算法] 展开后裁片总数: {len(all_pieces)}")
    print(f"[排料算法] 裁片面积总和: {sum(p['width'] * p['height'] for p in all_pieces):.2f}cm²")
    
    total_area = sum(p["width"] * p["height"] for p in all_pieces)
    placed_indices = set()
    
    # 区域列表：每个区域代表一个"带状区域"
    # 结构: {y_start, height, pieces: [{x, y_rel, w, h, ...}], used_width}
    zones = []
    
    def get_orientations(piece):
        """获取裁片的可选方向"""
        orientations = []
        orig_fits = piece["width"] + seam_gap_cm * 2 <= fabric_width_cm
        rot_fits = piece["height"] + seam_gap_cm * 2 <= fabric_width_cm
        
        if orig_fits:
            orientations.append((piece["width"], piece["height"], False))
        if rotation and abs(piece["width"] - piece["height"]) > 0.01 and rot_fits:
            orientations.append((piece["height"], piece["width"], True))
        if not orientations:
            orientations.append((piece["width"], piece["height"], False))
        return orientations
    
    def try_place_in_zone(zone, pw, ph):
        """尝试在指定区域的水平方向放置裁片"""
        if ph > zone["height"] + 0.01:
            return None
        
        available = fabric_width_cm - zone["used_width"] - seam_gap_cm
        if available < pw + seam_gap_cm:
            return None
        
        x_pos = zone["used_width"] + seam_gap_cm
        return x_pos
    
    def find_vertical_slot_in_zone(zone, pw, ph):
        """在区域内寻找垂直空隙（矮裁片上方的空间）"""
        best_slot = None
        best_y_rel = float('inf')
        
        for existing in zone["pieces"]:
            ex, ey, ew, eh = existing["x"], existing["y_rel"], existing["w"], existing["h"]
            
            if eh >= ph + seam_gap_cm:
                continue
            
            slot_y = ey + eh + seam_gap_cm
            
            if slot_y + ph > zone["height"] + 0.01:
                continue
            
            # 检查x方向是否重叠
            can_fit_x = True
            for other in zone["pieces"]:
                ox, oy, ow, oh = other["x"], other["y_rel"], other["w"], other["h"]
                
                if other is existing:
                    continue
                
                x_overlap = not (ex + pw + seam_gap_cm <= ox or ox + ow + seam_gap_cm <= ex)
                y_overlap = not (slot_y + ph + seam_gap_cm <= oy or oy + oh + seam_gap_cm <= slot_y)
                
                if x_overlap and y_overlap:
                    can_fit_x = False
                    break
            
            if can_fit_x and ex + pw <= fabric_width_cm - seam_gap_cm:
                if slot_y < best_y_rel:
                    best_y_rel = slot_y
                    best_slot = (ex, slot_y)
        
        return best_slot
    
    def fill_zone_gaps(zone_idx):
        """填充指定区域的水平和垂直缝隙"""
        zone = zones[zone_idx]
        filled_any = True
        
        while filled_any:
            filled_any = False
            available_h = fabric_width_cm - zone["used_width"] - seam_gap_cm
            
            if available_h < seam_gap_cm * 3:
                break
            
            best_piece_idx = None
            best_orient = None
            best_area = -1
            
            for idx, piece in enumerate(all_pieces):
                if idx in placed_indices:
                    continue
                
                for orient_w, orient_h, rotated in get_orientations(piece):
                    if orient_h > zone["height"] + 0.01:
                        continue
                    
                    # 尝试水平放置（行尾）
                    if orient_w + seam_gap_cm <= available_h:
                        piece_area = orient_w * orient_h
                        if piece_area > best_area:
                            best_area = piece_area
                            best_piece_idx = idx
                            best_orient = (orient_w, orient_h, rotated, "horizontal")
                    
                    # 尝试垂直放置（矮裁片上方）
                    vslot = find_vertical_slot_in_zone(zone, orient_w, orient_h)
                    if vslot:
                        piece_area = orient_w * orient_h
                        if piece_area > best_area:
                            best_area = piece_area
                            best_piece_idx = idx
                            best_orient = (orient_w, orient_h, rotated, "vertical", vslot[0], vslot[1])
            
            if best_piece_idx is None:
                break
            
            piece = all_pieces[best_piece_idx]
            pw, ph, rot = best_orient[0], best_orient[1], best_orient[2]
            place_type = best_orient[3]
            
            if place_type == "horizontal":
                x_pos = zone["used_width"] + seam_gap_cm
                y_rel = 0
                zone["used_width"] = x_pos + pw
            else:
                x_pos = best_orient[4]
                y_rel = best_orient[5]
            
            zone["pieces"].append({
                "name": piece["name"],
                "x": x_pos,
                "y_rel": y_rel,
                "w": pw,
                "h": ph,
                "color": piece["color"],
                "shape": piece["shape"],
                "shoulder_width": piece["shoulder_width"],
                "sleeve_cap_width": piece["sleeve_cap_width"],
                "cuff_width": piece["cuff_width"],
                "rotated": rot,
            })
            zone["pieces_count"] += 1
            placed_indices.add(best_piece_idx)
            filled_any = True
            
            print(f"[排料调试] 区域#{zone_idx}填充: {piece['name']} ({pw:.1f}x{ph:.1f}) at ({x_pos:.1f},{y_rel:.1f}), 类型={place_type}")
    
    def create_zone(start_y, first_piece, pw, ph, rotated):
        """创建新区域并放入第一个裁片"""
        new_zone = {
            "y_start": start_y,
            "height": ph,
            "used_width": seam_gap_cm + pw,
            "pieces_count": 1,
            "pieces": [{
                "name": first_piece["name"],
                "x": seam_gap_cm,
                "y_rel": 0,
                "w": pw,
                "h": ph,
                "color": first_piece["color"],
                "shape": first_piece["shape"],
                "shoulder_width": first_piece["shoulder_width"],
                "sleeve_cap_width": first_piece["sleeve_cap_width"],
                "cuff_width": first_piece["cuff_width"],
                "rotated": rotated,
            }],
        }
        zones.append(new_zone)
        return len(zones) - 1
    
    def get_best_zone(pw, ph):
        """找到最适合放置的区域（优先选择能放入且浪费最少的）"""
        best_zone_idx = None
        best_score = -1
        best_waste = float('inf')
        
        for zi, zone in enumerate(zones):
            if ph > zone["height"] + 0.01:
                continue
            
            avail = fabric_width_cm - zone["used_width"] - seam_gap_cm
            if avail < pw + seam_gap_cm:
                continue
            
            waste = avail - pw
            score = 100 - waste / fabric_width_cm * 100
            
            if score > best_score or (score == best_score and waste < best_waste):
                best_score = score
                best_waste = waste
                best_zone_idx = zi
        
        return best_zone_idx
    
    # 主循环：逐个放置裁片
    for idx, piece in enumerate(all_pieces):
        if idx in placed_indices:
            continue
        
        piece_area = piece["width"] * piece["height"]
        print(f"[排料调试] 处理裁片 #{idx}: {piece['name']} ({piece['width']}x{piece['height']}), 面积={piece_area:.2f}cm²")
        
        orientations = get_orientations(piece)
        placed = False
        best_result = None
        best_zone_for_result = None
        best_place_y = float('inf')
        
        for orient_w, orient_h, rotated in orientations:
            # 策略1：尝试放入现有区域（水平方向）
            zone_idx = get_best_zone(orient_w, orient_h)
            if zone_idx is not None:
                zone = zones[zone_idx]
                x_pos = zone["used_width"] + seam_gap_cm
                place_y = zone["y_start"]
                
                if place_y < best_place_y or (place_y == best_place_y and best_result is None):
                    best_place_y = place_y
                    best_result = (x_pos, 0, orient_w, orient_h, rotated, "horizontal")
                    best_zone_for_result = zone_idx
            
            # 策略2：尝试在现有区域的垂直空隙中放置
            for zi, zone in enumerate(zones):
                vslot = find_vertical_slot_in_zone(zone, orient_w, orient_h)
                if vslot:
                    place_y = zone["y_start"]
                    if place_y < best_place_y or (place_y == best_place_y and best_result is None):
                        best_place_y = place_y
                        best_result = (vslot[0], vslot[1], orient_w, orient_h, rotated, "vertical")
                        best_zone_for_result = zi
        
        if best_result:
            px, py_rel, pw, ph, rot, ptype = best_result
            zone = zones[best_zone_for_result]
            
            zone["pieces"].append({
                "name": piece["name"],
                "x": px,
                "y_rel": py_rel,
                "w": pw,
                "h": ph,
                "color": piece["color"],
                "shape": piece["shape"],
                "shoulder_width": piece["shoulder_width"],
                "sleeve_cap_width": piece["sleeve_cap_width"],
                "cuff_width": piece["cuff_width"],
                "rotated": rot,
            })
            zone["pieces_count"] += 1
            
            if ptype == "horizontal":
                zone["used_width"] = max(zone["used_width"], px + pw)
            
            placed_indices.add(idx)
            placed = True
            
            current_bottom = max(z["y_start"] + z["height"] for z in zones) if zones else 0
            print(f"[排料调试] 已放置: {piece['name']} at ({px:.1f},{py_rel:.1f}) {pw}x{ph}, 区域#{best_zone_for_result}, 类型={ptype}, 当前底部={current_bottom:.1f}cm")
            
            # 放置后立即尝试填充该区域剩余空间
            fill_zone_gaps(best_zone_for_result)
        
        # 策略3：如果没找到合适区域，新建区域
        if not placed:
            for orient_w, orient_h, rotated in orientations:
                if orient_w + seam_gap_cm * 2 > fabric_width_cm:
                    continue
                
                last_bottom = max((z["y_start"] + z["height"] for z in zones), default=0)
                new_y = last_bottom + seam_gap_cm if zones else 0
                
                zi = create_zone(new_y, piece, orient_w, orient_h, rotated)
                placed_indices.add(idx)
                placed = True
                
                print(f"[排料调试] 新建区域#{zi}: {piece['name']} ({orient_w:.1f}x{orient_h:.1f}), 起始Y={new_y:.1f}cm")
                
                # 新建后立即填充
                fill_zone_gaps(zi)
                break
        
        if not placed:
            print(f"[排料警告] 裁片 {piece['name']} ({piece['width']}x{piece['height']}) 无法放入门幅 {fabric_width_cm}cm")
    
    # 将zones转换为前端需要的rows格式
    rows = []
    for zone in zones:
        row_pieces = []
        max_right = 0
        for p in zone["pieces"]:
            row_pieces.append({
                "name": p["name"],
                "x": p["x"],
                "y": p["y_rel"],
                "width": p["w"],
                "height": p["h"],
                "color": p["color"],
                "shape": p["shape"],
                "shoulder_width": p["shoulder_width"],
                "sleeve_cap_width": p["sleeve_cap_width"],
                "cuff_width": p["cuff_width"],
                "rotated": p["rotated"],
            })
            max_right = max(max_right, p["x"] + p["w"])
        
        rows.append({
            "length_cm": zone["height"],
            "used_width_cm": max_right,
            "pieces_count": zone["pieces_count"],
            "pieces": row_pieces,
        })
    
    total_length = sum(row["length_cm"] for row in rows) if rows else 0
    total_available_area = fabric_width_cm * total_length if total_length > 0 else 0
    width_utilization = total_area / total_available_area if total_available_area > 0 else 0
    
    elapsed = time.time() - start_time
    print(f"[排料算法] 耗时: {elapsed:.3f}秒, 裁片数量: {len(all_pieces)}, 已放置: {len(placed_indices)}, 总长度: {total_length:.2f}cm")
    
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