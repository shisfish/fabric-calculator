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
