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
from PIL import Image, ImageDraw, ImageFont

_FONT_CACHE = {}

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
    CAD裁片预览 - 基于人体参数生成裁片预览
    """
    import subprocess
    import json
    import sys
    
    if options is None:
        options = {}
    
    ts_script = '''
import { TshirtPatternGenerator } from './patterns/index.js';

const measurements = MEASUREMENTS_PLACEHOLDER;
const options = OPTIONS_PLACEHOLDER;

const generator = new TshirtPatternGenerator(measurements, options);
const pieces = generator.generate();

const result = pieces.map(piece => ({
    name: piece.name,
    points: Object.entries(piece.points).map(([key, p]) => ({
        key,
        x: p.x,
        y: p.y
    })),
    pathOps: piece.path.ops.map(op => ({
        type: op.type,
        to: op.to ? { x: op.to.x, y: op.to.y } : null,
        cp1: op.cp1 ? { x: op.cp1.x, y: op.cp1.y } : null,
        cp2: op.cp2 ? { x: op.cp2.x, y: op.cp2.y } : null
    })),
    cutCount: piece.cutCount,
    onFold: piece.onFold
}));

console.log(JSON.stringify(result));
'''.replace('MEASUREMENTS_PLACEHOLDER', json.dumps(measurements)) \
   .replace('OPTIONS_PLACEHOLDER', json.dumps(options))

    try:
        result = subprocess.run(
            ['npx', 'tsx', '-e', ts_script],
            capture_output=True,
            text=True,
            timeout=30
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
    CAD排料计算 - 基于人体参数生成裁片并排料
    """
    import subprocess
    import json
    
    if options is None:
        options = {}
    
    ts_script = '''
import { TshirtPatternGenerator } from './patterns/index.js';
import { PolygonConverter } from './nesting/index.js';
import { NestEngine } from './nesting/index.js';
import { SvgExporter } from './export/index.js';

const measurements = MEASUREMENTS_PLACEHOLDER;
const options = OPTIONS_PLACEHOLDER;
const fabricWidth = FABRIC_WIDTH_PLACEHOLDER;

const generator = new TshirtPatternGenerator(measurements, options);
const pieces = generator.generate();

const engine = new NestEngine({
    fabricWidth: fabricWidth,
    fabricHeight: 3000,
    spacing: 10,
    rotations: [0, 90, 180, 270]
});
engine.addPieces(pieces);
const result = engine.nest();

const piecesData = pieces.map(piece => {
    const bbox = piece.path.getBoundingBox();
    return {
        name: piece.name,
        cutCount: piece.cutCount,
        onFold: piece.onFold,
        width: bbox ? bbox.bottomRight.x - bbox.topLeft.x : 0,
        height: bbox ? bbox.bottomRight.y - bbox.topLeft.y : 0,
        area: piece.path.getArea ? piece.path.getArea() : 0
    };
});

const positions = result.positions.map(pos => ({
    pieceId: pos.pieceId,
    x: pos.x,
    y: pos.y,
    rotation: pos.rotation
}));

console.log(JSON.stringify({
    pieces: piecesData,
    positions: positions,
    utilization: result.utilization,
    bounds: result.bounds,
    totalArea: result.totalArea,
    usedArea: result.usedArea
}));
'''.replace('MEASUREMENTS_PLACEHOLDER', json.dumps(measurements)) \
   .replace('OPTIONS_PLACEHOLDER', json.dumps(options)) \
   .replace('FABRIC_WIDTH_PLACEHOLDER', str(fabric_width))

    try:
        result = subprocess.run(
            ['npx', 'tsx', '-e', ts_script],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            print(f"TypeScript执行错误: {result.stderr}")
            raise Exception(f"排料计算失败: {result.stderr}")
        
        data = json.loads(result.stdout.strip())
        
        total_area_cm2 = data.get('totalArea', 0) * 10000
        used_area_cm2 = data.get('usedArea', 0) * 10000
        
        total_area_m2 = total_area_cm2 / 10000
        per_piece_length_m = data.get('bounds', {}).get('width', 0) / 100
        total_length_m = per_piece_length_m * quantity
        
        fabric_weight_kg = 0
        if fabric_weight_gsm > 0:
            fabric_weight_kg = (total_area_m2 * fabric_weight_gsm * (1 + wastage_rate / 100)) / 1000
        
        utilization_rate = data.get('utilization', 0)
        
        pieces_detail = []
        for p in data.get('pieces', []):
            area_cm2 = p.get('area', 0) * 10000
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
    """生成排料图SVG"""
    if not positions:
        return ""
    
    scale = 0.5
    padding = 20
    
    max_x = max((p.get('x', 0) + p.get('width', 0)) for p in pieces) if pieces else fabric_width
    max_y = max((pos.get('y', 0) + 100) for pos in positions) if positions else 500
    
    svg_width = int(fabric_width * scale + padding * 2)
    svg_height = int(max_y * scale + padding * 2)
    
    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}">')
    lines.append(f'<rect x="{padding}" y="{padding}" width="{fabric_width * scale}" height="{max_y * scale}" '
                f'fill="none" stroke="#ccc" stroke-width="1" stroke-dasharray="5,3"/>')
    
    piece_colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    
    for i, pos in enumerate(positions):
        piece_id = pos.get('pieceId', '')
        x = pos.get('x', 0) * scale + padding
        y = pos.get('y', 0) * scale + padding
        rotation = pos.get('rotation', 0)
        
        piece = next((p for p in pieces if f"{p.get('name', '')}_0" == piece_id or 
                      piece_id.startswith(p.get('name', ''))), None)
        
        if piece:
            w = piece.get('width', 50) * scale
            h = piece.get('height', 50) * scale
            color = piece_colors[i % len(piece_colors)]
            
            lines.append(f'<g transform="translate({x:.1f}, {y:.1f}) rotate({rotation})">')
            lines.append(f'<rect x="0" y="0" width="{w:.1f}" height="{h:.1f}" '
                        f'fill="{color}33" stroke="{color}" stroke-width="1"/>')
            lines.append(f'<text x="{w/2:.1f}" y="{h/2:.1f}" text-anchor="middle" '
                        f'dominant-baseline="middle" font-size="10" fill="{color}">{piece.get("name", "")}</text>')
            lines.append('</g>')
    
    lines.append('</svg>')
    return "\n".join(lines)
