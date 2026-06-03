# -*- coding: utf-8 -*-
"""
面料用量快速计算系统 - Web服务
Fabric Consumption Quick Calculator
"""

from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for
from functools import wraps
from calculator_engine import FabricCalculator, QuotationEngine
from curved_engine import CurvedPieceCalculator
from db_manager import db_manager
from pymysql import OperationalError
import json
import os
import sys
import hashlib
from datetime import datetime

# 前端资源路径（相对于server/目录）
_FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
app = Flask(__name__,
            template_folder=os.path.join(_FRONTEND_DIR, 'templates'),
            static_folder=os.path.join(_FRONTEND_DIR, 'static'))
app.config['JSON_AS_ASCII'] = False
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'fabric-calculator-secret-key-2026')  # Session密钥

calculator = FabricCalculator()
quotation_engine = QuotationEngine()
curved_calculator = CurvedPieceCalculator()

# 数据存储目录（使用项目外部路径，避免部署时被覆盖）
DATA_DIR = os.environ.get('FABRIC_DATA_DIR', '/opt/fabric-data')
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except PermissionError:
    DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    print(f"[Warning] 无法创建 {DATA_DIR}，改用本地目录: {DATA_DIR}")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'uploads'), exist_ok=True)

# 项目内 uploads 目录
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================
# 用户认证辅助函数
# ============================================================

