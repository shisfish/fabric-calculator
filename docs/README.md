# 面料用量快速计算系统

## 使用说明与工作流程

---

## 一、系统简介

本系统用于**替代版师测量环节**，在获取成品衣服后，通过简单的手工测量即可快速计算面料用量，用于前期快速报价。

### 核心功能

| 功能 | 说明 |
|------|------|
| **快速估算** | 输入衣长、胸围等4个关键尺寸，30秒内得到用量估算 |
| **精确计算** | 逐片录入各分片测量数据，得到较精准的用量 |
| **报价管理** | 结合材料价格和加工费用，自动生成报价单 |
| **历史记录** | 保存所有计算记录，使用MySQL数据库存储 |

### 支持品类

大衣、羽绒服、夹克、风衣、棉服、裤子、裙子、衬衫、T恤，以及自定义品类。

---

## 二、安装与启动

### 环境要求

- Python 3.7 或更高版本
- pip（Python 包管理器）
- MySQL 8.0

### 安装步骤

#### 方式一：本地开发

```bash
# 1. 进入项目目录
cd fabric-calculator

# 2. 安装依赖
pip install -r requirements.txt --break-system-packages

# 3. 初始化MySQL数据库（需提前安装MySQL 8.0）
mysql -u root -p < init.sql

# 4. 配置环境变量（或直接修改代码中的默认值）
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=fabric
export MYSQL_PASSWORD=fabric123
export MYSQL_DATABASE=fabric_calculator

# 5. 启动服务
python3 app.py
```

#### 方式二：Docker部署（推荐）

```bash
# 1. 进入项目目录
cd fabric-calculator

# 2. 启动所有服务（包含MySQL）
docker compose up -d

# MySQL容器首次启动时会自动执行 init.sql 初始化数据库

# 3. 查看服务状态
docker compose ps
```

### 访问系统

启动后在浏览器中打开：

- **精确计算**：http://localhost:5000
- **快速估算**：http://localhost:5000/quick
- **报价管理**：http://localhost:5000/quotation
- **历史记录**：http://localhost:5000/history

---

## 三、数据存储配置

### 数据库初始化

系统使用 MySQL 数据库存储历史记录。数据库初始化通过 `init.sql` 完成：

- **Docker部署**：MySQL容器首次启动时自动执行 `init.sql`（挂载到 `/docker-entrypoint-initdb.d/`），无需手动操作
- **手动执行**：如果MySQL容器非首次启动，需手动执行初始化：
  ```bash
  docker compose exec mysql mysql -u root -pfabric_root_123 < init.sql
  ```

### 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MYSQL_HOST` | `localhost` | MySQL主机地址 |
| `MYSQL_PORT` | `3306` | MySQL端口 |
| `MYSQL_USER` | `fabric` | MySQL用户名 |
| `MYSQL_PASSWORD` | `fabric123` | MySQL密码 |
| `MYSQL_DATABASE` | `fabric_calculator` | 数据库名 |
| `FABRIC_DATA_DIR` | `/opt/fabric-data` | 数据文件存储目录（上传图片等） |

### Docker Compose 配置

使用Docker Compose部署时，MySQL服务已自动配置：

```yaml
# MySQL 默认配置
- 数据库: fabric_calculator
- 用户名: fabric
- 密码: fabric123
- 端口: 3306
- 数据持久化: /opt/fabric-mysql-data
- 初始化脚本: init.sql（首次启动自动执行）
```

如需修改MySQL密码，请同时修改：
1. `docker-compose.yml` 中的 `MYSQL_PASSWORD`
2. `fabric-calculator` 服务中的 `MYSQL_PASSWORD` 环境变量

---

## 四、优化后的工作流程

### 原流程 vs 新流程

```
【原流程】
获取成品 → 拍照 → 交给版师 → 等待测量 → 录入系统 → 得出用量 → 整理报价
                       ↑ 沟通成本高    ↑ 等待时间长    ↑ 耗时操作

【新流程】
获取成品 → 拍照 → 自行简单测量 → 录入本系统 → 得出用量 → 整理报价
                       ↑ 几分钟即可完成    ↑ 即时计算
```

