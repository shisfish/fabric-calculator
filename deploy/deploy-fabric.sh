#!/bin/bash
# ========================================
# 面料计算器自动部署脚本
# 用法：复制到 /opt/deploy-fabric.sh 执行
# 兼容首次部署（自动克隆）和后续更新
# ========================================

set -e

# 配置
REPO_DIR="${REPO_DIR:-/opt/fabric-calculator}"
GIT_URL="${GIT_URL:-git@github.com:shisfish/fabric-calculator.git}"
GIT_BRANCH="${1:-main}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 首次部署：目录不存在或不是 git 仓库
if [ ! -d "$REPO_DIR/.git" ]; then
    log_info "首次部署，正在克隆仓库..."
    
    # 如果目录存在但不是 git 仓库，先备份
    if [ -d "$REPO_DIR" ]; then
        BACKUP_DIR="${REPO_DIR}.backup.$(date +%Y%m%d%H%M%S)"
        log_warn "目录已存在，备份到: $BACKUP_DIR"
        mv "$REPO_DIR" "$BACKUP_DIR"
    fi
    
    # 克隆仓库
    git clone -b "$GIT_BRANCH" "$GIT_URL" "$REPO_DIR"
    cd "$REPO_DIR"
    
    # 清理可能的孤立容器
    cleanup_orphan_containers
    
    log_info "首次构建并启动..."
    docker compose -f deploy/docker-compose.yml build fabric-calculator
    docker compose -f deploy/docker-compose.yml up -d fabric-calculator
    
    sleep 5
    
    if docker compose -f deploy/docker-compose.yml ps fabric-calculator | grep -q "Up"; then
        log_info "服务启动成功！"
    else
        log_error "服务启动失败，请检查日志:"
        docker compose -f deploy/docker-compose.yml logs fabric-calculator
        exit 1
    fi
    
    log_info "部署完成！"
    exit 0
fi

# 后续更新流程
cd "$REPO_DIR"

log_info "正在获取最新代码..."
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/${GIT_BRANCH}")

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warn "代码已是最新，无需更新"
    exit 0
fi

log_info "检测到代码更新: ${LOCAL:0:7} -> ${REMOTE:0:7}"

# 拉取最新代码
log_info "执行 git pull ..."
git pull origin "$GIT_BRANCH"

# 清理可能的孤立容器（防止名称冲突）
cleanup_orphan_containers

# 重新构建并启动
log_info "重新构建 Docker 镜像..."
docker compose -f deploy/docker-compose.yml build fabric-calculator

log_info "重新启动服务..."
docker compose -f deploy/docker-compose.yml up -d fabric-calculator

# 等待服务启动
log_info "等待服务启动..."
sleep 5

# 检查服务状态
if docker compose -f deploy/docker-compose.yml ps fabric-calculator | grep -q "Up"; then
    log_info "服务启动成功！"
else
    log_error "服务启动失败，请检查日志:"
    docker compose -f deploy/docker-compose.yml logs fabric-calculator
    exit 1
fi

log_info "最近日志:"
docker compose -f deploy/docker-compose.yml logs --tail=20 fabric-calculator

log_info "部署完成！"
