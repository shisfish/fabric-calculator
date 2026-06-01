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
import hashlib
from copy import deepcopy

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


NESTING_ALGORITHM_VERSION = "nfp-contact-v2-spacing-0.5-render-bounds"
NESTING_SPACING_CM = 0.5
NESTING_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nesting_best_cache.json")


def _json_safe(value):
    return json.loads(json.dumps(value, ensure_ascii=False, sort_keys=True, default=str))


def _make_nesting_cache_key(measurements, fabric_width, seam_allowance, options):
    key_payload = {
        "algorithm": NESTING_ALGORITHM_VERSION,
        "measurements": _json_safe(measurements),
        "fabric_width": round(float(fabric_width), 4),
        "seam_allowance": round(float(seam_allowance), 4),
        "shrinkage_rate": options.get("shrinkage_rate", options.get("shrinkRate")),
        "shrinkage": options.get("shrinkage") or options.get("fabricShrinkage"),
        "fabricNap": options.get("fabricNap", options.get("fabric_nap")),
        "spacing": NESTING_SPACING_CM,
    }
    raw = json.dumps(key_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _load_nesting_cache():
    try:
        if not os.path.exists(NESTING_CACHE_FILE):
            return {}
        with open(NESTING_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[Calc-Engine] nesting best cache load failed: {e}")
        return {}


def _save_nesting_cache(cache):
    try:
        with open(NESTING_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Calc-Engine] nesting best cache save failed: {e}")


def _nesting_length(nesting_data):
    bounds = nesting_data.get("bounds") or {}
    fabric_info = nesting_data.get("fabricInfo") or {}
    return float(
        bounds.get("height")
        or fabric_info.get("height")
        or (fabric_info.get("bounds") or {}).get("height")
        or 0
    )


def _nesting_utilization(nesting_data):
    fabric_info = nesting_data.get("fabricInfo") or {}
    return float(
        nesting_data.get("utilization")
        or nesting_data.get("utilization_rate")
        or fabric_info.get("utilization")
        or 0
    )


def _strip_render_payload(nesting_data):
    cleaned = deepcopy(nesting_data)
    cleaned.pop("nesting_svg", None)
    cleaned.pop("nesting_png_base64", None)
    return cleaned


def _apply_best_nesting_cache(nesting_data, measurements, fabric_width, seam_allowance, options):
    if not nesting_data or nesting_data.get("error"):
        return nesting_data

    current_length = _nesting_length(nesting_data)
    pieces = nesting_data.get("pieces") or []
    positions = nesting_data.get("positions") or nesting_data.get("nestPositions") or []
    if current_length <= 0 or not pieces or not positions:
        return nesting_data

    key = _make_nesting_cache_key(measurements, fabric_width, seam_allowance, options)
    cache = _load_nesting_cache()
    best = cache.get(key)
    tolerance_cm = 0.01

    if best and current_length > float(best.get("bestLengthCm", 0)) + tolerance_cm:
        reused = deepcopy(best["nesting"])
        reused["historyBest"] = {
            "key": key,
            "reused": True,
            "algorithmVersion": best.get("algorithmVersion"),
            "bestLengthCm": best.get("bestLengthCm"),
            "bestUtilization": best.get("bestUtilization"),
            "currentLengthCm": current_length,
            "currentUtilization": _nesting_utilization(nesting_data)
        }
        print(
            f"[Calc-Engine] Reusing best nesting: current={current_length:.2f}cm, "
            f"best={float(best.get('bestLengthCm', 0)):.2f}cm"
        )
        return reused

    if not best or current_length < float(best.get("bestLengthCm", 0)) - tolerance_cm:
        cache[key] = {
            "algorithmVersion": NESTING_ALGORITHM_VERSION,
            "bestLengthCm": current_length,
            "bestUtilization": _nesting_utilization(nesting_data),
            "nesting": _strip_render_payload(nesting_data)
        }
        _save_nesting_cache(cache)
        nesting_data = deepcopy(nesting_data)
        nesting_data["historyBest"] = {
            "key": key,
            "reused": False,
            "updated": True,
            "bestLengthCm": current_length,
            "bestUtilization": _nesting_utilization(nesting_data)
        }
    elif best:
        nesting_data = deepcopy(nesting_data)
        nesting_data["historyBest"] = {
            "key": key,
            "reused": False,
            "updated": False,
            "bestLengthCm": best.get("bestLengthCm"),
            "bestUtilization": best.get("bestUtilization")
        }

    return nesting_data


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
    shrinkage_rate = options.get("shrinkage_rate", options.get("shrinkRate"))
    shrinkage_config = options.get("shrinkage") or options.get("fabricShrinkage")

    input_data = json.dumps({
        "mode": "nesting",
        "category": measurements.get("category", "tshirt"),
        "pieces": measurements.get("pieces", []),
        "seamAllowance": seam_allowance,
        "fabricWidth": fabric_width,
        "shrinkage_rate": shrinkage_rate,
        "shrinkage": shrinkage_config,
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
        nesting_data = _apply_best_nesting_cache(nesting_data, measurements, fabric_width, seam_allowance, options)
        
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
                "shrinkage": nesting_data.get("shrinkage"),
                "actualNestingUtilization": nesting_data.get("actualNestingUtilization", utilization),
                "historyBest": nesting_data.get("historyBest"),
                
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
    shrinkage_rate = options.get("shrinkage_rate", options.get("shrinkRate"))
    shrinkage_config = options.get("shrinkage") or options.get("fabricShrinkage")

    input_data = json.dumps({
        "mode": "all",
        "category": measurements.get("category", "tshirt"),
        "pieces": measurements.get("pieces", []),
        "seamAllowance": seam_allowance,
        "fabricWidth": fabric_width,
        "shrinkage_rate": shrinkage_rate,
        "shrinkage": shrinkage_config,
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
            timeout=120,
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
        nesting_data = _apply_best_nesting_cache(nesting_data, measurements, fabric_width, seam_allowance, options)
        
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
            
            # 构建nesting对象（与CAD数据结构完全一致，包含statistics）
            nesting_result = {
                "pieces": pieces,
                "positions": positions,
                "bounds": bounds,
                "nesting_svg": nesting_svg,
                "nesting_png_base64": nesting_png_base64,
                "per_piece_length_m": round(per_piece_length_m, 3),
                "total_area_m2": round(total_area_cm2 / 10000, 4),
                "utilization_rate": round(utilization, 1),
                "fabricInfo": fabric_info,
                "shrinkage": nesting_data.get("shrinkage"),
                "actualNestingUtilization": nesting_data.get("actualNestingUtilization", utilization),
                "historyBest": nesting_data.get("historyBest"),
                # ✅ 【关键】保留完整的statistics字段供前端使用
                "statistics": nesting_data.get("statistics", {
                    "totalPieces": len(pieces),
                    "totalArea": total_area_cm2,
                    "usedArea": total_area_cm2 * (utilization / 100) if utilization > 0 else total_area_cm2,
                    "wasteArea": 0,
                    "fabricLength": bounds.get('height', 0),
                    "utilization": utilization
                })
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