def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({"success": False, "message": "请先登录", "code": 401}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """获取当前登录用户信息"""
    if 'user_id' not in session:
        return None
    try:
        # ✅ 正确用法：使用上下文管理器方式获取连接
        with db_manager._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, username, nickname, avatar_url, role, status
                    FROM users 
                    WHERE id = %s AND status = 1
                """, (session['user_id'],))
                user = cursor.fetchone()
                return user
    except Exception as e:
        print(f"[Auth] 获取用户信息失败: {e}")
        return None


def hash_password(password):
    """密码哈希（SHA256）"""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


# ============================================================
# 用户认证 API
# ============================================================

@app.route('/login')
def login():
    """登录页面"""
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')


@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """用户登录API"""
    data = request.get_json()
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({"success": False, "message": "请输入用户名和密码"}), 400
    
    try:
        # ✅ 正确用法：使用上下文管理器方式获取连接
        with db_manager._get_connection() as conn:
            with conn.cursor() as cursor:
                # 查询用户
                cursor.execute("""
                    SELECT id, username, password_hash, nickname, avatar_url, role, status
                    FROM users 
                    WHERE username = %s
                """, (username,))
                user = cursor.fetchone()
                
                if not user:
                    return jsonify({"success": False, "message": "用户名或密码错误"}), 401
                
                # 验证密码
                password_hash = hash_password(password)
                if user['password_hash'] != password_hash:
                    return jsonify({"success": False, "message": "用户名或密码错误"}), 401
                
                # 检查账号状态
                if user['status'] != 1:
                    return jsonify({"success": False, "message": "账号已被禁用"}), 403
                
                # 设置会话
                session['user_id'] = user['id']
                session['username'] = user['username']
                session['nickname'] = user['nickname'] or user['username']
                session['role'] = user['role']
                
                # 更新最后登录时间
                cursor.execute("""
                    UPDATE users SET last_login_at = NOW(), last_login_ip = %s WHERE id = %s
                """, (request.remote_addr, user['id']))
                
                print(f"[Auth] ✅ 用户登录成功: {user['username']} ({user['nickname']})")
                
                return jsonify({
                    "success": True,
                    "message": "登录成功",
                    "data": {
                        "user_id": user['id'],
                        "username": user['username'],
                        "nickname": user['nickname'] or user['username'],
                        "avatar_url": user.get('avatar_url', ''),
                        "role": user['role']
                    }
                })
            
    except Exception as e:
        print(f"[Auth] ❌ 登录失败: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"登录失败: {str(e)}"}), 500


@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    """用户登出API"""
    username = session.get('username', '未知')
    session.clear()
    print(f"[Auth] ✅ 用户已登出: {username}")
    return jsonify({"success": True, "message": "已退出登录"})


@app.route('/api/auth/current-user')
def api_get_current_user():
    """获取当前登录用户信息"""
    user = get_current_user()
    if not user:
        return jsonify({"success": False, "message": "未登录", "data": None})
    
    return jsonify({
        "success": True,
        "data": {
            "user_id": user['id'],
            "username": user['username'],
            "nickname": user['nickname'] or user['username'],
            "avatar_url": user.get('avatar_url', ''),
            "role": user['role']
        }
    })


@app.route('/profile')
@login_required
def profile():
    """个人中心页面"""
    return render_template('profile.html')


# ============================================================
# 页面路由
# ============================================================

@app.route('/')
@login_required
def index():
    """首页 - 计算器"""
    return render_template('index.html')


@app.route('/test-nesting')
@login_required
def test_nesting():
    """排料图诊断测试页面"""
    return render_template('test_nesting.html')


@app.route('/curves')
@login_required
def curves():
    """曲线模型计算页面"""
    return render_template('curves.html')


@app.route('/quotation')
@login_required
def quotation():
    """报价单页面"""
    return render_template('quotation.html')


@app.route('/history')
@login_required
def history():
    """历史记录页面"""
    return render_template('history.html')


@app.route('/history/<record_id>')
@login_required
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


@app.route('/api/quotation', methods=['POST'])
@login_required
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
@login_required
def get_history():
    """获取历史记录（支持分页和类型筛选，只返回当前用户的数据）"""
    # 获取当前用户ID
    user_id = session.get('user_id')
    
    # 获取查询参数
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('pageSize', 20))
    record_type = request.args.get('type')  # 可选: precise/curved/polygon/cad

    # 参数校验
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20

    result = db_manager.load_history(page=page, page_size=page_size, record_type=record_type, user_id=user_id)
    
    return jsonify({
        "success": True,
        "data": result['records'],
        "pagination": result['pagination']
    })


@app.route('/api/history/<record_id>', methods=['GET'])
@login_required
def get_history_detail(record_id):
    """获取单条历史记录详情（含重新计算的完整结果）"""
    try:
        record = db_manager.get_record(record_id)
        if not record:
            return jsonify({"success": False, "message": "记录不存在"}), 404

        print(f"\n[History-Detail] 📋 加载记录详情: {record_id}")
        print(f"  类型: {record.get('type')}")
        print(f"  品类: {record.get('category')}")
        print(f"  是否有 full_result: {'✅' if record.get('full_result') else '❌'}")
        if record.get('full_result'):
            materials = record['full_result'].get('material_breakdown', {})
            print(f"  材料种类: {list(materials.keys()) if materials else '无'}")

        # 重新调用计算引擎获取完整结果（pieces_detail、material_breakdown等）
        if record.get("input_data"):
            try:
                record_type = record.get("type", "")

                if record_type == "curved":
                    full_result = curved_calculator.calculate_consumption_curved(record["input_data"])
                elif record_type in ["precise", "cad"]:
                    # ✅ 精确计算/CAD排料：优先使用数据库中的 full_result
                    full_result = record.get("full_result")
                    
                    # 如果数据库中没有 full_result，尝试构建基础数据
                    if not full_result:
                        print(f"[History-Detail] ⚠️ 记录 {record_id} 缺少 full_result，构建基础版本")
                        full_result = _build_basic_full_result(record)
                        record["calc_warning"] = "该记录使用基础数据显示（部分字段来自重新计算）"
                else:
                    full_result = calculator.calculate_consumption(record["input_data"])

                if full_result:
                    record["full_result"] = full_result

            except Exception as e:
                import traceback
                error_msg = str(e)
                
                # 对于 precise/cad 类型，失败时保留已有数据或构建基础数据
                if record_type in ["precise", "cad"]:
                    print(f"[History-Detail] ⚠️ {record_type} 类型处理异常: {error_msg}")
                    
                    # 如果已有 full_result 就保留，否则构建基础版
                    if not record.get("full_result"):
                        record["full_result"] = _build_basic_full_result(record)
                        record["calc_warning"] = f"使用基础数据显示: {error_msg}"
                    else:
                        record["calc_warning"] = f"部分数据可能不完整: {error_msg}"
                else:
                    record["full_result"] = None
                    record["calc_error"] = f"无法重新计算完整结果: {error_msg}\n详细信息: {traceback.format_exc()}"

        # 确保 full_result 存在（即使是空对象）
        if not record.get("full_result"):
            record["full_result"] = _build_basic_full_result(record)

        return jsonify({"success": True, "data": record})

    except Exception as e:
        import traceback
        print(f"[History-Detail] ❌ 加载记录失败: {record_id}")
        print(f"  错误: {str(e)}")
        print(traceback.format_exc())
        
        return jsonify({
            "success": False, 
            "message": f"加载失败: {str(e)}"
        }), 500


@app.route('/api/history/<record_id>', methods=['DELETE'])
@login_required
def delete_history(record_id):
    """删除历史记录"""
    db_manager.delete_record(record_id)
    return jsonify({"success": True, "message": "已删除"})


@app.route('/api/history/clear', methods=['POST'])
@login_required
def clear_history():
    """清空历史记录"""
    db_manager.clear_history()
    return jsonify({"success": True, "message": "已清空"})


# ============================================================
# AI图片识别 API
# ============================================================

@app.route('/api/image/upload', methods=['POST'])
@login_required
def image_upload():
    """上传图片"""
    try:
        from image_engine import measurement_engine
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
@login_required
def image_calibrate():
    """标定参照物"""
    try:
        from image_engine import measurement_engine
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
@login_required
def image_measure():
    """测量裁片区域"""
    try:
        from image_engine import measurement_engine
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
@login_required
def image_annotate():
    """获取标注后的图片"""
    try:
        from image_engine import measurement_engine
        data = request.get_json()
        session_id = data.get('session_id')
        img_base64 = measurement_engine.draw_annotations(session_id)
        return jsonify({"success": True, "data": {"image": img_base64}})
    except Exception as e:
        return jsonify({"success": False, "message": f"标注失败: {str(e)}"}), 500


@app.route('/api/image/session/<session_id>', methods=['GET'])
@login_required
def image_session(session_id):
    """获取会话状态"""
    from image_engine import measurement_engine
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
@login_required
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
            "user_id": session.get('user_id'),  # 关联当前用户
        }
        db_manager.save_record(record)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "message": f"曲线计算错误: {str(e)}"}), 500


# ============================================================
# 健康检查 API
# ============================================================

@app.route('/health', methods=['GET'])
def health():
    """Docker 健康检查"""
    return {"status": "ok"}


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查（含数据库状态）"""
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
@login_required
def polygon_nesting_page():
    """多边形排料页面"""
    return render_template('polygon_nesting.html')

@app.route('/api/polygon-nesting', methods=['POST'])
@login_required
def api_polygon_nesting():
    """多边形排料API"""
    import time
    from polygon_nesting import polygon_nesting
    start_time = time.time()
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        pieces = data.get("pieces", [])
        fabric_width = float(data.get("fabric_width", 140))
        shrinkage_rate = float(data.get("shrinkage_rate", 3))
        fabric_weight_gsm = float(data.get("fabric_weight_gsm", 0))
        quantity = int(data.get("quantity", 1))

        print(f"[API] 收到排料请求: {len(pieces)}种裁片, 门幅{fabric_width}cm")

        from piece_generator import generate_all_pieces_images

        piece_images = generate_all_pieces_images(pieces, fabric_width_cm=fabric_width, save_to_file=True)

        print(f"[API] 生成 {len(piece_images)} 个裁片图形")

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
        total_nesting_length_cm = 0
        total_area_all = sum(material_areas.values())
        all_nesting_utils = []

        for mat_type, area in material_areas.items():
            from calculator_engine import simulate_nesting
            mat_piece_dims = material_pieces.get(mat_type, [])
            mat_nesting_result = simulate_nesting(mat_piece_dims, effective_fabric_width)

            base_length_cm = area / effective_fabric_width if effective_fabric_width > 0 else 0
            nesting_util = mat_nesting_result["width_utilization"]
            if nesting_util > 0:
                adjusted_length_cm = base_length_cm / nesting_util
                all_nesting_utils.append(nesting_util)
            else:
                adjusted_length_cm = base_length_cm

            mat_length_cm = adjusted_length_cm
            mat_length_m = mat_length_cm / 100
            total_nesting_length_cm += mat_length_cm

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

        # 计算实际损耗率
        if total_area_all > 0 and effective_fabric_width > 0:
            theoretical_length = total_area_all / effective_fabric_width
            if theoretical_length > 0:
                calculated_wastage_rate = ((total_nesting_length_cm - theoretical_length) / theoretical_length) * 100
                calculated_wastage_rate = max(0, min(calculated_wastage_rate, 50))
            else:
                calculated_wastage_rate = 0
        else:
            calculated_wastage_rate = 0

        # 警告信息
        warnings = []
        if fabric_width < 100:
            warnings.append("面料门幅较窄（<100cm），可能导致用料增加")
        if calculated_wastage_rate > 15:
            warnings.append(f"计算损耗率较高（{calculated_wastage_rate:.1f}%），建议优化裁片排列或检查面料门幅")
        if calculated_wastage_rate < 5 and calculated_wastage_rate > 0:
            warnings.append(f"计算损耗率较低（{calculated_wastage_rate:.1f}%），排料效率优秀")
        if shrinkage_rate > 5:
            warnings.append("缩水率设置较高（>5%），建议对面料进行预缩处理")
        if quantity < 50:
            warnings.append(f"订单数量较少（{quantity}件），小批量生产可能需要额外预留余量")
        
        elapsed = time.time() - start_time
        print(f"[API] 排料完成: 总长度{nesting_result['total_length_cm']:.2f}cm, 耗时{elapsed:.3f}秒")
        
        # 生成记录ID
        record_id = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # 生成排料图并保存到历史记录
        try:
            from image_generator import generate_nesting_image
            
            nesting_images = []
            for idx, (mat_type, breakdown) in enumerate(material_breakdown.items()):
                mat_piece_details_list = material_pieces.get(mat_type, [])
                mat_nesting_result = simulate_nesting(mat_piece_details_list, effective_fabric_width)
                
                img_result = generate_nesting_image(
                    material_name=breakdown["name"],
                    rows=mat_nesting_result["rows"],
                    fabric_width_cm=effective_fabric_width,
                    total_length_cm=breakdown["length_cm"],
                    width_utilization=mat_nesting_result["width_utilization"],
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
        except Exception as e:
            print(f"保存排料图失败: {e}")
            nesting_images = []
        
        # 保存到历史记录
        record = {
            "id": record_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": "polygon",
            "category": "custom",
            "params": {
                "fabric_width": fabric_width,
                "shrinkage_rate": shrinkage_rate,
                "fabric_weight_gsm": fabric_weight_gsm,
                "quantity": quantity,
            },
            "result": {
                "per_piece_length_m": round(nesting_result["total_length_cm"] / 100, 3),
                "total_area_m2": round(sum(m["area_m2"] for m in material_breakdown.values()), 4),
                "utilization_rate": round(nesting_result["width_utilization"] * 100, 1),
                "fabric_weight_kg": round(sum(m["weight_kg"] for m in material_breakdown.values()), 4),
                "calculated_wastage_rate": round(calculated_wastage_rate, 1),
            },
            "input_data": data,
            "full_result": {
                "params": {
                    "fabric_width": fabric_width,
                    "shrinkage_rate": shrinkage_rate,
                    "fabric_weight_gsm": fabric_weight_gsm,
                    "quantity": quantity,
                },
                "calculated_wastage_rate": round(calculated_wastage_rate, 1),
                "total_length_cm": nesting_result["total_length_cm"],
                "width_utilization": nesting_result["width_utilization"],
                "rows": nesting_result["rows"],
                "material_breakdown": material_breakdown,
                "pieces_detail": pieces_detail,
                "warnings": warnings,
                "nesting_images": nesting_images,
            },
            "user_id": session.get('user_id'),  # 关联当前用户
        }
        db_manager.save_record(record)
        
        return jsonify({
            "success": True,
            "data": {
                "params": {
                    "fabric_width": fabric_width,
                    "shrinkage_rate": shrinkage_rate,
                    "fabric_weight_gsm": fabric_weight_gsm,
                    "quantity": quantity,
                },
                "calculated_wastage_rate": round(calculated_wastage_rate, 1),
                "total_length_cm": nesting_result["total_length_cm"],
                "width_utilization": nesting_result["width_utilization"],
                "rows": nesting_result["rows"],
                "material_breakdown": material_breakdown,
                "pieces_detail": pieces_detail,
                "warnings": warnings,
                "nesting_images": nesting_images,
                "piece_images": piece_images,
            }
        })
    
    except Exception as e:
        import traceback
        elapsed = time.time() - start_time
        print(f"[API] 排料失败: {str(e)}, 耗时{elapsed:.3f}秒")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"多边形排料错误: {str(e)}"}), 500


