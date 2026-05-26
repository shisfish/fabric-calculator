# =========================================================
# Stage 1: Frontend Builder
# =========================================================
FROM node:20-slim AS frontend-builder

WORKDIR /build

# 复制 package 文件（最大化利用缓存）
COPY package.json package-lock.json ./
RUN npm install

# 复制前端源码和构建脚本
COPY frontend/ ./frontend/

# 构建前端
RUN npm run build:frontend && \
    npm cache clean --force && \
    rm -rf /root/.npm /tmp/*


# =========================================================
# Stage 2: Node.js Binary Provider
# =========================================================
FROM node:20-slim AS node-provider


# =========================================================
# Stage 3: Python Runtime (生产镜像)
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
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# =========================================================
# 设置工作目录
# =========================================================
WORKDIR /app

# =========================================================
# 从 node:20-slim 复制 Node.js 二进制
# 避免 apt install nodejs 拉取 118 个依赖包
# =========================================================
COPY --from=node-provider /usr/local/bin/node /usr/local/bin/node
COPY --from=node-provider /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# =========================================================
# 更换 Debian 镜像源（腾讯云）
# 安装系统依赖 - opencv-python-headless 最小依赖
# 注意：headless 版本无需 libgl1/OpenGL
# =========================================================
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libsm6 \
        libxrender1 \
        libxext6 \
        librsvg2-bin \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# =========================================================
# 先复制 requirements（利用 Docker 缓存）
# =========================================================
COPY server/requirements.txt ./server/

# =========================================================
# 安装 Python 依赖
# =========================================================
RUN pip install \
    -r server/requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --no-compile

# =========================================================
# 全局安装 tsx（运行时 TypeScript 执行器）
# =========================================================
RUN npm install -g tsx && \
    npm cache clean --force && \
    rm -rf /root/.npm

# =========================================================
# 复制后端代码
# =========================================================
COPY server/ ./server/

# =========================================================
# 复制 CAD 引擎代码
# =========================================================
COPY cad-engine/ ./cad-engine/
COPY calc-engine/ ./calc-engine/
COPY package.json package-lock.json ./
RUN npm install --production && npm cache clean --force && rm -rf /root/.npm

# =========================================================
# 复制前端静态资源（非编译的JS/CSS/图片/模板）
# =========================================================
COPY frontend/static/ ./frontend/static/
COPY frontend/templates/ ./frontend/templates/

# =========================================================
# 从前端构建阶段复制编译后的 bundle
# =========================================================
COPY --from=frontend-builder /build/frontend/static/js/bundle.js ./frontend/static/js/bundle.js

# =========================================================
# 创建上传目录
# =========================================================
RUN mkdir -p /opt/fabric-data/uploads

# =========================================================
# 创建非 root 用户
# =========================================================
RUN useradd -m -r appuser

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
# 使用 Python urllib 避免安装 curl
# =========================================================
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=10s \
            --retries=3 \
CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

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
     "--chdir", "server", \
     "app:app"]
