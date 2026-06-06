ALTER TABLE history_pieces
ADD COLUMN IF NOT EXISTS calculation_method VARCHAR(20) NOT NULL DEFAULT 'nesting'
COMMENT '计算方式: nesting/area' AFTER shape;
