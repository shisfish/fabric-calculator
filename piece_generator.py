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
_CJK_FONT_AVAILABLE = True  # 默认为True，_get_font未找到CJK字体会设为False

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

    global _CJK_FONT_AVAILABLE
    _CJK_FONT_AVAILABLE = True  # 先假设找到，找不到才改False

    system = platform.system()
    candidates = []

    if system == "Darwin":
        candidates = [
            ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 0),
            ("/System/Library/Fonts/PingFang.ttc", 0),
            ("/System/Library/Fonts/STHeiti Medium.ttc", 0),
            ("/System/Library/Fonts/Hiragino Sans GB.ttc", 0),
            ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 0),
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
        # Linux — common Docker / server paths
        candidates = [
            ("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 0),
            ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf", 0),
            ("/usr/share/fonts/truetype/arphic/uming.ttc", 0),
            ("/usr/local/share/fonts/NotoSansSC-Regular.otf", 0),
            ("/usr/local/share/fonts/wqy-zenhei.ttc", 0),
            ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 0),
        ]

    for path, index in candidates:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, size, index=index)
                _FONT_CACHE[cache_key] = font
                return font
            except (IOError, OSError):
                continue

    # Linux fallback: try fc-match to find any CJK-supporting font
    if system != "Darwin" and system != "Windows":
        try:
            import subprocess
            result = subprocess.run(
                ['fc-match', '-f', '%{file}', 'sans:lang=zh'],
                capture_output=True, text=True, timeout=5
            )
            font_path = result.stdout.strip()
            if font_path and os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, size)
                    _FONT_CACHE[cache_key] = font
                    return font
                except (IOError, OSError):
                    pass
        except Exception:
            pass

    default = ImageFont.load_default()
    _CJK_FONT_AVAILABLE = False  # 无CJK字体，后续会降级为SVG渲染
    _FONT_CACHE[cache_key] = default
    return default


def _get_svg_font_family():
    """返回支持中文的SVG font-family字符串"""
    return ('font-family="PingFang SC, STHeiti, Hiragino Sans GB, '
            'Arial Unicode MS, AppleSDGothicNeo, Microsoft YaHei, '
            'WenQuanYi Zen Hei, Noto Sans CJK SC, sans-serif"')


def _svg_to_data_uri(svg_content):
    """将SVG内容转换为data:image/svg+xml;base64 URI（浏览器直接渲染，中文显示正常）"""
    import base64
    b64 = base64.b64encode(svg_content.encode('utf-8')).decode('ascii')
    return f"data:image/svg+xml;base64,{b64}"


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
            [_find_npx(), 'tsx', '--no-cache', 'cad_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"TypeScript执行错误: {result.stderr}")
            return {"pieces": [], "error": result.stderr}

        # 输出TypeScript的调试日志（stderr）
        if result.stderr:
            print(result.stderr, end='')

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
                "area": _calculate_polygon_area(piece['points']),
                # 🔧 【关键修复】保留原始 pathOps 数据（用于前端 Canvas 渲染）
                "pathOps": piece.get('pathOps', []),
                "points": piece.get('points', []),
                "seamAllowance": piece.get('seamAllowance', 0),
                "seamAllowancePathOps": piece.get('seamAllowancePathOps', [])
            })

        return {"pieces": pieces_with_svg}

    except subprocess.TimeoutExpired:
        return {"pieces": [], "error": "预览生成超时"}
    except Exception as e:
        print(f"CAD预览错误: {str(e)}")
        return {"pieces": [], "error": str(e)}


