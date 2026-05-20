# 后端模块文档

## 一、模块概览

后端采用Python Flask框架，提供RESTful API服务。主要包含以下核心模块：

| 模块 | 文件 | 功能 |
|------|------|------|
| Web服务 | app.py | Flask主应用，路由与API |
| 计算引擎 | calculator_engine.py | 面料用量计算 |
| 曲线引擎 | curved_engine.py | 曲线裁片计算 |
| 图片识别 | image_engine.py | AI图片测量 |
| 数据库管理 | db_manager.py | MySQL数据持久化 |
| 排料算法 | polygon_nesting.py | 多边形排料 |
| 裁片生成 | piece_generator.py | 裁片图片生成 |
| 图片生成 | image_generator.py | 排料图生成 |

---

## 二、Web服务模块 (app.py)

### 2.1 模块职责

Flask Web服务主程序，负责：
- HTTP路由处理
- API接口暴露
- 请求参数验证
- 响应数据封装
- 错误处理

### 2.2 核心路由

#### 页面路由

```python
@app.route('/')
def index():
    """精确计算页面"""

@app.route('/quick')
def quick_estimate():
    """快速估算页面"""

@app.route('/quotation')
def quotation():
    """报价单页面"""

@app.route('/history')
def history():
    """历史记录页面"""

@app.route('/curves')
def curves():
    """曲线模型计算页面"""

@app.route('/polygon-nesting')
def polygon_nesting_page():
    """多边形排料页面"""
```

#### API路由

**计算相关API**

```python
@app.route('/api/calculate', methods=['POST'])
def calculate():
    """精确计算面料用量"""
    data = request.get_json()
    result = calculator.calculate_consumption(data)
    return jsonify({"success": True, "data": result})

@app.route('/api/quick-estimate', methods=['POST'])
def quick_estimate_api():
    """快速估算"""
    data = request.get_json()
    result = calculator.quick_estimate(data)
    return jsonify({"success": True, "data": result})

@app.route('/api/calculate-curved', methods=['POST'])
def calculate_curved():
    """曲线模型计算"""
    data = request.get_json()
    result = curved_calculator.calculate_consumption_curved(data)
    return jsonify({"success": True, "data": result})

@app.route('/api/quotation', methods=['POST'])
def calculate_quotation():
    """计算报价"""
    data = request.get_json()
    result = quotation_engine.calculate_quotation(data)
    return jsonify({"success": True, "data": result})
```

**数据查询API**

```python
@app.route('/api/categories', methods=['GET'])
def get_categories():
    """获取所有品类"""

@app.route('/api/categories/<category_id>', methods=['GET'])
def get_category(category_id):
    """获取品类详情"""

@app.route('/api/fabric-types', methods=['GET'])
def get_fabric_types():
    """获取面料类型"""

@app.route('/api/dictionaries', methods=['GET'])
def get_dictionaries():
    """获取系统字典"""
```

**历史记录API**

```python
@app.route('/api/history', methods=['GET'])
def get_history():
    """获取历史记录"""

@app.route('/api/history/<record_id>', methods=['GET'])
def get_history_detail(record_id):
    """获取单条记录详情"""

@app.route('/api/history/<record_id>', methods=['DELETE'])
def delete_history(record_id):
    """删除记录"""

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    """清空历史记录"""
```

**AI图片识别API**

```python
@app.route('/api/image/upload', methods=['POST'])
def image_upload():
    """上传图片"""

@app.route('/api/image/calibrate', methods=['POST'])
def image_calibrate():
    """标定参照物"""

@app.route('/api/image/measure', methods=['POST'])
def image_measure():
    """测量裁片区域"""

@app.route('/api/image/annotate', methods=['POST'])
def image_annotate():
    """获取标注图片"""
```

**排料API**

```python
@app.route('/api/polygon-nesting', methods=['POST'])
def api_polygon_nesting():
    """多边形排料API"""
    data = request.get_json()
    pieces = data.get("pieces", [])
    fabric_width = float(data.get("fabric_width", 140))
    result = polygon_nesting(pieces, fabric_width)
    return jsonify({"success": True, "data": result})
```

### 2.3 依赖关系

```
app.py
  ├── calculator_engine.py (FabricCalculator, QuotationEngine)
  ├── curved_engine.py (CurvedPieceCalculator)
  ├── image_engine.py (MeasurementEngine)
  ├── db_manager.py (db_manager)
  ├── polygon_nesting.py (polygon_nesting)
  ├── piece_generator.py (generate_all_pieces_images)
  └── image_generator.py (generate_piece_image, generate_nesting_image)
```

---

