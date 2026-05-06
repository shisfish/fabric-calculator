#!/bin/bash
# 面料用量快速计算系统 - 启动脚本
# Fabric Consumption Quick Calculator - Startup Script

echo "============================================================"
echo "  面料用量快速计算系统"
echo "  Fabric Consumption Quick Calculator"
echo "============================================================"

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 Python3，请先安装 Python 3.7+"
    exit 1
fi

# 检查Flask
python3 -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "正在安装 Flask..."
    pip3 install flask --break-system-packages
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 启动服务
echo ""
echo "  访问地址: http://localhost:5000"
echo "  快速估算: http://localhost:5000/quick"
echo "  报价管理: http://localhost:5000/quotation"
echo "  历史记录: http://localhost:5000/history"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "============================================================"
echo ""

python3 app.py
