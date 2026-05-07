-- ========================================
-- 面料计算器 - 数据库初始化脚本（多表版）
-- 注意：此文件必须使用 UTF-8 编码保存
-- ========================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET collation_connection = utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS fabric_calculator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fabric_calculator;

CREATE TABLE IF NOT EXISTS calculation_history (
    id VARCHAR(20) PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    category_name VARCHAR(50) NOT NULL DEFAULT '',
    fabric_width DECIMAL(8,2),
    fabric_type VARCHAR(20),
    fabric_weight_gsm DECIMAL(8,2),
    shrinkage_rate DECIMAL(5,2),
    wastage_rate DECIMAL(5,2),
    quantity INT,
    per_piece_length_m DECIMAL(10,4),
    total_area_m2 DECIMAL(10,4),
    utilization_rate DECIMAL(5,2),
    fabric_weight_kg DECIMAL(10,4),
    main_fabric_per_piece_m DECIMAL(10,4),
    lining_per_piece_m DECIMAL(10,4),
    curved_pieces_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp),
    INDEX idx_type (type),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS history_pieces (
    id INT AUTO_INCREMENT PRIMARY KEY,
    history_id VARCHAR(20) NOT NULL,
    piece_name VARCHAR(100) NOT NULL,
    original_length DECIMAL(8,2),
    original_width DECIMAL(8,2),
    piece_count INT DEFAULT 1,
    shape VARCHAR(20),
    material VARCHAR(30),
    seam_allowance DECIMAL(5,2),
    piece_id VARCHAR(30),
    shoulder_width DECIMAL(8,2),
    bicep_width DECIMAL(8,2),
    cuff_width DECIMAL(8,2),
    INDEX idx_history_id (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS history_quick_params (
    id INT AUTO_INCREMENT PRIMARY KEY,
    history_id VARCHAR(20) NOT NULL,
    garment_length DECIMAL(8,2),
    chest DECIMAL(8,2),
    shoulder DECIMAL(8,2),
    sleeve_length DECIMAL(8,2),
    has_hood TINYINT(1) DEFAULT 0,
    has_lining TINYINT(1) DEFAULT 0,
    style_complexity VARCHAR(20),
    INDEX idx_history_id (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS history_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    history_id VARCHAR(20) NOT NULL,
    material VARCHAR(30) NOT NULL,
    material_name VARCHAR(50) NOT NULL DEFAULT '',
    length_m DECIMAL(10,4),
    area_m2 DECIMAL(10,4),
    weight_kg DECIMAL(10,4),
    width_utilization DECIMAL(5,4),
    INDEX idx_history_id (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105731', '下摆螺纹', '102', '14', '1', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260501105731', '帽子', '38', '28', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260430214955', '2026-04-30 21:49:55', 'curved', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.268', '1.7257', '80.0', '0.554', NULL, NULL, '0');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214955', '前片', '69.5', '31', '2', '', 'main', '1.5', 'front_body', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214955', '后片', '69.5', '62', '1', '', 'main', '1.5', 'back_body', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214955', '袖子（左+右）', '61', '25.5', '2', '', 'main', '1.5', 'sleeve', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214955', '领口罗纹', '21', '14', '1', '', 'rib', '1.5', 'collar_rib', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214955', '下摆螺纹', '102', '14', '1', '', 'rib', '1.5', 'other', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214955', '帽子', '38', '28', '1', '', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260430214946', '2026-04-30 21:49:46', 'curved', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.336', '1.8179', '80.0', '0.5836', NULL, NULL, '3');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214946', '前片', '69.5', '31', '2', '', 'main', '1.5', 'front_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214946', '后片', '69.5', '62', '1', '', 'main', '1.5', 'back_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214946', '袖子（左+右）', '61', '25.5', '2', '', 'main', '1.5', 'sleeve', NULL, '47', '25');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214946', '领口罗纹', '21', '14', '1', '', 'rib', '1.5', 'collar_rib', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214946', '下摆螺纹', '102', '14', '1', '', 'rib', '1.5', 'other', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214946', '帽子', '38', '28', '1', '', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260430214936', '2026-04-30 21:49:36', 'curved', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.302', '1.7723', '80.0', '0.5689', NULL, NULL, '3');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214936', '前片', '69.5', '31', '2', '', 'main', '1.5', 'front_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214936', '后片', '69.5', '62', '1', '', 'main', '1.5', 'back_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214936', '袖子（左+右）', '61', '25.5', '2', '', 'main', '1.5', 'sleeve', NULL, '47', '12.5');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214936', '领口罗纹', '21', '14', '1', '', 'rib', '1.5', 'collar_rib', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214936', '下摆螺纹', '102', '14', '1', '', 'rib', '1.5', 'other', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214936', '帽子', '38', '28', '1', '', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260430214505', '2026-04-30 21:45:05', 'curved', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.167', '1.5882', '80.0', '0.5098', NULL, NULL, '3');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214505', '前片', '69.5', '31', '2', '', 'main', '1.5', 'front_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214505', '后片', '69.5', '62', '1', '', 'main', '1.5', 'back_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214505', '袖子（左+右）', '61', '25.5', '2', '', 'main', '1.5', 'sleeve', NULL, '23.5', '12.5');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214505', '领口罗纹', '21', '14', '1', '', 'rib', '1.5', 'collar_rib', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214505', '下摆螺纹', '102', '14', '1', '', 'rib', '1.5', 'other', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214505', '帽子', '38', '28', '1', '', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260430214239', '2026-04-30 21:42:39', 'curved', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.167', '1.5882', '80.0', '0.5098', NULL, NULL, '3');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214239', '前片', '69.5', '31', '2', '', 'main', '1.5', 'front_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214239', '后片', '69.5', '62', '1', '', 'main', '1.5', 'back_body', '62.5', NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214239', '袖子（左+右）', '61', '25.5', '2', '', 'main', '1.5', 'sleeve', NULL, '23.5', '12.5');
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214239', '领口罗纹', '21', '14', '1', '', 'rib', '1.5', 'collar_rib', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214239', '下摆螺纹', '102', '14', '1', '', 'main', '1.5', 'other', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260430214239', '帽子', '38', '28', '1', '', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429190924', '2026-04-29 19:09:24', 'precise', 'tshirt', 'T恤', '145.0', 'woven', '300.0', '3.0', '7.0', '100', '0.951', '1.0099', '80.0', '0.3242', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429190924', '前片', '69.4', '47.8', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429190924', '袖子（左+右）', '76', '12.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429175234', '2026-04-29 17:52:34', 'precise', 'skirt', '裙子', '105.0', 'woven', '300.0', '2.0', '3.0', '1500', '2.829', '2.297', '82.0', '0.7098', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '前片', '90', '26', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '侧片', '73', '15', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '后侧片', '76', '17', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '后中片', '78', '18', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '前片里布', '80', '26', '1', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '侧片里布', '63', '15', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '后侧片里布', '66', '17', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429175234', '后中片里布', '68', '18', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429170816', '2026-04-29 17:08:16', 'precise', 'windbreaker', '风衣', '145.0', 'woven', '300.0', '2.0', '8.0', '100', '3.76', '3.7577', '76.0', '1.2175', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '前片（左+右）', '60', '38', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '后片', '40', '31.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '袖子（左+右）', '57.5', '25', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '领子', '54', '8.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '领座', '43.5', '3', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '口袋', '16.5', '5', '4', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '挂面', '58.5', '16', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '龟贴', '11', '26.5', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '前片里布', '58.5', '25', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '大袖里', '57.5', '25', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '小袖里', '52.5', '21', '1', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '后片育克', '21.5', '56', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '小袖片', '52.5', '21', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '后片里布', '61.5', '33.5', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '肩袢', '20', '4.5', '4', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '袖袢', '27.5', '5', '4', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170816', '口袋布', '18', '14', '4', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429170215', '2026-04-29 17:02:15', 'precise', 'coat', '大衣', '145.0', 'woven', '300.0', '3.0', '8.0', '100', '0.544', '0.5581', '78.0', '0.1808', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170215', '前片（左+右）', '60', '40', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429170159', '2026-04-29 17:01:59', 'precise', 'coat', '大衣', '145.0', 'woven', '300.0', '3.0', '8.0', '100', '0.544', '0.5581', '78.0', '0.1808', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429170159', '前片（左+右）', '60', '40', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429165924', '2026-04-29 16:59:24', 'precise', 'windbreaker', '风衣', '145.0', 'woven', '300.0', '2.0', '8.0', '100', '3.803', '3.7998', '76.0', '1.2311', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '前片（左+右）', '60', '38', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '后片', '40', '31.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '袖子（左+右）', '57.5', '25', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '领子', '54', '8.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '领座', '43.5', '3', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '口袋', '16.5', '5', '4', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '挂面', '58.5', '16', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '龟贴', '11', '26.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '前片里布', '58.5', '25', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '大袖里', '57.5', '25', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '小袖里', '52.5', '21', '1', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '后片育克', '21.5', '56', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '小袖片', '52.5', '21', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '后片里布', '61.5', '33.5', '2', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '肩袢', '20', '4.5', '4', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '袖袢', '27.5', '5', '4', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165924', '口袋布', '18', '14', '4', 'rectangle', 'lining', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429165350', '2026-04-29 16:53:50', 'precise', 'windbreaker', '风衣', '145.0', 'woven', '300.0', '2.0', '8.0', '100', '0.503', '0.5029', '76.0', '0.1629', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429165350', '前片（左+右）', '69.5', '31', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429162909', '2026-04-29 16:29:09', 'precise', 'tshirt', 'T恤', '185.0', 'knit', '300.0', '3.0', '7.0', '100', '1.395', '1.8987', '80.0', '0.6095', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429162909', '前片', '69.5', '31', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429162909', '后片', '69.5', '62', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429162909', '袖子（左+右）', '61', '25.5', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429162909', '袖口罗纹', '21', '14', '2', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429162909', '下摆螺纹', '102', '14', '1', 'rectangle', 'rib', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429162909', '帽子', '38', '28', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429141649', '2026-04-29 14:16:49', 'precise', 'coat', '大衣', '145.0', 'woven', '300.0', '3.0', '8.0', '100', '0.032', '3.2836', '78.0', '1.0639', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429141649', '前片（左+右）', '85', '60', '2', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429141649', '后片', '88', '58', '1', 'rectangle', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429141649', '袖子（左+右）', '62', '30', '2', 'trapezoid', 'main', '1.5', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429141649', '领子', '45', '8', '2', 'rectangle', 'main', '1', '', NULL, NULL, NULL);
INSERT INTO history_pieces (history_id, piece_name, original_length, original_width, piece_count, shape, material, seam_allowance, piece_id, shoulder_width, bicep_width, cuff_width) VALUES ('20260429141649', '里布', '85', '58', '2', 'rectangle', 'lining', '1', '', NULL, NULL, NULL);

INSERT IGNORE INTO calculation_history (id, timestamp, type, category, category_name, fabric_width, fabric_type, fabric_weight_gsm, shrinkage_rate, wastage_rate, quantity, per_piece_length_m, total_area_m2, utilization_rate, fabric_weight_kg, main_fabric_per_piece_m, lining_per_piece_m, curved_pieces_count) VALUES ('20260429141629', '2026-04-29 14:16:29', 'quick', 'coat', '大衣', '145.0', NULL, '300.0', NULL, NULL, '100', NULL, NULL, NULL, NULL, '0.054', '0.04', NULL);
INSERT INTO history_quick_params (history_id, garment_length, chest, shoulder, sleeve_length, has_hood, has_lining, style_complexity) VALUES ('20260429141629', '90', '110', '45', '62', 0, 1, 'medium');
