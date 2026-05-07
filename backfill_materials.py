# -*- coding: utf-8 -*-
"""
回填脚本：将历史记录重新计算，写入 history_materials 表
用法：python backfill_materials.py
"""
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pymysql

# 数据库配置（和 db_manager.py 一致）
DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'fabric'),
    'password': os.environ.get('MYSQL_PASSWORD', 'fabric123'),
    'database': os.environ.get('MYSQL_DATABASE', 'fabric_calculator'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
}

MATERIAL_NAMES = {
    'main': '主面料', 'lining': '里布', 'interlining': '衬布',
    'filling_fabric_single': '胆料(单层)', 'filling_fabric_double': '胆料(双层)',
    'rib': '罗纹', 'other': '其他',
}


def get_connection():
    return pymysql.connect(**DB_CONFIG)


def get_records_without_materials(conn):
    """获取没有 history_materials 数据的记录"""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT h.id, h.type, h.category, h.fabric_width, h.fabric_type,
                   h.fabric_weight_gsm, h.shrinkage_rate, h.wastage_rate, h.quantity
            FROM calculation_history h
            LEFT JOIN history_materials m ON h.id = m.history_id
            WHERE m.id IS NULL AND h.type != 'quick'
            ORDER BY h.timestamp DESC
        """)
        return cursor.fetchall()


def get_pieces(conn, history_id):
    """获取裁片明细"""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT piece_name, original_length, original_width, piece_count,
                   shape, material, seam_allowance, piece_id,
                   shoulder_width, bicep_width, cuff_width
            FROM history_pieces WHERE history_id = %s
        """, (history_id,))
        rows = cursor.fetchall()
        pieces = []
        for r in rows:
            p = {
                'name': r['piece_name'],
                'length': float(r['original_length']) if r['original_length'] else 0,
                'width': float(r['original_width']) if r['original_width'] else 0,
                'count': int(r['piece_count']) if r['piece_count'] else 1,
                'material': r['material'] or '',
                'seam_allowance': float(r['seam_allowance']) if r['seam_allowance'] else 0,
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


def build_input_data(row, pieces):
    """组装 input_data"""
    return {
        'category': row['category'],
        'fabric_width': float(row['fabric_width']) if row['fabric_width'] else 145,
        'fabric_type': row['fabric_type'] or 'woven',
        'fabric_weight_gsm': float(row['fabric_weight_gsm']) if row['fabric_weight_gsm'] else 0,
        'shrinkage_rate': float(row['shrinkage_rate']) if row['shrinkage_rate'] is not None else 0,
        'wastage_rate': float(row['wastage_rate']) if row['wastage_rate'] is not None else 0,
        'quantity': int(row['quantity']) if row['quantity'] else 1,
        'pieces': pieces,
    }


def main():
    # 延迟导入计算引擎
    from calculator_engine import FabricCalculator
    from curved_engine import CurvedPieceCalculator as CurvedFabricCalculator

    calc = FabricCalculator()
    curved_calc = CurvedFabricCalculator()

    conn = get_connection()
    try:
        records = get_records_without_materials(conn)
        if not records:
            print('所有记录已有 history_materials 数据，无需回填。')
            return

        print(f'共 {len(records)} 条记录需要回填...')
        success = 0
        failed = 0

        for row in records:
            rid = row['id']
            rtype = row['type']
            try:
                pieces = get_pieces(conn, rid)
                if not pieces:
                    print(f'  跳过 {rid}：无裁片数据')
                    failed += 1
                    continue

                input_data = build_input_data(row, pieces)

                if rtype == 'curved':
                    full_result = curved_calc.calculate_consumption_curved(input_data)
                else:
                    full_result = calc.calculate_consumption(input_data)

                material_breakdown = full_result.get('material_breakdown', {})
                if not material_breakdown:
                    print(f'  跳过 {rid}：计算结果无 material_breakdown')
                    failed += 1
                    continue

                with conn.cursor() as cursor:
                    for mat_key, mat_val in material_breakdown.items():
                        cursor.execute("""
                            INSERT INTO history_materials
                            (history_id, material, material_name, length_m, area_m2, weight_kg, width_utilization)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            rid,
                            mat_key,
                            mat_val.get('name', ''),
                            mat_val.get('length_m'),
                            mat_val.get('area_m2'),
                            mat_val.get('weight_kg'),
                            mat_val.get('width_utilization'),
                        ))
                    conn.commit()

                mat_info = ', '.join(
                    f"{v.get('name', k)}={v.get('length_m')}m"
                    for k, v in material_breakdown.items()
                )
                print(f'  ✓ {rid} ({rtype}): {mat_info}')
                success += 1

            except Exception as e:
                print(f'  ✗ {rid} ({rtype}): {e}')
                failed += 1

        print(f'\n回填完成：成功 {success}，失败 {failed}，共 {len(records)} 条')

    finally:
        conn.close()


if __name__ == '__main__':
    main()