## 三、计算引擎模块 (calculator_engine.py)

### 3.1 模块职责

核心面料用量计算引擎，负责：
- 品类配置管理
- 裁片面积计算
- 缝份、缩水率、损耗率计算
- 排料模拟
- 用量估算

### 3.2 核心类

#### FabricCalculator

```python
class FabricCalculator:
    """面料用量计算器"""
    
    def __init__(self):
        self.categories = DEFAULT_CATEGORIES
        self.fabric_types = FABRIC_TYPES
    
    def get_categories(self):
        """获取所有品类列表"""
        
    def get_category_detail(self, category_id):
        """获取品类详情"""
        
    def calculate_consumption(self, data):
        """
        精确计算面料用量
        
        参数:
            data: {
                "category": "tshirt",
                "pieces": [
                    {"name": "前片", "length": 70, "width": 30, "count": 2},
                    {"name": "后片", "length": 72, "width": 32, "count": 1},
                    ...
                ],
                "fabric_width": 145,
                "shrinkage_rate": 3,
                "wastage_rate": 5,
                "fabric_weight_gsm": 200
            }
        
        返回:
            {
                "per_piece_length_m": 1.25,
                "total_area_m2": 0.85,
                "utilization_rate": 0.82,
                "fabric_weight_kg": 0.17,
                "material_breakdown": {...},
                "pieces_detail": [...]
            }
        """
        
    def quick_estimate(self, data):
        """
        快速估算面料用量
        
        参数:
            data: {
                "category": "coat",
                "body_length": 100,
                "chest": 110,
                "shoulder": 45,
                "sleeve_length": 60
            }
        
        返回:
            {
                "main_fabric": {"per_piece_length_m": 2.5, ...},
                "lining": {"per_piece_length_m": 2.2, ...}
            }
        """
```

#### QuotationEngine

```python
class QuotationEngine:
    """报价计算引擎"""
    
    def calculate_quotation(self, consumption_data, pricing_data):
        """
        计算报价
        
        参数:
            consumption_data: 用量数据
            pricing_data: {
                "fabric_price": 50,  # 元/米
                "lining_price": 20,
                "labor_cost": 100,
                "other_cost": 50
            }
        
        返回:
            {
                "fabric_cost": 125,
                "lining_cost": 44,
                "labor_cost": 100,
                "other_cost": 50,
                "total_cost": 319,
                "profit_margin": 0.3,
                "suggested_price": 415
            }
        """
```

### 3.3 品类配置

```python
DEFAULT_CATEGORIES = {
    "coat": {
        "name": "大衣",
        "pieces": [
            {"id": "front_body", "name": "前片（左+右）", "default": True},
            {"id": "back_body", "name": "后片", "default": True},
            {"id": "sleeve", "name": "袖子（左+右）", "default": True},
            {"id": "collar", "name": "领子", "default": True},
            {"id": "pocket", "name": "口袋", "default": False},
            {"id": "belt", "name": "腰带", "default": False},
            {"id": "lining", "name": "里布", "default": True},
        ],
        "default_wastage": 8,
        "default_shrinkage": 3,
        "fabric_utilization": 0.78,
    },
    "down_jacket": {
        "name": "羽绒服",
        "pieces": [...],
        "has_filling": True,
        "has_lining": True,
    },
    "tshirt": {
        "name": "T恤",
        "pieces": [...],
        "default_wastage": 5,
        "default_shrinkage": 2,
    },
    ...
}
```

### 3.4 计算流程

```
输入数据
   ↓
验证参数
   ↓
计算裁片面积（含缝份、缩水）
   ↓
模拟排料
   ↓
计算利用率
   ↓
计算面料重量
   ↓
返回结果
```

---

## 四、曲线引擎模块 (curved_engine.py)

### 4.1 模块职责

曲线裁片计算引擎，负责：
- 非矩形裁片面积计算
- 曲线裁片顶点生成
- 多材料分类计算
- 裁片图片数据生成

### 4.2 核心类

