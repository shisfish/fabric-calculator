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
        
        return {
            "success": True,
            "pattern": data.get("pattern", {}),
            "seam": data.get("seam", {}),
            "nesting": data.get("nesting", {}),
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