def generate_cad_nesting_result(measurements, options, fabric_width, shrinkage_rate,
                                 wastage_rate, fabric_weight_gsm, quantity, fabric_nap=False,
                                 custom_pieces=None):
    """
    CAD排料计算 - 基于实物测量数据生成裁片并排料
    """
    import subprocess
    import json

    if options is None:
        options = {}

    garment_input = _normalize_garment_input(measurements)

    ts_input = {
        "mode": "nesting",
        "garmentInput": garment_input,
        "options": options,
        "fabricWidth": fabric_width,
        "fabricNap": fabric_nap,
    }
    if custom_pieces:
        ts_input["customPieces"] = custom_pieces
    input_data = json.dumps(ts_input)

    base_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        result = subprocess.run(
            [_find_npx(), 'tsx', '--no-cache', 'cad_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"TypeScript执行错误: {result.stderr}")
            raise Exception(f"排料计算失败: {result.stderr}")

        # 输出TypeScript的调试日志（stderr）
        if result.stderr:
            print(result.stderr, end='')

        data = json.loads(result.stdout.strip())

        # 检测排料引擎返回的结构化错误（如方向违规）
        if isinstance(data, dict) and 'error' in data:
            raise Exception(f"排料引擎错误: {data.get('error', '未知错误')}")

        total_area_cm2 = data.get('totalArea', 0)
        used_area_cm2 = data.get('usedArea', 0)

        total_area_m2 = total_area_cm2 / 10000
        per_piece_length_m = data.get('bounds', {}).get('height', 0) / 100
        total_length_m = per_piece_length_m * quantity

        fabric_weight_kg = 0
        if fabric_weight_gsm > 0:
            fabric_weight_kg = (total_area_m2 * fabric_weight_gsm * (1 + wastage_rate / 100)) / 1000

        utilization_rate = data.get('utilization', 0)

        pieces = data.get('pieces', [])
        positions = data.get('positions', [])
        bounds = data.get('bounds', {})

        pieces_detail = []
        custom_name_set = {cp.get('name') for cp in (custom_pieces or [])}
        for p in pieces:
            area_cm2 = p.get('area', 0)
            is_custom = p.get('_custom', False) or p.get('name', '') in custom_name_set
            pd = {
                "name": p.get('name', ''),
                "original_length": round(p.get('height', 0), 2),
                "original_width": round(p.get('width', 0), 2),
                "count": p.get('cutCount', 1),
                "area_cm2": round(area_cm2, 2),
                "area_with_shrinkage_cm2": round(area_cm2 * (1 + shrinkage_rate / 100), 2),
                "material": "main",
                "on_fold": p.get('onFold', False),
                "is_custom": is_custom,
            }
            pieces_detail.append(pd)

        nesting_svg = _generate_nesting_svg(pieces, positions, fabric_width, bounds, utilization_rate)

        # 优先使用Pillow直接生成PNG（需要系统有CJK字体）
        if _CJK_FONT_AVAILABLE:
            nesting_png = _generate_nesting_png_direct(pieces, positions, fabric_width, bounds, utilization_rate)
            if not nesting_png:
                print("[PNG生成] Pillow渲染失败，改用SVG转换...")
                nesting_png = _generate_nesting_png_base64(nesting_svg)
        else:
            print("[PNG生成] 未找到CJK字体，使用SVG data URI直出（浏览器渲染中文）")
            nesting_png = _svg_to_data_uri(nesting_svg)

        return {
            "pieces": pieces,
            "positions": positions,
            "bounds": bounds,
            "nesting_svg": nesting_svg,
            "nesting_png_base64": nesting_png,
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


def _generate_rectangle_path_ops(w, h):
    """生成矩形裁片的 pathOps（用于前端 Canvas 渲染）"""
    return [
        {"type": "move", "to": {"x": 0, "y": 0}},
        {"type": "line", "to": {"x": w, "y": 0}},
        {"type": "line", "to": {"x": w, "y": h}},
        {"type": "line", "to": {"x": 0, "y": h}},
        {"type": "close"},
    ]


def _generate_rectangle_seam_ops(w, h, seam_allowance=1.5):
    """生成矩形裁片的缝份 pathOps"""
    sa = seam_allowance
    return [
        {"type": "move", "to": {"x": -sa, "y": -sa}},
        {"type": "line", "to": {"x": w + sa, "y": -sa}},
        {"type": "line", "to": {"x": w + sa, "y": h + sa}},
        {"type": "line", "to": {"x": -sa, "y": h + sa}},
        {"type": "close"},
    ]


def _calculate_industrial_biceps_width(cuff_width, chest_width, sleeve_length):
    """
    基于工业标准计算腋下半围（bicepWidth）
    
    工业比例规则：
    - 袖肥（腋下）与袖口的比例应为 1.5:1 ~ 1.8:1
    - 基于胸宽的参考：袖肥 ≈ 胸宽 × 0.28~0.32（半围）
    - 长袖比短袖略宽
    
    参数：
        cuff_width: 袖口半围 (cm)
        chest_width: 胸宽 (cm)
        sleeve_length: 袖长 (cm)
    
    返回：
        合理的腋下半围 (cm)
    """
    
    # 方法1：基于袖口比例（主要方法）
    # 工业标准：长袖T恤 腋下/袖口 ≈ 1.6~1.75
    if sleeve_length > 40:  # 长袖
        ratio = 1.65
    elif sleeve_length > 25:  # 中袖/七分袖
        ratio = 1.55
    else:  # 短袖
        ratio = 1.45
    
    bicep_from_cuff = cuff_width * ratio
    
    # 方法2：基于胸宽（参考值）
    bicep_from_chest = chest_width * 0.30  # 工业标准范围 0.28~0.32
    
    # 取两种方法的平均值，偏向袖口比例（更符合实际成衣）
    final_bicep = (bicep_from_cuff * 0.6 + bicep_from_chest * 0.4)
    
    # 四舍五入到0.5cm精度（工业制版习惯）
    final_bicep = round(final_bicep * 2) / 2
    
    print(f"[工业计算] bicepsWidth 计算:")
    print(f"   基于袖口 ({cuff_width} × {ratio}): {bicep_from_cuff:.2f} cm")
    print(f"   基于胸宽 ({chest_width} × 0.30): {bicep_from_chest:.2f} cm")
    print(f"   最终值: {final_bicep} cm")
    
    return final_bicep


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
        'bicepWidth': ('bicepWidth', 'bicepsWidth', '腋下围', 'bicep_width', 'biceps_width'),  # 新增：袖子参数
        'sleeveCapHeight': ('sleeveCapHeight', '袖山高', 'cap_height', 'sleeve_cap_height'),  # 新增：袖山高
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
    bicep_width = flat_result.get('bicepWidth')  # 新增：用户输入的腋下围
    sleeve_cap_height = flat_result.get('sleeveCapHeight')  # 新增：用户输入的袖山高
    shoulder_slope = flat_result.get('shoulderSlope', 5.5)

    print(f"[参数规范化] 输入参数提取完成:")
    print(f"   chestWidth: {chest_width}")
    print(f"   shoulderWidth: {shoulder_width}")
    print(f"   bodyLength: {body_length}")
    print(f"   sleeveLength: {sleeve_length}")
    print(f"   neckWidth: {neck_width}")
    print(f"   armholeDepth: {armhole_depth}")
    print(f"   🔍 [关键] cuffWidth (原始输入): {cuff_width} ← 检查这个值")
    print(f"   🔍 [关键] bicepWidth (原始输入): {bicep_width} ← 检查是否使用用户输入")
    print(f"   🔍 [关键] sleeveCapHeight (原始输入): {sleeve_cap_height} ← 检查是否使用用户输入")
    print(f"   shoulderSlope: {shoulder_slope}")

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
            'bicepWidth': bicep_width if bicep_width is not None else _calculate_industrial_biceps_width(cuff_width, chest_width, sleeve_length),  # 工业标准计算
            'cuffWidth': cuff_width,           # 直接使用用户输入的半围值，不翻倍
            'sleeveCapHeight': sleeve_cap_height if sleeve_cap_height is not None else armhole_depth * 0.45  # 优先使用用户输入
        }
    }

    print(f"[参数转换] 扁平化 → 嵌套结构")
    print(f"  输入: chestWidth={chest_width}, shoulderWidth={shoulder_width}")
    print(f"  转换: front.chestWidth={chest_width}, back.chestWidth={chest_width}")
    
    # 计算最终的bicepWidth（用于日志显示）
    final_bicep = bicep_width if bicep_width is not None else _calculate_industrial_biceps_width(cuff_width, chest_width, sleeve_length)
    
    print(f"  🔍 [最终sleeve参数]")
    print(f"     sleeveLength: {sleeve_length} cm")
    if bicep_width is not None:
        print(f"     bicepWidth: {final_bicep} cm ✅ (用户输入)")
    else:
        print(f"     bicepWidth: {final_bicep} cm 📐 (工业标准自动计算)")
    print(f"     cuffWidth: {cuff_width} cm ✅ (用户输入)")
    print(f"     sleeveCapHeight: {sleeve_cap_height if sleeve_cap_height is not None else armhole_depth * 0.45} cm (用户输入: {sleeve_cap_height})")
    print(f"  ⚠️ 袖子比例: 腋下/袖口 = {final_bicep/cuff_width:.2f}:1 (工业标准 1.5~1.8)")
    
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


def _get_path_ops_bbox(ops):
    """计算PathOperation数组的包围盒"""
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')
    for op in ops:
        for key in ('to', 'cp1', 'cp2'):
            pt = op.get(key)
            if pt and 'x' in pt and 'y' in pt:
                min_x = min(min_x, pt['x'])
                min_y = min(min_y, pt['y'])
                max_x = max(max_x, pt['x'])
                max_y = max(max_y, pt['y'])
    if min_x == float('inf'):
        return {'minX': 0, 'minY': 0, 'maxX': 0, 'maxY': 0}
    return {'minX': min_x, 'minY': min_y, 'maxX': max_x, 'maxY': max_y}


def _calculate_centroid(points):
    """从多边形顶点列表计算形心（鞋带公式）

    NestEngine使用形心作为旋转中心，SVG/PNG渲染必须使用相同的形心，
    否则旋转后位置与碰撞检测结果不一致，导致裁片重叠。
    """
    n = len(points)
    if n < 3:
        return (0.0, 0.0)
    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x0, y0 = points[i]
        x1, y1 = points[(i + 1) % n]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area *= 0.5
    if abs(area) < 1e-10:
        return (0.0, 0.0)
    cx /= (6.0 * area)
    cy /= (6.0 * area)
    return (cx, cy)


def _generate_nesting_svg(pieces, positions, fabric_width, bounds=None, utilization=0):
    """生成排料图SVG - 横向排列，门幅在左侧

    坐标系说明：
    - NestEngine原始坐标：X=门幅方向(0~fabricWidth)，Y=排料长度方向(0~length)
    - 屏幕横向排列：X=排料长度方向(水平)，Y=门幅方向(垂直，从上到下)
    - 变换公式：screenX = origY * scale + padding, screenY = origX * scale + padding + label_height
    """
    if not positions:
        return ""

    scale = 1.5
    padding = 20
    label_height = 30

    if bounds:
        nest_w = bounds.get('width', fabric_width)
        nest_h = bounds.get('height', 0)
    else:
        nest_w = fabric_width
        nest_h = max((pos.get('y', 0) + 50) for pos in positions) if positions else 50

    # 横向排列：排料长度→水平，门幅→垂直
    # 使用实际使用的门幅宽度(nest_w)裁剪画布高度，避免下方大量空白
    svg_w = int(nest_h * scale + padding * 2)
    svg_h = int(nest_w * scale + padding * 2 + label_height)

    ff = _get_svg_font_family()

    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w} {svg_h}" width="100%" height="auto">')

    # 顶部标注
    lines.append(f'<text x="{svg_w / 2}" y="{padding + 8}" '
                f'text-anchor="middle" font-size="13" fill="#555" '
                f'{ff}>'
                f'门幅: {fabric_width} cm (使用: {nest_w:.0f}cm) | 排料长度: {nest_h:.1f} cm | 利用率: {utilization:.1f}%'
                f'</text>')

    # 面料虚线框（横向：宽=排料长度，高=实际使用门幅）
    lines.append(f'<rect x="{padding}" y="{padding + label_height}" '
                f'width="{nest_h * scale}" height="{nest_w * scale}" '
                f'fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="8,4"/>')

    # 门幅标注（左侧竖向）- 显示实际使用宽度
    mid_y = padding + label_height + nest_w * scale / 2
    lines.append(f'<text x="{padding - 5}" y="{mid_y}" '
                f'text-anchor="end" font-size="10" fill="#999" '
                f'{ff}>'
                f'{nest_w:.0f}cm'
                f'</text>')

    # 排料长度标注（底部横向）
    mid_x = padding + nest_h * scale / 2
    lines.append(f'<text x="{mid_x}" y="{padding + label_height + nest_w * scale + 15}" '
                f'text-anchor="middle" font-size="10" fill="#999" '
                f'{ff}>'
                f'{nest_h:.1f}cm'
                f'</text>')

    piece_colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

    # 使用展开后的路径（expandedPathOps），兼容新旧数据
    piece_path_map = {}
    piece_onfold_map = {}
    for p in pieces:
        onfold = p.get('onFold', False)
        piece_onfold_map[p.get('name', '')] = onfold
        if onfold:
            piece_path_map[p.get('name', '')] = p.get('pathOps', [])
        else:
            piece_path_map[p.get('name', '')] = p.get('expandedPathOps') or p.get('pathOps', [])

    for i, pos in enumerate(positions):
        name = pos.get('name', '')
        pos_x = pos.get('x', 0)
        pos_y = pos.get('y', 0)
        rotation = pos.get('rotation', 0)

        path_ops = piece_path_map.get(name, [])
        onfold = piece_onfold_map.get(name, False)
        color = piece_colors[i % len(piece_colors)]

        if path_ops:
            pts_list = _extract_polygon_points(path_ops)
            if onfold and pts_list:
                mirrored = [(-x, y) for x, y in reversed(pts_list)]
                full_pts = pts_list + mirrored
            elif pts_list:
                full_pts = pts_list
            else:
                full_pts = []

            if full_pts and len(full_pts) >= 3:
                cx, cy = _calculate_centroid(full_pts)
                import math
                rad = rotation * math.pi / 180
                cos_r, sin_r = math.cos(rad), math.sin(rad)

                # 旋转 + 平移 + 坐标交换(X/Y) 一步完成
                # 1. 旋转：围绕形心(cx,cy)旋转
                # 2. 平移：加上排料位置(pos_x,pos_y)
                # 3. 坐标交换：origX→screenY, origY→screenX
                screen_pts = []
                for fx, fy in full_pts:
                    dx = fx - cx
                    dy = fy - cy
                    rx = pos_x + dx * cos_r - dy * sin_r + cx
                    ry = pos_y + dx * sin_r + dy * cos_r + cy
                    # 坐标交换：origX→screenY, origY→screenX
                    sx = ry * scale + padding
                    sy = rx * scale + padding + label_height
                    screen_pts.append((sx, sy))

                # 构建SVG polygon（用采样点，曲线精度足够）
                points_str = " ".join(f"{x:.2f},{y:.2f}" for x, y in screen_pts)
                lines.append(f'<polygon points="{points_str}" fill="none" stroke="{color}" stroke-width="1.5"/>')

                # 标签
                scx = sum(p[0] for p in screen_pts) / len(screen_pts)
                scy = sum(p[1] for p in screen_pts) / len(screen_pts)
                lines.append(f'<text x="{scx:.1f}" y="{scy:.1f}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="{color}" {ff}>{name}</text>')
            else:
                # fallback: 用bounding box
                bbox = _get_path_ops_bbox(path_ops)
                bw = (bbox['maxX'] - bbox['minX']) * scale
                bh = (bbox['maxY'] - bbox['minY']) * scale
                # 坐标交换后：bw→高，bh→宽
                sx = pos_y * scale + padding
                sy = pos_x * scale + padding + label_height
                lines.append(f'<rect x="{sx:.1f}" y="{sy:.1f}" width="{bh:.1f}" height="{bw:.1f}" '
                            f'fill="none" stroke="{color}" stroke-width="1.5" stroke-dasharray="3,2"/>')
                lines.append(f'<text x="{sx + bh/2:.1f}" y="{sy + bw/2:.1f}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="{color}" {ff}>{name}(简化)</text>')
        else:
            # 无路径fallback
            w = 50 * scale
            h = 80 * scale
            sx = pos_y * scale + padding
            sy = pos_x * scale + padding + label_height
            lines.append(f'<rect x="{sx:.1f}" y="{sy:.1f}" width="{w:.1f}" height="{h:.1f}" '
                        f'fill="none" stroke="{color}" stroke-width="1.5" stroke-dasharray="3,2"/>')
            lines.append(f'<text x="{sx + w/2:.1f}" y="{sy + h/2:.1f}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="{color}" {ff}>{name}(无路径)</text>')

    lines.append('</svg>')
    return "\n".join(lines)


