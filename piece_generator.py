# -*- coding: utf-8 -*-
"""
裁片独立图形生成模块

功能:
1. 为每个裁片生成独立的 PNG 图形（轮廓+尺寸标注+缝份线，无填充色）
2. 落库保存到 history_images 表
3. 排料时基于预生成的裁片图形进行布局
"""

import math
import base64
import io
import os
import platform
import shutil
from PIL import Image, ImageDraw, ImageFont

_FONT_CACHE = {}

def _find_npx():
    """查找npx可执行文件路径"""
    npx_path = shutil.which('npx')
    if npx_path:
        return npx_path
    common_paths = [
        os.path.expanduser('~/.nvm/versions/node/*/bin/npx'),
        '/usr/local/bin/npx',
        '/opt/homebrew/bin/npx',
    ]
    for p in common_paths:
        import glob
        matches = glob.glob(p)
        if matches:
            return matches[0]
    return 'npx'

def _get_font(size=14):
    cache_key = size
    if cache_key in _FONT_CACHE:
        return _FONT_CACHE[cache_key]

    system = platform.system()
    candidates = []

    if system == "Darwin":
        candidates = [
            ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 0),
            ("/System/Library/Fonts/PingFang.ttc", 0),
            ("/System/Library/Fonts/STHeiti Medium.ttc", 0),
            ("/System/Library/Fonts/Hiragino Sans GB.ttc", 0),
        ]
    elif system == "Windows":
        windir = os.environ.get("SystemRoot", "C:\\Windows")
        font_dir = os.path.join(windir, "Fonts")
        candidates = [
            (os.path.join(font_dir, "msyh.ttc"), 0),
            (os.path.join(font_dir, "msyhbd.ttc"), 0),
            (os.path.join(font_dir, "simsun.ttc"), 0),
            (os.path.join(font_dir, "simhei.ttf"), 0),
        ]
    else:
        candidates = [
            ("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 0),
            ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf", 0),
            ("/usr/share/fonts/truetype/arphic/uming.ttc", 0),
        ]

    for path, index in candidates:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, size, index=index)
                _FONT_CACHE[cache_key] = font
                return font
            except (IOError, OSError):
                continue

    default = ImageFont.load_default()
    _FONT_CACHE[cache_key] = default
    return default


def generate_piece_vertices(w, h, shape, shoulder_width=0, sleeve_cap_width=0, cuff_width=0):
    if shape == 'double_corner':
        sw = shoulder_width if shoulder_width > 0 else w * 0.8
        sd = h * 0.15
        tcx = (w - sw) / 2
        tcy = sd
        bcx = w * 0.15
        bcy = h * 0.9
        return [[tcx, 0], [w - tcx, 0], [w, tcy],
                [w, bcy], [w - bcx, h],
                [bcx, h], [0, bcy], [0, tcy]]
    elif shape == 'single_corner':
        scw = sleeve_cap_width if sleeve_cap_width > 0 else w
        cfw = cuff_width if cuff_width > 0 else w * 0.6
        cw = (scw - cfw) / 2
        ch = h * 0.2
        return [[0, 0], [w, 0], [w, h],
                [w - cw, h], [0, h - ch]]
    else:
        return [[0, 0], [w, 0], [w, h], [0, h]]


def rotate_vertices_90cw(vertices, orig_h):
    return [[orig_h - y, x] for x, y in vertices]


