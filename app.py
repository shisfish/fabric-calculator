# -*- coding: utf-8 -*-
"""
面料用量快速计算系统 - Web服务
Fabric Consumption Quick Calculator
"""

from flask import Flask, render_template, request, jsonify, send_file
from calculator_engine import FabricCalculator, QuotationEngine
from curved_engine import CurvedPieceCalculator
from image_engine import measurement_engine
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

# 历史记录文件
HISTORY_FILE = os.path.join(DATA_DIR, 'history.json')


def load_history():
    """加载历史记录"""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    return []


def save_history(history):
    """保存历史记录"""
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


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
        history = load_history()
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
        }
        history.insert(0, record)
        if len(history) > 100:
            history = history[:100]
        save_history(history)

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
        history = load_history()
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
        history.insert(0, record)
        if len(history) > 100:
            history = history[:100]
        save_history(history)

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
    history = load_history()
    return jsonify({"success": True, "data": history})


@app.route('/api/history/<record_id>', methods=['GET'])
def get_history_detail(record_id):
    """获取单条历史记录详情（含重新计算的完整结果）"""
    history = load_history()
    record = next((h for h in history if h.get("id") == record_id), None)
    if not record:
        return jsonify({"success": False, "message": "记录不存在"}), 404

    # 如果是精确计算，重新调用计算引擎获取完整结果（pieces_detail、material_breakdown等）
    if record.get("type") == "precise" and record.get("input_data"):
        try:
            full_result = calculator.calculate_consumption(record["input_data"])
            record["full_result"] = full_result
        except Exception as e:
            record["full_result"] = None
            record["calc_error"] = str(e)
    elif record.get("type") == "quick" and record.get("input_data"):
        try:
            full_result = calculator.quick_estimate(record["input_data"])
            record["full_result"] = full_result
        except Exception as e:
            record["full_result"] = None
            record["calc_error"] = str(e)

    return jsonify({"success": True, "data": record})


@app.route('/api/history/<record_id>', methods=['DELETE'])
def delete_history(record_id):
    """删除历史记录"""
    history = load_history()
    history = [h for h in history if h.get("id") != record_id]
    save_history(history)
    return jsonify({"success": True, "message": "已删除"})


@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    """清空历史记录"""
    save_history([])
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

        # 保存到历史记录
        history = load_history()
        record = {
            "id": datetime.now().strftime("%Y%m%d%H%M%S"),
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
        }
        history.insert(0, record)
        if len(history) > 100:
            history = history[:100]
        save_history(history)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "message": f"曲线计算错误: {str(e)}"}), 500


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
    app.run(host='0.0.0.0', port=5000, debug=False)
