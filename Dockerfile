# =========================================================
# Stage 1: Frontend Builder
# =========================================================
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# 复制 package 文件（最大化利用缓存）
COPY package.json package-lock.json ./

# 使用 npm ci 保证依赖稳定
RUN npm ci

# 复制前端源码
COPY build-frontend.js ./
COPY static/js/cad/ ./static/js/cad/

# 构建前端
RUN npm run build:frontend


# =========================================================
# Stage 2: Python Runtime
# =========================================================
FROM python:3.11-slim

LABEL maintainer="fabric-calculator"
LABEL description="Fabric Consumption Quick Calculator"

# =========================================================
# 环境变量
# =========================================================
ENV TZ=Asia/Shanghai \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# =========================================================
# 设置工作目录
# =========================================================
WORKDIR /app

# =========================================================
# 更换 Debian 镜像源（腾讯云）
# =========================================================
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources

# =========================================================
# 安装系统依赖
# =========================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# =========================================================
# 先复制 requirements（利用 Docker 缓存）
# =========================================================
COPY requirements.txt .

# =========================================================
# 安装 Python 依赖
# =========================================================
RUN pip install \
    -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple

# =========================================================
# 安装 Gunicorn
# =========================================================
RUN pip install gunicorn \
    -i https://pypi.tuna.tsinghua.edu.cn/simple

# =========================================================
# 复制项目文件
# =========================================================
COPY . .

# =========================================================
# 从前端构建阶段复制静态资源
# =========================================================
COPY --from=frontend-builder /frontend/static/js/cad/dist ./static/js/cad/dist

# =========================================================
# 创建上传目录
# =========================================================
RUN mkdir -p /opt/fabric-data/uploads

# =========================================================
# 创建非 root 用户
# =========================================================
RUN useradd -m appuser

# 目录权限
RUN chown -R appuser:appuser /app /opt/fabric-data

# 切换用户
USER appuser

# =========================================================
# 暴露端口
# =========================================================
EXPOSE 5000

# =========================================================
# 健康检查
# 必须确保 Flask 存在 /health 接口
# =========================================================
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=10s \
            --retries=3 \
CMD curl -f http://localhost:5000/health || exit 1

# =========================================================
# Gunicorn 启动参数
# =========================================================
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "3", \
     "--threads", "2", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]