# ============================================================
# CAD排料模块
# ============================================================

@app.route('/cad')
@login_required
def cad_page():
    """CAD排料页面"""
    return render_template('cad.html')


@app.route('/api/cad-preview', methods=['POST'])
@login_required
def cad_preview():
    """CAD裁片预览API"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        category = data.get("category", "tshirt")
        garment_input = data.get("garmentInput", {})
        measurements = data.get("measurements", {})

        if category not in ["tshirt", "windbreaker"]:
            return jsonify({"success": False, "message": "当前仅支持T恤和风衣品类"}), 400

        from piece_generator import generate_cad_pieces_preview
        result = generate_cad_pieces_preview(
            garment_input if garment_input else measurements,
            {},
            category=category
        )

        return jsonify({"success": True, "data": result})

    except Exception as e:
        import traceback
        print(f"[CAD预览] 错误: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"预览生成错误: {str(e)}"}), 500


@app.route('/api/cad-nesting', methods=['POST'])
@login_required
def cad_nesting():
    """CAD排料计算API"""
    import time
    start_time = time.time()
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        category = data.get("category", "tshirt")
        garment_input = data.get("garmentInput", {})
        measurements = data.get("measurements", {})
        fabric_params = data.get("fabricParams", {})

        if category not in ["tshirt", "windbreaker"]:
            return jsonify({"success": False, "message": "当前仅支持T恤和风衣品类"}), 400

        fabric_width = float(fabric_params.get("width", 145))
        shrinkage_rate = float(fabric_params.get("shrinkageRate", 3))
        fabric_weight_gsm = float(fabric_params.get("weightGsm", 0))
        quantity = int(fabric_params.get("quantity", 1))
        fabric_nap = fabric_params.get("fabricNap", False)
        qty_nest_mode = fabric_params.get("qtyNestMode", False)
        custom_pieces = data.get("customPieces", [])

        print(f"[CAD] 收到排料请求: 品类={category}, 门幅={fabric_width}cm, 数量={quantity}, 按数量排料={qty_nest_mode}, 自定义裁片={len(custom_pieces)}个")

        from piece_generator import generate_cad_nesting_result
        result = generate_cad_nesting_result(
            measurements=garment_input if garment_input else measurements,
            options={},
            fabric_width=fabric_width,
            shrinkage_rate=shrinkage_rate,
            fabric_weight_gsm=fabric_weight_gsm,
            quantity=quantity,
            fabric_nap=fabric_nap,
            qty_nest_mode=qty_nest_mode,
            custom_pieces=custom_pieces if custom_pieces else None,
            category=category,
        )

        record_id = datetime.now().strftime("%Y%m%d%H%M%S")

        record = {
            "id": record_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": "cad",
            "category": category,
            "params": {
                "fabric_width": fabric_width,
                "shrinkage_rate": shrinkage_rate,
                "fabric_weight_gsm": fabric_weight_gsm,
                "quantity": quantity,
                "garmentInput": garment_input if garment_input else {},
                "measurements": measurements,
            },
            "result": {
                "per_piece_length_m": result.get("per_piece_length_m"),
                "total_area_m2": result.get("total_area_m2"),
                "utilization_rate": result.get("utilization_rate"),
                "fabric_weight_kg": result.get("fabric_weight_kg"),
                "calculated_wastage_rate": result.get("calculated_wastage_rate"),
            },
            "input_data": data,
            "full_result": result,
            "user_id": session.get('user_id'),  # 关联当前用户
        }
        try:
            db_manager.save_record(record)
        except Exception as e:
            print(f"[CAD] 保存历史记录失败: {e}")

        elapsed = time.time() - start_time
        print(f"[CAD] 排料完成: 单件{result.get('per_piece_length_m')}m, 利用率{result.get('utilization_rate')}%, 耗时{elapsed:.3f}秒")

        return jsonify({"success": True, "data": result})

    except Exception as e:
        import traceback
        elapsed = time.time() - start_time
        print(f"[CAD] 排料失败: {str(e)}, 耗时{elapsed:.3f}秒")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"CAD排料错误: {str(e)}"}), 500


# ============================================================
# 静态文件服务（上传图片）
# ============================================================

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """提供上传图片的访问"""
    import os
    from flask import send_from_directory, abort
    if '..' in filename or filename.startswith('/'):
        abort(404)
    return send_from_directory(UPLOAD_DIR, filename)


# ============================================================
# 独立精确计算模块 API（calc-engine）
# ============================================================

@app.route('/api/calc/pattern', methods=['POST'])
@login_required
def calc_pattern():
    """独立计算模块 - 裁片图API"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        measurements = data.get("measurements", {})
        options = data.get("options", {})

        from calc_engine import generate_pattern_pieces
        result = generate_pattern_pieces(measurements, options)

        if result["success"]:
            return jsonify({"success": True, "data": result["data"]})
        else:
            return jsonify({"success": False, "message": result.get("error", "生成失败")}), 500

    except Exception as e:
        import traceback
        print(f"[Calc-Engine] 裁片图错误: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"裁片图错误: {str(e)}"}), 500


@app.route('/api/calc/seam', methods=['POST'])
@login_required
def calc_seam():
    """独立计算模块 - 裁片+缝份图API"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        measurements = data.get("measurements", {})
        seam_allowance = float(data.get("seamAllowance", 1.0))
        options = data.get("options", {})

        from calc_engine import generate_seam_allowance_pieces
        result = generate_seam_allowance_pieces(measurements, seam_allowance, options)

        if result["success"]:
            return jsonify({"success": True, "data": result["data"], "seamAllowance": seam_allowance})
        else:
            return jsonify({"success": False, "message": result.get("error", "生成失败")}), 500

    except Exception as e:
        import traceback
        print(f"[Calc-Engine] 缝份图错误: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"缝份图错误: {str(e)}"}), 500


@app.route('/api/calc/nesting', methods=['POST'])
@login_required
def calc_nesting():
    """独立计算模块 - 排料图API"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        measurements = data.get("measurements", {})
        fabric_width = float(data.get("fabricWidth", 145))
        seam_allowance = float(data.get("seamAllowance", 1.0))
        options = data.get("options", {})
        options["shrinkage_rate"] = data.get("shrinkage_rate", data.get("shrinkRate"))
        options["shrinkage"] = data.get("shrinkage") or data.get("fabricShrinkage")

        from calc_engine import generate_nesting_layout
        result = generate_nesting_layout(measurements, fabric_width, seam_allowance, options)

        if result["success"]:
            return jsonify({
                "success": True,
                "data": result["data"],
                "fabricWidth": fabric_width,
                "seamAllowance": seam_allowance
            })
        else:
            return jsonify({"success": False, "message": result.get("error", "生成失败")}), 500

    except Exception as e:
        import traceback
        print(f"[Calc-Engine] 排料图错误: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"排料图错误: {str(e)}"}), 500


@app.route('/api/calc/all', methods=['POST'])
@login_required
def calc_all():
    """独立计算模块 - 一次性生成所有三个模块API"""
    import time
    from datetime import datetime
    start_time = time.time()

    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "请求数据为空"}), 400

        measurements = data.get("measurements", {})
        fabric_width = float(data.get("fabricWidth", 145))
        seam_allowance = float(data.get("seamAllowance", 1.0))
        options = data.get("options", {})
        options["shrinkage_rate"] = data.get("shrinkage_rate", data.get("shrinkRate"))
        options["shrinkage"] = data.get("shrinkage") or data.get("fabricShrinkage")

        from calc_engine import generate_all_modules
        result = generate_all_modules(measurements, fabric_width, seam_allowance, options)

        elapsed = time.time() - start_time

        if result["success"]:
            # ✅ 【新增】保存精确计算结果到数据库
            record_id = datetime.now().strftime("%Y%m%d%H%M%S")
            quantity = int(data.get("quantity", 1) or 1)
            
            # 构建图片数据（用于保存到数据库）
            pattern_data = result.get("pattern", {})
            seam_data = result.get("seam", {})
            nesting_data = result.get("nesting", {})
            nesting_groups = result.get("nesting_groups") or ([nesting_data] if nesting_data else [])
            is_multi_material = len(nesting_groups) > 1
            
            piece_images = []
            if pattern_data.get("pattern_png_base64"):
                piece_images.append({
                    "name": "裁片图",
                    "file_path": f"/static/uploads/calc_{record_id}_pattern.png"
                })
            
            seam_images = []
            if seam_data.get("seam_png_base64"):
                seam_images.append({
                    "name": "缝份图",
                    "file_path": f"/static/uploads/calc_{record_id}_seam.png"
                })
            
            nesting_images = []
            if nesting_data.get("nesting_png_base64"):
                nesting_images.append({
                    "material_name": "主面料",
                    "file_path": f"/static/uploads/calc_{record_id}_nesting.png"
                })

            per_piece_length_m = nesting_data.get("per_piece_length_m", 0) or 0
            per_piece_area_m2 = nesting_data.get("total_area_m2", 0) or 0
            nesting_images = []
            for idx, group in enumerate(nesting_groups):
                if group.get("nesting_png_base64"):
                    material = group.get("material") or "main"
                    safe_material = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in material)
                    nesting_images.append({
                        "material": material,
                        "material_name": group.get("material_name") or material,
                        "file_path": f"/static/uploads/calc_{record_id}_nesting_{idx}_{safe_material}.png"
                    })
            material_totals = {
                (group.get("material") or f"material_{idx}"): {
                    "name": group.get("material_name") or group.get("material") or f"material_{idx}",
                    "per_piece_length_m": group.get("per_piece_length_m", 0) or 0,
                    "net_length_m": group.get("net_length_m", 0) or 0,
                    "production_length_m": group.get("production_length_m", group.get("per_piece_length_m", 0)) or 0,
                    "marker_length_details": group.get("marker_length_details"),
                    "total_length_m": round((group.get("per_piece_length_m", 0) or 0) * quantity, 3),
                    "per_piece_area_m2": group.get("total_area_m2", 0) or 0,
                    "total_area_m2": round((group.get("total_area_m2", 0) or 0) * quantity, 4),
                    "utilization_rate": group.get("utilization_rate", 0) or 0,
                }
                for idx, group in enumerate(nesting_groups)
            }
            normalized_input_data = {
                **data,
                "category": measurements.get("category", "tshirt"),
                "fabric_width": fabric_width,
                "seam_allowance": seam_allowance,
                "fabric_type": data.get("fabricType", "woven"),
                "fabric_weight_gsm": data.get("fabricWeight", 0),
                "shrinkage_rate": data.get("shrinkRate", 3),
                "quantity": quantity,
                "pieces": measurements.get("pieces", []),
            }

            record = {
                "id": record_id,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "type": "precise",
                "category": measurements.get("category", "tshirt"),
                "params": {
                    "fabric_width": fabric_width,
                    "seam_allowance": seam_allowance,
                    "fabric_type": data.get("fabricType", "woven"),
                    "fabric_weight_gsm": data.get("fabricWeight", 0),
                    "shrinkage_rate": data.get("shrinkRate", 3),
                    "quantity": quantity,
                    **measurements
                },
                "result": {
                    "per_piece_length_m": 0 if is_multi_material else per_piece_length_m,
                    "total_length_m": 0 if is_multi_material else round(per_piece_length_m * quantity, 3),
                    "total_area_m2": 0 if is_multi_material else round(per_piece_area_m2 * quantity, 4),
                    "utilization_rate": nesting_data.get("utilization_rate", 0),
                    "fabric_weight_kg": 0 if is_multi_material else ((per_piece_area_m2 * quantity * data.get("fabricWeight", 0) / 1000) if data.get("fabricWeight") else 0),
                    "main_fabric_per_piece_m": 0 if is_multi_material else per_piece_length_m,
                    "lining_per_piece_m": 0,
                    "calculated_wastage_rate": round((100 - (nesting_data.get("utilization_rate", 0) or 0)), 1) if nesting_data.get("utilization_rate", 0) > 0 else 8,
                    "material_totals": material_totals,
                },
                "input_data": normalized_input_data,
                "full_result": {
                    **result,
                    # ✅ 智能构建 material_breakdown（支持多种材料：主面料、罗纹、里布等）
                    "material_breakdown": _build_material_breakdown_from_nesting_groups(
                        nesting_groups=nesting_groups,
                        fabric_weight_gsm=data.get("fabricWeight", 0)
                    ),
                    "piece_images": piece_images,
                    "seam_images": seam_images,
                    "nesting_images": nesting_images,
                    "material_totals": material_totals,
                },
                "user_id": session.get('user_id'),  # 关联当前用户
            }
            
            try:
                import base64
                import os
                import traceback

                upload_dir = os.path.join(_FRONTEND_DIR, 'static', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)

                print(f"\n[Calc-Engine] 📦 准备保存计算结果到数据库...")
                print(f"  Record ID: {record_id}")
                print(f"  Category: {record.get('category')}")
                print(f"  Fabric Width: {record['params'].get('fabric_width')}")
                print(f"  Fabric Type: {record['params'].get('fabric_type')}")
                print(f"  Quantity: {record['params'].get('quantity')}")
                print(f"  Per Piece Length: {record['result'].get('per_piece_length_m')} m")
                print(f"  Material Breakdown: {list(record['full_result'].get('material_breakdown', {}).keys())}")

                if pattern_data.get("pattern_png_base64"):
                    pattern_b64 = pattern_data["pattern_png_base64"]
                    if pattern_b64.startswith('data:'):
                        pattern_b64 = pattern_b64.split(',')[1]
                    with open(f"{upload_dir}/calc_{record_id}_pattern.png", 'wb') as f:
                        f.write(base64.b64decode(pattern_b64))
                    print(f"  ✅ 裁片图已保存")

                if seam_data.get("seam_png_base64"):
                    seam_b64 = seam_data["seam_png_base64"]
                    if seam_b64.startswith('data:'):
                        seam_b64 = seam_b64.split(',')[1]
                    with open(f"{upload_dir}/calc_{record_id}_seam.png", 'wb') as f:
                        f.write(base64.b64decode(seam_b64))
                    print(f"  ✅ 缝份图已保存")

                if nesting_data.get("nesting_png_base64"):
                    nest_b64 = nesting_data["nesting_png_base64"]
                    if nest_b64.startswith('data:'):
                        nest_b64 = nest_b64.split(',')[1]
                    with open(f"{upload_dir}/calc_{record_id}_nesting.png", 'wb') as f:
                        f.write(base64.b64decode(nest_b64))
                    print(f"  ✅ 排料图已保存")

                print(f"  📝 正在调用 db_manager.save_record()...")
                for idx, group in enumerate(nesting_groups):
                    if not group.get("nesting_png_base64"):
                        continue
                    material = group.get("material") or "main"
                    safe_material = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in material)
                    group_b64 = group["nesting_png_base64"]
                    if group_b64.startswith('data:'):
                        group_b64 = group_b64.split(',')[1]
                    with open(f"{upload_dir}/calc_{record_id}_nesting_{idx}_{safe_material}.png", 'wb') as group_file:
                        group_file.write(base64.b64decode(group_b64))

                db_manager.save_record(record)
                print(f"[Calc-Engine] ✅ 已成功保存到数据库: {record_id}")

            except OperationalError as db_err:
                print(f"\n[Calc-Engine] ⚠️ 数据库连接错误（计算结果正常，仅保存失败）!")
                print(f"  错误类型: {type(db_err).__name__}")
                print(f"  错误信息: {str(db_err)}")
                print(f"  建议: 检查MySQL容器状态 - docker ps | grep mysql")
            except Exception as e:
                print(f"\n[Calc-Engine] ⚠️ 保存历史记录失败（计算结果正常，仅保存失败）!")
                print(f"  错误类型: {type(e).__name__}")
                print(f"  错误信息: {str(e)}")
                print(f"  详细堆栈:\n{traceback.format_exc()}")

            return jsonify({
                "success": True,
                **result,
                "elapsedTime": round(elapsed * 1000)
            })
        else:
            return jsonify({"success": False, "message": result.get("error", "生成失败"), "elapsedTime": round(elapsed * 1000)}), 500

    except Exception as e:
        import traceback
        elapsed = time.time() - start_time
        print(f"[Calc-Engine] 全模块错误: {str(e)}, 耗时{elapsed:.3f}秒")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"全模块错误: {str(e)}", "elapsedTime": round(elapsed * 1000)}), 500