### 推荐工作流程

#### 方案A：快速报价（30秒出结果）

1. **拍照记录**：对成品衣服拍照（正面、背面、细节）
2. **简单测量**：量取4个关键尺寸
   - 衣长（后领中点到下摆）
   - 胸围（腋下最丰满处围量）
   - 肩宽（两肩端点距离）
   - 袖长（肩端点到袖口）
3. **快速估算**：打开系统 → 快速估算页面 → 输入数据 → 得到用量
4. **生成报价**：点击"生成报价单" → 输入材料价格 → 得到报价

#### 方案B：精确报价（5-10分钟出结果）

1. **拍照记录**：对成品衣服拍照
2. **分片测量**：将衣服平铺，逐片测量各分片尺寸
   - 前片：长度 × 宽度
   - 后片：长度 × 宽度
   - 袖子：长度 × 宽度（最宽处）
   - 领子、口袋等配件
3. **精确计算**：打开系统 → 精确计算页面 → 选择品类 → 录入数据 → 计算
4. **生成报价**：点击"生成报价单" → 输入材料价格 → 得到报价

---

## 五、测量方法指南

### 基本测量原则

1. **平铺测量**：将衣服平放在桌面上，抚平褶皱
2. **不含缝份**：测量成品尺寸即可，系统会自动加缝份
3. **取最大值**：长度和宽度取该裁片的最大尺寸
4. **单位统一**：所有尺寸使用厘米（cm）

### 大衣/外套各分片测量方法

| 裁片 | 测量方法 |
|------|---------|
| 前片 | 从肩线最高点垂直量到下摆（长度），腋下水平最宽处（宽度） |
| 后片 | 从后领中点垂直量到下摆（长度），后背最宽处（宽度） |
| 袖子 | 从袖山顶点量到袖口（长度），袖肥最宽处（宽度） |
| 领子 | 领子展开后的长度和宽度 |
| 口袋 | 口袋布的长度和宽度 |
| 腰带 | 腰带展开后的长度和宽度 |

### 羽绒服额外测量

| 裁片 | 测量方法 |
|------|---------|
| 帽子 | 帽子展开后的高度和宽度 |
| 袖口罗纹 | 罗纹部分的长度和周长 |
| 下摆罗纹 | 罗纹部分的长度和周长 |

---

## 六、参数设置参考

### 面料门幅

| 面料类型 | 常见门幅 |
|----------|---------|
| 梭织面料 | 140/145/148/150 cm |
| 针织面料 | 150/155/160/165 cm |
| 羽绒服面料 | 140/145/148/150 cm |
| 里布 | 140/145/148/150 cm |
| 衬布 | 90/100/110/140/150 cm |

### 缩水率

| 面料种类 | 缩水率 |
|----------|--------|
| 棉布（未预缩） | 3%-5% |
| 棉布（预缩） | 1%-2% |
| 毛/羊毛 | 2%-4% |
| 化纤 | 1%-3% |

### 损耗率

| 场景 | 损耗率 |
|------|--------|
| 梭织面料（常规） | 5%-6% |
| 针织面料 | 6%-8% |
| 复杂款式 | 8%-12% |
| 小批量（<50件） | 在标准基础上+3%-6% |
| 印花/起绒面料 | 在标准基础上+8% |

---

## 七、系统架构

```
fabric-calculator/
├── app.py                  # Flask Web服务主程序
├── calculator_engine.py    # 核心计算引擎
├── curved_engine.py        # 曲线裁片计算引擎
├── image_engine.py         # AI图片识别引擎
├── db_manager.py           # 数据库管理模块
├── init.sql                # MySQL数据库初始化脚本
├── start.sh                # 一键启动脚本
├── requirements.txt        # Python依赖
├── Dockerfile              # Docker镜像构建
├── docker-compose.yml      # Docker Compose配置
├── templates/              # HTML模板
│   ├── index.html          # 精确计算页面
│   ├── quick.html          # 快速估算页面
│   ├── quotation.html      # 报价管理页面
│   ├── history.html        # 历史记录页面
│   ├── detail.html         # 历史记录详情
│   └── curves.html         # 曲线模型页面
├── static/                 # 静态资源
│   ├── css/style.css       # 样式表
│   └── js/
│       ├── app.js          # 精确计算逻辑
│       ├── quick.js        # 快速估算逻辑
│       ├── quotation.js    # 报价管理逻辑
│       ├── history.js      # 历史记录逻辑
│       └── curves.js       # 曲线模型逻辑
└── data/                   # 数据存储（上传图片等）
```

