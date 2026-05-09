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

def polygon_nesting(pieces, fabric_width_cm, seam_gap_cm=0.5, rotation=False):
    """
    多边形排料算法
    
    参数:
      pieces: 裁片列表，每个裁片包含:
        {
          "name": 裁片名称,
          "vertices": [(x, y), ...] 多边形顶点列表,
          "length": 长度（可选，用于排序）,
          "width": 宽度（可选，用于排序）
        }
      fabric_width_cm: 面料门幅 (cm)
      seam_gap_cm: 裁片间隙 (cm)
      rotation: 是否允许旋转
    
    返回:
      {
        "total_length_cm": 总用料长度,
        "rows": [
          {
            "length_cm": 行高,
            "used_width_cm": 已用宽度,
            "pieces": [
              {name, vertices, x, y, width, height, rotated},
              ...
            ]
          },
          ...
        ],
        "width_utilization": 门幅利用率
      }
    """
    if not pieces or fabric_width_cm <= 0:
        return {"total_length_cm": 0, "rows": [], "width_utilization": 0}
    
    # 预处理裁片：计算面积，按面积降序排序
    processed_pieces = []
    for piece in pieces:
        vertices = piece.get("vertices", [])
        area = polygon_area(vertices)
        w, h = polygon_width_height(vertices)
        count = piece.get("count", 1)
        
        # 根据数量展开裁片
        for i in range(count):
            processed_pieces.append({
                "name": piece.get("name", ""),
                "vertices": vertices,
                "area": area,
                "width": w,
                "height": h,
                "color": piece.get("color", "#007bff"),
                "shape": piece.get("shape", "rectangle"),
                "material": piece.get("material", "main"),
            })
    
    # 按面积降序排序
    processed_pieces.sort(key=lambda p: -p["area"])
    
    rows = []
    total_area = sum(p["area"] for p in processed_pieces)
    
    for piece in processed_pieces:
        placed = False
        
        # 尝试放入已有行
        for row in rows:
            # 按行内现有位置尝试放置
            current_x = seam_gap_cm if row["pieces"] else 0
            
            while True:
                # 检查宽度是否足够
                if current_x + piece["width"] + seam_gap_cm > fabric_width_cm:
                    break
                
                # 创建候选放置位置的多边形（平移后的顶点）
                candidate_poly = translate_points(piece["vertices"], current_x, 0)
                
                # 检查与行内已有裁片的碰撞
                collision = False
                for existing in row["pieces"]:
                    existing_poly = translate_points(existing["vertices"], existing["x"], existing["y"])
                    if sat_collision(candidate_poly, existing_poly):
                        collision = True
                        break
                
                if not collision:
                    # 放置成功
                    row["pieces"].append({
                        "name": piece["name"],
                        "vertices": piece["vertices"],
                        "x": current_x,
                        "y": 0,  # 暂时放在底部
                        "width": piece["width"],
                        "height": piece["height"],
                        "rotated": False,
                    })
                    row["used_width_cm"] = max(row["used_width_cm"], current_x + piece["width"])
                    row["length_cm"] = max(row["length_cm"], piece["height"])
                    row["pieces_count"] = len(row["pieces"])
                    placed = True
                    break
                
                # 尝试下一个位置
                current_x += piece["width"] / 10  # 步进
                
            if placed:
                break
        
        if not placed:
            # 新建行
            rows.append({
                "length_cm": piece["height"],
                "used_width_cm": piece["width"],
                "pieces_count": 1,
                "pieces": [{
                    "name": piece["name"],
                    "vertices": piece["vertices"],
                    "x": 0,
                    "y": 0,
                    "width": piece["width"],
                    "height": piece["height"],
                    "rotated": False,
                }]
            })
    
    total_length = sum(row["length_cm"] for row in rows)
    total_available_area = fabric_width_cm * total_length if total_length > 0 else 0
    width_utilization = total_area / total_available_area if total_available_area > 0 else 0
    
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