```python
class CurvedPieceCalculator:
    """曲线裁片计算器"""
    
    def calculate_consumption_curved(self, data):
        """
        曲线模型计算
        
        参数:
            data: {
                "category": "tshirt",
                "pieces": [
                    {
                        "name": "前片",
                        "calc_method": "polygon",
                        "vertices": [[0,0], [30,0], [30,70], [0,70]],
                        "count": 2,
                        "material": "main"
                    },
                    {
                        "name": "袖子",
                        "calc_method": "trapezoid",
                        "top_width": 15,
                        "bottom_width": 20,
                        "height": 60,
                        "count": 2,
                        "material": "main"
                    },
                    ...
                ],
                "fabric_width": 145,
                "shrinkage_rate": 3,
                "wastage_rate": 5
            }
        
        返回:
            {
                "per_piece_length_m": 1.35,
                "total_area_m2": 0.92,
                "curved_pieces_count": 5,
                "material_breakdown": {
                    "main": {
                        "name": "主面料",
                        "length_cm": 135,
                        "area_cm2": 92000,
                        "utilization": 0.82
                    },
                    "rib": {
                        "name": "罗纹",
                        "length_cm": 15,
                        ...
                    }
                },
                "_piece_image_data": [...],  # 裁片图片数据
                "_material_piece_details": {...}  # 排料用裁片详情
            }
        """
```

### 4.3 计算方法

| 方法 | 说明 | 适用场景 |
|------|------|---------|
| `polygon` | 多边形面积计算 | 不规则裁片 |
| `trapezoid` | 梯形面积计算 | 袖子、领子 |
| `triangle` | 三角形面积计算 | 简单三角片 |
| `circle` | 圆形面积计算 | 圆形裁片 |
| `rectangle` | 矩形面积计算 | 简单矩形片 |

---

## 五、图片识别模块 (image_engine.py)

### 5.1 模块职责

AI图片识别引擎，负责：
- 图片上传与存储
- 参照物标定
- 裁片区域测量
- 标注图片生成

### 5.2 核心类

```python
class MeasurementEngine:
    """图片测量引擎"""
    
    def upload_image(self, image_data, session_id=None):
        """
        上传图片
        
        参数:
            image_data: 图片数据（base64或文件）
            session_id: 会话ID（可选）
        
        返回:
            {
                "session_id": "xxx",
                "image_width": 1920,
                "image_height": 1080
            }
        """
        
    def calibrate(self, session_id, ref_rect, ref_length_cm):
        """
        标定参照物
        
        参数:
            session_id: 会话ID
            ref_rect: 参照物区域 {x1, y1, x2, y2}
            ref_length_cm: 参照物实际长度（厘米）
        
        返回:
            {
                "pixels_per_cm": 10.5,
                "calibrated": True
            }
        """
        
    def measure_all_pieces(self, session_id, pieces_data):
        """
        测量所有裁片
        
        参数:
            session_id: 会话ID
            pieces_data: [
                {"name": "前片", "rect": {x1, y1, x2, y2}},
                {"name": "后片", "rect": {x1, y1, x2, y2}},
                ...
            ]
        
        返回:
            [
                {
                    "name": "前片",
                    "length_cm": 70.5,
                    "width_cm": 30.2,
                    "area_cm2": 2129.1
                },
                ...
            ]
        """
        
    def draw_annotations(self, session_id):
        """
        生成标注图片
        
        返回:
            base64编码的标注图片
        """
```

### 5.3 工作流程

```
上传图片
   ↓
创建会话
   ↓
框选参照物
   ↓
输入参照物实际长度
   ↓
计算像素/厘米比例
   ↓
框选各裁片区域
   ↓
计算裁片尺寸
   ↓
生成标注图片
```

---

## 六、数据库管理模块 (db_manager.py)

### 6.1 模块职责

MySQL数据库管理模块，负责：
- 数据库连接管理
- 历史记录CRUD操作
- 数据库健康检查

### 6.2 核心类

```python
class DBManager:
    """数据库管理器"""
    
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        """连接数据库"""
        
    def save_record(self, record):
        """
        保存计算记录
        
        参数:
            record: {
                "id": "20250520143000",
                "timestamp": "2025-05-20 14:30:00",
                "type": "precise",
                "category": "tshirt",
                "params": {...},
                "result": {...},
                "input_data": {...}
            }
        """
        
    def load_history(self, limit=100):
        """
        加载历史记录
        
        返回:
            [
                {
                    "id": "20250520143000",
                    "timestamp": "2025-05-20 14:30:00",
                    "type": "precise",
                    "category": "tshirt",
                    ...
                },
                ...
            ]
        """
        
    def get_record(self, record_id):
        """获取单条记录"""
        
    def delete_record(self, record_id):
        """删除记录"""
        
    def clear_history(self):
        """清空历史记录"""
        
    def check_health(self):
        """检查数据库健康状态"""
        
    def load_dictionaries(self):
        """加载系统字典"""
```

### 6.3 数据库表结构

**calculation_history表**

```sql
CREATE TABLE calculation_history (
    id VARCHAR(20) PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    params JSON,
    result JSON,
    input_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp),
    INDEX idx_type (type),
    INDEX idx_category (category)
);
```

---

## 七、排料算法模块 (polygon_nesting.py)