def generate_piece_image(piece_config, save_to_file=False, output_dir=None):
    name = piece_config.get("name", "裁片")
    width = float(piece_config.get("width", 0))
    height = float(piece_config.get("height", 0))
    shape = piece_config.get("shape", "rectangle")
    shoulder_width = float(piece_config.get("shoulder_width", 0))
    sleeve_cap_width = float(piece_config.get("sleeve_cap_width", 0))
    cuff_width = float(piece_config.get("cuff_width", 0))
    seam_allowance = float(piece_config.get("seam_allowance", 1.5))
    rotated = piece_config.get("rotated", False)
    count = int(piece_config.get("count", 1))

    if width <= 0 or height <= 0:
        return None

    verts = generate_piece_vertices(width, height, shape, shoulder_width,
                                     sleeve_cap_width, cuff_width)
    if rotated:
        verts = rotate_vertices_90cw(verts, height)

    piece_w = max(v[0] for v in verts)
    piece_h = max(v[1] for v in verts)

    display_w = piece_w + seam_allowance * 2
    display_h = piece_h + seam_allowance * 2

    padding = 50
    scale = min(320 / display_w, 240 / display_h)

    img_w = int(display_w * scale + padding * 2)
    img_h = int(display_h * scale + padding * 2 + 90)

    img = Image.new("RGB", (img_w, img_h), "#ffffff")
    draw = ImageDraw.Draw(img)

    font_title = _get_font(18)
    font_dim = _get_font(13)
    font_label = _get_font(11)

    cx = img_w // 2
    title_y = 12
    draw.text((cx, title_y), f"{name} ×{count}", fill="#1e293b", font=font_title, anchor="mt")

    ox = padding + seam_allowance * scale
    oy = padding + 35 + seam_allowance * scale

    scaled_verts = [(ox + v[0] * scale, oy + v[1] * scale) for v in verts]

    seam_scaled_verts = [(ox + (v[0] - seam_allowance) * scale,
                          oy + (v[1] - seam_allowance) * scale) if v[0] >= seam_allowance and v[1] >= seam_allowance
                         else (ox + max(0, v[0]) * scale,
                               oy + max(0, v[1]) * scale) for v in verts]

    outer_verts = [(ox + (v[0] + seam_allowance) * scale,
                    oy + (v[1] + seam_allowance) * scale) for v in verts]
    
    draw.polygon(outer_verts, outline="#cbd5e1", width=1)
    draw.polygon(scaled_verts, fill="#f8fafc", outline="#1e293b", width=2)

    for i, (vx, vy) in enumerate(scaled_verts):
        j = (i + 1) % len(scaled_verts)
        mx = (scaled_verts[i][0] + scaled_verts[j][0]) / 2
        my = (scaled_verts[i][1] + scaled_verts[j][1]) / 2
        dx = scaled_verts[j][0] - scaled_verts[i][0]
        dy = scaled_verts[j][1] - scaled_verts[i][1]
        dist = math.sqrt(dx * dx + dy * dy) / scale
        if dist > 5:
            label = f"{dist:.1f}"
            bbox = draw.textbbox((0, 0), label, font=font_dim)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            nx = mx - tw / 2
            ny = my - th / 2
            draw.rectangle([nx - 2, ny - 2, nx + tw + 2, ny + th + 2], fill="#ffffff")
            draw.text((mx, my), label, fill="#475569", font=font_dim, anchor="mm")

    info_y = oy + max(v[1] for v in verts) * scale + 25

    draw.text((cx, info_y), f"原始: {width:.1f} × {height:.1f} cm",
              fill="#64748b", font=font_dim, anchor="mt")

    draw.text((cx, info_y + 18), f"含缝份({seam_allowance}cm): {display_w:.1f} × {display_h:.1f} cm",
              fill="#64748b", font=font_dim, anchor="mt")

    shape_names = {"rectangle": "矩形", "double_corner": "双切角(前/后片)",
                   "single_corner": "单切角(袖子)"}
    shape_label = shape_names.get(shape, shape)
    rot_label = " ↻旋转" if rotated else ""
    draw.text((cx, info_y + 36), f"形状: {shape_label}{rot_label}",
              fill="#94a3b8", font=font_label, anchor="mt")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    base64_str = f"data:image/png;base64,{b64}"

    file_path = None
    if save_to_file:
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(__file__), "static", "calc_images")
        os.makedirs(output_dir, exist_ok=True)
        safe_name = "".join(c if c.isalnum() or c in "_-" else "_" for c in name)
        filename = f"{safe_name}_{'rot' if rotated else ''}_{width:.0f}x{height:.0f}.png"
        filepath = os.path.join(output_dir, filename)
        img.save(filepath, format="PNG")
        file_path = filepath

    return {
        "name": name,
        "base64": base64_str,
        "file_path": file_path,
        "width": width,
        "height": height,
        "shape": shape,
        "rotated": rotated,
        "vertices": verts,
        "count": count,
    }