def _extract_polygon_points(ops, steps_per_curve=50):
    """从PathOps提取多边形顶点（采样曲线段，忽略close操作）

    steps_per_curve: 每条曲线段的采样步数，必须与TypeScript的Path.toPoints(stepsPerCurve)一致。
    NestEngine使用默认50步，匹配此值确保形心计算精度一致。
    """
    points = []
    current = None
    for op in ops:
        op_type = op.get('type')
        if op_type == 'move':
            to = op.get('to')
            if to:
                current = (to['x'], to['y'])
                points.append(current)
        elif op_type == 'line':
            to = op.get('to')
            if to:
                current = (to['x'], to['y'])
                points.append(current)
        elif op_type == 'curve':
            cp1 = op.get('cp1')
            cp2 = op.get('cp2')
            to = op.get('to')
            if cp1 and cp2 and to and current:
                px0, py0 = current
                for step in range(1, steps_per_curve + 1):
                    t = step / steps_per_curve
                    mt = 1 - t
                    px = mt*mt*mt*px0 + 3*mt*mt*t*cp1['x'] + 3*mt*t*t*cp2['x'] + t*t*t*to['x']
                    py = mt*mt*mt*py0 + 3*mt*mt*t*cp1['y'] + 3*mt*t*t*cp2['y'] + t*t*t*to['y']
                    points.append((px, py))
                current = (to['x'], to['y'])
        elif op_type == 'quad':
            cp1 = op.get('cp1')
            to = op.get('to')
            if cp1 and to and current:
                px0, py0 = current
                for step in range(1, steps_per_curve + 1):
                    t = step / steps_per_curve
                    mt = 1 - t
                    px = mt*mt*px0 + 2*mt*t*cp1['x'] + t*t*to['x']
                    py = mt*mt*py0 + 2*mt*t*cp1['y'] + t*t*to['y']
                    points.append((px, py))
                current = (to['x'], to['y'])
    return points


