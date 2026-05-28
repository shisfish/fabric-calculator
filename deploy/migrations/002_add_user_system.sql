-- ========================================
-- 用户系统 - 数据库迁移脚本
-- 添加用户表 + 所有表添加 user_id 字段
-- ========================================

SET NAMES utf8mb4;
USE fabric_calculator;

-- ========================================
-- 1. 创建用户表
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希（SHA256）',
    nickname VARCHAR(50) DEFAULT '' COMMENT '昵称/显示名称',
    avatar_url VARCHAR(255) DEFAULT '' COMMENT '头像URL',
    role ENUM('admin', 'user') DEFAULT 'user' COMMENT '角色: admin=管理员/user=普通用户',
    status TINYINT(1) DEFAULT 1 COMMENT '状态: 0=禁用/1=启用',
    last_login_at DATETIME NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) DEFAULT '' COMMENT '最后登录IP',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_username (username),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ========================================
-- 2. 插入默认测试用户（test / test123456）
-- 密码 test123456 的 SHA256 哈希值
-- ========================================
INSERT IGNORE INTO users (username, password_hash, nickname, role, status) VALUES 
('test', SHA2('test123456', 256), '测试用户', 'admin', 1);

-- ========================================
-- 3. 给所有业务表添加 user_id 字段
-- ========================================

-- 3.1 计算历史主表
ALTER TABLE calculation_history 
ADD COLUMN IF NOT EXISTS user_id INT NULL COMMENT '关联用户ID' AFTER id,
ADD INDEX IF NOT EXISTS idx_user_id (user_id);

-- 3.2 裁片明细表
ALTER TABLE history_pieces 
ADD COLUMN IF NOT EXISTS user_id INT NULL COMMENT '关联用户ID' AFTER history_id,
ADD INDEX IF NOT EXISTS idx_user_id (user_id);

-- 3.3 快速估算参数表
ALTER TABLE history_quick_params 
ADD COLUMN IF NOT EXISTS user_id INT NULL COMMENT '关联用户ID' AFTER history_id,
ADD INDEX IF NOT EXISTS idx_user_id (user_id);

-- 3.4 材料汇总表
ALTER TABLE history_materials 
ADD COLUMN IF NOT EXISTS user_id INT NULL COMMENT '关联用户ID' AFTER history_id,
ADD INDEX IF NOT EXISTS idx_user_id (user_id);

-- 3.5 图片路径表
ALTER TABLE history_images 
ADD COLUMN IF NOT EXISTS user_id INT NULL COMMENT '关联用户ID' AFTER history_id,
ADD INDEX IF NOT EXISTS idx_user_id (user_id);

-- ========================================
-- 4. 给现有数据赋值默认用户（test用户，ID=1）
-- ========================================

-- 更新计算历史主表的现有数据
UPDATE calculation_history SET user_id = 1 WHERE user_id IS NULL;

-- 更新裁片明细表的现有数据
UPDATE hp SET hp.user_id = 1 
FROM history_pieces hp
JOIN calculation_history ch ON hp.history_id = ch.id
WHERE hp.user_id IS NULL;

-- 更新快速估算参数表的现有数据
UPDATE hqp SET hqp.user_id = 1 
FROM history_quick_params hqp
JOIN calculation_history ch ON hqp.history_id = ch.id
WHERE hqp.user_id IS NULL;

-- 更新材料汇总表的现有数据
UPDATE hm SET hm.user_id = 1 
FROM history_materials hm
JOIN calculation_history ch ON hm.history_id = ch.id
WHERE hm.user_id IS NULL;

-- 更新图片路径表的现有数据
UPDATE hi SET hi.user_id = 1 
FROM history_images hi
JOIN calculation_history ch ON hi.history_id = ch.id
WHERE hi.user_id IS NULL;

-- ========================================
-- 5. 添加外键约束（可选，确保数据一致性）
-- ========================================
-- ALTER TABLE calculation_history ADD CONSTRAINT fk_calc_user FOREIGN KEY (user_id) REFERENCES users(id);
-- ALTER TABLE history_pieces ADD CONSTRAINT fk_pieces_user FOREIGN KEY (user_id) REFERENCES users(id);
-- ALTER TABLE history_quick_params ADD CONSTRAINT fk_quick_user FOREIGN KEY (user_id) REFERENCES users(id);
-- ALTER TABLE history_materials ADD CONSTRAINT fk_mat_user FOREIGN KEY (user_id) REFERENCES users(id);
-- ALTER TABLE history_images ADD CONSTRAINT fk_img_user FOREIGN KEY (user_id) REFERENCES users(id);

-- ========================================
-- 验证结果
-- ========================================
SELECT '✅ 用户表创建完成' AS message;
SELECT COUNT(*) AS user_count FROM users;
SELECT username, nickname, role FROM users LIMIT 10;
SELECT '✅ 现有数据已关联到默认用户' AS message;
SELECT COUNT(*) AS updated_records FROM calculation_history WHERE user_id = 1;