def generate_all_pieces_images(pieces, fabric_width_cm=None, save_to_file=False):
    results = []

    for idx, piece in enumerate(pieces):
        w = piece.get("width", 0)
        h = piece.get("height", 0)
        count = piece.get("count", 1)
        name = piece.get("name", f"裁片{idx}")

        if w <= 0 or h <= 0:
            continue

        orientations = []
        orientations.append({**piece, "rotated": False})
        if abs(w - h) > 0.01:
            orientations.append({**piece, "rotated": True})

        for ori in orientations:
            result = generate_piece_image(ori, save_to_file=save_to_file)
            if result:
                results.append(result)

    return results


if __name__ == "__main__":
    test_pieces = [
        {"name": "后片", "width": 50, "height": 80, "count": 1,
         "shape": "double_corner", "shoulder_width": 40},
        {"name": "前片", "width": 50, "height": 70, "count": 2,
         "shape": "double_corner", "shoulder_width": 40},
        {"name": "袖子", "width": 20, "height": 60, "count": 2,
         "shape": "single_corner", "sleeve_cap_width": 20, "cuff_width": 12},
        {"name": "口袋", "width": 15, "height": 15, "count": 4,
         "shape": "rectangle"},
        {"name": "领口罗纹", "width": 10, "height": 30, "count": 1,
         "shape": "rectangle"},
    ]

    print("=" * 70)
    print("裁片独立图形生成测试")
    print("=" * 70)

    results = generate_all_pieces_images(test_pieces, save_to_file=True)

    for r in results:
        rot_str = " [旋转]" if r["rotated"] else ""
        print(f"\n{r['name']}×{r['count']}{rot_str}: {r['width']}×{r['height']} {r['shape']}")
        print(f"  顶点数: {len(r['vertices'])}")
        print(f"  文件: {r.get('file_path', 'N/A')}")


