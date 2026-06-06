CREATE TABLE IF NOT EXISTS history_fabrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    history_id VARCHAR(20) NOT NULL,
    fabric_id VARCHAR(80) NOT NULL,
    fabric_name VARCHAR(100) NOT NULL DEFAULT '',
    fabric_type VARCHAR(30) NOT NULL DEFAULT 'woven',
    fabric_width DECIMAL(8,2) NOT NULL,
    shrinkage_rate DECIMAL(5,2) NOT NULL DEFAULT 0.50,
    sort_order INT NOT NULL DEFAULT 0,
    user_id INT NULL,
    INDEX idx_history_id (history_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='精确计算面料配置表';
