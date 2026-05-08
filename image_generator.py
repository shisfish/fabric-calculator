# -*- coding: utf-8 -*-
"""
裁片图片和排料图生成模块
使用 Pillow 生成 PNG 图片，返回 base64 编码
"""

import math
import base64
import io
from PIL import Image, ImageDraw, ImageFont


# ============================================================
# 字体配置
# ============================================================

def _get_font(size=14):
    """获取中文字体"""
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


# ============================================================
# 颜色配置
# ============================================================

PIECE_COLORS = {
    "front_body": ("#4a90d9", "#2c5f8a"),
    "back_body": ("#5ba0e9", "#3a6f9a"),
    "sleeve": ("#e07040", "#b05020"),
    "collar": ("#50c878", "#30a858"),
    "hood": ("#60d888", "#40b868"),
    "pocket": ("#f0c040", "#d0a020"),
    "belt": ("#a080d0", "#8060b0"),
    "cuff": ("#d080b0", "#b06090"),
    "lining": ("#80b0d0", "#6090b0"),
    "interlining": ("#b0b0b0", "#909090"),
    "collar_rib": ("#c0a060", "#a08040"),
    "bottom_rib": ("#d0b070", "#b09050"),
    "shell_fabric": ("#70a0c0", "#5080a0"),
    "filling_fabric_single": ("#90c0e0", "#70a0c0"),
    "filling_fabric_double": ("#a0d0f0", "#80b0d0"),
    "down_filling": ("#e0e0e0", "#c0c0c0"),
    "cotton_filling": ("#d8d8d8", "#b8b8b8"),
    "rib": ("#c0a060", "#a08040"),
    "other": ("#a0a0a0", "#808080"),
}

DEFAULT_COLOR = ("#a0a0a0", "#808080")


# ============================================================
# 裁片图片生成
# ============================================================

