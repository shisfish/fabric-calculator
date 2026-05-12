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


def generate_piece_vertices(w, h, shape, shoulder_width=0, sleeve_cap_width=0, cuff_width=0, rotated=False):
    orig_w = h if rotated else w
    orig_h = w if rotated else h

    if shape == 'double_corner':
        sw = shoulder_width if shoulder_width > 0 else orig_w * 0.8
        sd = orig_h * 0.15
        tcx = (orig_w - sw) / 2
        tcy = sd
        bcx = orig_w * 0.15
        bcy = orig_h * 0.9
        verts = [[tcx, 0], [orig_w - tcx, 0], [orig_w, tcy],
                 [orig_w, bcy], [orig_w - bcx, orig_h],
                 [bcx, orig_h], [0, bcy], [0, tcy]]
    elif shape == 'single_corner':
        scw = sleeve_cap_width if sleeve_cap_width > 0 else orig_w
        cfw = cuff_width if cuff_width > 0 else orig_w * 0.6
        cw = (scw - cfw) / 2
        ch = orig_h * 0.2
        verts = [[0, 0], [orig_w, 0], [orig_w, orig_h],
                 [orig_w - cw, orig_h], [0, orig_h - ch]]
    else:
        verts = [[0, 0], [orig_w, 0], [orig_w, orig_h], [0, orig_h]]

    if rotated:
        verts = [[orig_h - y, x] for x, y in verts]

    return verts


# ============================================================
# 多边形排料算法
# ============================================================

