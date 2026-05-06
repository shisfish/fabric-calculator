# 腾讯云服务器部署指南

## 一、服务器环境准备（仅需执行一次）

### 1.1 安装Docker（如已安装可跳过）

```bash
# 使用官方脚本一键安装Docker
curl -fsSL https://get.docker.com | sh

# 启动Docker并设置开机自启
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
```

### 1.2 安装Docker Compose（Docker新版本已内置，如不可用则手动安装）

```bash
# 检查是否已内置
docker compose version

# 如果没有，手动安装
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 1.3 开放防火墙端口

```bash
# 腾讯云安全组：在腾讯云控制台 → 安全组 → 添加入站规则
#   协议: TCP
#   端口: 5000
#   来源: 0.0.0.0/0（所有IP）或限制为您的IP

# 服务器防火墙（如果启用了firewalld或ufw）
# ufw:
ufw allow 5000/tcp
ufw reload

# firewalld:
firewall-cmd --permanent --add-port=5000/tcp
firewall-cmd --reload
```

---

## 二、部署应用

### 2.1 上传项目文件

将整个 `fabric-calculator` 文件夹上传到服务器，例如放到 `/opt/` 目录：

```bash
# 方法1: 使用scp（在本地电脑执行）
scp -r fabric-calculator root@<你的服务器IP>:/opt/

# 方法2: 使用git（如果项目在git仓库）
cd /opt
git clone <你的仓库地址> fabric-calculator
```

### 2.2 一键部署

```bash
cd /opt/fabric-calculator
chmod +x deploy.sh
./deploy.sh
```

### 2.3 手动部署（如果一键脚本不可用）

```bash
cd /opt/fabric-calculator

# 构建镜像
docker compose build --no-cache

# 启动容器（后台运行）
docker compose up -d

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f
```

---

## 三、验证部署

```bash
# 在服务器上测试
curl http://localhost:5000/

# 在浏览器中访问
# http://<你的服务器公网IP>:5000
```

---

## 四、日常运维命令

```bash
cd /opt/fabric-calculator

# 查看服务状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新代码后重新部署
git pull                          # 拉取最新代码
docker compose build --no-cache   # 重新构建镜像
docker compose up -d              # 重新启动

# 进入容器内部调试
docker compose exec fabric-calculator bash

# 查看容器资源占用
docker stats fabric-calculator
```

---

## 五、数据备份

数据存储在 `/opt/fabric-data/` 目录下（项目外部，通过Docker卷挂载持久化，部署不会覆盖）：

```bash
# 备份数据
tar -czf backup_$(date +%Y%m%d).tar.gz /opt/fabric-data/

# 恢复数据
tar -xzf backup_20260429.tar.gz -C /
docker compose restart
```

---

## 六、常见问题

**Q: 访问不了页面？**
```bash
# 1. 检查容器是否在运行
docker compose ps

# 2. 检查端口是否被监听
netstat -tlnp | grep 5000

# 3. 检查腾讯云安全组是否开放了5000端口
#    腾讯云控制台 → 安全组 → 入站规则 → 确认有TCP 5000
```

**Q: 如何修改端口？**
编辑 `docker-compose.yml`，将 `"5000:5000"` 改为 `"你的端口:5000"`，例如 `"80:5000"`，然后 `docker compose up -d`。

**Q: 如何配置域名和HTTPS？**
建议在服务器前端安装Nginx作为反向代理，配合Let's Encrypt证书：
```bash
apt install nginx certbot python3-certbot-nginx -y
# 配置Nginx后执行:
certbot --nginx -d yourdomain.com
```

**Q: 如何查看Python版本？**
```bash
docker compose exec fabric-calculator python --version
```