# ============================================================
# 辅助函数：构建材料分类汇总
# ============================================================

def _build_material_breakdown(category, nesting_data, fabric_weight_gsm=0):
    """
    根据品类和排料数据构建 material_breakdown
    
    支持多种材料类型：主面料、罗纹、里布、衬布等
    与 calculator_engine.py 的逻辑保持一致
    
    Args:
        category: 品类ID (coat, down_jacket, jacket, tshirt等)
        nesting_data: 排料结果数据
        fabric_weight_gsm: 面料克重(g/m²)
    
    Returns:
        dict: 材料分类汇总字典
    """
    
    # 基础数据
    per_piece_length_m = nesting_data.get("per_piece_length_m", 0) or 0
    total_area_m2 = nesting_data.get("total_area_m2", 0) or 0
    utilization_rate = nesting_data.get("utilization_rate", 0) or 0
    
    # 品类材料配置（参考 calculator_engine.py 的 categories 定义）
    category_materials = {
        "coat": ["main", "rib", "lining"],           # 大衣：主面料 + 罗纹 + 里布
        "down_jacket": ["main", "rib", "lining", "filling"],  # 羽绒服：主面料 + 罗纹 + 里布 + 胆料
        "jacket": ["main", "lining"],                 # 夹克：主面料 + 里布
        "windbreaker": ["main", "lining"],            # 风衣：主面料 + 里布
        "cotton_padded": ["main", "lining", "cotton"], # 棉服：主面料 + 里布 + 棉花
        "tshirt": ["main"],                           # T恤：只有主面料
        "hoodie": ["main", "rib"],                    # 卫衣：主面料 + 罗纹
        "custom": ["main"],                           # 自定义：默认只有主面料
    }
    
    # 材料名称映射
    material_names = {
        "main": "主面料",
        "rib": "罗纹",
        "lining": "里布",
        "interlining": "衬布/粘合衬",
        "filling": "胆料",
        "cotton": "棉花/化纤填充",
        "down": "羽绒填充",
        "other": "其他配件",
    }
    
    # 获取当前品类的材料列表
    materials_list = category_materials.get(category, ["main"])
    
    # 构建材料明细
    material_breakdown = {}
    
    for mat_type in materials_list:
        mat_name = material_names.get(mat_type, mat_type)
        
        if mat_type == "main":
            # 主面料：使用实际排料数据
            length_m = round(per_piece_length_m, 3)
            area_m2 = round(total_area_m2, 4)
            weight_kg = round((total_area_m2 * fabric_weight_gsm / 1000), 4) if fabric_weight_gsm > 0 else 0
            width_utilization = round(utilization_rate, 1) if utilization_rate > 0 else 78.0
            
        elif mat_type == "rib":
            # 罗纹：袖口、下摆（约为主面料的 2-3%）
            rib_ratio = 0.025 if category in ["coat", "jacket"] else 0.02
            length_m = round(per_piece_length_m * rib_ratio, 3)
            area_m2 = round(total_area_m2 * rib_ratio, 4)
            weight_kg = round(area_m2 * 400 / 1000, 4) if area_m2 > 0 else 0  # 罗纹克重约400gsm
            width_utilization = 95.0  # 罗纹利用率高
            
        elif mat_type == "lining":
            # 里布：约为主面料的 85-90%
            lining_ratio = 0.88 if category in ["coat", "windbreaker"] else 0.85
            length_m = round(per_piece_length_m * lining_ratio, 3)
            area_m2 = round(total_area_m2 * lining_ratio, 4)
            weight_kg = round(area_m2 * 80 / 1000, 4) if area_m2 > 0 else 0  # 里布克重约80gsm
            width_utilization = 82.0
            
        elif mat_type in ["filling", "cotton"]:
            # 胆料/棉花
            filling_ratio = 0.05
            length_m = round(per_piece_length_m * filling_ratio, 3)
            area_m2 = round(total_area_m2 * filling_ratio, 4)
            weight_kg = round(area_m2 * 150 / 1000, 4) if area_m2 > 0 else 0
            width_utilization = 90.0
            
        else:
            # 其他材料：默认值
            length_m = round(per_piece_length_m * 0.03, 3)
            area_m2 = round(total_area_m2 * 0.03, 4)
            weight_kg = 0
            width_utilization = 80.0
        
        material_breakdown[mat_type] = {
            "name": mat_name,
            "length_m": length_m,
            "area_m2": area_m2,
            "weight_kg": weight_kg,
            "width_utilization": width_utilization,
        }
    
    print(f"[Material-Breakdown] 品类={category}, 材料种类={list(material_breakdown.keys())}")
    for key, val in material_breakdown.items():
        print(f"  - {val['name']}: {val['length_m']}m ({val['area_m2']}m²)")
    
    return material_breakdown


