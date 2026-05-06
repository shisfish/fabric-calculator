# 面料用量快速计算系统 - Docker部署脚本
# 适用于腾讯云服务器（已安装Docker）

set -e

echo "============================================================"
echo "  面料用量快速计算系统 - Docker部署"
echo "============================================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: 未检测到Docker，请先安装Docker${NC}"
    echo "安装命令: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# 检查Docker Compose是否可用
if ! docker compose version &> /dev/null; then
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}提示: 未检测到Docker Compose，将使用docker compose（Docker内置）${NC}"
    fi
fi

# 确保外部数据目录存在（避免部署时覆盖历史数据）
mkdir -p /opt/fabric-data/uploads

# 构建并启动
echo ""
echo -e "${GREEN}[1/3] 构建 Docker 镜像...${NC}"
docker compose build --no-cache

echo ""
echo -e "${GREEN}[2/3] 启动容器...${NC}"
docker compose up -d

# 等待服务启动
echo ""
echo -e "${GREEN}[3/3] 等待服务启动...${NC}"
sleep 5

# 检查服务状态
if docker compose ps | grep -q "running"; then
    echo ""
    echo "============================================================"
    echo -e "  ${GREEN}✅ 部署成功！${NC}"
    echo "============================================================"
    echo ""
    echo "  本机访问: http://localhost:5000"
    echo "  外网访问: http://<你的服务器公网IP>:5000"
    echo ""
    echo "  常用命令:"
    echo "    查看日志:   docker compose logs -f"
    echo "    停止服务:   docker compose down"
    echo "    重启服务:   docker compose restart"
    echo "    查看状态:   docker compose ps"
    echo "============================================================"
else
    echo ""
    echo -e "${RED}❌ 部署可能失败，请查看日志:${NC}"
    echo "  docker compose logs"
fi