def _generate_onfold_full_path(half_ops, scale=1):
    """
    为onFold裁片生成完整的镜像轮廓SVG路径字符串。

    核心思路：
    1. 从半片pathOps提取多边形顶点（采样曲线段）
    2. 沿Y轴（x=0）镜像得到另一半顶点
    3. 合并为完整外轮廓（不包含中心线）
    4. 返回SVG path d属性

    这样避免了两条子路径拼接导致的中心线可见问题。
    """
    # 提取半片顶点
    half_points = _extract_polygon_points(half_ops)

    if not half_points:
        return ""

    # 排除最后一点到第一点的闭合线（即中心线）
    # 半片路径的最后一个点通常在中心线（x≈0）上
    # 镜像反转后的另一半从中心线终点开始，沿外侧回到中心线起点
    mirrored = [(-x, y) for x, y in half_points]

    # 合并：半片 + 镜像反转（不包含首尾重复点）
    # half_points: 从 center-neck 顺时针到 center-hem
    # mirrored[::-1]: 从 center-hem 逆时针回到 center-neck
    combined = half_points + mirrored[::-1]

    # 构建单个连续SVG路径
    x0, y0 = combined[0]
    d = f"M {x0 * scale:.2f},{y0 * scale:.2f}"
    for x, y in combined[1:]:
        d += f" L {x * scale:.2f},{y * scale:.2f}"
    d += " Z"
    return d


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