### 7.1 模块职责

多边形排料算法，负责：
- 不规则裁片排料
- 利用率优化
- 排料结果生成

### 7.2 核心函数

```python
def polygon_nesting(pieces, fabric_width):
    """
    多边形排料
    
    参数:
        pieces: [
            {
                "name": "前片",
                "width": 30,
                "height": 70,
                "count": 2,
                "material": "main",
                "seam_allowance": 1.5
            },
            ...
        ]
        fabric_width: 面料门幅（厘米）
    
    返回:
        {
            "total_length": 135.5,
            "utilization": 0.82,
            "rows": [
                {
                    "y": 0,
                    "height": 70,
                    "pieces_count": 4,
                    "pieces": [...]
                },
                ...
            ]
        }
    """
```

### 7.3 排料策略

- **按面积排序**：大面积裁片优先排料
- **紧凑排列**：尽量减少裁片间隙
- **旋转优化**：支持裁片旋转以提高利用率
- **多行布局**：适应面料门幅

---

## 八、裁片生成模块 (piece_generator.py)

### 8.1 模块职责

裁片图片生成器，负责：
- 根据裁片数据生成图片
- 缩略图生成
- 图片缓存管理

### 8.2 核心函数

```python
def generate_all_pieces_images(pieces, fabric_width_cm, save_to_file=True):
    """
    生成所有裁片图片
    
    参数:
        pieces: 裁片数据列表
        fabric_width_cm: 面料门幅
        save_to_file: 是否保存到文件
    
    返回:
        [
            {
                "name": "前片",
                "image_base64": "...",
                "file_path": "/static/calc_images/前片__50x70.png"
            },
            ...
        ]
        """
```

---

## 九、图片生成模块 (image_generator.py)

### 9.1 模块职责

排料图生成器，负责：
- 生成排料可视化图片
- 标注尺寸信息
- 图片缓存管理

### 9.2 核心函数

```python
def generate_piece_image(piece_info, vertices, save_to_file=False, history_id=None, image_order=0):
    """
    生成单个裁片图片
    
    参数:
        piece_info: 裁片信息
        vertices: 裁片顶点
        save_to_file: 是否保存到文件
        history_id: 历史记录ID
        image_order: 图片序号
    
    返回:
        {
            "base64": "...",
            "file_path": "/static/calc_images/前片__50x70.png"
        }
        """

def generate_nesting_image(material_name, rows, fabric_width_cm, total_length_cm, 
                           width_utilization, save_to_file=False, history_id=None, image_order=0):
    """
    生成排料图
    
    参数:
        material_name: 材料名称
        rows: 排料行数据
        fabric_width_cm: 面料门幅
        total_length_cm: 总长度
        width_utilization: 利用率
        save_to_file: 是否保存到文件
        history_id: 历史记录ID
        image_order: 图片序号
    
    返回:
        {
            "base64": "...",
            "file_path": "/static/calc_images/排料图.png"
        }
        """
```

---

## 十、模块间依赖关系

```
app.py (Flask主应用)
  │
  ├── calculator_engine.py
  │     └── 品类配置、计算逻辑
  │
  ├── curved_engine.py
  │     └── 曲线裁片计算
  │
  ├── image_engine.py
  │     └── 图片识别、测量
  │
  ├── db_manager.py
  │     └── MySQL数据库操作
  │
  ├── polygon_nesting.py
  │     └── 排料算法
  │
  ├── piece_generator.py
  │     └── 裁片图片生成
  │
  └── image_generator.py
        └── 排料图生成
```

---

## 十一、配置与环境变量

### 11.1 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MYSQL_HOST` | `localhost` | MySQL主机地址 |
| `MYSQL_PORT` | `3306` | MySQL端口 |
| `MYSQL_USER` | `fabric` | MySQL用户名 |
| `MYSQL_PASSWORD` | `fabric123` | MySQL密码 |
| `MYSQL_DATABASE` | `fabric_calculator` | 数据库名 |
| `FABRIC_DATA_DIR` | `/opt/fabric-data` | 数据文件存储目录 |

### 11.2 Flask配置

```python
app = Flask(__name__, 
            template_folder='templates', 
            static_folder='static')
app.config['JSON_AS_ASCII'] = False
```

---

## 十二、错误处理

### 12.1 统一错误响应

```python
{
    "success": False,
    "message": "错误描述"
}
```

### 12.2 常见错误码

| HTTP状态码 | 说明 |
|-----------|------|
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 十三、日志与调试

### 13.1 日志输出

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("计算完成")
logger.error("计算错误: %s", str(e))
```

### 13.2 调试模式

```python
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```
