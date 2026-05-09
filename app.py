# -*- coding: utf-8 -*-
"""
面料用量快速计算系统 - Web服务
Fabric Consumption Quick Calculator
"""

from flask import Flask, render_template, request, jsonify, send_file
from calculator_engine import FabricCalculator, QuotationEngine
from curved_engine import CurvedPieceCalculator
from polygon_nesting import polygon_nesting
from image_engine import measurement_engine
from db_manager import db_manager
import json
import os
from datetime import datetime

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['JSON_AS_ASCII'] = False

calculator = FabricCalculator()
quotation_engine = QuotationEngine()
curved_calculator = CurvedPieceCalculator()

# 数据存储目录（使用项目外部路径，避免部署时被覆盖）
DATA_DIR = os.environ.get('FABRIC_DATA_DIR', '/opt/fabric-data')
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'uploads'), exist_ok=True)

# 项目内 uploads 目录
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================
# 页面路由
# ============================================================

@app.route('/')
def index():
    """首页 - 计算器"""
    return render_template('index.html')


@app.route('/curves')
def curves():
    """曲线模型计算页面"""
    return render_template('curves.html')


@app.route('/quick')
def quick_estimate():
    """快速估算页面"""
    return render_template('quick.html')


@app.route('/quotation')
def quotation():
    """报价单页面"""
    return render_template('quotation.html')


@app.route('/history')
def history():
    """历史记录页面"""
    return render_template('history.html')


@app.route('/history/<record_id>')
def history_detail(record_id):
    """历史记录详情页面"""
    return render_template('detail.html', record_id=record_id)


# ============================================================
# API 路由
# ============================================================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """获取所有品类"""
    return jsonify({"success": True, "data": calculator.get_categories()})


@app.route('/api/categories/<category_id>', methods=['GET'])
def get_category(category_id):
    """获取品类详情"""
    detail = calculator.get_category_detail(category_id)
    if detail:
        return jsonify({"success": True, "data": detail})
    return jsonify({"success": False, "message": "品类不存在"}), 404


@app.route('/api/dictionaries', methods=['GET'])
def get_dictionaries():
    """获取系统字典（品类、材料、形状名称映射）"""
    try:
        dicts = db_manager.load_dictionaries()
        return jsonify({"success": True, "data": dicts})
    except Exception as e:
        # 数据库可能未初始化或未连接，返回默认值
        default_dicts = {
            "category": {
                "coat": "大衣", "down_jacket": "羽绒服", "jacket": "夹克",
                "windbreaker": "风衣", "cotton_padded": "棉服", "pants": "裤子",
                "skirt": "裙子", "shirt": "衬衫", "tshirt": "T恤", "custom": "自定义"
            },
            "material": {
                "main": "主面料", "lining": "里布", "interlining": "衬布",
                "filling_fabric_single": "胆料(单层)", "filling_fabric_double": "胆料(双层)",
                "rib": "罗纹", "other": "其他"
            },
            "shape": {
                "rectangle": "矩形", "trapezoid": "梯形", "triangle": "三角形", "circle": "圆形"
            }
        }
        return jsonify({"success": True, "data": default_dicts})


@app.route('/api/fabric-types', methods=['GET'])
def get_fabric_types():
    """获取面料类型"""
    from calculator_engine import FABRIC_TYPES
    result = []
    for key, ft in FABRIC_TYPES.items():
        result.append({
            "id": key,
            "name": ft["name"],
            "description": ft["description"],
            "default_wastage": ft["default_wastage"],
            "typical_widths": ft["typical_widths"],
        })
    return jsonify({"success": True, "data": result})


