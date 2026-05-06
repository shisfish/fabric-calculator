# -*- coding: utf-8 -*-
"""
图像测量引擎 - Image Measurement Engine
基于OpenCV的参照物测量系统，用于从照片中估算服装裁片尺寸

工作原理：
1. 用户上传衣服平铺照片（旁边放置参照物，如尺子）
2. 用户在图片上框选参照物区域，并输入参照物实际长度
3. 系统计算 pixels_per_cm 比例
4. 用户框选各裁片区域，系统自动计算实际尺寸
"""

import cv2
import numpy as np
import os
import uuid
import base64
from datetime import datetime

# 上传图片存储目录（与app.py保持一致，使用项目外部路径）
UPLOAD_DIR = os.path.join(
    os.environ.get('FABRIC_DATA_DIR', '/opt/fabric-data'), 'uploads'
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ImageMeasurementEngine:
    """图像测量引擎"""

    def __init__(self):
        self.sessions = {}  # 存储各会话的测量状态

    def _get_session(self, session_id):
        """获取或创建会话"""
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "image_path": None,
                "image_width": 0,
                "image_height": 0,
                "pixels_per_cm": None,
                "ref_rect": None,       # 参照物框选区域 {x1, y1, x2, y2}
                "ref_length_cm": None,  # 参照物实际长度(cm)
                "pieces": [],           # 裁片框选区域列表
            }
        return self.sessions[session_id]

    def upload_image(self, image_data, session_id=None):
        """
        上传并处理图片
        image_data: base64编码的图片数据 或 文件对象
        返回: {session_id, image_width, image_height, preview_url}
        """
        if session_id is None:
            session_id = str(uuid.uuid4())[:8]

        session = self._get_session(session_id)

        # 解码图片
        if isinstance(image_data, str):
            # base64 编码
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            img_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            # 文件对象
            file_stream = image_data.read()
            nparr = np.frombuffer(file_stream, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("无法解析图片，请确认图片格式正确")

        # 限制最大尺寸（防止内存问题）
        max_dim = 2000
        h, w = img.shape[:2]
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
            h, w = img.shape[:2]

        # 保存图片
        filename = f"{session_id}_{datetime.now().strftime('%H%M%S')}.jpg"
        filepath = os.path.join(UPLOAD_DIR, filename)
        cv2.imwrite(filepath, img, [cv2.IMWRITE_JPEG_QUALITY, 90])

        session["image_path"] = filepath
        session["image_width"] = w
        session["image_height"] = h
        session["pixels_per_cm"] = None
        session["ref_rect"] = None
        session["pieces"] = []

        return {
            "session_id": session_id,
            "image_width": w,
            "image_height": h,
        }

    def calibrate(self, session_id, ref_rect, ref_length_cm):
        """
        标定参照物，计算 pixels_per_cm

        ref_rect: {x1, y1, x2, y2} 框选区域的像素坐标
        ref_length_cm: 参照物的实际长度(cm)
        """
        session = self._get_session(session_id)
        if not session["image_path"]:
            raise ValueError("请先上传图片")

        session["ref_rect"] = ref_rect
        session["ref_length_cm"] = ref_length_cm

        # 计算参照物在图片中的像素长度（取较长边）
        dx = abs(ref_rect["x2"] - ref_rect["x1"])
        dy = abs(ref_rect["y2"] - ref_rect["y1"])
        ref_pixels = max(dx, dy)

        if ref_pixels <= 0:
            raise ValueError("参照物区域太小")

        pixels_per_cm = ref_pixels / ref_length_cm
        session["pixels_per_cm"] = pixels_per_cm

        return {
            "pixels_per_cm": round(pixels_per_cm, 2),
            "ref_pixels": ref_pixels,
            "ref_length_cm": ref_length_cm,
            "accuracy_hint": self._get_accuracy_hint(pixels_per_cm),
        }

    def measure_piece(self, session_id, piece_rect, piece_name="未命名"):
        """
        测量裁片区域

        piece_rect: {x1, y1, x2, y2} 框选区域的像素坐标
        返回: {length_cm, width_cm, area_cm2}
        """
        session = self._get_session(session_id)
        if session["pixels_per_cm"] is None:
            raise ValueError("请先标定参照物")

        ppc = session["pixels_per_cm"]

        # 计算像素尺寸
        dx = abs(piece_rect["x2"] - piece_rect["x1"])
        dy = abs(piece_rect["y2"] - piece_rect["y1"])

        # 转换为实际尺寸
        length_cm = max(dx, dy) / ppc
        width_cm = min(dx, dy) / ppc
        area_cm2 = length_cm * width_cm

        # 保存到会话
        piece_data = {
            "name": piece_name,
            "rect": piece_rect,
            "length_cm": round(length_cm, 1),
            "width_cm": round(width_cm, 1),
            "area_cm2": round(area_cm2, 1),
        }
        session["pieces"].append(piece_data)

        return piece_data

    def measure_all_pieces(self, session_id, pieces_data):
        """
        批量测量裁片

        pieces_data: [{name, rect: {x1,y1,x2,y2}}, ...]
        返回: [{name, length_cm, width_cm, area_cm2}, ...]
        """
        session = self._get_session(session_id)
        if session["pixels_per_cm"] is None:
            raise ValueError("请先标定参照物")

        # 清空之前的裁片数据
        session["pieces"] = []

        results = []
        for piece in pieces_data:
            result = self.measure_piece(
                session_id,
                piece["rect"],
                piece.get("name", "未命名")
            )
            results.append(result)

        return results

    def get_session_state(self, session_id):
        """获取会话状态"""
        session = self._get_session(session_id)
        return {
            "session_id": session_id,
            "image_width": session["image_width"],
            "image_height": session["image_height"],
            "pixels_per_cm": session["pixels_per_cm"],
            "ref_rect": session["ref_rect"],
            "ref_length_cm": session["ref_length_cm"],
            "pieces": session["pieces"],
        }

    def clear_session(self, session_id):
        """清除会话"""
        if session_id in self.sessions:
            del self.sessions[session_id]

    def _get_accuracy_hint(self, pixels_per_cm):
        """根据像素密度给出精度提示"""
        if pixels_per_cm >= 30:
            return "参照物清晰，测量精度较高"
        elif pixels_per_cm >= 15:
            return "参照物可见，测量精度中等"
        elif pixels_per_cm >= 8:
            return "参照物较小，建议靠近拍摄以提高精度"
        else:
            return "参照物太小，测量精度可能较低，建议使用更大的参照物或靠近拍摄"

    def draw_annotations(self, session_id):
        """
        在图片上绘制标注（参照物和裁片区域），返回标注后的图片base64
        """
        session = self._get_session(session_id)
        if not session["image_path"]:
            raise ValueError("请先上传图片")

        img = cv2.imread(session["image_path"])
        if img is None:
            raise ValueError("图片加载失败")

        # 绘制参照物
        if session["ref_rect"]:
            r = session["ref_rect"]
            cv2.rectangle(img, (r["x1"], r["y1"]), (r["x2"], r["y2"]),
                          (0, 255, 0), 2)  # 绿色
            label = f"参照物: {session['ref_length_cm']}cm"
            cv2.putText(img, label, (r["x1"], r["y1"] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # 绘制裁片
        colors = [
            (255, 0, 0), (0, 0, 255), (255, 165, 0), (255, 0, 255),
            (0, 255, 255), (128, 0, 128), (0, 128, 255), (255, 128, 0),
        ]
        for i, piece in enumerate(session["pieces"]):
            r = piece["rect"]
            color = colors[i % len(colors)]
            cv2.rectangle(img, (r["x1"], r["y1"]), (r["x2"], r["y2"]),
                          color, 2)
            label = f"{piece['name']}: {piece['length_cm']}x{piece['width_cm']}cm"
            cv2.putText(img, label, (r["x1"], r["y1"] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # 编码为base64
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{img_base64}"


# 全局实例
measurement_engine = ImageMeasurementEngine()