def generate_cad_pieces_preview(measurements, options=None):
    """
    CAD裁片预览 - 基于实物测量数据生成裁片预览
    """
    import subprocess
    import json

    if options is None:
        options = {}

    garment_input = _normalize_garment_input(measurements)

    input_data = json.dumps({
        "mode": "preview",
        "garmentInput": garment_input,
        "options": options
    })

    base_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        result = subprocess.run(
            [_find_npx(), 'tsx', 'cad_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"TypeScript执行错误: {result.stderr}")
            return {"pieces": [], "error": result.stderr}

        pieces = json.loads(result.stdout.strip())

        pieces_with_svg = []
        for piece in pieces:
            bbox = _calculate_bbox_from_points(piece['points'])
            svg_path = _generate_svg_path_from_ops(piece['pathOps'])

            pieces_with_svg.append({
                "name": piece['name'],
                "cutCount": piece['cutCount'],
                "onFold": piece['onFold'],
                "bbox": bbox,
                "svgPath": svg_path,
                "area": _calculate_polygon_area(piece['points'])
            })

        return {"pieces": pieces_with_svg}

    except subprocess.TimeoutExpired:
        return {"pieces": [], "error": "预览生成超时"}
    except Exception as e:
        print(f"CAD预览错误: {str(e)}")
        return {"pieces": [], "error": str(e)}


def generate_cad_nesting_result(measurements, options, fabric_width, shrinkage_rate, 
                                 wastage_rate, fabric_weight_gsm, quantity):
    """
    CAD排料计算 - 基于实物测量数据生成裁片并排料
    """
    import subprocess
    import json

    if options is None:
        options = {}

    garment_input = _normalize_garment_input(measurements)

    input_data = json.dumps({
        "mode": "nesting",
        "garmentInput": garment_input,
        "options": options,
        "fabricWidth": fabric_width
    })

    base_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        result = subprocess.run(
            [_find_npx(), 'tsx', 'cad_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"TypeScript执行错误: {result.stderr}")
            raise Exception(f"排料计算失败: {result.stderr}")

        data = json.loads(result.stdout.strip())

        total_area_cm2 = data.get('totalArea', 0)
        used_area_cm2 = data.get('usedArea', 0)

        total_area_m2 = total_area_cm2 / 10000
        per_piece_length_m = data.get('bounds', {}).get('height', 0) / 100
        total_length_m = per_piece_length_m * quantity

        fabric_weight_kg = 0
        if fabric_weight_gsm > 0:
            fabric_weight_kg = (total_area_m2 * fabric_weight_gsm * (1 + wastage_rate / 100)) / 1000

        utilization_rate = data.get('utilization', 0)

        pieces_detail = []
        for p in data.get('pieces', []):
            area_cm2 = p.get('area', 0)
            pieces_detail.append({
                "name": p.get('name', ''),
                "original_length": round(p.get('height', 0), 2),
                "original_width": round(p.get('width', 0), 2),
                "count": p.get('cutCount', 1),
                "area_cm2": round(area_cm2, 2),
                "area_with_shrinkage_cm2": round(area_cm2 * (1 + shrinkage_rate / 100), 2),
                "material": "main",
                "on_fold": p.get('onFold', False)
            })

        positions = data.get('positions', [])

        nesting_svg = _generate_nesting_svg(data.get('pieces', []), positions, fabric_width)

        return {
            "pieces": data.get('pieces', []),
            "positions": positions,
            "nesting_svg": nesting_svg,
            "pieces_detail": pieces_detail,
            "per_piece_length_m": round(per_piece_length_m, 3),
            "total_length_m": round(total_length_m, 2),
            "total_area_m2": round(total_area_m2, 4),
            "utilization_rate": round(utilization_rate, 1),
            "fabric_weight_kg": round(fabric_weight_kg, 3),
            "params": {
                "fabric_width": fabric_width,
                "shrinkage_rate": shrinkage_rate,
                "wastage_rate": wastage_rate,
                "fabric_weight_gsm": fabric_weight_gsm,
                "quantity": quantity,
                "measurements": measurements,
                "options": options
            },
            "material_breakdown": {
                "main": {
                    "name": "主面料",
                    "area_m2": round(total_area_m2, 4),
                    "length_m": round(total_length_m, 2),
                    "length_cm": round(total_length_m * 100, 1),
                    "weight_kg": round(fabric_weight_kg, 3),
                    "width_utilization": utilization_rate / 100
                }
            }
        }

    except subprocess.TimeoutExpired:
        raise Exception("排料计算超时")
    except json.JSONDecodeError as e:
        raise Exception(f"解析结果失败: {str(e)}")
    except Exception as e:
        raise e


def _normalize_garment_input(measurements):
    """
    将输入数据规范化为 garmentInput 格式（实物测量数据）

    重要：必须转换为嵌套结构 {front: {...}, back: {...}, sleeve: {...}}
    因为 GarmentMeasurementAdapter.adapt() 期望这种格式！
    """
    if not measurements:
        return {}

    # 提取扁平化字段
    garment_fields = {
        'chestWidth': ('chestWidth', '胸宽', '半胸宽', 'chest_width'),
        'shoulderWidth': ('shoulderWidth', '肩长', 'shoulder_width'),
        'bodyLength': ('bodyLength', '衣长', 'body_length'),
        'sleeveLength': ('sleeveLength', '袖长', 'sleeve_length'),
        'neckWidth': ('neckWidth', '领宽', 'neck_width'),
        'armholeDepth': ('armholeDepth', '袖窿深', 'armhole_depth'),
        'cuffWidth': ('cuffWidth', '袖口宽', 'cuff_width'),
        'hemCurve': ('hemCurve', '下摆弧度', 'hem_curve'),
        'shoulderSlope': ('shoulderSlope', '肩斜角', 'shoulder_slope'),
    }

    flat_result = {}
    for target, aliases in garment_fields.items():
        for alias in aliases:
            if alias in measurements and measurements[alias] is not None:
                flat_result[target] = float(measurements[alias])
                break

    legacy_map = {
        'chest': ('chestWidth', 0.52),
        'shoulderToShoulder': ('shoulderWidth', 1),
        'hpsToWaistBack': ('bodyLength', 1),
        'hpsToWaistFront': ('bodyLength', 1.05),
        'neck': ('neckWidth', 0.45),
        'biceps': ('armholeDepth', 0.55),
        'wrist': ('cuffWidth', 1.1),
        'shoulderSlope': ('shoulderSlope', 1),
    }

    for legacy_key, (target, factor) in legacy_map.items():
        if target not in flat_result and legacy_key in measurements:
            flat_result[target] = float(measurements[legacy_key]) * factor

    # 🔥 关键修复：将扁平化对象转换为嵌套结构
    chest_width = flat_result.get('chestWidth', 59)
    shoulder_width = flat_result.get('shoulderWidth', 19.5)
    body_length = flat_result.get('bodyLength', 68)
    sleeve_length = flat_result.get('sleeveLength', 60)
    neck_width = flat_result.get('neckWidth', 25)
    armhole_depth = flat_result.get('armholeDepth', 28)
    cuff_width = flat_result.get('cuffWidth', 10)
    shoulder_slope = flat_result.get('shoulderSlope', 5.5)

    # 计算领深（基于领宽的比例）
    front_neck_drop = neck_width * 0.34 if neck_width else 8.5
    back_neck_drop = neck_width * 0.10 if neck_width else 2.5

    # 转换为 GarmentMeasurementAdapter 期望的嵌套格式
    nested_result = {
        'garment': 'basic_tshirt',
        'front': {
            'chestWidth': chest_width,
            'bodyLength': body_length,
            'shoulderWidth': shoulder_width,
            'neckWidth': neck_width,
            'neckDrop': front_neck_drop,
            'armholeDepth': armhole_depth
        },
        'back': {
            'chestWidth': chest_width,
            'bodyLength': body_length,
            'shoulderWidth': shoulder_width,
            'neckWidth': neck_width,
            'neckDrop': back_neck_drop,
            'armholeDepth': armhole_depth
        },
        'sleeve': {
            'sleeveLength': sleeve_length,
            'bicepWidth': chest_width * 0.38,  # 基于胸宽估算
            'cuffWidth': cuff_width * 2,       # 袖口宽是半围，需要×2
            'sleeveCapHeight': armhole_depth * 0.45
        }
    }

    print(f"[参数转换] 扁平化 → 嵌套结构")
    print(f"  输入: chestWidth={chest_width}, shoulderWidth={shoulder_width}")
    print(f"  转换: front.chestWidth={chest_width}, back.chestWidth={chest_width}")
    
    return nested_result


def _calculate_bbox_from_points(points):
    """计算点集的边界框"""
    if not points:
        return {"minX": 0, "minY": 0, "maxX": 0, "maxY": 0, "width": 0, "height": 0}
    
    xs = [p['x'] for p in points]
    ys = [p['y'] for p in points]
    
    return {
        "minX": min(xs),
        "minY": min(ys),
        "maxX": max(xs),
        "maxY": max(ys),
        "width": max(xs) - min(xs),
        "height": max(ys) - min(ys)
    }


def _generate_svg_path_from_ops(ops):
    """从路径操作生成SVG路径字符串"""
    parts = []
    for op in ops:
        if op['type'] == 'M':
            parts.append(f"M {op['to']['x']:.2f} {op['to']['y']:.2f}")
        elif op['type'] == 'L':
            parts.append(f"L {op['to']['x']:.2f} {op['to']['y']:.2f}")
        elif op['type'] == 'C':
            parts.append(f"C {op['cp1']['x']:.2f} {op['cp1']['y']:.2f} "
                        f"{op['cp2']['x']:.2f} {op['cp2']['y']:.2f} "
                        f"{op['to']['x']:.2f} {op['to']['y']:.2f}")
        elif op['type'] == 'Z':
            parts.append("Z")
    return " ".join(parts)


def _calculate_polygon_area(points):
    """计算多边形面积"""
    if len(points) < 3:
        return 0
    
    n = len(points)
    area = 0
    for i in range(n):
        j = (i + 1) % n
        area += points[i]['x'] * points[j]['y']
        area -= points[j]['x'] * points[i]['y']
    return abs(area) / 2


def _generate_nesting_svg(pieces, positions, fabric_width):
    """生成排料图SVG - 基于真实Bezier路径"""
    if not positions:
        return ""
    
    scale = 0.5
    padding = 20
    
    max_x = fabric_width
    max_y = max((pos.get('y', 0) + 150) for pos in positions) if positions else 500
    
    svg_width = int(fabric_width * scale + padding * 2)
    svg_height = int(max_y * scale + padding * 2)
    
    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}">')
    lines.append(f'<rect x="{padding}" y="{padding}" width="{fabric_width * scale}" height="{max_y * scale}" '
                f'fill="none" stroke="#ccc" stroke-width="1" stroke-dasharray="5,3"/>')
    
    piece_colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    
    piece_path_map = {}
    for p in pieces:
        piece_path_map[p.get('name', '')] = p.get('pathOps', [])
    
    for i, pos in enumerate(positions):
        name = pos.get('name', '')
        x = pos.get('x', 0) * scale + padding
        y = pos.get('y', 0) * scale + padding
        rotation = pos.get('rotation', 0)
        
        path_ops = piece_path_map.get(name, [])
        color = piece_colors[i % len(piece_colors)]
        
        if path_ops:
            path_d = _convert_path_ops_to_svg_d(path_ops, scale)
            lines.append(f'<g transform="translate({x:.1f}, {y:.1f}) rotate({rotation})">')
            lines.append(f'<path d="{path_d}" fill="{color}33" stroke="{color}" stroke-width="1"/>')
            lines.append(f'<text x="5" y="-5" font-size="10" fill="{color}">{name}</text>')
            lines.append('</g>')
        else:
            w = 50 * scale
            h = 80 * scale
            lines.append(f'<g transform="translate({x:.1f}, {y:.1f}) rotate({rotation})">')
            lines.append(f'<rect x="0" y="0" width="{w:.1f}" height="{h:.1f}" '
                        f'fill="{color}33" stroke="{color}" stroke-width="1" stroke-dasharray="3,2"/>')
            lines.append(f'<text x="{w/2:.1f}" y="{h/2:.1f}" text-anchor="middle" '
                        f'dominant-baseline="middle" font-size="9" fill="{color}">{name}(无路径)</text>')
            lines.append('</g>')
    
    lines.append('</svg>')
    return "\n".join(lines)


def _convert_path_ops_to_svg_d(ops, scale=1):
    """将PathOperation数组转换为SVG d属性"""
    d_parts = []
    for op in ops:
        op_type = op.get('type')
        if op_type == 'move':
            to = op.get('to')
            if to:
                d_parts.append(f"M {to['x'] * scale:.2f},{to['y'] * scale:.2f}")
        elif op_type == 'line':
            to = op.get('to')
            if to:
                d_parts.append(f"L {to['x'] * scale:.2f},{to['y'] * scale:.2f}")
        elif op_type == 'curve':
            cp1 = op.get('cp1')
            cp2 = op.get('cp2')
            to = op.get('to')
            if cp1 and cp2 and to:
                d_parts.append(f"C {cp1['x'] * scale:.2f},{cp1['y'] * scale:.2f} "
                              f"{cp2['x'] * scale:.2f},{cp2['y'] * scale:.2f} "
                              f"{to['x'] * scale:.2f},{to['y'] * scale:.2f}")
        elif op_type == 'quad':
            cp1 = op.get('cp1')
            to = op.get('to')
            if cp1 and to:
                d_parts.append(f"Q {cp1['x'] * scale:.2f},{cp1['y'] * scale:.2f} "
                              f"{to['x'] * scale:.2f},{to['y'] * scale:.2f}")
        elif op_type == 'close':
            d_parts.append("Z")
    return " ".join(d_parts)