@app.route('/api/calculate', methods=['POST'])
def calculate():
    """精确计算面料用量"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        result = calculator.calculate_consumption(data)

        # 保存到历史记录
        record = {
            "id": datetime.now().strftime("%Y%m%d%H%M%S"),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": "precise",
            "category": data.get("category", "custom"),
            "params": result.get("params", {}),
            "result": {
                "per_piece_length_m": result.get("per_piece_length_m"),
                "total_area_m2": result.get("total_area_m2"),
                "utilization_rate": result.get("utilization_rate"),
                "fabric_weight_kg": result.get("fabric_weight_kg"),
            },
            "input_data": data,
            "full_result": result,
        }
        db_manager.save_record(record)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "message": f"计算错误: {str(e)}"}), 500


@app.route('/api/quick-estimate', methods=['POST'])
def quick_estimate_api():
    """快速估算"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        result = calculator.quick_estimate(data)

        # 保存到历史记录
        record = {
            "id": datetime.now().strftime("%Y%m%d%H%M%S"),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": "quick",
            "category": data.get("category", "coat"),
            "params": result.get("params", {}),
            "result": {
                "main_fabric_per_piece_m": result.get("main_fabric", {}).get("per_piece_length_m"),
                "lining_per_piece_m": result.get("lining", {}).get("per_piece_length_m") if result.get("lining") else 0,
            },
            "input_data": data,
        }
        db_manager.save_record(record)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "message": f"估算错误: {str(e)}"}), 500


@app.route('/api/quotation', methods=['POST'])
def calculate_quotation():
    """计算报价"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        consumption_data = data.get("consumption_data", {})
        pricing_data = data.get("pricing_data", {})

        result = quotation_engine.calculate_quotation(consumption_data, pricing_data)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "message": f"报价计算错误: {str(e)}"}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """获取历史记录"""
    history = db_manager.load_history(limit=100)
    return jsonify({"success": True, "data": history})


@app.route('/api/history/<record_id>', methods=['GET'])
def get_history_detail(record_id):
    """获取单条历史记录详情（含重新计算的完整结果）"""
    record = db_manager.get_record(record_id)
    if not record:
        return jsonify({"success": False, "message": "记录不存在"}), 404

    # 重新调用计算引擎获取完整结果（pieces_detail、material_breakdown等）
    if record.get("input_data"):
        try:
            if record["type"] == "curved":
                full_result = curved_calculator.calculate_consumption_curved(record["input_data"])
            elif record["type"] == "quick":
                full_result = calculator.quick_estimate(record["input_data"])
            else:
                full_result = calculator.calculate_consumption(record["input_data"])
            record["full_result"] = full_result
        except Exception as e:
            import traceback
            record["full_result"] = None
            record["calc_error"] = f"无法重新计算完整结果: {str(e)}\n详细信息: {traceback.format_exc()}"

    # input_data 保留给详情页（返回修改功能需要）
    return jsonify({"success": True, "data": record})


@app.route('/api/history/<record_id>', methods=['DELETE'])
def delete_history(record_id):
    """删除历史记录"""
    db_manager.delete_record(record_id)
    return jsonify({"success": True, "message": "已删除"})


@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    """清空历史记录"""
    db_manager.clear_history()
    return jsonify({"success": True, "message": "已清空"})


# ============================================================
# AI图片识别 API
# ============================================================

@app.route('/api/image/upload', methods=['POST'])
def image_upload():
    """上传图片"""
    try:
        session_id = request.form.get('session_id')
        image_data = request.form.get('image_data')

        if not image_data:
            # 尝试从文件获取
            if 'file' not in request.files:
                return jsonify({"success": False, "message": "请提供图片"}), 400
            file = request.files['file']
            result = measurement_engine.upload_image(file, session_id)
        else:
            result = measurement_engine.upload_image(image_data, session_id)

        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "message": f"上传失败: {str(e)}"}), 500


@app.route('/api/image/calibrate', methods=['POST'])
def image_calibrate():
    """标定参照物"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        ref_rect = data.get('ref_rect')  # {x1, y1, x2, y2}
        ref_length_cm = float(data.get('ref_length_cm', 0))

        if not ref_rect or ref_length_cm <= 0:
            return jsonify({"success": False, "message": "请提供参照物区域和实际长度"}), 400

        result = measurement_engine.calibrate(session_id, ref_rect, ref_length_cm)
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "message": f"标定失败: {str(e)}"}), 500


