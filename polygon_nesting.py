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
                      if r["y"] >= zone["y_start"] - 0.01 and r["y"] + r["h"] <= zone_bottom + 0.01]
        
        if not zone_rects:
            return None
        
        gaps = []
        checked_ys = set()
        
        for r in zone_rects:
            if r["h"] >= zone["height"] - 0.01:
                continue
            below_y = r["y"] + r["h"] + seam_gap_cm
            if below_y + ph > zone_bottom + 0.01:
                continue
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
        """在区域内从左到右扫描，找到第一个可放置的水平位置
        
        返回 (x, y) 或 None
        """
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
        
        if place_type == "horizontal":
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
        
        评分标准：优先选择y坐标最低、空间利用最好的放置方案
        """
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
                        slot = find_zone_horizontal_slot(zone, pw, ph)
                        if slot is not None:
                            xp, place_y = slot
                            s = place_y * 10000 + xp
                            if s < best_score:
                                best_score = s
                                best_idx = idx
                                best_result = (zi, xp, 0, pw, ph, rot, "horizontal")
                        
                        vgap = find_zone_vertical_gap(zone, pw, ph)
                        if vgap is not None:
                            vxp, vyp = vgap
                            rel_y = vyp - zone["y_start"]
                            s = vyp * 10000 + vxp + 0.5
                            if s < best_score:
                                best_score = s
                                best_idx = idx
                                best_result = (zi, vxp, rel_y, pw, ph, rot, "zone_vertical")
                    
                    vs = find_global_vertical_slot(pw, ph)
                    if vs:
                        vx, vy = vs
                        s = vy * 10000 + vx + 1
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
                print(f"[排料调试] 填充: {piece['name']}({pw:.0f}x{ph:.0f}){'↻'if rot else''} → ({px:.1f},{abs_y:.1f}) 类型={ptype}")
    
    for idx, piece in enumerate(all_pieces):
        if idx in placed_indices:
            continue
        
        orientations = get_orientations(piece)
        best_result = None
        best_score = float('inf')
        
        for pw, ph, rotated in orientations:
            zone_idx = get_best_zone(pw, ph)
            if zone_idx is not None:
                zone = zones[zone_idx]
                slot = find_zone_horizontal_slot(zone, pw, ph)
                if slot is not None:
                    xp, place_y = slot
                    s = place_y * 10000 + ph * 10 + xp
                    if s < best_score:
                        best_score = s
                        best_result = ("zone_h", zone_idx, xp, 0, pw, ph, rotated)
            
            vslot = find_global_vertical_slot(pw, ph)
            if vslot:
                vx, vy = vslot
                s = vy * 10000 + ph * 10 + vx + 1
                if s < best_score:
                    best_score = s
                    best_result = ("global_v", None, vx, vy, pw, ph, rotated)
        
        if best_result:
            ptype, zi, px, py, pw, ph, rot = best_result
            
            if ptype == "zone_h":
                abs_y = add_to_zone(zi, piece, px, py, pw, ph, rot, "horizontal")
                print(f"[排料调试] #{idx} {piece['name']}({pw:.0f}x{ph:.0f}){'↻'if rot else''} → ({px:.1f},{abs_y:.1f}) 区域#{zi}")
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
                    print(f"[排料调试] #{idx} {piece['name']}({pw:.0f}x{ph:.0f}){'↻'if rot else''} → ({px:.1f},{abs_y:.1f}) 区域#{matched_zi}垂直")
            
            placed_indices.add(idx)
            fill_all_gaps()
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
                print(f"[排料调试] #{idx} {piece['name']}({pw:.0f}x{ph:.0f}){'↻'if rotated else''} → 新行@{new_y:.1f}cm")
                fill_all_gaps()
            else:
                print(f"[排料警告] {piece['name']}({piece['width']}x{piece['height']}) 无法放入!")
    
    rows = []
    if placed_rects and zones:
        for zone in zones:
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
    
    return {
        "total_length_cm": total_length,
        "rows": rows,
        "width_utilization": round(util, 4),
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