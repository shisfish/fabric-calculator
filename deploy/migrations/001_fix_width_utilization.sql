-- ========================================
-- 数据库迁移：修复 width_utilization 字段类型
-- 日期: 2026-05-28
-- 原因: DECIMAL(5,4) 范围太小（-9.9999~9.9999），
--       无法存储利用率百分比（0~100+）
-- ========================================

-- 修改 history_materials 表的 width_utilization 字段
ALTER TABLE history_materials 
MODIFY COLUMN width_utilization DECIMAL(5,1) COMMENT '门幅利用率(%)';

-- 验证修改结果
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'history_materials' 
  AND COLUMN_NAME = 'width_utilization';
