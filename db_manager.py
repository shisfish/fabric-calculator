# -*- coding: utf-8 -*-
"""
数据库管理模块 - MySQL历史记录存储（多表版）
"""

import os
import pymysql
from datetime import datetime
from contextlib import contextmanager


class DatabaseManager:
    """MySQL数据库管理器"""

    def __init__(self):
        self.host = os.environ.get('MYSQL_HOST', 'localhost')
        self.port = int(os.environ.get('MYSQL_PORT', 3306))
        self.user = os.environ.get('MYSQL_USER', 'fabric')
        self.password = os.environ.get('MYSQL_PASSWORD', 'fabric123')
        self.database = os.environ.get('MYSQL_DATABASE', 'fabric_calculator')

    @contextmanager
    def _get_connection(self):
        """获取数据库连接"""
        conn = None
        try:
            conn = pymysql.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()

    # ============================================================
    # 历史记录列表（主表）
    # ============================================================

    def load_history(self, limit=100):
        """加载历史记录列表"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, timestamp, type, category, category_name,
                           fabric_width, fabric_type, fabric_weight_gsm,
                           shrinkage_rate, wastage_rate, quantity,
                           per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg,
                           main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count
                    FROM calculation_history
                    ORDER BY timestamp DESC
                    LIMIT %s
                """, (limit,))
                rows = cursor.fetchall()

                history = []
                for row in rows:
                    params = self._build_params(row)
                    if row['type'] == 'quick':
                        qp = self._get_quick_params(conn, row['id'])
                        if qp:
                            params.update(qp)

                    result = self._build_result(row)
                    # 获取材料用量汇总
                    materials = self._get_materials_summary(conn, row['id'])
                    if materials:
                        result['materials'] = materials

                    record = {
                        "id": row['id'],
                        "timestamp": self._fmt_time(row['timestamp']),
                        "type": row['type'],
                        "category": row['category'],
                        "params": params,
                        "result": result,
                    }
                    history.append(record)
                return history

    def get_record(self, record_id):
        """获取单条记录详情"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM calculation_history WHERE id = %s", (record_id,))
                row = cursor.fetchone()
                if not row:
                    return None
                return self._row_to_record(conn, row)

    def _row_to_record(self, conn, row):
        """将数据库行转换为前端需要的记录格式"""
        params = self._build_params(row)
        result = self._build_result(row)
        pieces = self._get_pieces(conn, row['id'])
        quick_params = self._get_quick_params(conn, row['id']) if row['type'] == 'quick' else None
        piece_images, nesting_images = self._get_images(conn, row['id'])
        # 从平铺表重新组装 input_data（用于重新计算）
        input_data = self._build_input_data(conn, row, pieces, quick_params)

        return {
            "id": row['id'],
            "timestamp": self._fmt_time(row['timestamp']),
            "type": row['type'],
            "category": row['category'],
            "params": params,
            "result": result,
            "pieces": pieces,
            "quick_params": quick_params,
            "input_data": input_data,
            "piece_images": piece_images,
            "nesting_images": nesting_images,
        }

    # ============================================================
    # 保存记录
    # ============================================================

    def save_record(self, record):
        """保存单条记录（主表 + 裁片 + 快速估算参数 + 材料汇总 + 图片路径）"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                # 1. 写主表
                cursor.execute("""
                    INSERT INTO calculation_history
                    (id, timestamp, type, category, category_name,
                     fabric_width, fabric_type, fabric_weight_gsm,
                     shrinkage_rate, wastage_rate, quantity,
                     per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg,
                     main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                    timestamp = VALUES(timestamp),
                    type = VALUES(type),
                    category = VALUES(category),
                    category_name = VALUES(category_name),
                    fabric_width = VALUES(fabric_width),
                    fabric_type = VALUES(fabric_type),
                    fabric_weight_gsm = VALUES(fabric_weight_gsm),
                    shrinkage_rate = VALUES(shrinkage_rate),
                    wastage_rate = VALUES(wastage_rate),
                    quantity = VALUES(quantity),
                    per_piece_length_m = VALUES(per_piece_length_m),
                    total_area_m2 = VALUES(total_area_m2),
                    utilization_rate = VALUES(utilization_rate),
                    fabric_weight_kg = VALUES(fabric_weight_kg),
                    main_fabric_per_piece_m = VALUES(main_fabric_per_piece_m),
                    lining_per_piece_m = VALUES(lining_per_piece_m),
                    curved_pieces_count = VALUES(curved_pieces_count)
                """, self._extract_main_fields(record))

                # 2. 写裁片明细（先删后插）
                cursor.execute("DELETE FROM history_pieces WHERE history_id = %s", (record['id'],))
                pieces = record.get('input_data', {}).get('pieces', [])
                for p in pieces:
                    # 兼容多边形排料：pieces 中可能是 width/height 格式
                    length_val = p.get('length') or p.get('height')
                    width_val = p.get('width')
                    cursor.execute("""
                        INSERT INTO history_pieces
                        (history_id, piece_name, original_length, original_width,
                         piece_count, shape, material, seam_allowance,
                         piece_id, shoulder_width, bicep_width, cuff_width)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        record['id'],
                        p.get('name', ''),
                        length_val,
                        width_val,
                        p.get('count', 1),
                        p.get('shape', ''),
                        p.get('material', ''),
                        p.get('seam_allowance'),
                        p.get('id', ''),
                        p.get('shoulder_width'),
                        p.get('bicep_width'),
                        p.get('cuff_width'),
                    ))

                # 3. 写快速估算参数
                if record['type'] == 'quick':
                    cursor.execute("DELETE FROM history_quick_params WHERE history_id = %s", (record['id'],))
                    input_data = record.get('input_data', {})
                    cursor.execute("""
                        INSERT INTO history_quick_params
                        (history_id, garment_length, chest, shoulder, sleeve_length,
                         has_hood, has_lining, style_complexity)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        record['id'],
                        input_data.get('garment_length'),
                        input_data.get('chest'),
                        input_data.get('shoulder'),
                        input_data.get('sleeve_length'),
                        1 if input_data.get('has_hood') else 0,
                        1 if input_data.get('has_lining') else 0,
                        input_data.get('style_complexity'),
                    ))

                # 4. 写材料用量汇总
                cursor.execute("DELETE FROM history_materials WHERE history_id = %s", (record['id'],))
                full_result = record.get('full_result', {})
                material_breakdown = full_result.get('material_breakdown', {})
                for mat_key, mat_val in material_breakdown.items():
                    cursor.execute("""
                        INSERT INTO history_materials
                        (history_id, material, material_name, length_m, area_m2, weight_kg, width_utilization)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        record['id'],
                        mat_key,
                        mat_val.get('name', ''),
                        mat_val.get('length_m'),
                        mat_val.get('area_m2'),
                        mat_val.get('weight_kg'),
                        mat_val.get('width_utilization'),
                    ))

                # 5. 写图片路径（先删后插）
                cursor.execute("DELETE FROM history_images WHERE history_id = %s", (record['id'],))
                piece_images = full_result.get('piece_images', [])
                nesting_images = full_result.get('nesting_images', [])

                for idx, img_info in enumerate(piece_images):
                    file_path = img_info.get('file_path')
                    if file_path:
                        cursor.execute("""
                            INSERT INTO history_images
                            (history_id, image_type, image_name, image_path, image_order)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (
                            record['id'],
                            'piece',
                            img_info.get('name', ''),
                            file_path,
                            idx,
                        ))

                for idx, img_info in enumerate(nesting_images):
                    file_path = img_info.get('file_path')
                    if file_path:
                        cursor.execute("""
                            INSERT INTO history_images
                            (history_id, image_type, image_name, image_path, image_order)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (
                            record['id'],
                            'nesting',
                            img_info.get('material_name', ''),
                            file_path,
                            idx,
                        ))

            conn.commit()

    def _extract_main_fields(self, record):
        """从 record 字典提取主表字段"""
        params = record.get('params', {})
        result = record.get('result', {})
        input_data = record.get('input_data', {})

        cat_names = {
            'coat': '大衣', 'down_jacket': '羽绒服', 'jacket': '夹克',
            'windbreaker': '风衣', 'cotton_padded': '棉服', 'pants': '裤子',
            'skirt': '裙子', 'shirt': '衬衫', 'tshirt': 'T恤', 'custom': '自定义',
        }
        cat = record.get('category', '')
        cat_name = params.get('category', cat_names.get(cat, cat))

        return (
            record['id'],
            record['timestamp'],
            record['type'],
            cat,
            cat_name,
            params.get('fabric_width') or input_data.get('fabric_width'),
            params.get('fabric_type') or input_data.get('fabric_type'),
            params.get('fabric_weight_gsm') or input_data.get('fabric_weight_gsm'),
            params.get('shrinkage_rate') or input_data.get('shrinkage_rate'),
            params.get('wastage_rate') or input_data.get('wastage_rate'),
            params.get('quantity') or input_data.get('quantity'),
            result.get('per_piece_length_m'),
            result.get('total_area_m2'),
            result.get('utilization_rate'),
            result.get('fabric_weight_kg'),
            result.get('main_fabric_per_piece_m'),
            result.get('lining_per_piece_m'),
            result.get('curved_pieces_count'),
        )

    # ============================================================
    # 从平铺表重新组装 input_data（替代 JSON 快照）
    # ============================================================

    def _build_input_data(self, conn, row, pieces, quick_params):
        """从平铺表字段重新组装 input_data，用于重新计算"""
        input_data = {
            "category": row['category'] or 'custom',
            "fabric_width": float(row['fabric_width']) if row['fabric_width'] else 145,
            "fabric_type": row['fabric_type'] or 'woven',
            "fabric_weight_gsm": float(row['fabric_weight_gsm']) if row['fabric_weight_gsm'] else 0,
            "shrinkage_rate": float(row['shrinkage_rate']) if row['shrinkage_rate'] is not None else 0,
            "wastage_rate": float(row['wastage_rate']) if row['wastage_rate'] is not None else 0,
            "quantity": int(row['quantity']) if row['quantity'] else 1,
        }

        if row['type'] == 'quick' and quick_params:
            input_data.update({
                "garment_length": quick_params['garment_length'],
                "chest": quick_params['chest'],
                "shoulder": quick_params['shoulder'],
                "sleeve_length": quick_params['sleeve_length'],
                "has_hood": quick_params['has_hood'],
                "has_lining": quick_params['has_lining'],
                "style_complexity": quick_params['style_complexity'],
            })
        else:
            # precise / curved: 加入裁片数据
            input_data["pieces"] = pieces

        return input_data

    # ============================================================
    # 子表查询
    # ============================================================

    def _get_materials_summary(self, conn, history_id):
        """获取材料用量汇总（用于历史列表显示）"""
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT material, material_name, length_m
                FROM history_materials
                WHERE history_id = %s
                ORDER BY id
            """, (history_id,))
            rows = cursor.fetchall()
            if not rows:
                return None
            materials = {}
            for r in rows:
                name = r['material_name'] if r['material_name'] else (r['material'] or '未分类')
                length = float(r['length_m']) if r['length_m'] else 0
                materials[name] = round(length, 3)
            return materials

    def _get_pieces(self, conn, history_id):
        """获取裁片明细"""
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT piece_name, original_length, original_width, piece_count,
                       shape, material, seam_allowance, piece_id,
                       shoulder_width, bicep_width, cuff_width
                FROM history_pieces
                WHERE history_id = %s
            """, (history_id,))
            rows = cursor.fetchall()
            pieces = []
            for r in rows:
                p = {
                    "name": r['piece_name'],
                    "length": float(r['original_length']) if r['original_length'] else 0,
                    "width": float(r['original_width']) if r['original_width'] else 0,
                    "count": int(r['piece_count']) if r['piece_count'] else 1,
                    "material": r['material'] or '',
                    "seam_allowance": float(r['seam_allowance']) if r['seam_allowance'] else 0,
                }
                if r['shape']:
                    p['shape'] = r['shape']
                if r['piece_id']:
                    p['id'] = r['piece_id']
                if r['shoulder_width']:
                    p['shoulder_width'] = float(r['shoulder_width'])
                if r['bicep_width']:
                    p['bicep_width'] = float(r['bicep_width'])
                if r['cuff_width']:
                    p['cuff_width'] = float(r['cuff_width'])
                pieces.append(p)
            return pieces

    def load_dictionaries(self):
        """加载所有字典数据（用于前端缓存）"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT dict_type, dict_key, dict_value
                    FROM sys_dict
                    ORDER BY sort_order
                """)
                rows = cursor.fetchall()

        result = {}
        for row in rows:
            dict_type = row['dict_type']
            if dict_type not in result:
                result[dict_type] = {}
            result[dict_type][row['dict_key']] = row['dict_value']
        return result

    def _get_quick_params(self, conn, history_id):
        """获取快速估算参数"""
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT garment_length, chest, shoulder, sleeve_length,
                       has_hood, has_lining, style_complexity
                FROM history_quick_params
                WHERE history_id = %s
            """, (history_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return {
                'garment_length': float(row['garment_length']) if row['garment_length'] else 0,
                'chest': float(row['chest']) if row['chest'] else 0,
                'shoulder': float(row['shoulder']) if row['shoulder'] else 0,
                'sleeve_length': float(row['sleeve_length']) if row['sleeve_length'] else 0,
                'has_hood': bool(row['has_hood']),
                'has_lining': bool(row['has_lining']),
                'style_complexity': row['style_complexity'] or '',
            }

    def _get_images(self, conn, history_id):
        """获取图片路径"""
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT image_type, image_name, image_path, image_order
                FROM history_images
                WHERE history_id = %s
                ORDER BY image_type, image_order
            """, (history_id,))
            rows = cursor.fetchall()

        piece_images = []
        nesting_images = []
        for r in rows:
            img_info = {
                "name": r['image_name'],
                "file_path": r['image_path'],
            }
            if r['image_type'] == 'piece':
                piece_images.append(img_info)
            elif r['image_type'] == 'nesting':
                nesting_images.append({
                    "material": r['image_name'],
                    "material_name": r['image_name'],
                    "file_path": r['image_path'],
                })
        return piece_images, nesting_images

    # ============================================================
    # 辅助方法
    # ============================================================

    def _build_params(self, row):
        """从主表行构造 params"""
        params = {}
        if row.get('fabric_width'):
            params['fabric_width'] = float(row['fabric_width'])
        if row.get('fabric_type'):
            params['fabric_type'] = row['fabric_type']
        if row.get('fabric_weight_gsm'):
            params['fabric_weight_gsm'] = float(row['fabric_weight_gsm'])
        if row.get('quantity'):
            params['quantity'] = int(row['quantity'])
        if row.get('shrinkage_rate') is not None:
            params['shrinkage_rate'] = float(row['shrinkage_rate'])
        if row.get('wastage_rate') is not None:
            params['wastage_rate'] = float(row['wastage_rate'])
        return params

    def _build_result(self, row):
        """从主表行构造 result"""
        result = {}
        if row.get('per_piece_length_m') is not None:
            result['per_piece_length_m'] = float(row['per_piece_length_m'])
        if row.get('total_area_m2') is not None:
            result['total_area_m2'] = float(row['total_area_m2'])
        if row.get('utilization_rate') is not None:
            result['utilization_rate'] = float(row['utilization_rate'])
        if row.get('fabric_weight_kg') is not None:
            result['fabric_weight_kg'] = float(row['fabric_weight_kg'])
        if row.get('main_fabric_per_piece_m') is not None:
            result['main_fabric_per_piece_m'] = float(row['main_fabric_per_piece_m'])
        if row.get('lining_per_piece_m') is not None:
            result['lining_per_piece_m'] = float(row['lining_per_piece_m'])
        if row.get('curved_pieces_count') is not None:
            result['curved_pieces_count'] = int(row['curved_pieces_count'])
        return result

    @staticmethod
    def _fmt_time(val):
        """格式化时间"""
        if isinstance(val, datetime):
            return val.strftime('%Y-%m-%d %H:%M:%S')
        return str(val)

    # ============================================================
    # 删除 / 清空
    # ============================================================

    def delete_record(self, record_id):
        """删除单条记录（级联删除子表 + 图片文件）"""
        import os
        # 先获取图片路径
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT image_path FROM history_images WHERE history_id = %s", (record_id,))
                rows = cursor.fetchall()
                for row in rows:
                    if row['image_path']:
                        base_dir = os.path.dirname(os.path.abspath(__file__))
                        full_path = os.path.join(base_dir, row['image_path'])
                        if os.path.exists(full_path):
                            try:
                                os.remove(full_path)
                            except OSError as e:
                                print(f"[警告] 删除文件失败 {full_path}: {e}")

                cursor.execute("DELETE FROM history_pieces WHERE history_id = %s", (record_id,))
                cursor.execute("DELETE FROM history_quick_params WHERE history_id = %s", (record_id,))
                cursor.execute("DELETE FROM history_images WHERE history_id = %s", (record_id,))
                cursor.execute("DELETE FROM calculation_history WHERE id = %s", (record_id,))
            conn.commit()
            return cursor.rowcount > 0

    def clear_history(self):
        """清空所有历史记录（含图片文件）"""
        import os
        # 先删除所有图片文件
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT image_path FROM history_images")
                rows = cursor.fetchall()
                for row in rows:
                    if row['image_path']:
                        base_dir = os.path.dirname(os.path.abspath(__file__))
                        full_path = os.path.join(base_dir, row['image_path'])
                        if os.path.exists(full_path):
                            try:
                                os.remove(full_path)
                            except OSError as e:
                                print(f"[警告] 删除文件失败 {full_path}: {e}")

                cursor.execute("TRUNCATE TABLE history_pieces")
                cursor.execute("TRUNCATE TABLE history_quick_params")
                cursor.execute("TRUNCATE TABLE history_images")
                cursor.execute("TRUNCATE TABLE calculation_history")
            conn.commit()

    # ============================================================
    # 健康检查
    # ============================================================

    def check_health(self):
        """检查数据库连接状态"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) as count FROM calculation_history")
                    result = cursor.fetchone()
                    return {
                        "status": "connected",
                        "message": "MySQL连接正常",
                        "host": self.host,
                        "database": self.database,
                        "record_count": result['count']
                    }
        except Exception as e:
            return {
                "status": "error",
                "message": f"MySQL连接失败: {str(e)}",
                "host": self.host,
                "database": self.database
            }


# 全局数据库管理器实例
db_manager = DatabaseManager()