@app.route('/api/image/measure', methods=['POST'])
def image_measure():
    """测量裁片区域"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        pieces_data = data.get('pieces', [])  # [{name, rect: {x1,y1,x2,y2}}, ...]

        if not pieces_data:
            return jsonify({"success": False, "message": "请提供裁片区域数据"}), 400

        results = measurement_engine.measure_all_pieces(session_id, pieces_data)
        return jsonify({"success": True, "data": results})
    except Exception as e:
        return jsonify({"success": False, "message": f"测量失败: {str(e)}"}), 500


@app.route('/api/image/annotate', methods=['POST'])
def image_annotate():
    """获取标注后的图片"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        img_base64 = measurement_engine.draw_annotations(session_id)
        return jsonify({"success": True, "data": {"image": img_base64}})
    except Exception as e:
        return jsonify({"success": False, "message": f"标注失败: {str(e)}"}), 500


@app.route('/api/image/session/<session_id>', methods=['GET'])
def image_session(session_id):
    """获取会话状态"""
    state = measurement_engine.get_session_state(session_id)
    return jsonify({"success": True, "data": state})


# ============================================================
# 辅助函数
# ============================================================

def _attach_pieces_to_rows(rows, piece_details):
    """将裁片详情关联到排料行，用于排料图绘制"""
    if not rows or not piece_details:
        return
    idx = 0
    for row in rows:
        row_pieces = []
        count = row.get("pieces_count", 0)
        for _ in range(count):
            if idx < len(piece_details):
                row_pieces.append(piece_details[idx])
                idx += 1
        row["pieces"] = row_pieces


# ============================================================
# 曲线衣片计算 API（独立模块，不影响现有接口）
# ============================================================