def _generate_nesting_png_base64(svg_content):
    """将排料SVG转换为PNG base64"""
    if not svg_content:
        return None

    import base64
    import subprocess
    import tempfile
    import os

    # 方法1: 使用 rsvg-convert（Docker/linux 推荐）
    rsvg_paths = ['rsvg-convert', '/usr/bin/rsvg-convert']
    for rsvg in rsvg_paths:
        try:
            with tempfile.NamedTemporaryFile(suffix='.svg', mode='w', delete=False) as f:
                f.write(svg_content)
                svg_path = f.name

            png_path = svg_path + '.png'
            result = subprocess.run(
                [rsvg, '-w', '2048', '-f', 'png', '-o', png_path, svg_path],
                capture_output=True, timeout=30
            )

            if result.returncode == 0 and os.path.exists(png_path):
                with open(png_path, 'rb') as f:
                    png_data = f.read()
                try: os.unlink(svg_path)
                except: pass
                try: os.unlink(png_path)
                except: pass
                b64 = base64.b64encode(png_data).decode('ascii')
                return f"data:image/png;base64,{b64}"
            else:
                try: os.unlink(svg_path)
                except: pass
                try: os.unlink(png_path)
                except: pass
        except (FileNotFoundError, subprocess.TimeoutExpired):
            try: os.unlink(svg_path)
            except: pass
            continue

    # 方法2: macOS 使用 qlmanage
    try:
        with tempfile.NamedTemporaryFile(suffix='.svg', mode='w', delete=False) as f:
            f.write(svg_content)
            svg_path = f.name

        result = subprocess.run(
            ['qlmanage', '-t', '-s', '4096', '-o', os.path.dirname(svg_path), svg_path],
            capture_output=True, timeout=30
        )

        ql_png = svg_path + '.png'
        if os.path.exists(ql_png):
            with open(ql_png, 'rb') as f:
                png_data = f.read()
            try: os.unlink(svg_path)
            except: pass
            try: os.unlink(ql_png)
            except: pass
            b64 = base64.b64encode(png_data).decode('ascii')
            return f"data:image/png;base64,{b64}"
        else:
            try: os.unlink(svg_path)
            except: pass
    except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
        try: os.unlink(svg_path)
        except: pass
        pass

    # 方法3: 尝试 cairosvg
    try:
        import cairosvg
        png_data = cairosvg.svg2png(bytestring=svg_content.encode('utf-8'))
        b64 = base64.b64encode(png_data).decode('ascii')
        return f"data:image/png;base64,{b64}"
    except Exception:
        pass

    return None


