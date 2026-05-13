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
# Stage 2: Python Runtime (生产镜像)
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

RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY requirements.txt .

RUN pip install \
    -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --no-compile

COPY . .

COPY --from=frontend-builder /frontend/static/js/cad/dist ./static/js/cad/dist

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
