# =========================================================
# Stage 1: Frontend Builder
# =========================================================
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

COPY package.json package-lock.json ./
RUN npm install

COPY build-frontend.js ./
COPY static/js/cad/ ./static/js/cad/

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

ENV TZ=Asia/Shanghai \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 从 node:20-slim 复制 Node.js 二进制（避免 apt install nodejs 的 118 个依赖）
COPY --from=node-provider /usr/local/bin/node /usr/local/bin/node
COPY --from=node-provider /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# 只安装 OpenCV + rsvg-convert 必需的系统库
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
        librsvg2-bin \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY requirements.txt .

RUN pip install \
    -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --no-compile

# 全局安装 tsx（运行时需要）
RUN npm install -g tsx && \
    npm cache clean --force && \
    rm -rf /root/.npm

COPY . .

# 清理旧编译JS文件，确保 tsx 运行时代码解析到最新的 .ts 源码
RUN rm -rf dist/

COPY --from=frontend-builder /frontend/static/js/cad/bundle.js ./static/js/cad/bundle.js

RUN mkdir -p /opt/fabric-data/uploads && \
    useradd -m -r appuser && \
    chown -R appuser:appuser /app /opt/fabric-data

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=10s \
            --retries=3 \
CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

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
