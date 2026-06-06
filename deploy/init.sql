-- ========================================
-- 面料用量快速计算系统 - 数据库初始化脚本
-- Database: fabric_calculator
-- 注意：此文件必须使用 UTF-8 编码保存
-- ========================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET collation_connection = utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS fabric_calculator 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE fabric_calculator;

-- ========================================
-- 表: sys_dict
-- 描述: 系统字典表（统一管理品类、材料、形状等名称映射）
-- ========================================
CREATE TABLE IF NOT EXISTS sys_dict (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    dict_type VARCHAR(50) NOT NULL COMMENT '字典类型: category/material/shape',
    dict_key VARCHAR(50) NOT NULL COMMENT '字典键',
    dict_value VARCHAR(100) NOT NULL COMMENT '字典值（显示名称）',
    sort_order INT DEFAULT 0 COMMENT '排序',
    remark VARCHAR(255) COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_dict_type_key (dict_type, dict_key),
    INDEX idx_dict_type (dict_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统字典表';

-- ========================================
-- 初始化字典数据
-- ========================================
INSERT IGNORE INTO sys_dict (dict_type, dict_key, dict_value, sort_order) VALUES
-- 品类名称映射
('category', 'coat', '大衣', 1),
('category', 'down_jacket', '羽绒服', 2),
('category', 'jacket', '夹克', 3),
('category', 'windbreaker', '风衣', 4),
('category', 'cotton_padded', '棉服', 5),
('category', 'pants', '裤子', 6),
('category', 'skirt', '裙子', 7),
('category', 'shirt', '衬衫', 8),
('category', 'tshirt', 'T恤', 9),
('category', 'custom', '自定义', 10),
-- 材料名称映射
('material', 'main', '主面料', 1),
('material', 'lining', '里布', 2),
('material', 'interlining', '衬布', 3),
('material', 'filling_fabric_single', '胆料(单层)', 4),
('material', 'filling_fabric_double', '胆料(双层)', 5),
('material', 'rib', '罗纹', 6),
('material', 'other', '其他', 7),
-- 形状名称映射
('shape', 'rectangle', '矩形', 1),
('shape', 'trapezoid', '梯形', 2),
('shape', 'triangle', '三角形', 3),
('shape', 'circle', '圆形', 4);

-- ========================================
-- 表: calculation_history
-- 描述: 计算历史主表
-- ========================================
CREATE TABLE IF NOT EXISTS calculation_history (
    id VARCHAR(20) PRIMARY KEY COMMENT '记录ID（时间戳格式）',
    timestamp DATETIME NOT NULL COMMENT '计算时间',
    type VARCHAR(20) NOT NULL COMMENT '计算类型: precise(精确)/curved(曲线)/quick(快速)',
    category VARCHAR(50) NOT NULL COMMENT '品类ID',
    category_name VARCHAR(50) NOT NULL DEFAULT '' COMMENT '品类名称',
    fabric_width DECIMAL(8,2) COMMENT '面料门幅(cm)',
    fabric_type VARCHAR(20) COMMENT '面料类型: woven(梭织)/knit(针织)等',
    fabric_weight_gsm DECIMAL(8,2) COMMENT '面料克重(g/m²)',
    shrinkage_rate DECIMAL(5,2) COMMENT '缩水率(%)',
    wastage_rate DECIMAL(5,2) COMMENT '损耗率(%)',
    quantity INT COMMENT '订单数量(件)',
    per_piece_length_m DECIMAL(10,4) COMMENT '单件用料长度(m)',
    total_area_m2 DECIMAL(10,4) COMMENT '总面积(m²)',
    utilization_rate DECIMAL(5,2) COMMENT '面料利用率(%)',
    fabric_weight_kg DECIMAL(10,4) COMMENT '面料总重量(kg)',
    main_fabric_per_piece_m DECIMAL(10,4) COMMENT '主料单件用量(m)',
    lining_per_piece_m DECIMAL(10,4) COMMENT '里料单件用量(m)',
    curved_pieces_count INT COMMENT '曲线计算裁片数量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_timestamp (timestamp),
    INDEX idx_type (type),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计算历史主表';

-- ========================================
-- 表: history_pieces
-- 描述: 计算历史裁片明细表
-- ========================================
CREATE TABLE IF NOT EXISTS history_pieces (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    history_id VARCHAR(20) NOT NULL COMMENT '关联 calculation_history.id',
    piece_name VARCHAR(100) NOT NULL COMMENT '裁片名称',
    original_length DECIMAL(8,2) COMMENT '裁片原始长度(cm)',
    original_width DECIMAL(8,2) COMMENT '裁片原始宽度(cm)',
    piece_count INT DEFAULT 1 COMMENT '裁片数量',
    shape VARCHAR(20) COMMENT '形状: rectangle/trapezoid/triangle/circle',
    material VARCHAR(30) COMMENT '材料类型: main/lining/interlining/rib等',
    seam_allowance DECIMAL(5,2) COMMENT '缝份(cm)',
    piece_id VARCHAR(30) COMMENT '裁片标识ID',
    shoulder_width DECIMAL(8,2) COMMENT '肩宽(cm，曲线计算用)',
    bicep_width DECIMAL(8,2) COMMENT '袖肥(cm，曲线计算用)',
    cuff_width DECIMAL(8,2) COMMENT '袖口宽(cm，曲线计算用)',
    INDEX idx_history_id (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计算历史裁片明细表';

-- ========================================
-- 表: history_quick_params
-- 描述: 快速估算参数表
-- ========================================
CREATE TABLE IF NOT EXISTS history_quick_params (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    history_id VARCHAR(20) NOT NULL COMMENT '关联 calculation_history.id',
    garment_length DECIMAL(8,2) COMMENT '衣长(cm)',
    chest DECIMAL(8,2) COMMENT '胸围(cm)',
    shoulder DECIMAL(8,2) COMMENT '肩宽(cm)',
    sleeve_length DECIMAL(8,2) COMMENT '袖长(cm)',
    has_hood TINYINT(1) DEFAULT 0 COMMENT '是否有帽子: 0=否/1=是',
    has_lining TINYINT(1) DEFAULT 0 COMMENT '是否有里布: 0=否/1=是',
    style_complexity VARCHAR(20) COMMENT '款式复杂度: simple/medium/complex',
    INDEX idx_history_id (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快速估算参数表';

-- ========================================
-- 表: history_materials
-- 描述: 计算历史材料汇总表
-- ========================================
CREATE TABLE IF NOT EXISTS history_materials (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    history_id VARCHAR(20) NOT NULL COMMENT '关联 calculation_history.id',
    material VARCHAR(30) NOT NULL COMMENT '材料类型',
    material_name VARCHAR(50) NOT NULL DEFAULT '' COMMENT '材料名称',
    length_m DECIMAL(10,4) COMMENT '用料长度(m)',
    area_m2 DECIMAL(10,4) COMMENT '用料面积(m²)',
    weight_kg DECIMAL(10,4) COMMENT '用料重量(kg)',
    width_utilization DECIMAL(5,2) COMMENT '门幅利用率(%)',
    INDEX idx_history_id (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计算历史材料汇总表';

-- ========================================
-- 表: history_fabrics
-- 描述: 精确计算中用户配置的多面料参数
-- ========================================
CREATE TABLE IF NOT EXISTS history_fabrics (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    history_id VARCHAR(20) NOT NULL COMMENT '关联 calculation_history.id',
    fabric_id VARCHAR(80) NOT NULL COMMENT '面料稳定标识',
    fabric_name VARCHAR(100) NOT NULL DEFAULT '' COMMENT '面料名称',
    fabric_type VARCHAR(30) NOT NULL DEFAULT 'woven' COMMENT '面料类型',
    fabric_width DECIMAL(8,2) NOT NULL COMMENT '面料门幅(cm)',
    shrinkage_rate DECIMAL(5,2) NOT NULL DEFAULT 0.50 COMMENT '缩水率(%)',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '显示顺序',
    user_id INT NULL COMMENT '关联用户ID',
    INDEX idx_history_id (history_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='精确计算面料配置表';

-- ========================================
-- 表: history_images
-- 描述: 计算历史图片路径表
-- ========================================
CREATE TABLE IF NOT EXISTS history_images (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
    history_id VARCHAR(20) NOT NULL COMMENT '关联 calculation_history.id',
    image_type VARCHAR(20) NOT NULL COMMENT '图片类型: piece(裁片图)/seam(缝份图)/nesting(排料图)',
    image_name VARCHAR(100) NOT NULL COMMENT '图片名称（裁片名称或材料名称）',
    image_path VARCHAR(255) NOT NULL COMMENT '图片相对路径',
    image_order INT DEFAULT 0 COMMENT '排序序号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_history_id (history_id),
    INDEX idx_image_type (image_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计算历史图片路径表';

-- ========================================
-- 表: history_result_snapshots
-- 描述: 计算结果快照表，详情页优先读取
-- ========================================
CREATE TABLE IF NOT EXISTS history_result_snapshots (
    history_id VARCHAR(20) PRIMARY KEY COMMENT '关联 calculation_history.id',
    params_json LONGTEXT COMMENT '计算参数快照',
    result_json LONGTEXT COMMENT '结果摘要快照',
    input_data_json LONGTEXT COMMENT '回填编辑输入快照',
    full_result_json LONGTEXT COMMENT '完整计算结果快照（不含base64图片）',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计算结果快照表';

-- ========================================
-- 示例数据
-- ========================================
INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260501112023', '2026-05-01 11:20:23', 'precise', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.922', '1.8987', '76.0', '0.6095', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501112023', '前片', '69.5', '31', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501112023', '后片', '69.5', '62', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501112023', '袖子（左+右）', '61', '25.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501112023', '袖口罗纹', '21', '14', '2', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501112023', '下摆螺纹', '102', '14', '1', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501112023', '帽子', '38', '28', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260501105812', '2026-05-01 10:58:12', 'precise', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.922', '1.8987', '76.0', '0.6095', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105812', '前片', '69.5', '31', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105812', '后片', '69.5', '62', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105812', '袖子（左+右）', '61', '25.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105812', '袖口罗纹', '21', '14', '2', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105812', '下摆螺纹', '102', '14', '1', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105812', '帽子', '38', '28', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260501105731', '2026-05-01 10:57:31', 'precise', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.922', '1.8987', '76.0', '0.6095', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105731', '前片', '69.5', '31', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105731', '后片', '69.5', '62', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105731', '袖子（左+右）', '61', '25.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105731', '袖口罗纹', '21', '14', '2', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
