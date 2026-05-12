# 面料用量快速计算系统 - Dockerfile
FROM python:3.13-slim

LABEL maintainer="fabric-calculator"
LABEL description="面料用量快速计算系统 - Fabric Consumption Quick Calculator"

# 设置时区为上海
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 使用腾讯云内网镜像源加速
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources

# 安装系统依赖 + Node.js 20 LTS（CAD 排料模块需要 TypeScript 运行时）
# 合并为单层 RUN 避免重复构建，apt 缓存清理在同一层减小镜像体积
RUN set -eux; \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        nodejs \
    && node --version \
    && npm --version \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 设置工作目录
WORKDIR /app

# 先复制依赖文件，利用Docker缓存层加速构建
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 安装 Node.js 依赖（CAD排料模块需要TypeScript运行时）
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# 复制项目文件
COPY . .

# 创建数据目录（持久化数据通过Docker卷挂载到外部路径）
RUN mkdir -p /opt/fabric-data/uploads

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/')" || exit 1

# 使用 gunicorn 作为生产服务器
RUN pip install --no-cache-dir gunicorn -i https://pypi.tuna.tsinghua.edu.cn/simple

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "8", "--timeout", "120", "--limit-request-line", "8190", "app:app"]
