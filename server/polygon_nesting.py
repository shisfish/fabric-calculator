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


def get_bounding_box_verts(vertices):
    """计算顶点列表的包围盒 (min_x, min_y, max_x, max_y)"""
    if not vertices:
        return 0, 0, 0, 0
    xs = [v[0] for v in vertices]
    ys = [v[1] for v in vertices]
    return min(xs), min(ys), max(xs), max(ys)

def rotate_vertices_ccw(vertices):
    """绕原点逆时针旋转90度"""
    return [(-y, x) for x, y in vertices]

def rotate_vertices_cw(vertices):
    """绕原点顺时针旋转90度 (等同于逆时针旋转270度)"""
    return [(y, -x) for x, y in vertices]

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
    """将全局已放置裁片列表转换为前端rows格式

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

        # 使用裁片的实际顶点（如果已通过 SAT 碰撞计算过）
        # 否则回退到 generate_piece_vertices 生成
        if "vertices" in rect and rect["vertices"]:
            verts = rect["vertices"]
        else:
            verts = generate_piece_vertices(
                rect["w"], rect["h"], rect["shape"],
                rect.get("shoulder_width", 0),
                rect.get("sleeve_cap_width", 0),
                rect.get("cuff_width", 0),
                rect.get("rotated", False)
            )

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
            "vertices": verts,
        }
        matched_row["pieces"].append(piece_entry)
        matched_row["pieces_count"] += 1

    for row in rows:
        row.pop("y", None)
        row.pop("max_bottom", None)

    return rows

def polygon_nesting(pieces, fabric_width_cm, seam_gap_cm=0.5, rotation=True):
    """
    Bottom-Left Fill 多边形排料算法（基于 SAT 多边形碰撞检测）

    核心策略：
    1. 使用 SAT（分离轴定理）进行精确的多边形碰撞检测
    2. Bottom-Left Fill 放置策略：在每个可用 X 位置找到最低的 Y
    3. 后置压缩（Compaction）：放置完成后将裁片向左/向下推紧
    4. 支持不规则形状（double_corner/single_corner）的真实轮廓碰撞
    """
    import time
    start_time = time.time()

    print(f"[排料算法] ========== 开始排料 (SAT多边形碰撞) ==========")
    print(f"[排料算法] 门幅宽度: {fabric_width_cm}cm, 缝份间隙: {seam_gap_cm}cm")

    if not pieces or fabric_width_cm <= 0:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}

    # ==================== Phase 1: 准备裁片（带真实顶点） ====================
    all_pieces = []
    for piece in pieces:
        w, h = piece.get("width", 0), piece.get("height", 0)
        shape = piece.get("shape", "rectangle")
        shoulder_width = piece.get("shoulder_width", 0)
        sleeve_cap_width = piece.get("sleeve_cap_width", 0)
        cuff_width = piece.get("cuff_width", 0)
        name = piece.get("name", "")
        color = piece.get("color", "#007bff")

        for _ in range(piece.get("count", 1)):
            if w <= 0 or h <= 0:
                continue
            if shape == "rectangle":
                vertices = [[0, 0], [w, 0], [w, h], [0, h]]
            else:
                vertices = generate_piece_vertices(w, h, shape, shoulder_width, sleeve_cap_width, cuff_width)
            real_area = polygon_area(vertices)
            all_pieces.append({
                "name": name, "width": w, "height": h,
                "color": color, "shape": shape,
                "shoulder_width": shoulder_width,
                "sleeve_cap_width": sleeve_cap_width,
                "cuff_width": cuff_width,
                "vertices": vertices,
                "real_area": real_area,
            })

    if not all_pieces:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}

    # 按真实面积降序排序（大裁片优先放置）
    all_pieces.sort(key=lambda p: -p["real_area"])
    total_real_area = sum(p["real_area"] for p in all_pieces)
    print(f"[排料算法] 裁片数: {len(all_pieces)}, 真实多边形总面积: {total_real_area:.2f}cm²")

    placed = []  # 已放置裁片列表，每项: {name, vertices (全局坐标), color, shape, ...}

    def get_rotated_vertices(vertices, do_rotate):
        """生成旋转后的顶点列表（绕原点旋转90度）"""
        if do_rotate:
            return rotate_vertices_ccw(vertices)
        return vertices

    # ==================== Phase 2: SAT 碰撞检测 ====================

    def try_place(x, y, test_vertices):
        """检查在 (x,y) 放置裁片是否与已放置的所有裁片碰撞"""
        if x < seam_gap_cm or y < seam_gap_cm:
            return False
        test_verts = [(x + vx, y + vy) for vx, vy in test_vertices]
        test_bbox = get_bounding_box_verts(test_verts)
        # 检查是否超出门幅或超出左边界
        if test_bbox[0] < seam_gap_cm or test_bbox[2] > fabric_width_cm - seam_gap_cm:
            return False
        for r in placed:
            if sat_collision(test_verts, r["vertices"]):
                return False
        return True

    def find_lowest_y_at_x(vertices, base_x):
        """在指定 X 找到最低可用 Y（布料顶部落下）"""
        bbox = get_bounding_box_verts(vertices)
        pw = bbox[2] - bbox[0]

        # 检查 base_x 是否在有效范围（左边界 + 右边界）
        if base_x < seam_gap_cm or base_x + pw > fabric_width_cm - seam_gap_cm:
            return None

        test_y = seam_gap_cm
        visited = set()

        while test_y < fabric_width_cm * 5:
            y_key = round(test_y, 1)
            if y_key in visited:
                break
            visited.add(y_key)

            test_verts = [(base_x + vx, test_y + vy) for vx, vy in vertices]

            collision_found = False
            lowest_below = float('inf')

            for r in placed:
                if sat_collision(test_verts, r["vertices"]):
                    collision_found = True
                    r_bbox = get_bounding_box_verts(r["vertices"])
                    new_y = r_bbox[3] + seam_gap_cm
                    if new_y < lowest_below:
                        lowest_below = new_y

            if not collision_found:
                return test_y

            if lowest_below > test_y + 0.01:
                test_y = lowest_below
            else:
                break

        return None

    def get_x_candidates(bbox_width):
        """生成 X 候选位置"""
        cands = {seam_gap_cm}
        for r in placed:
            rb = get_bounding_box_verts(r["vertices"])
            # 右边缘与门幅边界之间
            cands.add(rb[2] + seam_gap_cm)
            cands.add(rb[0] - bbox_width - seam_gap_cm)
        return sorted(x for x in cands if seam_gap_cm <= x and x + bbox_width + seam_gap_cm <= fabric_width_cm)

    def find_best_placement(piece):
        """找到最佳放置位置（得分越低越好）"""
        best = None
        best_score = float('inf')

        for do_rotate in ([False, True] if rotation else [False]):
            verts = get_rotated_vertices(piece["vertices"], do_rotate)
            bbox = get_bounding_box_verts(verts)
            pw = bbox[2] - bbox[0]

            if pw + seam_gap_cm * 2 > fabric_width_cm:
                continue

            for cx in get_x_candidates(pw):
                place_y = find_lowest_y_at_x(verts, cx)
                if place_y is not None:
                    score = place_y * fabric_width_cm + cx
                    if score < best_score:
                        best_score = score
                        ph = bbox[3] - bbox[1]
                        best = {
                            "x": cx, "y": place_y,
                            "vertices": verts,
                            "rotated": do_rotate,
                            "pw": pw, "ph": ph,
                        }

        return best

    # ==================== Phase 3: 主放置循环 ====================

    for piece in all_pieces:
        pos = find_best_placement(piece)
        if pos:
            translated = [(pos["x"] + vx, pos["y"] + vy) for vx, vy in pos["vertices"]]
            placed.append({
                "name": piece["name"],
                "vertices": translated,
                "x": pos["x"],
                "y": pos["y"],
                "w": pos["pw"],
                "h": pos["ph"],
                "color": piece["color"],
                "shape": piece["shape"],
                "shoulder_width": piece["shoulder_width"],
                "sleeve_cap_width": piece["sleeve_cap_width"],
                "cuff_width": piece["cuff_width"],
                "rotated": pos["rotated"],
                "real_area": piece["real_area"],
            })
        else:
            print(f"[排料警告] {piece['name']} 无法放入 (w={piece['width']:.0f} h={piece['height']:.0f})")

    # ==================== Phase 4: 后置压缩 Compaction ====================

    def compact_layout():
        """将放置的裁片依次向左/向下推紧"""
        improved = True
        for iteration in range(15):
            if not improved:
                break
            improved = False
            # 按 Y 坐标排序（从上到下），先压缩上方的裁片
            sorted_idx = sorted(range(len(placed)), key=lambda i: get_bounding_box_verts(placed[i]["vertices"])[1])
            for idx in sorted_idx:
                r = placed[idx]
                r_bbox = get_bounding_box_verts(r["vertices"])
                cur_x, cur_y = r_bbox[0], r_bbox[1]

                # 向左推（步长 0.5cm）
                dx = 0
                while cur_x + dx - 0.5 >= seam_gap_cm:
                    new_verts = [(vx - 0.5, vy) for vx, vy in r["vertices"]]
                    valid = True
                    for other in placed:
                        if other is r:
                            continue
                        if sat_collision(new_verts, other["vertices"]):
                            valid = False
                            break
                    if valid:
                        dx -= 0.5
                        r["vertices"] = new_verts
                        improved = True
                    else:
                        break

                # 向上推（向布料顶部，步长 0.5cm）
                dy = 0
                while cur_y + dy - 0.5 >= seam_gap_cm:
                    new_verts = [(vx, vy - 0.5) for vx, vy in r["vertices"]]
                    valid = True
                    for other in placed:
                        if other is r:
                            continue
                        if sat_collision(new_verts, other["vertices"]):
                            valid = False
                            break
                    if valid:
                        dy -= 0.5
                        r["vertices"] = new_verts
                        improved = True
                    else:
                        break

                # 更新 x/y/w/h 缓存
                final_bbox = get_bounding_box_verts(r["vertices"])
                r["x"] = final_bbox[0]
                r["y"] = final_bbox[1]
                r["w"] = final_bbox[2] - final_bbox[0]
                r["h"] = final_bbox[3] - final_bbox[1]

    compact_layout()

    # ==================== Phase 5: 输出格式化 ====================

    total_height = max(get_bounding_box_verts(r["vertices"])[3] for r in placed) if placed else 0
    util = total_real_area / (fabric_width_cm * total_height) if total_height > 0 else 0

    elapsed = time.time() - start_time
    print(f"[排料算法] 完成! 耗时:{elapsed:.3f}s, 总长:{total_height:.2f}cm, 利用率:{util*100:.2f}%")

    return {
        "total_length_cm": total_height,
        "rows": convert_to_rows_v2(placed, seam_gap_cm),
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