def generate_piece_image(piece, vertices=None):
    """
    生成单个裁片的图片

    参数:
        piece: dict, 裁片信息
        vertices: list, 曲线裁片的顶点列表 [(x,y), ...]，None 表示矩形

    返回:
        str: base64 编码的 PNG 图片 (data:image/png;base64,...)
    """
    piece_id = piece.get("id", "")
    piece_name = piece.get("name", "裁片")
    piece_count = piece.get("count", 1)
    length = float(piece.get("length", 0))
    width = float(piece.get("width", 0))
    seam_allowance = float(piece.get("seam_allowance", 1.5))
    calc_method = piece.get("calc_method", "rectangle")

    eff_length = length + seam_allowance * 2
    eff_width = width + seam_allowance * 2

    # 图片尺寸
    img_width = 420
    img_height = 340

    # 创建图片
    img = Image.new("RGB", (img_width, img_height), "#ffffff")
    draw = ImageDraw.Draw(img)

    # 字体
    font_title = _get_font(16)
    font_label = _get_font(12)
    font_dim = _get_font(11)
    font_small = _get_font(10)

    # 颜色
    fill_color, stroke_color = PIECE_COLORS.get(piece_id, DEFAULT_COLOR)

    # 标题区域
    title_y = 10
    draw.text((img_width // 2, title_y), f"{piece_name} ×{piece_count}",
              fill="#1e293b", font=font_title, anchor="mt")

    # 绘图区域（居中）
    draw_area_x = 30
    draw_area_y = 40
    draw_area_w = img_width - 60
    draw_area_h = img_height - 120

    if vertices and len(vertices) >= 3:
        # 曲线裁片：绘制多边形
        _draw_curved_piece(draw, vertices, draw_area_x, draw_area_y,
                           draw_area_w, draw_area_h, fill_color, stroke_color)
    else:
        # 矩形裁片：绘制矩形
        _draw_rect_piece(draw, eff_length, eff_width, draw_area_x, draw_area_y,
                         draw_area_w, draw_area_h, fill_color, stroke_color)

    # 底部信息
    info_y = img_height - 80

    # 原始尺寸
    draw.text((img_width // 2, info_y), f"原始尺寸: {length} × {width} cm",
              fill="#64748b", font=font_dim, anchor="mt")

    # 含缝份尺寸
    draw.text((img_width // 2, info_y + 18), f"含缝份: {eff_length:.1f} × {eff_width:.1f} cm",
              fill="#64748b", font=font_dim, anchor="mt")

    # 曲线计算额外信息
    if calc_method == "curved":
        area = piece.get("area_cm2", 0)
        rect_area = piece.get("rectangle_area_cm2", 0)
        diff = piece.get("difference_cm2", 0)
        pct = piece.get("difference_percent", 0)

        if rect_area > 0:
            y_offset = info_y + 40
            draw.text((img_width // 2, y_offset), f"曲线面积: {area} cm²",
                      fill="#2e7d32", font=font_small, anchor="mt")
            draw.text((img_width // 2, y_offset + 14), f"矩形面积: {rect_area} cm²",
                      fill="#999", font=font_small, anchor="mt")
            if diff > 0:
                draw.text((img_width // 2, y_offset + 28), f"节省: {diff} cm² ({pct}%)",
                          fill="#2e7d32", font=font_small, anchor="mt")
            elif diff < 0:
                draw.text((img_width // 2, y_offset + 28), f"增加: {abs(diff)} cm² ({abs(pct)}%)",
                          fill="#e65100", font=font_small, anchor="mt")

    # 转为 base64
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def _draw_curved_piece(draw, vertices, area_x, area_y, area_w, area_h, fill_color, stroke_color):
    """绘制曲线裁片"""
    # 计算边界框
    min_x = min(v[0] for v in vertices)
    max_x = max(v[0] for v in vertices)
    min_y = min(v[1] for v in vertices)
    max_y = max(v[1] for v in vertices)

    piece_w = max_x - min_x
    piece_h = max_y - min_y

    # 缩放比例
    scale = min(area_w / piece_w, area_h / piece_h) * 0.85

    # 居中偏移
    offset_x = area_x + (area_w - piece_w * scale) / 2 - min_x * scale
    offset_y = area_y + (area_h - piece_h * scale) / 2 - min_y * scale

    # 转换顶点
    scaled_vertices = [(v[0] * scale + offset_x, v[1] * scale + offset_y) for v in vertices]

    # 绘制多边形
    draw.polygon(scaled_vertices, fill=fill_color, outline=stroke_color, width=2)

    # 绘制缝份虚线框（外扩）
    seam_pixels = 1.5 * scale
    outer_vertices = [(v[0] - seam_pixels, v[1] - seam_pixels) for v in scaled_vertices]
    # 简化：只画一个外扩矩形示意
    outer_min_x = min(v[0] for v in scaled_vertices) - seam_pixels
    outer_min_y = min(v[1] for v in scaled_vertices) - seam_pixels
    outer_max_x = max(v[0] for v in scaled_vertices) + seam_pixels
    outer_max_y = max(v[1] for v in scaled_vertices) + seam_pixels
    draw.rectangle([outer_min_x, outer_min_y, outer_max_x, outer_max_y],
                   outline="#ccc", width=1)


def _draw_rect_piece(draw, length, width, area_x, area_y, area_w, area_h, fill_color, stroke_color):
    """绘制矩形裁片"""
    # 缩放比例
    scale = min(area_w / length, area_h / width) * 0.85

    rect_w = length * scale
    rect_h = width * scale

    # 居中
    rect_x = area_x + (area_w - rect_w) / 2
    rect_y = area_y + (area_h - rect_h) / 2

    # 绘制矩形
    draw.rectangle([rect_x, rect_y, rect_x + rect_w, rect_y + rect_h],
                   fill=fill_color, outline=stroke_color, width=2)

    # 标注尺寸
    font_dim = _get_font(11)
    # 长度标注（底部）
    draw.text((rect_x + rect_w / 2, rect_y + rect_h + 4), f"{length}cm",
              fill="#333", font=font_dim, anchor="mt")
    # 宽度标注（右侧）
    draw.text((rect_x + rect_w + 4, rect_y + rect_h / 2), f"{width}cm",
              fill="#333", font=font_dim, anchor="lm")


# ============================================================
# 排料图生成
# ============================================================

def generate_nesting_image(material_name, rows, fabric_width_cm, total_length_cm, width_utilization):
    """
    生成排料效果图

    参数:
        material_name: 材料名称
        rows: 排料行列表 [{"length_cm", "used_width_cm", "pieces_count"}, ...]
        fabric_width_cm: 面料门幅
        total_length_cm: 总用料长度
        width_utilization: 门幅利用率

    返回:
        str: base64 编码的 PNG 图片
    """
    if not rows:
        return None

    # 图片尺寸
    img_width = 800
    margin_top = 50
    margin_bottom = 60
    margin_left = 20
    margin_right = 20

    # 计算缩放比例
    available_w = img_width - margin_left - margin_right
    scale = available_w / fabric_width_cm

    # 计算总高度
    total_row_height = sum(row["length_cm"] for row in rows) * scale
    img_height = int(margin_top + total_row_height + margin_bottom + 40)
    img_height = max(img_height, 200)

    # 创建图片
    img = Image.new("RGB", (img_width, img_height), "#f8f9fa")
    draw = ImageDraw.Draw(img)

    font_title = _get_font(14)
    font_label = _get_font(11)
    font_small = _get_font(10)

    # 标题
    draw.text((img_width // 2, 10), f"{material_name} - 排料图",
              fill="#1e293b", font=font_title, anchor="mt")

    # 门幅标注
    draw.text((margin_left, 30), f"门幅: {fabric_width_cm}cm",
              fill="#64748b", font=font_label, anchor="lt")

    # 面料区域背景
    fabric_x = margin_left
    fabric_y = margin_top
    fabric_w = int(fabric_width_cm * scale)
    fabric_h = int(total_row_height)

    draw.rectangle([fabric_x, fabric_y, fabric_x + fabric_w, fabric_y + fabric_h],
                   fill="#e8edf2", outline="#ccc", width=1)

    # 绘制每一行
    colors = ["#4a90d9", "#e07040", "#50c878", "#f0c040", "#a080d0",
              "#d080b0", "#80b0d0", "#b0b0b0", "#c0a060", "#70a0c0"]

    current_y = fabric_y
    for idx, row in enumerate(rows):
        row_h = int(row["length_cm"] * scale)
        if row_h < 2:
            row_h = 2

        color = colors[idx % len(colors)]

        # 行背景
        draw.rectangle([fabric_x, current_y, fabric_x + fabric_w, current_y + row_h],
                       fill="#fff", outline="#ddd", width=1)

        # 裁片占位（简化显示：用色块表示）
        piece_w = int(row["used_width_cm"] * scale)
        draw.rectangle([fabric_x, current_y, fabric_x + piece_w, current_y + row_h],
                       fill=color, outline=color, width=1)

        # 行号
        draw.text((fabric_x + 4, current_y + row_h // 2), f"行{idx + 1}",
                  fill="#fff", font=font_small, anchor="lm")

        current_y += row_h

    # 底部信息
    info_y = fabric_y + fabric_h + 10
    draw.text((img_width // 2, info_y),
              f"总长度: {total_length_cm:.1f}cm  |  门幅利用率: {width_utilization * 100:.1f}%",
              fill="#1e293b", font=font_label, anchor="mt")

    # 转为 base64
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    return f"data:image/png;base64,{b64}"