def _generate_nesting_png_direct(pieces, positions, fabric_width, bounds=None, utilization=0):
    """
    直接使用Pillow生成排料PNG（不依赖外部工具）
    横向排列，门幅在左侧

    坐标系与SVG一致：
    - NestEngine原始坐标：X=门幅方向，Y=排料长度方向
    - 屏幕坐标：X=排料长度(水平)，Y=门幅(垂直)
    - 变换：screenX = origY * scale + padding, screenY = origX * scale + padding + label_height
    """
    if not positions:
        return None

    import base64
    import io
    import math
    from PIL import Image, ImageDraw, ImageFont

    scale = 3.0
    padding = 40
    label_height = 50

    if bounds:
        nest_w = bounds.get('width', fabric_width)
        nest_h = bounds.get('height', 0)
    else:
        nest_w = fabric_width
        nest_h = max((pos.get('y', 0) + 50) for pos in positions) if positions else 50

    # 横向排列：排料长度→水平，门幅→垂直
    # 使用实际使用的门幅宽度(nest_w)裁剪画布高度，避免下方大量空白
    img_width = int(nest_h * scale + padding * 2)
    img_height = int(nest_w * scale + padding * 2 + label_height)

    img = Image.new('RGB', (img_width, img_height), '#ffffff')
    draw = ImageDraw.Draw(img)

    # 绘制面料虚线框（横向：宽=排料长度，高=实际使用门幅）
    bx1 = int(padding)
    by1 = int(padding + label_height)
    bx2 = int(padding + nest_h * scale)
    by2 = int(padding + label_height + nest_w * scale)
    for dash_start in range(bx1, bx2, 20):
        dash_end = min(dash_start + 12, bx2)
        draw.line([(dash_start, by1), (dash_end, by1)], fill='#999999', width=2)
        draw.line([(dash_start, by2), (dash_end, by2)], fill='#999999', width=2)
    for dash_start in range(by1, by2, 20):
        dash_end = min(dash_start + 12, by2)
        draw.line([(bx1, dash_start), (bx1, dash_end)], fill='#999999', width=2)
        draw.line([(bx2, dash_start), (bx2, dash_end)], fill='#999999', width=2)

    # 顶部标注
    label_text = f"门幅: {fabric_width} cm (使用: {nest_w:.0f}cm) | 排料长度: {nest_h:.1f} cm | 利用率: {utilization:.1f}%"
    font_label = _get_font(16)
    draw.text((img_width // 2, padding + 8), label_text, fill='#555555', font=font_label, anchor='mt')

    # 门幅标注（左侧竖向）- 显示实际使用宽度
    font_dim = _get_font(12)
    mid_y = padding + label_height + nest_w * scale / 2
    draw.text((padding - 5, mid_y), f"{nest_w:.0f}cm", fill='#999999', font=font_dim, anchor='rm')

    # 排料长度标注（底部横向）
    mid_x = padding + nest_h * scale / 2
    draw.text((mid_x, by2 + 10), f"{nest_h:.1f}cm", fill='#999999', font=font_dim, anchor='mt')

    piece_colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

    # 构建piece路径映射（与SVG逻辑一致：onFold用pathOps+镜像，否则用expandedPathOps）
    piece_path_map = {}
    piece_onfold_map = {}
    for p in pieces:
        onfold = p.get('onFold', False)
        piece_onfold_map[p.get('name', '')] = onfold
        if onfold:
            piece_path_map[p.get('name', '')] = p.get('pathOps', [])
        else:
            piece_path_map[p.get('name', '')] = p.get('expandedPathOps') or p.get('pathOps', [])

    font_small = _get_font(10)

    for i, pos in enumerate(positions):
        name = pos.get('name', '')
        pos_x = pos.get('x', 0)
        pos_y = pos.get('y', 0)
        rotation = pos.get('rotation', 0)

        path_ops = piece_path_map.get(name, [])
        onfold = piece_onfold_map.get(name, False)
        color = piece_colors[i % len(piece_colors)]

        if path_ops:
            pts_list = _extract_polygon_points(path_ops)
            if onfold and pts_list:
                mirrored = [(-x, y) for x, y in reversed(pts_list)]
                full_pts = pts_list + mirrored
            elif pts_list:
                full_pts = pts_list
            else:
                full_pts = []

            if full_pts and len(full_pts) >= 3:
                cx, cy = _calculate_centroid(full_pts)
                rad = rotation * math.pi / 180
                cos_r, sin_r = math.cos(rad), math.sin(rad)
                # 旋转 + 平移 + 坐标交换(X/Y)
                vertices = []
                for fx, fy in full_pts:
                    dx = fx - cx
                    dy = fy - cy
                    rx = pos_x + dx * cos_r - dy * sin_r + cx
                    ry = pos_y + dx * sin_r + dy * cos_r + cy
                    # 坐标交换：origX→screenY, origY→screenX
                    vertices.append((
                        round(ry * scale + padding),
                        round(rx * scale + padding + label_height)
                    ))
                draw.polygon(vertices, fill=None, outline=color, width=2)
                scx = sum(v[0] for v in vertices) / len(vertices)
                scy = sum(v[1] for v in vertices) / len(vertices)
                draw.text((scx, scy), name, fill=color, font=font_small, anchor='mm')
        else:
            w = 50 * scale
            h = 80 * scale
            sx = round(pos_y * scale + padding)
            sy = round(pos_x * scale + padding + label_height)
            draw.rectangle([sx, sy, sx + round(w), sy + round(h)], fill=None, outline=color, width=2)
            draw.text((sx + w/2, sy + h/2), f"{name}(无路径)", fill=color, font=font_small, anchor='mm')

    # 转换为base64
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode('ascii')
    return f"data:image/png;base64,{b64}"


def _path_ops_to_vertices(ops, scale, offset_x, offset_y, padding):
    """
    将pathOps转换为多边形顶点列表（用于Pillow绘制）
    简化版：曲线段采样为多个点
    """
    if not ops:
        return []

    vertices = []
    current_x, current_y = 0, 0

    for op in ops:
        op_type = op.get('type')

        if op_type == 'move':
            to = op.get('to')
            if to:
                current_x = to['x']
                current_y = to['y']
                vertices.append((
                    (current_x + offset_x) * scale + padding,
                    (current_y + offset_y) * scale + padding
                ))

        elif op_type == 'line':
            to = op.get('to')
            if to:
                current_x = to['x']
                current_y = to['y']
                vertices.append((
                    (current_x + offset_x) * scale + padding,
                    (current_y + offset_y) * scale + padding
                ))

        elif op_type == 'curve':
            # 简化：曲线采样为多个点
            cp1 = op.get('cp1')
            cp2 = op.get('cp2')
            to = op.get('to')
            if cp1 and cp2 and to:
                # 采样5个点
                for t in [0.2, 0.4, 0.6, 0.8, 1.0]:
                    t2 = t * t
                    t3 = t2 * t
                    mt = 1 - t
                    mt2 = mt * mt
                    mt3 = mt2 * mt

                    px = mt3 * current_x + 3 * mt2 * t * cp1['x'] + 3 * mt * t2 * cp2['x'] + t3 * to['x']
                    py = mt3 * current_y + 3 * mt2 * t * cp1['y'] + 3 * mt * t2 * cp2['y'] + t3 * to['y']
                    vertices.append((
                        (px + offset_x) * scale + padding,
                        (py + offset_y) * scale + padding
                    ))
                current_x = to['x']
                current_y = to['y']

        elif op_type == 'quad':
            cp1 = op.get('cp1')
            to = op.get('to')
            if cp1 and to:
                for t in [0.25, 0.5, 0.75, 1.0]:
                    mt = 1 - t
                    px = mt * mt * current_x + 2 * mt * t * cp1['x'] + t * t * to['x']
                    py = mt * mt * current_y + 2 * mt * t * cp1['y'] + t * t * to['y']
                    vertices.append((
                        (px + offset_x) * scale + padding,
                        (py + offset_y) * scale + padding
                    ))
                current_x = to['x']
                current_y = to['y']

        elif op_type == 'close':
            pass

    return vertices
