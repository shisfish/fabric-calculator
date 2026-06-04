# -*- coding: utf-8 -*-
"""
数据库管理模块 - MySQL历史记录存储（多表版）
"""

import os
import json
import pymysql
import time
from pymysql import OperationalError
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
        """获取数据库连接（带重试机制）"""
        conn = None
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                conn = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    user=self.user,
                    password=self.password,
                    database=self.database,
                    charset='utf8mb4',
                    cursorclass=pymysql.cursors.DictCursor,
                    connect_timeout=10,      # 连接超时10秒
                    read_timeout=30,         # 读取超时30秒
                    write_timeout=30,        # 写入超时30秒
                    autocommit=False         # 手动事务控制
                )
                
                yield conn
                
                break  # 成功执行，退出循环
                
            except OperationalError as e:
                retry_count += 1
                
                if conn:
                    try:
                        conn.close()
                    except:
                        pass
                    conn = None
                
                if retry_count >= max_retries:
                    print(f"[DB] 数据库连接失败，已重试 {max_retries} 次: {e}")
                    raise e
                    
                wait_time = retry_count * 1  # 递增等待时间：1s, 2s, 3s
                print(f"[DB] 连接失败，第 {retry_count} 次重试... ({wait_time}s后)")
                time.sleep(wait_time)
                
            except Exception as e:
                if conn:
                    try:
                        conn.rollback()
                    except:
                        pass
                    try:
                        conn.close()
                    except:
                        pass
                raise e
            finally:
                if conn and retry_count < max_retries:
                    try:
                        conn.close()
                    except:
                        pass

    def _get_connection_for_save(self):
        """获取用于保存记录的数据库连接（autocommit模式，避免commit问题）"""
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                conn = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    user=self.user,
                    password=self.password,
                    database=self.database,
                    charset='utf8mb4',
                    cursorclass=pymysql.cursors.DictCursor,
                    connect_timeout=10,
                    read_timeout=30,
                    write_timeout=30,
                    autocommit=True  # ✅ 自动提交模式：每个操作立即生效
                )
                return conn
                
            except OperationalError as e:
                retry_count += 1
                if retry_count >= max_retries:
                    print(f"[DB] 数据库连接失败（保存专用），已重试 {max_retries} 次: {e}")
                    raise e
                    
                wait_time = retry_count * 1
                print(f"[DB] 连接失败，第 {retry_count} 次重试... ({wait_time}s后)")
                time.sleep(wait_time)
                
            except Exception as e:
                raise e

    # ============================================================
    # 历史记录列表（主表）
    # ============================================================

    def load_history(self, page=1, page_size=20, record_type=None, user_id=None):
        """
        加载历史记录列表（支持分页和类型筛选，可按用户过滤）

        Args:
            page: 页码（从1开始）
            page_size: 每页数量
            record_type: 筛选类型 (quick/precise/curved/polygon/cad)，None表示全部
            user_id: 用户ID（可选，如果提供则只返回该用户的数据）

        Returns:
            dict: {
                records: [...],
                pagination: {
                    total: 总数,
                    page: 当前页,
                    pageSize: 每页数量,
                    totalPages: 总页数
                }
            }
        """
        with self._get_connection() as conn:
            # 1. 统计总数
            count_sql = "SELECT COUNT(*) as total FROM calculation_history WHERE 1=1"
            count_params = []
            
            if record_type:
                count_sql += " AND type = %s"
                count_params.append(record_type)
            
            # 添加用户过滤条件
            if user_id:
                count_sql += " AND user_id = %s"
                count_params.append(user_id)

            with conn.cursor() as count_cursor:
                count_cursor.execute(count_sql, count_params)
                total = count_cursor.fetchone()['total']

            # 2. 计算分页参数
            offset = (page - 1) * page_size
            total_pages = (total + page_size - 1) // page_size if total > 0 else 1

            # 3. 查询当前页数据
            query_sql = """
                SELECT id, timestamp, type, category, category_name,
                       fabric_width, fabric_type, fabric_weight_gsm,
                       shrinkage_rate, wastage_rate, quantity,
                       per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg,
                       main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count
                FROM calculation_history
                WHERE 1=1
            """
            query_params = []

            if record_type:
                query_sql += " AND type = %s"
                query_params.append(record_type)
            
            # 添加用户过滤条件
            if user_id:
                query_sql += " AND user_id = %s"
                query_params.append(user_id)

            query_sql += " ORDER BY timestamp DESC LIMIT %s OFFSET %s"
            query_params.extend([page_size, offset])

            with conn.cursor() as cursor:
                cursor.execute(query_sql, query_params)
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

                return {
                    "records": history,
                    "pagination": {
                        "total": total,
                        "page": page,
                        "pageSize": page_size,
                        "totalPages": total_pages
                    }
                }

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
        piece_images, nesting_images, seam_images = self._get_images(conn, row['id'])
        # 从平铺表重新组装 input_data（用于重新计算）
        input_data = self._build_input_data(conn, row, pieces, quick_params)

        # 组装 full_result（从各子表重建完整数据）
        full_result = self._build_full_result(conn, row, pieces, piece_images, nesting_images, seam_images)

        record = {
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
            "seam_images": seam_images,
            "full_result": full_result,  # ✅ 新增：完整计算结果
        }
        snapshot = self._get_result_snapshot(conn, row['id'])
        if snapshot:
            record['params'] = snapshot.get('params') or record['params']
            record['result'] = snapshot.get('result') or record['result']
            record['input_data'] = snapshot.get('input_data') or record['input_data']
            record['full_result'] = snapshot.get('full_result') or record['full_result']

            full_snapshot = record.get('full_result') or {}
            record['piece_images'] = full_snapshot.get('piece_images') or record['piece_images']
            record['nesting_images'] = full_snapshot.get('nesting_images') or record['nesting_images']
            record['seam_images'] = full_snapshot.get('seam_images') or record['seam_images']
        return record

    # ============================================================
    # 保存记录
    # ============================================================

    def save_record(self, record):
        """保存单条记录（主表 + 裁片 + 快速估算参数 + 材料汇总 + 图片路径）"""
        conn = None
        try:
            conn = self._get_connection_for_save()
            
            # 获取当前用户ID（从record中传入）
            user_id = record.get('user_id')
            
            # 1. 写主表（包含 user_id）
            with conn.cursor() as cursor:
                cursor.execute("""
                INSERT INTO calculation_history
                (id, timestamp, type, category, category_name,
                 fabric_width, fabric_type, fabric_weight_gsm,
                 shrinkage_rate, wastage_rate, quantity,
                 per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg,
                 main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count,
                 user_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                curved_pieces_count = VALUES(curved_pieces_count),
                user_id = VALUES(user_id)
            """, self._extract_main_fields(record) + (user_id,))

            # 2. 写裁片明细（先删后插，包含 user_id）
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM history_pieces WHERE history_id = %s", (record['id'],))
                input_data = record.get('input_data', {})
                pieces = (input_data.get('pieces', []) or
                          input_data.get('measurements', {}).get('pieces', []))
                for p in pieces:
                    length_val = p.get('length') or p.get('height')
                    width_val = p.get('width')
                    cursor.execute("""
                        INSERT INTO history_pieces
                        (history_id, piece_name, original_length, original_width,
                         piece_count, shape, material, seam_allowance,
                         piece_id, shoulder_width, bicep_width, cuff_width,
                         user_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                        user_id,
                    ))

            # 3. 写快速估算参数（仅 quick 类型，包含 user_id）
            if record['type'] == 'quick':
                with conn.cursor() as cursor:
                    cursor.execute("DELETE FROM history_quick_params WHERE history_id = %s", (record['id'],))
                    input_data = record.get('input_data', {})
                    cursor.execute("""
                        INSERT INTO history_quick_params
                        (history_id, garment_length, chest, shoulder, sleeve_length,
                         has_hood, has_lining, style_complexity,
                         user_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        record['id'],
                        input_data.get('garment_length'),
                        input_data.get('chest'),
                        input_data.get('shoulder'),
                        input_data.get('sleeve_length'),
                        1 if input_data.get('has_hood') else 0,
                        1 if input_data.get('has_lining') else 0,
                        input_data.get('style_complexity'),
                        user_id,
                    ))

            # 4. ✅ 写材料用量汇总（所有类型共享）
            full_result = record.get('full_result', {})
            material_breakdown = full_result.get('material_breakdown', {})
            
            if material_breakdown:
                print(f"[DB] 💾 保存材料数据: {list(material_breakdown.keys())}")
                
                with conn.cursor() as cursor:
                    cursor.execute("DELETE FROM history_materials WHERE history_id = %s", (record['id'],))
                    
                    for mat_key, mat_val in material_breakdown.items():
                        safe_utilization = self._normalize_utilization_ratio(
                            mat_val.get('width_utilization')
                        )

                        cursor.execute("""
                            INSERT INTO history_materials
                            (history_id, material, material_name, length_m, area_m2, weight_kg, width_utilization,
                             user_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            record['id'],
                            mat_key,
                            mat_val.get('name', ''),
                            mat_val.get('length_m'),
                            mat_val.get('area_m2'),
                            mat_val.get('weight_kg'),
                            safe_utilization,
                            user_id,
                        ))
                        
                        print(f"   - {mat_val.get('name', mat_key)}: {mat_val.get('length_m')}m")
            else:
                print(f"[DB] ⚠️ 无 material_breakdown 数据，跳过保存")

            # 5. ✅ 写图片路径（所有类型共享，包含 user_id）
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM history_images WHERE history_id = %s", (record['id'],))
                piece_images = full_result.get('piece_images', [])
                nesting_images = full_result.get('nesting_images', [])
                
                image_count = 0

                for idx, img_info in enumerate(piece_images):
                    file_path = img_info.get('file_path')
                    if file_path:
                        cursor.execute("""
                            INSERT INTO history_images
                            (history_id, image_type, image_name, image_path, image_order,
                             user_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            record['id'],
                            'piece',
                            img_info.get('name', ''),
                            file_path,
                            idx,
                            user_id,
                        ))
                        image_count += 1

                for idx, img_info in enumerate(nesting_images):
                    file_path = img_info.get('file_path')
                    if file_path:
                        cursor.execute("""
                            INSERT INTO history_images
                            (history_id, image_type, image_name, image_path, image_order,
                             user_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            record['id'],
                            'nesting',
                            img_info.get('material_name', ''),
                            file_path,
                            idx,
                            user_id,
                        ))
                        image_count += 1

                seam_images = full_result.get('seam_images', [])
                for idx, img_info in enumerate(seam_images):
                    file_path = img_info.get('file_path')
                    if file_path:
                        cursor.execute("""
                            INSERT INTO history_images
                            (history_id, image_type, image_name, image_path, image_order,
                             user_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            record['id'],
                            'seam',
                            img_info.get('name', '缝份图'),
                            file_path,
                            idx,
                            user_id,
                        ))
                        image_count += 1
                
                if image_count > 0:
                    print(f"[DB] 💾 保存 {image_count} 张图片")

            self._save_result_snapshot(conn, record)
            print(f"[DB] ✅ 记录保存成功: {record.get('id', 'unknown')}")

        except OperationalError as e:
            print(f"[DB] ❌ 数据库连接错误: {type(e).__name__}: {str(e)}")
            print(f"  可能原因: MySQL服务未启动/网络中断/连接超时")
            print(f"  主机: {self.host}:{self.port}, 数据库: {self.database}")
            raise e
        except Exception as e:
            print(f"[DB] ❌ 保存记录失败: {type(e).__name__}: {str(e)}")
            import traceback
            print(f"  详细堆栈:\n{traceback.format_exc()}")
            raise e
        finally:
            if conn:
                try:
                    conn.close()
                except:
                    pass

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
            None,
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
        """获取图片路径（支持piece/seam/nesting三种类型）"""
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
        seam_images = []
        for r in rows:
            raw_path = r['image_path'] or ''
            file_path = self._normalize_static_path(raw_path)
            img_info = {
                "name": r['image_name'],
                "file_path": file_path,
            }
            if r['image_type'] == 'piece':
                piece_images.append(img_info)
            elif r['image_type'] == 'seam':
                seam_images.append(img_info)
            elif r['image_type'] == 'nesting':
                nesting_images.append({
                    "material": r['image_name'],
                    "material_name": r['image_name'],
                    "file_path": file_path,
                })
        return piece_images, nesting_images, seam_images

    def _build_full_result(self, conn, row, pieces, piece_images, nesting_images, seam_images):
        """
        从各子表重建完整的 full_result 数据
        
        用于历史记录详情页显示，包含：
        - material_breakdown: 材料用量汇总
        - piece_images: 裁片图片
        - nesting_images: 排料图片
        - seam_images: 缝份图片
        - pieces_detail: 裁片明细
        """
        full_result = {}
        
        # 1. 获取材料用量汇总（完整格式，用于详情页）
        # ✅ 直接查询数据库，避免依赖 _get_materials_summary() 的简化格式
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT material, material_name, length_m, area_m2, weight_kg, width_utilization
                    FROM history_materials
                    WHERE history_id = %s
                    ORDER BY id
                """, (row['id'],))
                mat_rows = cursor.fetchall()
                
                if mat_rows:
                    full_result['material_breakdown'] = {}
                    for r in mat_rows:
                        # 确保每行都是字典格式（DictCursor）
                        if isinstance(r, dict):
                            mat_key = r.get('material') or 'unknown'
                            mat_name = r.get('material_name', '') or mat_key
                            length_m = self._safe_float(r.get('length_m'))
                            area_m2 = self._safe_float(r.get('area_m2'))
                            weight_kg = self._safe_float(r.get('weight_kg'))
                            width_utilization = self._normalize_utilization_ratio(
                                r.get('width_utilization')
                            )
                            
                            full_result['material_breakdown'][mat_key] = {
                                "name": mat_name,
                                "length_m": length_m,
                                "area_m2": area_m2,
                                "weight_kg": weight_kg,
                                "width_utilization": width_utilization,
                            }
                    
                    print(f"[DB] ✅ _build_full_result: 从 history_materials 加载 {len(mat_rows)} 种材料")
                    if 'material_breakdown' in full_result:
                        for key, val in full_result['material_breakdown'].items():
                            print(f"   - {val['name']}: {val['length_m']}m")
                else:
                    print(f"[DB] ⚠️ _build_full_result: history_materials 表中无记录 {row['id']}")
        except Exception as e:
            print(f"[DB] ❌ _build_full_result 查询材料失败: {e}")
            # 查询失败时不中断，继续处理其他数据
        
        # 2. 添加图片数据
        if piece_images:
            full_result['piece_images'] = piece_images
        if nesting_images:
            full_result['nesting_images'] = nesting_images
        if seam_images:
            full_result['seam_images'] = seam_images
        
        # 3. 添加裁片明细（从 history_pieces 表）
        if pieces:
            full_result['pieces_detail'] = [
                {
                    "name": p.get('piece_name', ''),
                    "original_length": float(p.get('original_length', 0)) if p.get('original_length') else None,
                    "original_width": float(p.get('original_width', 0)) if p.get('original_width') else None,
                    "effective_length": None,  # 历史记录可能没有此字段
                    "effective_width": None,
                    "count": int(p.get('piece_count', 1)),
                    "calc_method": p.get('shape', '矩形'),
                    "area_cm2": None,
                    "area_with_shrinkage_cm2": None,
                    "material": p.get('material', ''),
                    "shoulder_width": p.get('shoulder_width'),
                    "bicep_width": p.get('bicep_width'),
                    "cuff_width": p.get('cuff_width'),
                }
                for p in pieces
                if p.get('piece_name')  # 过滤空记录
            ]
            
            print(f"[DB] ✅ _build_full_result: 从 history_pieces 加载 {len(full_result['pieces_detail'])} 个裁片")
        
        # 4. 添加主表统计数据
        if row.get('per_piece_length_m') is not None:
            full_result['per_piece_length_m'] = float(row['per_piece_length_m'])
        if row.get('total_area_m2') is not None:
            full_result['total_area_m2'] = float(row['total_area_m2'])
        if row.get('utilization_rate') is not None:
            full_result['utilization_rate'] = float(row['utilization_rate'])
        return full_result

    def _ensure_snapshot_table(self, conn):
        """Create the result snapshot table used by the rewritten detail page."""
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS history_result_snapshots (
                    history_id VARCHAR(20) PRIMARY KEY,
                    params_json LONGTEXT,
                    result_json LONGTEXT,
                    input_data_json LONGTEXT,
                    full_result_json LONGTEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)

    def _save_result_snapshot(self, conn, record):
        """Persist the calculation result exactly as produced, without large base64 blobs."""
        self._ensure_snapshot_table(conn)
        snapshot = {
            "params": self._strip_large_payloads(record.get("params") or {}),
            "result": self._strip_large_payloads(record.get("result") or {}),
            "input_data": self._strip_large_payloads(record.get("input_data") or {}),
            "full_result": self._strip_large_payloads(record.get("full_result") or {}),
        }
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO history_result_snapshots
                (history_id, params_json, result_json, input_data_json, full_result_json)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    params_json = VALUES(params_json),
                    result_json = VALUES(result_json),
                    input_data_json = VALUES(input_data_json),
                    full_result_json = VALUES(full_result_json),
                    updated_at = CURRENT_TIMESTAMP
            """, (
                record["id"],
                json.dumps(snapshot["params"], ensure_ascii=False, default=str),
                json.dumps(snapshot["result"], ensure_ascii=False, default=str),
                json.dumps(snapshot["input_data"], ensure_ascii=False, default=str),
                json.dumps(snapshot["full_result"], ensure_ascii=False, default=str),
            ))

    def _get_result_snapshot(self, conn, history_id):
        """Load the saved calculation snapshot. Missing tables are tolerated for old installs."""
        try:
            self._ensure_snapshot_table(conn)
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT params_json, result_json, input_data_json, full_result_json
                    FROM history_result_snapshots
                    WHERE history_id = %s
                """, (history_id,))
                row = cursor.fetchone()
            if not row:
                return None
            return {
                "params": self._loads_json(row.get("params_json")),
                "result": self._loads_json(row.get("result_json")),
                "input_data": self._loads_json(row.get("input_data_json")),
                "full_result": self._loads_json(row.get("full_result_json")),
            }
        except Exception as e:
            print(f"[DB] ⚠️ 读取结果快照失败: {e}")
            return None

    def _strip_large_payloads(self, value):
        """Remove inline image payloads before saving JSON snapshots."""
        if isinstance(value, dict):
            result = {}
            for key, item in value.items():
                lower_key = str(key).lower()
                if lower_key.endswith("_png_base64") or lower_key in {"image_base64", "base64"}:
                    continue
                result[key] = self._strip_large_payloads(item)
            return result
        if isinstance(value, list):
            return [self._strip_large_payloads(item) for item in value]
        return value

    @staticmethod
    def _loads_json(value):
        if not value:
            return {}
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return {}

    @staticmethod
    def _safe_float(value):
        """安全转换为 float，处理 None 和非法值"""
        if value is None:
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0

    @staticmethod
    def _normalize_utilization_ratio(value):
        """Normalize width utilization to a 0..1 ratio.

        Older history rows may store 88.3 while newer calculation engines return
        0.883. The frontend expects the ratio form and formats it as a percent.
        """
        if value is None:
            return 0.0
        try:
            util = float(value)
        except (ValueError, TypeError):
            return 0.0
        if util > 1:
            util = util / 100
        return round(max(0.0, min(util, 1.0)), 4)

    @staticmethod
    def _normalize_static_path(path):
        """Return a browser URL under /static for stored image paths."""
        if not path:
            return ''
        path = str(path).replace('\\', '/')
        if path.startswith('/static/'):
            return path
        if path.startswith('static/'):
            return '/' + path
        if path.startswith('/'):
            return path
        return f'/static/{path}'

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
                        base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'static')
                        full_path = os.path.join(base_dir, row['image_path'])
                        if os.path.exists(full_path):
                            try:
                                os.remove(full_path)
                            except OSError as e:
                                print(f"[警告] 删除文件失败 {full_path}: {e}")

                cursor.execute("DELETE FROM history_pieces WHERE history_id = %s", (record_id,))
                cursor.execute("DELETE FROM history_quick_params WHERE history_id = %s", (record_id,))
                cursor.execute("DELETE FROM history_images WHERE history_id = %s", (record_id,))
                self._ensure_snapshot_table(conn)
                cursor.execute("DELETE FROM history_result_snapshots WHERE history_id = %s", (record_id,))
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
                        base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'static')
                        full_path = os.path.join(base_dir, row['image_path'])
                        if os.path.exists(full_path):
                            try:
                                os.remove(full_path)
                            except OSError as e:
                                print(f"[警告] 删除文件失败 {full_path}: {e}")

                cursor.execute("TRUNCATE TABLE history_pieces")
                cursor.execute("TRUNCATE TABLE history_quick_params")
                cursor.execute("TRUNCATE TABLE history_images")
                self._ensure_snapshot_table(conn)
                cursor.execute("TRUNCATE TABLE history_result_snapshots")
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
