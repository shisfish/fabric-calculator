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

# 如需远程访问MySQL（可选，不推荐）
#   协议: TCP
#   端口: 3306
#   来源: 限制为您的IP

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

### 2.2 创建数据目录

```bash
# 创建数据持久化目录
mkdir -p /opt/fabric-data
mkdir -p /opt/fabric-mysql-data

# 设置权限（Docker容器需要写入权限）
chmod 755 /opt/fabric-data
chmod 755 /opt/fabric-mysql-data
```

### 2.3 一键部署

```bash
cd /opt/fabric-calculator
chmod +x deploy.sh
./deploy.sh
```

> **数据库初始化**：MySQL容器首次启动时，会自动挂载并执行 `init.sql` 完成数据库和表的创建，无需手动操作。

### 2.4 手动部署（如果一键脚本不可用）

```bash
cd /opt/fabric-calculator

# 构建并启动所有服务（包含MySQL）
docker compose up -d --build

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f
```

> 如果MySQL容器非首次启动（数据目录已存在），`init.sql` 不会自动执行。此时需手动初始化：
> ```bash
> docker compose exec -T mysql mysql -u root -pfabric_root_123 < init.sql
> ```

---

## 三、验证部署

### 3.1 检查服务状态

```bash
# 查看所有服务状态
docker compose ps

# 预期输出：
# NAME              STATUS          PORTS
# fabric-calculator Up (healthy)    0.0.0.0:5000->5000/tcp
# fabric-mysql      Up (healthy)    0.0.0.0:3306->3306/tcp
```

### 3.2 检查健康状态

```bash
# 检查应用健康状态
curl http://localhost:5000/api/health

# 预期输出：
# {
#   "success": true,
#   "data": {
#     "status": "healthy",
#     "database": {
#       "status": "connected",
#       "message": "MySQL连接正常",
#       "host": "mysql",
#       "database": "fabric_calculator",
#       "record_count": 0
#     }
#   }
# }
```

### 3.3 访问系统

```bash
# 在服务器上测试
curl http://localhost:5000/

# 在浏览器中访问
# http://<你的服务器公网IP>:5000
```

---

## 四、MySQL数据库管理

### 4.1 连接MySQL

```bash
# 进入MySQL容器
docker compose exec mysql mysql -u fabric -pfabric123 fabric_calculator

# 或在容器外连接（需开放3306端口）
mysql -h <服务器IP> -P 3306 -u fabric -pfabric123 fabric_calculator
```

### 4.2 常用MySQL操作

```sql
-- 查看历史记录表
SELECT * FROM calculation_history ORDER BY timestamp DESC LIMIT 10;

-- 查看记录总数
SELECT COUNT(*) FROM calculation_history;

-- 清空历史记录（谨慎操作）
TRUNCATE TABLE calculation_history;
```

### 4.3 备份与恢复

```bash
# 备份MySQL数据
docker compose exec mysql mysqldump -u root -pfabric_root_123 fabric_calculator > backup_$(date +%Y%m%d).sql

# 恢复MySQL数据
docker compose exec -T mysql mysql -u root -pfabric_root_123 fabric_calculator < backup_20260506.sql

# 备份数据目录（包含上传图片）
tar -czf fabric_data_backup_$(date +%Y%m%d).tar.gz /opt/fabric-data/

# 恢复数据目录
tar -xzf fabric_data_backup_20260506.tar.gz -C /
```

---

## 五、日常运维命令

```bash
cd /opt/fabric-calculator

# 查看服务状态
docker compose ps

# 查看实时日志（所有服务）
docker compose logs -f

# 查看应用日志
docker compose logs -f fabric-calculator

# 查看MySQL日志
docker compose logs -f mysql

# 停止服务
docker compose down

# 停止服务并删除数据卷（谨慎操作！）
docker compose down -v

# 重启服务
docker compose restart

# 重启单个服务
docker compose restart fabric-calculator

# 更新代码后重新部署
git pull                          # 拉取最新代码
docker compose build --no-cache   # 重新构建镜像
docker compose up -d              # 重新启动

# 进入容器内部调试
docker compose exec fabric-calculator bash
docker compose exec mysql bash

# 查看容器资源占用
docker stats fabric-calculator fabric-mysql
```