### 数据库表结构

**calculation_history** - 计算历史记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(20) | 主键，记录ID（YYYYMMDDHHMMSS格式） |
| timestamp | DATETIME | 计算时间 |
| type | VARCHAR(20) | 计算类型：precise/quick/curved |
| category | VARCHAR(50) | 品类 |
| params | JSON | 计算参数 |
| result | JSON | 计算结果 |
| input_data | JSON | 完整输入数据 |
| created_at | TIMESTAMP | 记录创建时间 |

### 计算方法说明

本系统采用**面积法 + 经验公式法**相结合的方式：

1. **面积法**：将各裁片简化为规则形状（矩形/梯形），计算面积后除以面料门幅得到用料长度
2. **经验公式法**：基于行业标准公式，用少量关键尺寸快速推算用量
3. **自动修正**：系统自动加入缝份、缩水率、损耗率、面料利用率等修正系数

### 精度说明

| 方法 | 精度 | 适用场景 |
|------|------|---------|
| 快速估算 | 偏差约 8%-15% | 初步询价、快速报价 |
| 精确计算 | 偏差约 5%-10% | 正式报价、成本核算 |
| CAD排料（原流程） | 偏差约 1%-3% | 大货生产、精确采购 |

> 💡 **建议**：前期快速报价使用本系统，正式生产前仍需通过版师精确排料确认最终用量。

---

## 八、API 接口文档

系统提供 RESTful API，可与其他系统集成：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/categories` | GET | 获取所有品类 |
| `/api/categories/<id>` | GET | 获取品类详情 |
| `/api/fabric-types` | GET | 获取面料类型 |
| `/api/calculate` | POST | 精确计算用量 |
| `/api/quick-estimate` | POST | 快速估算用量 |
| `/api/quotation` | POST | 计算报价 |
| `/api/calculate-curved` | POST | 曲线模型计算 |
| `/api/history` | GET | 获取历史记录 |
| `/api/history/<id>` | GET | 获取单条记录详情 |
| `/api/history/<id>` | DELETE | 删除记录 |
| `/api/history/clear` | POST | 清空记录 |
| `/api/health` | GET | 健康检查（含数据库状态） |

---

## 九、常见问题

**Q: 快速估算的精度够用吗？**
A: 快速估算适用于前期快速报价，偏差约8%-15%。建议在报价中预留一定余量，正式生产前进行精确计算。

**Q: 如何处理格子/条纹面料的对位损耗？**
A: 在损耗率中额外增加5%-8%来覆盖对位损耗。

**Q: 羽绒服的充绒量怎么计算？**
A: 在精确计算中，系统会根据裁片面积自动分配充绒量。也可在快速估算中手动输入总充绒量。

**Q: 可以多人同时使用吗？**
A: 可以。使用MySQL数据库存储，支持多人同时使用。建议使用Docker部署方式。

**Q: 数据保存在哪里？**
A: 数据保存在MySQL数据库中。Docker部署时，数据持久化在 `/opt/fabric-mysql-data` 目录。

**Q: MySQL连接失败怎么办？**
A: 请检查以下几点：
1. MySQL服务是否已启动（`docker compose ps`）
2. 环境变量配置是否正确
3. `init.sql` 是否已执行（数据库表是否已创建）。可通过以下命令检查并手动初始化：
   ```bash
   docker compose exec mysql mysql -u root -pfabric_root_123 < init.sql
   ```

---

## 十、更新日志

### v1.1.0 (2025-05-06)
- 新增MySQL数据库支持
- 新增数据库健康检查接口 `/api/health`
- 新增 `init.sql` 数据库自动初始化
- 更新Docker Compose配置，添加MySQL 8服务
- 完善部署文档
