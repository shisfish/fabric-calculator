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

    # 🔧 【关键修复】将measurements中的字段提取到顶层
    input_data = json.dumps({
        "mode": "pattern",
        "category": measurements.get("category", "tshirt"),
        "pieces": measurements.get("pieces", []),
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

    # 🔧 【关键修复】将measurements中的字段提取到顶层
    input_data = json.dumps({
        "mode": "seam",
        "category": measurements.get("category", "tshirt"),
        "pieces": measurements.get("pieces", []),
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
    生成排料图 - 独立计算模块（与CAD数据结构100%一致）
    
    【关键原则】
    - 直接使用calc-engine返回的原始数据，不做任何转换
    - 确保pieces、positions、bounds与CAD完全一致
    - 使用CAD的_generate_nesting_svg函数生成SVG
    
    Args:
        measurements: 测量数据字典
        fabric_width: 布料门幅(cm)
        seam_allowance: 缝份宽度(cm)
        options: 可选配置
        
    Returns:
        dict: 包含SVG和排料数据的结果（CAD标准格式）
    """
    if options is None:
        options = {}

    # 🔧 【关键】将measurements中的字段提取到顶层（匹配calc_runner期望的格式）
    input_data = json.dumps({
        "mode": "nesting",
        "category": measurements.get("category", "tshirt"),
        "pieces": measurements.get("pieces", []),
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
            print(f"[Calc-Engine] 排料错误: {result.stderr}")
            return {"success": False, "error": result.stderr}

        data = json.loads(result.stdout.strip())
        
        # ✅ 【关键】直接使用calc-engine返回的nesting数据（不做任何转换！）
        nesting_data = data.get("nesting", {})
        
        pieces = nesting_data.get("pieces", [])
        positions = nesting_data.get("positions", [])
        fabric_info = nesting_data.get("fabricInfo", {})
        bounds = fabric_info.get("bounds", {
            "width": fabric_width,
            "height": fabric_info.get("height", 0)
        })
        utilization = fabric_info.get("utilization", 0)
        
        print(f"\n📐 【精确计算-排料】")
        print(f"  裁片数量: {len(pieces)} 个")
        print(f"  位置数量: {len(positions)} 个")
        print(f"  面料门幅: {fabric_width} cm")
        print(f"  排料长度: {bounds.get('height', 0):.1f} cm")
        print(f"  利用率: {utilization:.1f}%")
        
        # ✅ 使用CAD的专业方法生成SVG（确保与CAD显示一致）
        nesting_svg = _generate_nesting_svg(
            pieces=pieces,
            positions=positions,
            fabric_width=fabric_width,
            bounds=bounds,
            utilization=utilization
        )
        
        # 转换为base64 data URI（浏览器直接渲染，中文显示正常）
        nesting_png_base64 = _svg_to_data_uri(nesting_svg)
        
        # 计算统计数据
        total_area_cm2 = sum(p.get('area', 0) for p in pieces) if pieces else 0
        per_piece_length_m = bounds.get('height', 0) / 100 if bounds.get('height', 0) > 0 else 0
        
        return {
            "success": True,
            "data": {
                # ✅ 与CAD数据结构完全一致
                "pieces": pieces,
                "positions": positions,
                "bounds": bounds,
                "nesting_svg": nesting_svg,
                "nesting_png_base64": nesting_png_base64,
                
                # 统计信息
                "per_piece_length_m": round(per_piece_length_m, 3),
                "total_area_m2": round(total_area_cm2 / 10000, 4),
                "utilization_rate": round(utilization, 1),
                "fabricInfo": fabric_info,
                
                # 元数据
                "mode": "nesting",
                "fabricWidth": fabric_width,
                "seamAllowance": seam_allowance
            },
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
    一次性生成所有模块 - 独立计算模块（裁片图 + 缝份图 + 排料图）
    
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

    # 🔧 【关键修复】将measurements中的字段提取到顶层（匹配calc_runner期望的格式）
    input_data = json.dumps({
        "mode": "all",
        "category": measurements.get("category", "tshirt"),
        "pieces": measurements.get("pieces", []),
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
        
        # ✅ 【关键】直接使用calc-engine返回的nesting数据（不做任何转换！）
        if nesting_data:
            pieces = nesting_data.get("pieces", [])
            # 🔧 【修复】calc_runner.ts返回的是nestPositions字段
            positions = nesting_data.get("positions") or nesting_data.get("nestPositions", [])
            fabric_info = nesting_data.get("fabricInfo", {})
            bounds = fabric_info.get("bounds", {
                "width": fabric_width,
                "height": fabric_info.get("height", 0)
            })
            utilization = fabric_info.get("utilization", 0)
            
            print(f"\n📐 【精确计算-全模块排料】")
            print(f"  裁片数量: {len(pieces)} 个")
            print(f"  位置数量: {len(positions)} 个")
            print(f"  面料门幅: {fabric_width} cm")
            print(f"  排料长度: {bounds.get('height', 0):.1f} cm")
            
            # 使用CAD的专业方法生成SVG
            nesting_svg = _generate_nesting_svg(
                pieces=pieces,
                positions=positions,
                fabric_width=fabric_width,
                bounds=bounds,
                utilization=utilization
            )
            
            # 转换为base64 data URI
            nesting_png_base64 = _svg_to_data_uri(nesting_svg)
            
            # 计算统计数据
            total_area_cm2 = sum(p.get('area', 0) for p in pieces) if pieces else 0
            per_piece_length_m = bounds.get('height', 0) / 100 if bounds.get('height', 0) > 0 else 0
            
            # 构建nesting对象（与CAD数据结构完全一致）
            nesting_result = {
                "pieces": pieces,
                "positions": positions,
                "bounds": bounds,
                "nesting_svg": nesting_svg,
                "nesting_png_base64": nesting_png_base64,
                "per_piece_length_m": round(per_piece_length_m, 3),
                "total_area_m2": round(total_area_cm2 / 10000, 4),
                "utilization_rate": round(utilization, 1),
                "fabricInfo": fabric_info
            }
        else:
            nesting_result = None
        
        return {
            "success": True,
            "pattern": pattern_data,
            "seam": seam_data,
            "nesting": nesting_result,  # ✅ 新增排料数据（与CAD格式一致）
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