@app.route('/api/calculate-curved', methods=['POST'])
def calculate_curved():
    """曲线模型精确计算面料用量"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        result = curved_calculator.calculate_consumption_curved(data)

        # 生成记录ID
        record_id = datetime.now().strftime("%Y%m%d%H%M%S")

        # 保存图片到文件系统
        try:
            from image_generator import generate_piece_image, generate_nesting_image
            from calculator_engine import simulate_nesting

            piece_image_data = result.get("_piece_image_data", [])
            material_piece_details = result.get("_material_piece_details", {})
            effective_fabric_width = float(data.get("fabric_width", 145)) - 3

            # 生成并保存裁片图片
            piece_images = []
            for idx, (piece_info, vertices) in enumerate(piece_image_data):
                img_result = generate_piece_image(piece_info, vertices, save_to_file=True, history_id=record_id, image_order=idx)
                piece_images.append({
                    "name": piece_info["name"],
                    "image_base64": img_result["base64"],
                    "file_path": img_result["file_path"],
                    "calc_method": piece_info["calc_method"],
                })
            result["piece_images"] = piece_images

            # 生成并保存排料图
            nesting_images = []
            for idx, (mat_type, breakdown) in enumerate(result.get("material_breakdown", {}).items()):
                mat_piece_details_list = material_piece_details.get(mat_type, [])
                # 直接使用裁片详情（包含 name, length, width, vertices）
                nesting_result = simulate_nesting(mat_piece_details_list, effective_fabric_width)

                img_result = generate_nesting_image(
                    material_name=breakdown["name"],
                    rows=nesting_result["rows"],
                    fabric_width_cm=effective_fabric_width,
                    total_length_cm=breakdown["length_cm"],
                    width_utilization=nesting_result["width_utilization"],
                    save_to_file=True,
                    history_id=record_id,
                    image_order=idx,
                )
                nesting_images.append({
                    "material": mat_type,
                    "material_name": breakdown["name"],
                    "image_base64": img_result["base64"],
                    "file_path": img_result["file_path"],
                })
            result["nesting_images"] = nesting_images

            # 清理内部数据
            result.pop("_piece_image_data", None)
            result.pop("_material_piece_details", None)

        except Exception as e:
            print(f"保存图片失败: {e}")
            result["piece_images"] = []
            result["nesting_images"] = []

        # 保存到历史记录
        record = {
            "id": record_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": "curved",
            "category": data.get("category", "custom"),
            "params": result.get("params", {}),
            "result": {
                "per_piece_length_m": result.get("per_piece_length_m"),
                "total_area_m2": result.get("total_area_m2"),
                "utilization_rate": result.get("utilization_rate"),
                "fabric_weight_kg": result.get("fabric_weight_kg"),
                "curved_pieces_count": result.get("curved_pieces_count", 0),
            },
            "input_data": data,
            "full_result": result,
        }
        db_manager.save_record(record)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "message": f"曲线计算错误: {str(e)}"}), 500


# ============================================================
# 健康检查 API
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    db_health = db_manager.check_health()
    return jsonify({
        "success": True,
        "data": {
            "status": "healthy",
            "database": db_health
        }
    })


# ============================================================
# 多边形排料模块
# ============================================================

@app.route('/polygon-nesting')
def polygon_nesting_page():
    """多边形排料页面"""
    return render_template('polygon_nesting.html')

@app.route('/api/polygon-nesting', methods=['POST'])
def api_polygon_nesting():
    """多边形排料API"""
    import time
    start_time = time.time()
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400
        
        pieces = data.get("pieces", [])
        fabric_width = float(data.get("fabric_width", 140))
        shrinkage_rate = float(data.get("shrinkage_rate", 3))
        wastage_rate = float(data.get("wastage_rate", 8))
        fabric_weight_gsm = float(data.get("fabric_weight_gsm", 0))
        quantity = int(data.get("quantity", 1))
        
        print(f"[API] 收到排料请求: {len(pieces)}种裁片, 门幅{fabric_width}cm")
        
        # 执行多边形排料
        nesting_result = polygon_nesting(pieces, fabric_width)
        
        # 构建裁片明细
        pieces_detail = []
        material_areas = {}
        material_pieces = {}
        
        for piece in pieces:
            w = piece.get("width", 0)
            h = piece.get("height", 0)
            count = piece.get("count", 1)
            material = piece.get("material", "main")
            seam_allowance = piece.get("seam_allowance", 1.5)
            shoulder_width = piece.get("shoulder_width", 0)
            sleeve_cap_width = piece.get("sleeve_cap_width", 0)
            cuff_width = piece.get("cuff_width", 0)
            
            if w <= 0 or h <= 0:
                continue
            
            effective_w = w + seam_allowance * 2
            effective_h = h + seam_allowance * 2
            area = w * h
            area_with_shrinkage = area * (1 + shrinkage_rate / 100)
            
            piece_detail = {
                "name": piece.get("name", ""),
                "original_length": round(w, 2),
                "original_width": round(h, 2),
                "effective_length": round(effective_h, 2),
                "effective_width": round(effective_w, 2),
                "count": count,
                "area_cm2": round(area, 2),
                "area_with_shrinkage_cm2": round(area_with_shrinkage, 2),
                "material": material,
            }
            if shoulder_width > 0:
                piece_detail["shoulder_width"] = shoulder_width
            if sleeve_cap_width > 0:
                piece_detail["sleeve_cap_width"] = sleeve_cap_width
            if cuff_width > 0:
                piece_detail["cuff_width"] = cuff_width
            
            pieces_detail.append(piece_detail)
            
            # 按材料类型汇总
            total_area = area_with_shrinkage * count
            if material not in material_areas:
                material_areas[material] = 0
                material_pieces[material] = []
            material_areas[material] += total_area
            for _ in range(count):
                material_pieces[material].append({
                    "name": piece.get("name", ""),
                    "length": effective_h,
                    "width": effective_w,
                })
        
        # 构建材料分类汇总
        material_names = {
            "main": "主面料",
            "lining": "里布",
            "interlining": "衬布",
        }
        
        effective_fabric_width = fabric_width - 3
        material_breakdown = {}
        
        for mat_type, area in material_areas.items():
            from calculator_engine import simulate_nesting
            mat_piece_dims = material_pieces.get(mat_type, [])
            mat_nesting_result = simulate_nesting(mat_piece_dims, effective_fabric_width)
            
            base_length_cm = area / effective_fabric_width if effective_fabric_width > 0 else 0
            nesting_util = mat_nesting_result["width_utilization"]
            if nesting_util > 0:
                adjusted_length_cm = base_length_cm / nesting_util
            else:
                adjusted_length_cm = base_length_cm
            
            mat_length_cm = adjusted_length_cm * (1 + wastage_rate / 100)
            mat_length_m = mat_length_cm / 100
            
            material_breakdown[mat_type] = {
                "name": material_names.get(mat_type, mat_type),
                "area_cm2": round(area, 2),
                "area_m2": round(area / 10000, 4),
                "length_cm": round(mat_length_cm, 2),
                "length_m": round(mat_length_m, 3),
                "weight_g": round(area / 10000 * fabric_weight_gsm, 2) if fabric_weight_gsm > 0 else 0,
                "weight_kg": round(area / 10000 * fabric_weight_gsm / 1000, 4) if fabric_weight_gsm > 0 else 0,
                "width_utilization": mat_nesting_result["width_utilization"],
            }
        
        # 警告信息
        warnings = []
        if fabric_width < 100:
            warnings.append("面料门幅较窄（<100cm），可能导致用料增加")
        if wastage_rate > 15:
            warnings.append("损耗率设置较高（>15%），请确认是否合理")
        if wastage_rate < 3:
            warnings.append("损耗率设置较低（<3%），建议不低于5%")
        if shrinkage_rate > 5:
            warnings.append("缩水率设置较高（>5%），建议对面料进行预缩处理")
        if quantity < 50:
            warnings.append(f"订单数量较少（{quantity}件），小批量生产损耗可能偏高，建议在标准损耗基础上增加3%-6%")
        
        elapsed = time.time() - start_time
        print(f"[API] 排料完成: 总长度{nesting_result['total_length_cm']:.2f}cm, 耗时{elapsed:.3f}秒")
        
        return jsonify({
            "success": True,
            "data": {
                "params": {
                    "fabric_width": fabric_width,
                    "shrinkage_rate": shrinkage_rate,
                    "wastage_rate": wastage_rate,
                    "fabric_weight_gsm": fabric_weight_gsm,
                    "quantity": quantity,
                },
                "total_length_cm": nesting_result["total_length_cm"],
                "width_utilization": nesting_result["width_utilization"],
                "rows": nesting_result["rows"],
                "material_breakdown": material_breakdown,
                "pieces_detail": pieces_detail,
                "warnings": warnings,
            }
        })
    
    except Exception as e:
        import traceback
        elapsed = time.time() - start_time
        print(f"[API] 排料失败: {str(e)}, 耗时{elapsed:.3f}秒")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"多边形排料错误: {str(e)}"}), 500


# ============================================================
# 静态文件服务（上传图片）
# ============================================================

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """提供上传图片的访问"""
    import os
    from flask import send_from_directory, abort
    # 安全检查：防止路径遍历攻击
    if '..' in filename or filename.startswith('/'):
        abort(404)
    return send_from_directory(UPLOAD_DIR, filename)


# ============================================================
# 启动
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("  面料用量快速计算系统")
    print("  Fabric Consumption Quick Calculator")
    print("=" * 60)
    print(f"  访问地址: http://localhost:5000")
    print(f"  快速估算: http://localhost:5000/quick")
    print(f"  报价管理: http://localhost:5000/quotation")
    print(f"  历史记录: http://localhost:5000/history")
    print("=" * 60)
    
    # 检查数据库状态
    db_health = db_manager.check_health()
    print(f"  数据库: {db_health.get('message', '未知')}")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=False)
