#!/bin/bash
# ========================================
# 自动部署脚本：从 GitHub 拉取最新代码并重新发布
# 用法：./deploy.sh [git_branch]
# ========================================

set -e

# 配置
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${1:-main}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="docker-compose.yml"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 Git
if ! command -v git &> /dev/null; then
    log_error "Git 未安装"
    exit 1
fi

cd "$REPO_DIR"

# 检查是否为 Git 仓库
if [ ! -d ".git" ]; then
    log_error "当前目录不是 Git 仓库"
    exit 1
fi

# 获取最新代码
log_info "正在切换到分支: $GIT_BRANCH"
git checkout "$GIT_BRANCH" 2>/dev/null || git checkout -b "$GIT_BRANCH" 2>/dev/null || true

log_info "正在拉取最新代码..."
git fetch "$GIT_REMOTE"
LOCAL=$(git rev-parse "@")
REMOTE=$(git rev-parse "${GIT_REMOTE}/${GIT_BRANCH}")

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warn "代码已是最新，无需更新"
    exit 0
fi

log_info "检测到代码更新，正在部署..."
log_info "本地: $LOCAL"
log_info "远程: $REMOTE"

# 拉取最新代码
log_info "执行 git pull ..."
git pull "$GIT_REMOTE" "$GIT_BRANCH"

# 重新构建并启动
log_info "重新构建 Docker 镜像..."
docker compose build fabric-calculator --no-cache

log_info "重新启动服务..."
docker compose up -d fabric-calculator

# 等待服务启动
log_info "等待服务启动..."
sleep 5

# 检查服务状态
if docker compose ps fabric-calculator | grep -q "Up"; then
    log_info "服务启动成功！"
else
    log_error "服务启动失败，请检查日志:"
    docker compose logs fabric-calculator
    exit 1
fi

# 显示日志
log_info "最近日志:"
docker compose logs --tail=20 fabric-calculator

log_info "部署完成！"
