-- 保存计算结果快照，历史详情页优先读取该表，避免从旧历史字段反推结果
CREATE TABLE IF NOT EXISTS history_result_snapshots (
    history_id VARCHAR(20) PRIMARY KEY,
    params_json LONGTEXT,
    result_json LONGTEXT,
    input_data_json LONGTEXT,
    full_result_json LONGTEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
