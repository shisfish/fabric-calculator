"""
独立精确计算模块 - 基于calc-engine
提供三个独立模块：
1. 裁片图（Pattern Piece）
2. 裁片+缝份图（Seam Allowance）
3. 排料图（Nesting Layout）

注意：此模块完全独立，不修改原CAD逻辑
"""

import subprocess
import json
import os

# 导入CAD的排料图生成方法（确保与CAD完全一致）
from piece_generator import _generate_nesting_svg, _svg_to_data_uri


def _find_npx():
    """查找npx命令"""
    import shutil
    npx_path = shutil.which('npx')
    if not npx_path:
        raise RuntimeError("未找到npx命令，请确保已安装Node.js")
    return npx_path


def _get_calc_engine_dir():
    """获取calc-engine目录路径"""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'calc-engine')


def generate_pattern_pieces(measurements, options=None):
    """
    生成裁片图 - 独立计算模块
    
    Args:
        measurements: 测量数据字典
        options: 可选配置
        
    Returns:
        dict: 包含SVG和裁片数据的结果
    """
    if options is None:
        options = {}

    input_data = json.dumps({
        "mode": "pattern",
        "measurements": measurements,
        "options": {
            "showControlPoints": options.get("showControlPoints", False),
            "showLabels": options.get("showLabels", True)
        }
    })

    base_dir = _get_calc_engine_dir()

    try:
        result = subprocess.run(
            [_find_npx(), 'tsx', '--no-cache', 'calc_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"[Calc-Engine] 错误: {result.stderr}")
            return {"success": False, "error": result.stderr}

        data = json.loads(result.stdout.strip())
        
        return {
            "success": True,
            "data": data.get("pattern", {}),
            "mode": "pattern"
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "计算超时"}
    except Exception as e:
        print(f"[Calc-Engine] 裁片图生成错误: {str(e)}")
        return {"success": False, "error": str(e)}


def generate_seam_allowance_pieces(measurements, seam_allowance=1.0, options=None):
    """
    生成裁片+缝份图 - 独立计算模块
    
    Args:
        measurements: 测量数据字典
        seam_allowance: 缝份宽度(cm)
        options: 可选配置
        
    Returns:
        dict: 包含SVG和缝份数据的结果
    """
    if options is None:
        options = {}

    input_data = json.dumps({
        "mode": "seam",
        "measurements": measurements,
        "seamAllowance": seam_allowance,
        "options": {
            "showStitchLine": True,
            "showCuttingLine": True,
            "showSeamLabels": options.get("showSeamLabels", True)
        }
    })

    base_dir = _get_calc_engine_dir()

    try:
        result = subprocess.run(
            [_find_npx(), 'tsx', '--no-cache', 'calc_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"[Calc-Engine] 错误: {result.stderr}")
            return {"success": False, "error": result.stderr}

        data = json.loads(result.stdout.strip())
        
        return {
            "success": True,
            "data": data.get("seam", {}),
            "mode": "seam",
            "seamAllowance": seam_allowance
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "计算超时"}
    except Exception as e:
        print(f"[Calc-Engine] 缝份图生成错误: {str(e)}")
        return {"success": False, "error": str(e)}


def generate_nesting_layout(measurements, fabric_width=145, seam_allowance=1.0, options=None):
    """
    生成排料图 - 独立计算模块
    
    Args:
        measurements: 测量数据字典
        fabric_width: 布料门幅(cm)
        seam_allowance: 缝份宽度(cm)
        options: 可选配置
        
    Returns:
        dict: 包含SVG和排料数据的结果
    """
    if options is None:
        options = {}

    input_data = json.dumps({
        "mode": "nesting",
        "measurements": measurements,
        "seamAllowance": seam_allowance,
        "fabricWidth": fabric_width,
        "options": {
            "showGrid": options.get("showGrid", True),
            "showUtilization": options.get("showUtilization", True),
            "showPieceLabels": options.get("showPieceLabels", True)
        }
    })

    base_dir = _get_calc_engine_dir()

    try:
        result = subprocess.run(
            [_find_npx(), 'tsx', '--no-cache', 'calc_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"[Calc-Engine] 错误: {result.stderr}")
            return {"success": False, "error": result.stderr}

        data = json.loads(result.stdout.strip())
        
        return {
            "success": True,
            "data": data.get("nesting", {}),
            "mode": "nesting",
            "fabricWidth": fabric_width
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "计算超时"}
    except Exception as e:
        print(f"[Calc-Engine] 排料图生成错误: {str(e)}")
        return {"success": False, "error": str(e)}


def generate_all_modules(measurements, fabric_width=145, seam_allowance=1.0, options=None):
    """
    一次性生成所有三个模块 - 独立计算模块
    
    Args:
        measurements: 测量数据字典
        fabric_width: 布料门幅(cm)
        seam_allowance: 缝份宽度(cm)
        options: 可选配置
        
    Returns:
        dict: 包含三个模块完整结果的数据
    """
    if options is None:
        options = {}

    input_data = json.dumps({
        "mode": "all",
        "measurements": measurements,
        "seamAllowance": seam_allowance,
        "fabricWidth": fabric_width,
        "options": {
            "showControlPoints": options.get("showControlPoints", False),
            "showLabels": options.get("showLabels", True),
            "showGrid": options.get("showGrid", True),
            "showUtilization": options.get("showUtilization", True),
            "showPieceLabels": options.get("showPieceLabels", True),
            "showSeamLabels": options.get("showSeamLabels", True)
        }
    })

    base_dir = _get_calc_engine_dir()

    try:
        result = subprocess.run(
            [_find_npx(), 'tsx', '--no-cache', 'calc_runner.ts', input_data],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=base_dir
        )

        if result.returncode != 0:
            print(f"[Calc-Engine] 错误: {result.stderr}")
            return {"success": False, "error": result.stderr}

        data = json.loads(result.stdout.strip())
        
        # 获取各模块数据
        pattern_data = data.get("pattern", {})
        seam_data = data.get("seam", {})
        nesting_data = data.get("nesting", {})
        
        # 🔧 【关键】使用CAD的 _generate_nesting_svg() 方法生成专业排料图
        # 从pattern和seam阶段收集完整的裁片数据（包含pathOps、seamAllowancePathOps等）
        pieces_for_svg = []
        
        # 合并pattern和seam的裁片数据
        pattern_pieces = pattern_data.get("pieces", [])
        seam_pieces = seam_data.get("pieces", [])
        nesting_pieces = nesting_data.get("pieces", [])
        
        for np in nesting_pieces:
            name = np.get("name", "")
            # 从seam pieces查找对应的缝份数据
            seam_piece = next((sp for sp in seam_pieces if sp.get("name") == name), None)
            # 从pattern pieces查找对应的路径数据
            pattern_piece = next((pp for pp in pattern_pieces if pp.get("name") == name), None)
            
            piece_info = {
                "name": name,
                "pathOps": pattern_piece.get("pathOps", []) if pattern_piece else [],
                "expandedPathOps": pattern_piece.get("expandedPathOps", []) if pattern_piece else [],
                "seamAllowancePathOps": seam_piece.get("seamAllowancePathOps", []) if seam_piece else [],
                "seamAllowance": seam_piece.get("seamAllowance", seam_allowance) if seam_piece else seam_allowance,
                "onFold": np.get("onFold", False)
            }
            pieces_for_svg.append(piece_info)
        
        # 获取位置数据
        positions = nesting_data.get("nestPositions", [])
        
        # 获取边界和利用率
        fabric_info = nesting_data.get("fabricInfo", {})
        bounds = {
            "width": fabric_width,
            "height": fabric_info.get("height", 135)
        }
        utilization = fabric_info.get("utilization", 0)
        
        # 使用CAD的专业方法生成SVG
        nesting_svg = _generate_nesting_svg(
            pieces=pieces_for_svg,
            positions=positions,
            fabric_width=fabric_width,
            bounds=bounds,
            utilization=utilization
        )
        
        # 转换为base64 data URI（与CAD完全一致）
        nesting_png_base64 = _svg_to_data_uri(nesting_svg)
        
        return {
            "success": True,
            "pattern": pattern_data,
            "seam": seam_data,
            # 与CAD数据结构完全一致（使用CAD方法生成）
            "nesting_svg": nesting_svg,
            "nesting_png_base64": nesting_png_base64,
            # 保留原始nesting数据供React组件使用
            "nesting": nesting_data,
            "metadata": {
                "engine": "calc-engine (独立计算模块)",
                "version": "1.0.0",
                "fabricWidth": fabric_width,
                "seamAllowance": seam_allowance
            }
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "计算超时"}
    except Exception as e:
        print(f"[Calc-Engine] 全模块生成错误: {str(e)}")
        return {"success": False, "error": str(e)}