---

## 六、配置修改

### 6.1 修改MySQL密码

如需修改MySQL密码，请按以下步骤操作：

1. 编辑 `docker-compose.yml`：
```yaml
# 修改MySQL root密码
MYSQL_ROOT_PASSWORD: 你的新root密码

# 修改应用用户密码
MYSQL_PASSWORD: 你的新密码
```

2. 同时修改应用服务的环境变量：
```yaml
MYSQL_PASSWORD: 你的新密码
```

3. 重新部署：
```bash
docker compose down
docker compose up -d
```

### 6.2 修改应用端口

编辑 `docker-compose.yml`：
```yaml
ports:
  - "8080:5000"  # 将5000改为8080或其他端口
```

然后重启服务：
```bash
docker compose up -d
```

### 6.3 使用外部MySQL

如需使用外部MySQL服务器，修改 `docker-compose.yml`：

```yaml
fabric-calculator:
  # ... 其他配置
  environment:
    - MYSQL_HOST=你的MySQL服务器IP
    - MYSQL_PORT=3306
    - MYSQL_USER=fabric
    - MYSQL_PASSWORD=你的密码
    - MYSQL_DATABASE=fabric_calculator
  # 移除 depends_on mysql
```

然后移除或注释掉 `docker-compose.yml` 中的 `mysql` 服务部分。

> **注意**：使用外部MySQL时，需手动执行 `init.sql` 初始化数据库表结构：
> ```bash
> mysql -h 你的MySQL服务器IP -P 3306 -u fabric -p你的密码 fabric_calculator < init.sql
> ```

---

## 七、数据备份策略

### 7.1 自动备份脚本

创建 `/opt/backup.sh`：

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份MySQL
docker exec fabric-mysql mysqldump -u root -pfabric_root_123 fabric_calculator > $BACKUP_DIR/mysql_$DATE.sql

# 备份上传的图片数据
tar -czf $BACKUP_DIR/fabric_data_$DATE.tar.gz /opt/fabric-data/

# 保留最近30天的备份
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

添加定时任务：
```bash
chmod +x /opt/backup.sh

# 编辑crontab
crontab -e

# 添加每日凌晨2点备份
0 2 * * * /opt/backup.sh >> /var/log/backup.log 2>&1
```

---

## 八、常见问题

**Q: 访问不了页面？**
```bash
# 1. 检查容器是否在运行
docker compose ps

# 2. 检查端口是否被监听
netstat -tlnp | grep 5000

# 3. 检查腾讯云安全组是否开放了5000端口
#    腾讯云控制台 → 安全组 → 入站规则 → 确认有TCP 5000

# 4. 检查应用日志
docker compose logs fabric-calculator
```

**Q: MySQL连接失败？**
```bash
# 1. 检查MySQL容器状态
docker compose ps

# 2. 检查MySQL日志
docker compose logs mysql

# 3. 检查应用是否能连接MySQL
docker compose exec fabric-calculator python -c "from db_manager import db_manager; print(db_manager.check_health())"

# 4. 检查init.sql是否已执行（数据库表是否已创建）
docker compose exec mysql mysql -u root -pfabric_root_123 -e "USE fabric_calculator; SHOW TABLES;"

# 如果表不存在，手动执行初始化
docker compose exec mysql mysql -u root -pfabric_root_123 < init.sql
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

**Q: 如何迁移旧数据？**
如果之前使用JSON文件存储，旧数据保留在 `/opt/fabric-data/history.json`。

如需将旧数据导入MySQL，可以编写脚本读取JSON文件，通过API接口将数据重新录入到MySQL数据库中。

---

## 九、安全建议

1. **修改默认密码**：生产环境请务必修改MySQL的默认密码
2. **限制端口访问**：
   - 5000端口：限制为仅允许特定IP访问
   - 3306端口：不建议对外开放，如需开放请限制为特定IP
3. **定期备份**：配置自动备份策略
4. **更新镜像**：定期更新Docker镜像以获取安全补丁

---

## 十、更新日志

### v1.1.0 (2025-05-06)
- 新增MySQL 8.0数据库支持
- 新增独立MySQL容器
- 新增健康检查接口
- 新增 `init.sql` 数据库自动初始化
- 完善部署文档和运维指南