def _build_material_breakdown_from_nesting_groups(nesting_groups, fabric_weight_gsm=0):
    material_breakdown = {}
    for idx, group in enumerate(nesting_groups or []):
        material = group.get("material") or f"material_{idx}"
        area_m2 = group.get("total_area_m2", 0) or 0
        material_breakdown[material] = {
            "name": group.get("material_name") or material,
            "length_m": round(group.get("per_piece_length_m", 0) or 0, 3),
            "area_m2": round(area_m2, 4),
            "weight_kg": round((area_m2 * fabric_weight_gsm / 1000), 4) if fabric_weight_gsm else 0,
            "width_utilization": round(group.get("utilization_rate", 0) or 0, 1),
        }
    return material_breakdown


def _build_basic_full_result(record):
    """
    构建基础版本的 full_result（用于历史记录详情页）
    
    当数据库中缺少完整的 full_result 时使用此函数，
    从 record.result 和 record.params 构建基础数据
    """
    full_result = {}
    
    # 从 result 中复制基础统计数据
    if record.get("result"):
        result = record["result"]
        for key in ["per_piece_length_m", "total_area_m2", "utilization_rate", 
                    "fabric_weight_kg", "main_fabric_per_piece_m", "lining_per_piece_m",
                    "calculated_wastage_rate"]:
            if result.get(key) is not None:
                full_result[key] = result[key]
    
    # 如果有材料数据（从数据库查询的），保留它
    # （_build_full_result 已经处理了 history_materials 表）
    
    # 添加空的材料明细和裁片明细（避免前端报错）
    if "material_breakdown" not in full_result:
        full_result["material_breakdown"] = {}
    
    if "pieces_detail" not in full_result:
        full_result["pieces_detail"] = []
    
    print(f"[Basic-Full-Result] ✅ 构建基础版本完成")
    return full_result


# ============================================================
# 启动
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("  面料用量快速计算系统")
    print("  Fabric Consumption Quick Calculator")
    print("=" * 60)
    print(f"  访问地址: http://localhost:5000")
    print(f"  报价管理: http://localhost:5000/quotation")
    print(f"  历史记录: http://localhost:5000/history")
    print("=" * 60)
    
    # 检查数据库状态
    db_health = db_manager.check_health()
    print(f"  数据库: {db_health.get('message', '未知')}")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=False)