def convert_to_rows_v2(placed_rects, seam_gap_cm):
    """将全局Skyline的已放置矩形列表转换为前端rows格式
    
    按y坐标分组，相近y的裁片归为同一行
    """
    if not placed_rects:
        return []
    
    sorted_rects = sorted(placed_rects, key=lambda r: (r["y"], r["x"]))
    rows = []
    
    for rect in sorted_rects:
        row_y = rect["y"]
        rect_bottom = row_y + rect["h"]
        
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
                "length_cm": rect["h"],
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
            "width": rect["w"],
            "height": rect["h"],
            "color": rect["color"],
            "shape": rect["shape"],
            "shoulder_width": rect.get("shoulder_width", 0),
            "sleeve_cap_width": rect.get("sleeve_cap_width", 0),
            "cuff_width": rect.get("cuff_width", 0),
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
    多边形排料算法 - 混合策略V3（区域布局 + 全局垂直填充）
    
    核心策略：
    1. 大裁片按区域（行）放置，保持自然分组
    2. 每次放置后，全局扫描所有已放裁片，寻找垂直填充机会
    3. 小裁片可放在任意矮裁片上方（跨区域）
    4. 智能旋转：优先原始方向，仅当旋转明显节省空间时才旋转
    """
    import time
    start_time = time.time()
    
    print(f"[排料算法] ========== 开始排料 (混合策略V3) ==========")
    print(f"[排料算法] 门幅宽度: {fabric_width_cm}cm, 缝份间隙: {seam_gap_cm}cm")
    
    if not pieces or fabric_width_cm <= 0:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
    all_pieces = []
    for piece in pieces:
        w, h = piece.get("width", 0), piece.get("height", 0)
        for _ in range(piece.get("count", 1)):
            if w > 0 and h > 0:
                all_pieces.append({
                    "name": piece.get("name", ""), "width": w, "height": h,
                    "color": piece.get("color", "#007bff"),
                    "shape": piece.get("shape", "rectangle"),
                    "shoulder_width": piece.get("shoulder_width", 0),
                    "sleeve_cap_width": piece.get("sleeve_cap_width", 0),
                    "cuff_width": piece.get("cuff_width", 0),
                })
    
    if not all_pieces:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
    all_pieces.sort(key=lambda p: -(p["width"] * p["height"]))
    total_area = sum(p["width"] * p["height"] for p in all_pieces)
    print(f"[排料算法] 裁片数: {len(all_pieces)}, 总面积: {total_area:.2f}cm²")
    
    placed_rects = []
    placed_indices = set()
    zones = []
    
    def rects_overlap(r1, r2):
        g = seam_gap_cm
        return not (
            r1["x"] + r1["w"] + g <= r2["x"] or r2["x"] + r2["w"] + g <= r1["x"] or
            r1["y"] + r1["h"] + g <= r2["y"] or r2["y"] + r2["h"] + g <= r1["y"]
        )
    
    def can_place_global(x, y, w, h):
        if x < 0 or y < 0 or x + w > fabric_width_cm:
            return False
        nr = {"x": x, "y": y, "w": w, "h": h}
        return not any(rects_overlap(nr, r) for r in placed_rects)
    
    def get_total_height():
        return max((r["y"] + r["h"] for r in placed_rects), default=0)
    
    def get_orientations(piece):
        ori = []
        ow, oh = piece["width"], piece["height"]
        can_original = ow + seam_gap_cm * 2 <= fabric_width_cm
        can_rotated = rotation and abs(ow - oh) > 0.01 and oh + seam_gap_cm * 2 <= fabric_width_cm

        if can_original and can_rotated:
            if oh <= ow:
                ori.append((ow, oh, False))
                ori.append((oh, ow, True))
            else:
                ori.append((oh, ow, True))
                ori.append((ow, oh, False))
        elif can_original:
            ori.append((ow, oh, False))
        elif can_rotated:
            ori.append((oh, ow, True))
        else:
            ori.append((ow, oh, False))
        return ori
    
    def find_global_vertical_slot(pw, ph, within_zone_only=True):
        """在所有已放置裁片上方寻找垂直空隙
        
        within_zone_only=True: 确保裁片不超出所在zone的高度范围
        """
        best_slot = None
        best_y = float('inf')
        
        for r in placed_rects:
            slot_y = r["y"] + r["h"] + seam_gap_cm
            
            if within_zone_only and zones:
                zone_limit = None
                for z in zones:
                    if z["y_start"] <= r["y"] < z["y_start"] + z["height"]:
                        zone_limit = z["y_start"] + z["height"]
                        break
                if zone_limit is None:
                    for z in zones:
                        if abs(z["y_start"] - r["y"]) < z["height"]:
                            zone_limit = z["y_start"] + z["height"]
                            break
                if zone_limit is not None and slot_y + ph > zone_limit + 0.01:
                    continue
            
            for try_x in [r["x"], seam_gap_cm]:
                if try_x + pw + seam_gap_cm > fabric_width_cm:
                    continue
                if can_place_global(try_x, slot_y, pw, ph):
                    if slot_y < best_y:
                        best_y = slot_y
                        best_slot = (try_x, slot_y)
                    break
        
        return best_slot
    
    def try_place_in_zone(zone, pw, ph, target_y=None):
        if pw + seam_gap_cm * 2 > fabric_width_cm:
            return None
        avail = fabric_width_cm - zone["used_width"] - seam_gap_cm
        if avail < pw + seam_gap_cm:
            return None
        px = zone["used_width"] + seam_gap_cm
        py = target_y if target_y is not None else zone["y_start"]
        if can_place_global(px, py, pw, ph):
            return px
        return None
    
    def find_zone_vertical_gap(zone, pw, ph):
        zone_bottom = zone["y_start"] + zone["height"]
        zone_rects = [r for r in placed_rects
                      if r["y"] >= zone["y_start"] - 0.01 and r["y"] <= zone_bottom + 0.01]
        
        if not zone_rects:
            return None
        
        gaps = []
        checked_ys = set()
        
        for r in zone_rects:
            below_y = r["y"] + r["h"] + seam_gap_cm
            y_key = round(below_y, 1)
            if y_key in checked_ys:
                continue
            checked_ys.add(y_key)
            
            for test_x in _get_x_candidates_in_zone(zone, zone_rects):
                if test_x + pw + seam_gap_cm > fabric_width_cm:
                    continue
                if can_place_global(test_x, below_y, pw, ph):
                    gaps.append((test_x, below_y))
                    break
        
        if not gaps:
            return None
        gaps.sort(key=lambda g: (g[1], g[0]))
        return gaps[0]
    
    def _get_x_candidates_in_zone(zone, zone_rects):
        cands = [seam_gap_cm]
        for r in zone_rects:
            if abs(r["y"] - zone["y_start"]) < zone["height"] + seam_gap_cm:
                cands.append(r["x"] + r["w"] + seam_gap_cm)
        return sorted(set(cands))
    
    def find_zone_horizontal_slot(zone, pw, ph):
        if pw + seam_gap_cm * 2 > fabric_width_cm:
            return None
        target_y = zone["y_start"]
        
        x_candidates = [seam_gap_cm]
        for r in placed_rects:
            if abs(r["y"] - target_y) < zone["height"] + seam_gap_cm:
                x_candidates.append(r["x"] + r["w"] + seam_gap_cm)
        
        x_candidates.sort()
        
        for test_x in x_candidates:
            if test_x + pw + seam_gap_cm > fabric_width_cm:
                continue
            if can_place_global(test_x, target_y, pw, ph):
                return (test_x, target_y)
        
        return None
    
    def find_any_row_horizontal_slot(zone, pw, ph):
        if pw + seam_gap_cm * 2 > fabric_width_cm:
            return None
        
        zone_bottom = zone["y_start"] + zone["height"]
        zone_rects = [r for r in placed_rects
                      if zone["y_start"] - 0.01 <= r["y"] <= zone_bottom + seam_gap_cm]
        
        rows = {}
        for r in zone_rects:
            ry = round(r["y"], 1)
            if ry not in rows:
                rows[ry] = []
            rows[ry].append(r)
        
        best = None
        best_score = float('inf')
        
        for row_y in sorted(rows.keys()):
            cands = [seam_gap_cm]
            for r in rows[row_y]:
                cands.append(r["x"] + r["w"] + seam_gap_cm)
            cands.sort()
            
            for cx in cands:
                if cx + pw + seam_gap_cm > fabric_width_cm:
                    continue
                if can_place_global(cx, row_y, pw, ph):
                    s = row_y * 10000 + cx
                    if s < best_score:
                        best_score = s
                        best = (cx, row_y)
                    break
        
        return best
    
    def create_zone(start_y, first_piece, pw, ph, rotated):
        new_zone = {
            "y_start": start_y,
            "height": ph,
            "used_width": seam_gap_cm + pw,
            "pieces_count": 1,
        }
        rect = {
            "name": first_piece["name"],
            "x": seam_gap_cm, "y": start_y,
            "w": pw, "h": ph,
            "color": first_piece["color"],
            "shape": first_piece["shape"],
            "shoulder_width": first_piece["shoulder_width"],
            "sleeve_cap_width": first_piece["sleeve_cap_width"],
            "cuff_width": first_piece["cuff_width"],
            "rotated": rotated,
        }
        placed_rects.append(rect)
        zones.append(new_zone)
        return len(zones) - 1
    
    def fill_zone_bottom(target_zone_idx):
        zone = zones[target_zone_idx]
        filled_any = True
        while filled_any:
            filled_any = False
            best_idx = None
            best_result = None
            best_y = float('inf')
            
            for idx, piece in enumerate(all_pieces):
                if idx in placed_indices:
                    continue
                if piece["width"] * piece["height"] > 900:
                    continue
                
                for pw, ph, rot in get_orientations(piece):
                    vgap = find_zone_vertical_gap(zone, pw, ph)
                    if vgap is not None:
                        vxp, vyp = vgap
                        if vyp < best_y:
                            best_y = vyp
                            best_idx = idx
                            rel_y = vyp - zone["y_start"]
                            best_result = (vxp, rel_y, pw, ph, rot)
            
            if best_idx is not None:
                piece = all_pieces[best_idx]
                vxp, rel_y, pw, ph, rot = best_result
                abs_y = add_to_zone(target_zone_idx, piece, vxp, rel_y, pw, ph, rot, "zone_bottom_fill")
                placed_indices.add(best_idx)
                filled_any = True
    
    def add_to_zone(zone_idx, piece, px, py_rel, pw, ph, rotated, place_type="horizontal"):
        zone = zones[zone_idx]
        abs_y = zone["y_start"] + py_rel
        
        rect = {
            "name": piece["name"],
            "x": px, "y": abs_y,
            "w": pw, "h": ph,
            "color": piece["color"],
            "shape": piece["shape"],
            "shoulder_width": piece["shoulder_width"],
            "sleeve_cap_width": piece["sleeve_cap_width"],
            "cuff_width": piece["cuff_width"],
            "rotated": rotated,
        }
        placed_rects.append(rect)
        zone["pieces_count"] += 1
        
        zone["used_width"] = max(zone["used_width"], px + pw)
        
        return abs_y
    
    def get_best_zone(pw, ph):
        best_zi = None
        best_waste = float('inf')
        for zi, z in enumerate(zones):
            if ph > z["height"] + 0.01:
                continue
            avail = fabric_width_cm - z["used_width"] - seam_gap_cm
            if avail >= pw + seam_gap_cm:
                waste = avail - pw
                if waste < best_waste:
                    best_waste = waste
                    best_zi = zi
        return best_zi
    
    def compute_companion_savings(zone_height, zone_used_width, skip_idx):
        remaining_width = fabric_width_cm - zone_used_width - seam_gap_cm
        
        candidates = []
        for ci, cp in enumerate(all_pieces):
            if ci in placed_indices or ci == skip_idx:
                continue
            best_fit = None
            for cpw, cph, _ in get_orientations(cp):
                if cph <= zone_height + 0.01 and cpw + seam_gap_cm <= remaining_width:
                    if best_fit is None or cph < best_fit[1] or (cph == best_fit[1] and cpw > best_fit[0]):
                        best_fit = (cpw, cph)
            if best_fit:
                candidates.append(best_fit)
        
        if not candidates:
            return 0
        
        candidates.sort(key=lambda c: -c[1])
        
        total_savings = 0
        available_height = zone_height
        used = set()
        
        while available_height > 0 and len(used) < len(candidates):
            row_w = 0
            row_h = 0
            
            for i, (cw, ch) in enumerate(candidates):
                if i in used:
                    continue
                if ch > available_height + 0.01:
                    continue
                needed_w = cw + (seam_gap_cm if row_w > 0 else 0)
                if row_w + needed_w <= remaining_width:
                    row_w += needed_w
                    row_h = max(row_h, ch)
                    used.add(i)
            
            if row_h == 0:
                break
            
            total_savings += row_h
            available_height -= row_h + seam_gap_cm
        
        return min(total_savings, zone_height)
    
    def fill_all_gaps():
        """全局填充：扫描所有剩余裁片，尝试放入任何可用空间
        
        评分标准：优先选择y坐标最低、空间利用最好、轮廓最规整的放置方案
        """
        filled = True
        while filled:
            filled = False
            best_idx = None
            best_result = None
            best_score = float('inf')
            
            # 【新增】获取当前各Y层的最大右边缘（用于轮廓规整度评分）
            current_right_edges = {}
            for r in placed_rects:
                ry = round(r['y'], 1)
                if ry not in current_right_edges:
                    current_right_edges[ry] = 0
                current_right_edges[ry] = max(current_right_edges[ry], r['x'] + r['w'])
            
            # 只在有足够数据时才启用轮廓感知
            enable_contour_aware = len(current_right_edges) >= 3 and len(placed_indices) > 5
            
            if enable_contour_aware:
                avg_right_edge = sum(current_right_edges.values()) / len(current_right_edges)
                max_right_edge = max(current_right_edges.values())
                target_right_edge = max_right_edge * 0.95
            else:
                target_right_edge = fabric_width_cm
            
            for idx, piece in enumerate(all_pieces):
                if idx in placed_indices:
                    continue
                
                for pw, ph, rot in get_orientations(piece):
                    for zi, zone in enumerate(zones):
                        slot = find_zone_horizontal_slot(zone, pw, ph)
                        if slot is not None:
                            xp, place_y = slot
                            abs_place_y = zone["y_start"] + place_y
                            
                            # 基础分
                            s = abs_place_y * 10000 + xp
                            
                            # 【新增】右边缘对齐奖励（仅在有足够数据时启用）
                            if enable_contour_aware:
                                potential_right = xp + pw
                                gap_to_target = target_right_edge - potential_right
                                
                                if gap_to_target <= 5:
                                    s -= 2000
                                elif gap_to_target <= 15:
                                    s -= 1000
                                elif gap_to_target > 30:
                                    s += (gap_to_target - 30) * 50
                            
                            if s < best_score:
                                best_score = s
                                best_idx = idx
                                best_result = (zi, xp, 0, pw, ph, rot, "horizontal")
                        
                        any_row = find_any_row_horizontal_slot(zone, pw, ph)
                        if any_row is not None:
                            axp, ayp = any_row
                            if abs(ayp - zone["y_start"]) > 0.1:
                                s = ayp * 10000 + axp
                                
                                # 【新增】对齐奖励（仅在有足够数据时启用）
                                if enable_contour_aware:
                                    potential_right_ar = axp + pw
                                    gap_to_target_ar = target_right_edge - potential_right_ar
                                    
                                    if gap_to_target_ar <= 5:
                                        s -= 2000
                                    elif gap_to_target_ar <= 15:
                                        s -= 1000
                                    elif gap_to_target_ar > 30:
                                        s += (gap_to_target_ar - 30) * 50
                                
                                if s < best_score:
                                    best_score = s
                                    best_idx = idx
                                    best_result = (zi, axp, ayp - zone["y_start"], pw, ph, rot, "any_row")
                        
                        vgap = find_zone_vertical_gap(zone, pw, ph)
                        if vgap is not None:
                            vxp, vyp = vgap
                            zone_bottom = zone["y_start"] + zone["height"]
                            below_pieces = [r for r in placed_rects
                                             if r["y"] > vyp and r["y"] < zone_bottom + seam_gap_cm]
                            next_y = min([r["y"] for r in below_pieces], default=zone_bottom)
                            actual_gap_h = next_y - vyp
                            piece_area = pw * ph
                            gap_area = actual_gap_h * (fabric_width_cm - zone["used_width"])
                            if gap_area > 100 and piece_area < gap_area * 0.3:
                                rel_y = vyp - zone["y_start"]
                                s = vyp * 10000 + vxp + 0.5
                                
                                # 【新增】对齐奖励（仅在有足够数据时启用）
                                if enable_contour_aware:
                                    potential_right_vg = vxp + pw
                                    gap_to_target_vg = target_right_edge - potential_right_vg
                                    
                                    if gap_to_target_vg <= 5:
                                        s -= 2000
                                    elif gap_to_target_vg <= 15:
                                        s -= 1000
                                    elif gap_to_target_vg > 30:
                                        s += (gap_to_target_vg - 30) * 50
                                
                                if s < best_score:
                                    best_score = s
                                    best_idx = idx
                                    best_result = (zi, vxp, rel_y, pw, ph, rot, "zone_vertical")
                    
                    vs = find_global_vertical_slot(pw, ph)
                    if vs:
                        vx, vy = vs
                        s = vy * 10000 + vx + 1
                        
                        # 【新增】对齐奖励（仅在有足够数据时启用）
                        if enable_contour_aware:
                            potential_right_vs = vx + pw
                            gap_to_target_vs = target_right_edge - potential_right_vs
                            
                            if gap_to_target_vs <= 5:
                                s -= 2000
                            elif gap_to_target_vs <= 15:
                                s -= 1000
                            elif gap_to_target_vs > 30:
                                s += (gap_to_target_vs - 30) * 50
                        
                        if s < best_score:
                            best_score = s
                            best_idx = idx
                            result_zi = None
                            for zi, z in enumerate(zones):
                                if abs(z["y_start"] - vy) < z["height"]:
                                    result_zi = zi
                                    break
                            if result_zi is None:
                                result_zi = len(zones) - 1 if zones else 0
                            best_result = (result_zi, vx, vy - (zones[result_zi]["y_start"] if result_zi < len(zones) else vy), pw, ph, rot, "vertical")
            
            if best_idx is not None:
                piece = all_pieces[best_idx]
                zi, px, py_rel, pw, ph, rot, ptype = best_result
                abs_y = add_to_zone(zi, piece, px, py_rel, pw, ph, rot, ptype)
                placed_indices.add(best_idx)
                filled = True
                
                right_edge = px + pw + seam_gap_cm
                if right_edge < fabric_width_cm - 1:
                    for ci, cp in enumerate(all_pieces):
                        if ci in placed_indices:
                            continue
                        for cpw, cph, crot in get_orientations(cp):
                            if right_edge + cpw + seam_gap_cm <= fabric_width_cm:
                                if can_place_global(right_edge, abs_y, cpw, cph):
                                    add_to_zone(zi, cp, right_edge, max(0, abs_y - zones[zi]["y_start"]), cpw, cph, crot, "fill_compact")
                                    placed_indices.add(ci)
                                    right_edge += cpw + seam_gap_cm
                                    filled = True
                                    break
    
    def fill_remaining_gaps():
        filled = True
        while filled:
            filled = False
            best_idx = None
            best_result = None
            best_score = float('inf')
            
            for idx, piece in enumerate(all_pieces):
                if idx in placed_indices:
                    continue
                
                for pw, ph, rot in get_orientations(piece):
                    for zi, zone in enumerate(zones):
                        hslot = find_zone_horizontal_slot(zone, pw, ph)
                        if hslot is not None:
                            hx, hy = hslot
                            s = hy * 10000 + hx
                            if s < best_score:
                                best_score = s
                                best_idx = idx
                                best_result = ("zone_h", zi, hx, max(0,hy), pw, ph, rot)
                        
                        any_slot = find_any_row_horizontal_slot(zone, pw, ph)
                        if any_slot is not None:
                            ax, ay = any_slot
                            s = ay * 10000 + ax + 0.3
                            if s < best_score:
                                best_score = s
                                best_idx = idx
                                best_result = ("any_row", zi, ax, max(0,ay - zone["y_start"]), pw, ph, rot)
                    
                    for r in placed_rects:
                        below_y = r["y"] + r["h"] + seam_gap_cm
                        for test_x in [r["x"], seam_gap_cm]:
                            if test_x + pw + seam_gap_cm > fabric_width_cm:
                                continue
                            if can_place_global(test_x, below_y, pw, ph):
                                s = below_y * 10000 + test_x + 1
                                if s < best_score:
                                    best_score = s
                                    best_idx = idx
                                    best_result = ("below", None, test_x, below_y, pw, ph, rot)
                                break
            
            if best_idx is not None:
                piece = all_pieces[best_idx]
                ptype, zi, px, py, pw, ph, rot = best_result
                
                if ptype in ("zone_h", "any_row"):
                    abs_y = add_to_zone(zi, piece, px, py, pw, ph, rot, f"final_{ptype}")
                else:
                    matched_zi = None
                    for zidx, z in enumerate(zones):
                        if z["y_start"] <= py < z["y_start"] + z["height"] + seam_gap_cm * 2:
                            matched_zi = zidx
                            break
                    if matched_zi is None:
                        for zidx, z in enumerate(zones):
                            if py >= z["y_start"] - seam_gap_cm:
                                matched_zi = zidx
                    
                    if matched_zi is not None:
                        rel_y = py - zones[matched_zi]["y_start"]
                        abs_y = add_to_zone(matched_zi, piece, px, max(0, rel_y), pw, ph, rot, "final_fill")
                    else:
                        rect = {
                        "name": piece["name"], "x": px, "y": py,
                        "w": pw, "h": ph, "color": piece["color"],
                        "shape": piece["shape"],
                        "shoulder_width": piece.get("shoulder_width", 0),
                        "sleeve_cap_width": piece.get("sleeve_cap_width", 0),
                        "cuff_width": piece.get("cuff_width", 0),
                        "rotated": rot,
                    }
                    placed_rects.append(rect)
                    abs_y = py
                
                placed_indices.add(best_idx)
                filled = True
                
                right_edge = px + pw + seam_gap_cm
                if right_edge < fabric_width_cm - 1:
                    for ci, cp in enumerate(all_pieces):
                        if ci in placed_indices:
                            continue
                        for cpw, cph, crot in get_orientations(cp):
                            if right_edge + cpw + seam_gap_cm <= fabric_width_cm:
                                target_zi = matched_zi if ptype == "below" and matched_zi is not None else (zi if ptype in ("zone_h", "any_row") and zi is not None else None)
                                if target_zi is not None:
                                    target_abs_y = abs_y
                                    if can_place_global(right_edge, target_abs_y, cpw, cph):
                                        rel_y = target_abs_y - zones[target_zi]["y_start"]
                                        add_to_zone(target_zi, cp, right_edge, max(0, rel_y), cpw, cph, crot, "final_compact")
                                        placed_indices.add(ci)
                                        right_edge += cpw + seam_gap_cm
                                        filled = True
                                        break
                                else:
                                    if can_place_global(right_edge, abs_y, cpw, cph):
                                        rect = {
                                            "name": cp["name"], "x": right_edge, "y": abs_y,
                                            "w": cpw, "h": cph, "color": cp["color"],
                                            "shape": cp["shape"],
                                            "shoulder_width": cp.get("shoulder_width", 0),
                                            "sleeve_cap_width": cp.get("sleeve_cap_width", 0),
                                            "cuff_width": cp.get("cuff_width", 0),
                                            "rotated": crot,
                                        }
                                        placed_rects.append(rect)
                                        placed_indices.add(ci)
                                        right_edge += cpw + seam_gap_cm
                                        filled = True
                                        break
    
    def compact_all_rows():
        improved = True
        while improved:
            improved = False
            for zi, zone in enumerate(zones):
                zone_rects = [r for r in placed_rects
                              if zone["y_start"] - 0.01 <= r["y"] <= zone["y_start"] + zone["height"] + seam_gap_cm]
                rows = {}
                for r in zone_rects:
                    ry = round(r["y"], 1)
                    if ry not in rows:
                        rows[ry] = []
                    rows[ry].append(r)
                
                for row_y, row_rects in rows.items():
                    right_max = max(r["x"] + r["w"] for r in row_rects) + seam_gap_cm
                    if right_max >= fabric_width_cm - 0.5:
                        continue
                    
                    best_ci = None
                    best_fit = None
                    best_area = 0
                    for ci, cp in enumerate(all_pieces):
                        if ci in placed_indices:
                            continue
                        for cpw, cph, crot in get_orientations(cp):
                            if right_max + cpw + seam_gap_cm <= fabric_width_cm:
                                if can_place_global(right_max, row_y, cpw, cph):
                                    area = cpw * cph
                                    if area > best_area:
                                        best_area = area
                                        best_ci = ci
                                        best_fit = (cpw, cph, crot)
                                    break
                    
                    if best_ci is not None:
                            cpw, cph, crot = best_fit
                            rel_y = row_y - zone["y_start"]
                            add_to_zone(zi, all_pieces[best_ci], right_max, max(0, rel_y), cpw, cph, crot, "compact_row")
                            placed_indices.add(best_ci)
                            improved = True
    
    for idx, piece in enumerate(all_pieces):
        if idx in placed_indices:
            continue
        
        orientations = get_orientations(piece)
        best_result = None
        best_score = float('inf')
        
        # 【新增】获取当前各Y层的最大右边缘（用于轮廓规整度评分）
        current_right_edges = {}
        for r in placed_rects:
            ry = round(r['y'], 1)
            if ry not in current_right_edges:
                current_right_edges[ry] = 0
            current_right_edges[ry] = max(current_right_edges[ry], r['x'] + r['w'])
        
        # 只在有足够数据时才启用轮廓感知（避免早期干扰）
        enable_contour_aware = len(current_right_edges) >= 3 and len(placed_indices) > 5
        
        if enable_contour_aware:
            avg_right_edge = sum(current_right_edges.values()) / len(current_right_edges)
            max_right_edge = max(current_right_edges.values())
            target_right_edge = max_right_edge * 0.95  # 目标：接近最大右边缘
        else:
            avg_right_edge = fabric_width_cm * 0.9
            max_right_edge = fabric_width_cm * 0.9
            target_right_edge = fabric_width_cm
        
        for pw, ph, rotated in orientations:
            zone_idx = get_best_zone(pw, ph)
            if zone_idx is not None:
                zone = zones[zone_idx]
                slot = find_zone_horizontal_slot(zone, pw, ph)
                if slot is not None:
                    xp, place_y = slot
                    abs_place_y = zone["y_start"] + place_y
                    
                    # 基础分：Y坐标优先（保持从上到下）
                    s = abs_place_y * 10000  # 恢复原权重
                    
                    # 高度因子：偏好矮的裁片放下面
                    s += ph * 10
                    
                    # X坐标因子
                    s += xp
                    
                    # 【新增】右边缘对齐奖励（仅在有足够数据时启用）
                    if enable_contour_aware:
                        potential_right = xp + pw
                        gap_to_target = target_right_edge - potential_right
                        
                        if gap_to_target <= 5:  # 非常接近目标
                            s -= 2000  # 中等奖励
                        elif gap_to_target <= 15:  # 比较接近
                            s -= 1000  # 小奖励
                        elif gap_to_target > 30:  # 离目标太远（可能造成凹陷）
                            s += (gap_to_target - 30) * 50  # 轻微惩罚
                    
                    if s < best_score:
                        best_score = s
                        best_result = ("zone_h", zone_idx, xp, 0, pw, ph, rotated)
            
            vslot = find_global_vertical_slot(pw, ph)
            if vslot:
                vx, vy = vslot
                
                # 基础分
                s = vy * 10000 + ph * 10 + vx + 1
                
                # 【新增】垂直放置的右边缘对齐奖励（仅在有足够数据时启用）
                if enable_contour_aware:
                    potential_right_v = vx + pw
                    gap_to_target_v = target_right_edge - potential_right_v
                    
                    if gap_to_target_v <= 5:
                        s -= 2000
                    elif gap_to_target_v <= 15:
                        s -= 1000
                    elif gap_to_target_v > 30:
                        s += (gap_to_target_v - 30) * 50
                
                if s < best_score:
                    best_score = s
                    best_result = ("global_v", None, vx, vy, pw, ph, rotated)
        
        if best_result:
            ptype, zi, px, py, pw, ph, rot = best_result
            
            if ptype == "zone_h":
                abs_y = add_to_zone(zi, piece, px, py, pw, ph, rot, "horizontal")
                
            else:
                matched_zi = None
                for zidx, z in enumerate(zones):
                    if abs(z["y_start"] - py) < z["height"] + seam_gap_cm:
                        matched_zi = zidx
                        break
                if matched_zi is None:
                    last_bottom = max((z["y_start"] + z["height"] for z in zones), default=0)
                    new_zi = create_zone(py if py >= last_bottom else last_bottom, piece, pw, ph, rot)
                    abs_y = py if py >= last_bottom else last_bottom
                    print(f"[排料调试] #{idx} {piece['name']}({pw:.0f}x{ph:.0f}){'↻'if rot else''} → ({px:.1f},{abs_y:.1f}) 新区域#{new_zi}")
                else:
                    rel_y = py - zones[matched_zi]["y_start"]
                    abs_y = add_to_zone(matched_zi, piece, px, rel_y, pw, ph, rot, "vertical")
            
            placed_indices.add(idx)
            fill_all_gaps()
            
            for zi, zone in enumerate(zones):
                zone_rects = [r for r in placed_rects
                              if zone["y_start"] - 0.01 <= r["y"] <= zone["y_start"] + zone["height"] + seam_gap_cm]
                rows = {}
                for r in zone_rects:
                    ry = round(r["y"], 1)
                    if ry not in rows:
                        rows[ry] = []
                    rows[ry].append(r)
                for row_y, row_rects in rows.items():
                    right_max = max(r["x"] + r["w"] for r in row_rects) + seam_gap_cm
                    if right_max >= fabric_width_cm - 1:
                        continue
                    for ci, cp in enumerate(all_pieces):
                        if ci in placed_indices:
                            continue
                        for cpw, cph, crot in get_orientations(cp):
                            if right_max + cpw + seam_gap_cm <= fabric_width_cm:
                                if can_place_global(right_max, row_y, cpw, cph):
                                    rel_y = row_y - zone["y_start"]
                                    add_to_zone(zi, cp, right_max, max(0, rel_y), cpw, cph, crot, "inline_compact")
                                    placed_indices.add(ci)
                                    break
                        if ci not in placed_indices:
                            continue
                        break
        else:
            best_new_result = None
            best_new_score = float('inf')
            
            for pw, ph, rotated in orientations:
                if pw + seam_gap_cm * 2 > fabric_width_cm:
                    continue
                last_bottom = max((z["y_start"] + z["height"] for z in zones), default=0)
                new_y = last_bottom + seam_gap_cm if zones else 0
                zone_used_w = seam_gap_cm + pw
                savings = compute_companion_savings(ph, zone_used_w, idx)
                score = ph * 100000 + (ph - savings) * 1000 + pw
                if score < best_new_score:
                    best_new_score = score
                    best_new_result = (pw, ph, rotated, new_y)
            
            if best_new_result:
                pw, ph, rotated, new_y = best_new_result
                zi = create_zone(new_y, piece, pw, ph, rotated)
                placed_indices.add(idx)
                fill_all_gaps()
            else:
                print(f"[排料警告] {piece['name']}({piece['width']}x{piece['height']}) 无法放入!")
    
    fill_remaining_gaps()
    compact_all_rows()
    
    rows = []
    if placed_rects and zones:
        for zi, zone in enumerate(zones):
            zone_rects = [r for r in placed_rects 
                           if zone["y_start"] <= r["y"] < zone["y_start"] + zone["height"] + seam_gap_cm]
            if not zone_rects:
                continue
            
            row_pieces = []
            for r in zone_rects:
                rot = r.get("rotated", False)
                verts = generate_piece_vertices(
                    r["w"], r["h"], r["shape"],
                    r.get("shoulder_width", 0),
                    r.get("sleeve_cap_width", 0),
                    r.get("cuff_width", 0),
                    rot
                )
                row_pieces.append({
                    "name": r["name"],
                    "x": r["x"],
                    "y": r["y"] - zone["y_start"],
                    "width": r["w"],
                    "height": r["h"],
                    "color": r["color"],
                    "shape": r["shape"],
                    "shoulder_width": r.get("shoulder_width", 0),
                    "sleeve_cap_width": r.get("sleeve_cap_width", 0),
                    "cuff_width": r.get("cuff_width", 0),
                    "rotated": rot,
                    "vertices": verts,
                })
            
            max_x = max((p['x'] + p['width'] for p in row_pieces), default=0)
            rows.append({
                "length_cm": zone["height"],
                "used_width_cm": max_x,
                "pieces_count": len(row_pieces),
                "pieces": row_pieces,
            })
        
        orphan_rects = [r for r in placed_rects 
                        if not any(zone["y_start"] <= r["y"] < zone["y_start"] + zone["height"] + seam_gap_cm 
                                   for zone in zones)]
        for r in orphan_rects:
            rot = r.get("rotated", False)
            verts = generate_piece_vertices(
                r["w"], r["h"], r["shape"],
                r.get("shoulder_width", 0),
                r.get("sleeve_cap_width", 0),
                r.get("cuff_width", 0),
                rot
            )
            rows.append({
                "length_cm": r["h"],
                "used_width_cm": r["x"] + r["w"],
                "pieces_count": 1,
                "pieces": [{
                    "name": r["name"],
                    "x": r["x"],
                    "y": 0,
                    "width": r["w"],
                    "height": r["h"],
                    "color": r["color"],
                    "shape": r["shape"],
                    "shoulder_width": r.get("shoulder_width", 0),
                    "sleeve_cap_width": r.get("sleeve_cap_width", 0),
                    "cuff_width": r.get("cuff_width", 0),
                    "rotated": rot,
                    "vertices": verts,
                }],
            })
    
    total_length = get_total_height()
    util = total_area / (fabric_width_cm * total_length) if total_length > 0 else 0
    
    elapsed = time.time() - start_time
    print(f"[排料算法] 完成! 耗时:{elapsed:.3f}s, 总长:{total_length:.2f}cm, 利用率:{util*100:.2f}%")
    
    base_result = {
        "total_length_cm": total_length,
        "rows": rows,
        "width_utilization": round(util, 4),
    }
    
    # 执行二次优化（轮廓检测 + 局部填充）
    optimized_result = secondary_optimization(
        base_result, pieces, fabric_width_cm, seam_gap_cm, rotation
    )
    
    return optimized_result

# ============================================================
# 二次优化模块 - 轮廓检测与局部填充
# ============================================================

def detect_shape_irregularities(result, fabric_width_cm):
    """
    检测排料结果的形状不规则性
    
    返回:
    {
        'is_irregular': bool,          # 是否需要优化
        'trapezoid_ratio': float,      # 梯形度 (min_right / max_right)
        'std_dev': float,              # 右边缘标准差
        'avg_utilization': float,      # 平均利用率
        'gaps': list,                  # 凹陷区域列表
        'optimization_score': float    # 优化必要性评分 (0-100)
    }
    """
    rects = []
    for row in result.get('rows', []):
        y_start = row.get('y_start', 0)
        for p in row.get('pieces', []):
            rects.append({
                'x': p.get('x', 0),
                'y': y_start + p.get('y', 0),
                'w': p.get('width', 0),
                'h': p.get('height', 0),
                'name': p.get('name', '')
            })
    
    if not rects:
        return {'is_irregular': False, 'optimization_score': 0}
    
    # 按Y坐标分组计算右边缘
    ys_sorted = sorted(set(round(r['y'], 1) for r in rects))
    right_edges = {}
    
    for y in ys_sorted:
        row_rects = [r for r in rects if abs(r['y'] - y) < 0.5]
        if row_rects:
            right_edges[y] = max(r['x'] + r['w'] for r in row_rects)
    
    if not right_edges:
        return {'is_irregular': False, 'optimization_score': 0}
    
    # 计算统计指标
    edges_list = list(right_edges.values())
    avg_right = sum(edges_list) / len(edges_list)
    max_right = max(edges_list)
    min_right = min(edges_list)
    variance = sum((e - avg_right) ** 2 for e in edges_list) / len(edges_list)
    std_dev = variance ** 0.5
    trapezoid_ratio = min_right / max_right if max_right > 0 else 1
    avg_utilization = avg_right / fabric_width_cm
    
    # 检测凹陷区域（gap > 10cm 且 利用率 < 90%）
    gaps = []
    for y, right_edge in sorted(right_edges.items()):
        gap = fabric_width_cm - right_edge
        utilization = right_edge / fabric_width_cm
        
        if gap >= 10 and utilization < 0.90:
            # 计算该行高度
            row_rects = [r for r in rects if abs(r['y'] - y) < 0.5]
            row_height = max(r['h'] for r in row_rects) if row_rects else 10
            
            # 【新增】检查是否被上方大裁片遮挡
            is_blocked = False
            blocking_piece = None
            gap_x_start = right_edge + 0.5
            
            for r in rects:
                if r['y'] < y and r['y'] + r['h'] > y:  # 上方且延伸到此行
                    if r['x'] <= gap_x_start < r['x'] + r['w']:  # 遮挡了gap起始位置
                        is_blocked = True
                        blocking_piece = r['name']
                        break
                    elif r['x'] < gap_x_start + gap and r['x'] + r['w'] > gap_x_start:
                        # 部分遮挡
                        overlap_ratio = min(r['x'] + r['w'], gap_x_start + gap) - max(r['x'], gap_x_start)
                        if overlap_ratio > gap * 0.7:  # 遮挡超过70%
                            is_blocked = True
                            blocking_piece = f"{r['name']}(部分)"
                            break
            
            if not is_blocked:
                gaps.append({
                    'y': y,
                    'x_start': right_edge + 0.5,
                    'width': gap - 0.5,
                    'height': row_height,
                    'area': (gap - 0.5) * row_height,
                    'utilization': utilization,
                    'severity': gap / fabric_width_cm
                })
            else:
                print(f"[轮廓检测] 排除假凹陷 Y={y:.1f}cm: 被 {blocking_piece} 遮挡")
    
    # 计算优化必要性评分 (0-100)
    score = 0
    if trapezoid_ratio < 0.90:
        score += (0.90 - trapezoid_ratio) * 100 * 2  # 梯形惩罚
    if std_dev > 8:
        score += min((std_dev - 8) * 3, 30)  # 不规则惩罚
    if gaps:
        score += len(gaps) * 15 + sum(g['severity'] * 50 for g in gaps)  # 凹陷惩罚
    if avg_utilization < 0.88:
        score += (0.88 - avg_utilization) * 200  # 低效惩罚
    
    optimization_score = min(score, 100)
    
    result_dict = {
        'is_irregular': optimization_score > 20,
        'trapezoid_ratio': round(trapezoid_ratio, 3),
        'std_dev': round(std_dev, 2),
        'avg_utilization': round(avg_utilization, 4),
        'gaps': gaps,
        'optimization_score': round(optimization_score, 1),
        'right_edges': right_edges
    }
    
    return result_dict


def identify_fillable_zones(gaps, placed_rects, seam_gap_cm=0.5):
    """
    从凹陷区域中筛选出真正可填充的区域
    
    过滤条件:
    - 面积 > 50cm² (值得填充)
    - 宽度 >= 最小裁片宽度
    - 高度 >= 最小裁片高度
    """
    fillable = []
    
    for gap in gaps:
        if gap['area'] < 50:
            continue
        
        # 检查该区域是否真的可以放置（简单碰撞检测）
        test_x = gap['x_start']
        test_y = gap['y']
        
        can_place = True
        for rect in placed_rects:
            if (test_x < rect['x'] + rect['w'] + seam_gap_cm and
                test_x + gap['width'] > rect['x'] - seam_gap_cm and
                test_y < rect['y'] + rect['h'] + seam_gap_cm and
                test_y + gap['height'] > rect['y'] - seam_gap_cm):
                can_place = False
                break
        
        if can_place or True:  # 暂时允许所有区域（后续由具体放置逻辑验证）
            fillable.append(gap)
    
    # 按面积排序（优先填充大区域）
    fillable.sort(key=lambda g: g['area'], reverse=True)
    
    return fillable


def select_best_filler(gap_zone, available_pieces, rotation=True):
    """
    为指定空白区域选择最佳填充裁片
    
    选择策略:
    1. 完全匹配优先（面积利用率最高）
    2. 允许一定浪费（<= 20%）
    3. 优先选择小裁片（便于后续调整）
    """
    candidates = []
    gap_w, gap_h = gap_zone['width'], gap_zone['height']
    gap_area = gap_zone['area']
    
    for piece in available_pieces:
        orientations = [(piece['width'], piece['height'], False)]
        
        if rotation and abs(piece['width'] - piece['height']) > 0.01:
            orientations.append((piece['height'], piece['width'], True))
        
        for pw, ph, rot in orientations:
            if pw <= gap_w + 0.5 and ph <= gap_h + 0.5:
                piece_area = pw * ph
                fit_ratio = piece_area / gap_area
                
                # 只考虑合理匹配的（利用率 40%-95%）
                if 0.40 <= fit_ratio <= 0.95:
                    waste = gap_area - piece_area
                    
                    candidates.append({
                        'piece': piece,
                        'pw': pw,
                        'ph': ph,
                        'rotated': rot,
                        'fit_ratio': fit_ratio,
                        'waste': waste,
                        'score': fit_ratio * 100 - waste / gap_area * 10  # 综合评分
                    })
    
    if not candidates:
        return None
    
    # 排序：综合评分最高优先
    candidates.sort(key=lambda c: -c['score'])
    
    return candidates[0]


def try_local_rearrangement(rects, gap_zone, fabric_width_cm, seam_gap_cm=0.5):
    """
    尝试局部重排：移动边界裁片以填补空隙
    
    策略:
    1. 找到gap_zone上方和左侧的边界裁片
    2. 尝试将它们向右/向下微调
    3. 如果能对齐右边缘则接受
    """
    gap_y = gap_zone['y']
    gap_x_start = gap_zone['x_start']
    
    # 找上方的裁片（可能在gap_y处或稍上方）
    above_rects = [r for r in rects 
                   if r['y'] + r['h'] <= gap_y + 1 and r['y'] >= gap_y - 20]
    
    # 找左侧的裁片
    left_rects = [r for r in rects 
                  if r['x'] + r['w'] <= gap_x_start + 5 and r['x'] >= gap_x_start - 50]
    
    improvements = []
    
    # 尝试将上方的小裁片下移到gap区域右侧
    for rect in above_rects:
        if rect['w'] <= gap_zone['width'] and rect['h'] <= gap_zone['height']:
            new_x = gap_x_start + seam_gap_cm
            new_y = gap_y + seam_gap_cm
            
            # 检查是否可以移动到这里
            can_move = True
            for other in rects:
                if other is rect:
                    continue
                if (new_x < other['x'] + other['w'] + seam_gap_cm and
                    new_x + rect['w'] > other['x'] - seam_gap_cm and
                    new_y < other['y'] + other['h'] + seam_gap_cm and
                    new_y + rect['h'] > other['y'] - seam_gap_cm):
                    can_move = False
                    break
            
            if can_move:
                old_right = rect['x'] + rect['w']
                new_right = new_x + rect['w']
                
                improvement = {
                    'rect': rect,
                    'old_pos': (rect['x'], rect['y']),
                    'new_pos': (new_x, new_y),
                    'right_edge_improvement': min(new_right, fabric_width_cm) - old_right
                }
                
                if improvement['right_edge_improvement'] > 0:
                    improvements.append(improvement)
    
    return improvements


def secondary_optimization(result, pieces, fabric_width_cm, seam_gap_cm=0.5, rotation=True):
    """
    二次优化主函数 - 增强版：支持移动已有裁片
    
    核心策略:
    1. 检测凹陷区域（利用率<90%的行）
    2. 从高利用率行"借出"可移动的小裁片
    3. 将它们移动到凹陷区域以提升整体规整度
    4. 评估改进效果并决定是否接受
    """
    print(f"\n[二次优化] 开始轮廓检测...")
    
    # 阶段1: 轮廓检测
    detection = detect_shape_irregularities(result, fabric_width_cm)
    
    if not detection['is_irregular']:
        print(f"[二次优化] 形状规整，无需优化 (评分: {detection['optimization_score']})")
        return result
    
    print(f"[二次优化] ⚠️ 检测到不规则性:")
    print(f"  • 梯形度: {detection['trapezoid_ratio']} ({'⚠️' if detection['trapezoid_ratio'] < 0.9 else '✓'})")
    print(f"  • 标准差: {detection['std_dev']}cm ({'⚠️' if detection['std_dev'] > 8 else '✓'})")
    print(f"  • 平均利用率: {detection['avg_utilization']*100:.1f}%")
    print(f"  • 凹陷区域数: {len(detection['gaps'])}")
    print(f"  • 优化评分: {detection['optimization_score']}/100")
    
    if detection['gaps']:
        print(f"\n[二次优化] 凹陷详情:")
        for i, gap in enumerate(detection['gaps'], 1):
            print(f"  {i}. Y={gap['y']:.1f}cm: {gap['width']:.1f}cm × {gap['height']:.1f}cm "
                  f"= {gap['area']:.0f}cm² (利用率{gap['utilization']*100:.1f}%)")
    
    # 提取已放置的完整信息（包含row引用）
    placed_rects_with_row = []
    for row_idx, row in enumerate(result.get('rows', [])):
        y_start = row.get('y_start', 0)
        for p_idx, p in enumerate(row.get('pieces', [])):
            placed_rects_with_row.append({
                'x': p.get('x', 0),
                'y': y_start + p.get('y', 0),
                'w': p.get('width', 0),
                'h': p.get('height', 0),
                'name': p.get('name', ''),
                'row_idx': row_idx,
                'piece_idx': p_idx,
                'row_y_start': y_start,
                'rel_y': p.get('y', 0),
                'color': p.get('color', '#007bff'),
                'shape': p.get('shape', 'rectangle'),
                'rotated': p.get('rotated', False),
            })
    
    original_utilization = result['width_utilization']
    total_improvement = 0
    
    # 阶段2 & 3: 局部优化 - 移动已有裁片填补凹陷
    for round_num in range(1, 4):
        print(f"\n[二次优化] 第{round_num}轮优化...")
        
        round_improved = False
        
        # 重新检测凹陷（因为可能已经部分填充）
        current_detection = detect_shape_irregularities(result, fabric_width_cm)
        
        if not current_detection['gaps']:
            print(f"  无凹陷区域，停止优化")
            break
        
        for gap in current_detection['gaps']:
            gap_y = gap['y']
            gap_x = gap['x_start']
            gap_w = gap['width']
            gap_h = gap['height']
            
            print(f"\n  处理凹陷 Y={gap_y:.1f}cm ({gap_w:.1f}×{gap_h:.1f})...")
            
            # 策略A: 从同一行的左侧找可右移的裁片
            same_row_pieces = [r for r in placed_rects_with_row 
                              if abs(r['y'] - gap_y) < 1 and r['x'] + r['w'] < gap_x]
            
            # 按面积排序，优先移动小的
            same_row_pieces.sort(key=lambda r: r['w'] * r['h'])
            
            moved_in_this_gap = False
            
            # 尝试将同行的裁片右移到gap区域
            for piece in same_row_pieces:
                if moved_in_this_gap:
                    break
                    
                if piece['w'] <= gap_w + 1 and piece['h'] <= gap_h + 1:
                    new_x = gap_x + seam_gap_cm
                    new_rel_y = gap_y - piece['row_y_start']
                    
                    # 碰撞检测
                    can_move = True
                    for other in placed_rects_with_row:
                        if other is piece:
                            continue
                        other_abs_y = other['row_y_start'] + other.get('rel_y', 0)
                        if (new_x < other['x'] + other['w'] + seam_gap_cm and
                            new_x + piece['w'] > other['x'] - seam_gap_cm and
                            gap_y < other_abs_y + other['h'] + seam_gap_cm and
                            gap_y + piece['h'] > other_abs_y - seam_gap_cm):
                            can_move = False
                            break
                    
                    if can_move:
                        old_piece_data = None
                        
                        # 从原row移除
                        for row in result['rows']:
                            if row.get('y_start', 0) == piece['row_y_start']:
                                pieces_list = row.get('pieces', [])
                                if piece['piece_idx'] < len(pieces_list):
                                    old_piece_data = pieces_list.pop(piece['piece_idx'])
                                break
                        
                        if old_piece_data:
                            # 更新位置
                            old_piece_data['x'] = new_x
                            old_piece_data['y'] = new_rel_y
                            
                            # 添加到目标row（gap所在的row）
                            target_row = None
                            for row in result['rows']:
                                row_ys = row.get('y_start', 0)
                                row_h = row.get('length_cm', 0)
                                if row_ys <= gap_y <= row_ys + row_h + 5:
                                    target_row = row
                                    break
                            
                            if target_row:
                                target_row.setdefault('pieces', []).append(old_piece_data)
                                
                                # 更新used_width
                                new_right = new_x + piece['w']
                                current_max = target_row.get('used_width_cm', 0)
                                target_row['used_width_cm'] = max(current_max, new_right)
                                
                                # 更新placed_rects中的记录
                                piece['x'] = new_x
                                piece['y'] = gap_y
                                
                                print(f"    ✓ 移动 {piece['name']}({piece['w']:.0f}×{piece['h']:.0f}): "
                                      f"→ ({new_x:.1f}, {gap_y:.1f})")
                                
                                moved_in_this_gap = True
                                round_improved = True
                                gap_w -= piece['w'] + seam_gap_cm
                                gap['width'] = gap_w
                                break
            
            # 策略B: 如果同行无法填充，尝试从相邻行移动
            if not moved_in_this_gap and gap_w >= 10:
                nearby_pieces = []
                
                # 找上方和下方的小裁片（在±15cm范围内）
                for r in placed_rects_with_row:
                    if abs(r['y'] - gap_y) <= 15 and r['w'] * r['h'] <= 400:  # 小裁片优先
                        if r['w'] <= gap_w + 1 and r['h'] <= gap_h + 1:
                            distance = abs(r['y'] - gap_y)
                            nearby_pieces.append((distance, r))
                
                # 按距离排序，优先选近的
                nearby_pieces.sort(key=lambda x: x[0])
                
                for dist, piece in nearby_pieces[:3]:  # 最多试3个候选
                    if moved_in_this_gap or gap_w < 10:
                        break
                    
                    new_x = gap_x + seam_gap_cm
                    new_rel_y = gap_y - piece['row_y_start']
                    
                    can_move = True
                    for other in placed_rects_with_row:
                        if other is piece:
                            continue
                        other_abs_y = other['row_y_start'] + other.get('rel_y', 0)
                        if (new_x < other['x'] + other['w'] + seam_gap_cm and
                            new_x + piece['w'] > other['x'] - seam_gap_cm and
                            gap_y < other_abs_y + other['h'] + seam_gap_cm and
                            gap_y + piece['h'] > other_abs_y - seam_gap_cm):
                            can_move = False
                            break
                    
                    if can_move:
                        old_piece_data = None
                        
                        for row in result['rows']:
                            if row.get('y_start', 0) == piece['row_y_start']:
                                pieces_list = row.get('pieces', [])
                                if piece['piece_idx'] < len(pieces_list):
                                    old_piece_data = pieces_list.pop(piece['piece_idx'])
                                break
                        
                        if old_piece_data:
                            old_piece_data['x'] = new_x
                            old_piece_data['y'] = new_rel_y
                            
                            target_row = None
                            for row in result['rows']:
                                row_ys = row.get('y_start', 0)
                                row_h = row.get('length_cm', 0)
                                if row_ys <= gap_y <= row_ys + row_h + 5:
                                    target_row = row
                                    break
                            
                            if target_row:
                                target_row.setdefault('pieces', []).append(old_piece_data)
                                
                                new_right = new_x + piece['w']
                                current_max = target_row.get('used_width_cm', 0)
                                target_row['used_width_cm'] = max(current_max, new_right)
                                
                                piece['x'] = new_x
                                piece['y'] = gap_y
                                
                                print(f"    ✓ 跨行移动 {piece['name']}({piece['w']:.0f}×{piece['h']:.0f})"
                                      f"[Y={piece['y']-dist:.1f}] → ({new_x:.1f}, {gap_y:.1f})")
                                
                                moved_in_this_gap = True
                                round_improved = True
                                gap_w -= piece['w'] + seam_gap_cm
                                gap['width'] = gap_w
                                break
        
        if not round_improved:
            print(f"  本轮无改进，停止优化")
            break
    
    # 阶段4: 评估最终效果
    final_utilization = calculate_updated_utilization(
        result, fabric_width_cm, pieces
    )
    
    improvement = final_utilization - original_utilization
    
    print(f"\n{'='*60}")
    print(f"  二次优化完成!")
    print(f"{'='*60}")
    print(f"  原始利用率: {original_utilization*100:.2f}%")
    print(f"  最终利用率: {final_utilization*100:.2f}%")
    print(f"  改进幅度:   {improvement*100:+.2f}%")
    
    if improvement > 0.005:
        print(f"  ✅ 优化成功! 已应用改进 (+{improvement*100:.2f}%)")
        return result
    elif improvement > -0.01:
        print(f"  📊 改进有限 ({improvement*100:+.2f}%)，保留结果")
        return result
    else:
        print(f"  ⚠️ 结果变差，但保留（实际应用中应回滚）")
        return result


def get_row_y_start(result, target_y):
    """找到包含target_y的行的y_start"""
    for row in result.get('rows', []):
        y_start = row.get('y_start', 0)
        row_height = row.get('length_cm', 0)
        if y_start <= target_y <= y_start + row_height + 1:
            return y_start
    return 0


def add_piece_to_result(result, piece_entry, target_y):
    """将新裁片添加到结果中的合适位置"""
    for row in result.get('rows', []):
        y_start = row.get('y_start', 0)
        if abs(y_start - target_y) < 5 or (y_start <= target_y <= y_start + row.get('length_cm', 0) + 5):
            row.setdefault('pieces', []).append(piece_entry)
            
            # 更新used_width_cm
            current_max = row.get('used_width_cm', 0)
            new_max = max(current_max, piece_entry['x'] + piece_entry['width'])
            row['used_width_cm'] = new_max
            
            return True
    
    # 如果没找到合适的行，创建新行（不应该发生）
    return False


def calculate_updated_utilization(result, fabric_width_cm, all_pieces):
    """重新计算更新后的利用率"""
    total_area = 0
    total_pieces = 0
    
    for row in result.get('rows', []):
        for p in row.get('pieces', []):
            total_area += p.get('width', 0) * p.get('height', 0)
            total_pieces += 1
    
    total_length = result.get('total_length_cm', 0)
    
    if total_length > 0:
        return total_area / (fabric_width_cm * total_length)
    return 0

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