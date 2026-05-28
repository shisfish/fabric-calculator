import { Point, Path } from '../geometry/index.js';
import { type RectPiece } from '../patterns/index.js';

export interface NestConfig {
  fabricWidth: number;
  fabricHeight: number;
  spacing: number;
  rotations: number[];
}

export interface NestResult {
  positions: Array<{
    pieceId: string;
    pieceName: string;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
  }>;
  utilization: number;
  totalArea: number;
  usedArea: number;
  bounds: { width: number; height: number };
}

export const DEFAULT_NEST_CONFIG: NestConfig = {
  fabricWidth: 150,
  fabricHeight: 300,
  spacing: 3.5,  // 0.5cm基础间距 + 1.5cm*2缝份延伸 = 3.5cm，确保毛样不重叠
  rotations: [0, 90, 180, 270]
};

export class CalcNestEngine {
  private config: NestConfig;
  private pieces: RectPiece[] = [];

  constructor(config: Partial<NestConfig> = {}) {
    this.config = { ...DEFAULT_NEST_CONFIG, ...config };
  }

  addPiece(piece: RectPiece): void {
    this.pieces.push(piece);
  }

  addPieces(pieces: RectPiece[]): void {
    for (const piece of pieces) {
      this.addPiece(piece);
    }
  }

  nest(): NestResult {
    const placedPieces: NestResult['positions'] = [];

    let currentX = this.config.spacing;
    let currentY = this.config.spacing;
    let rowHeight = 0;

    console.error('🔍 [CalcNestEngine] 开始排料');
    console.error(`🔍 [CalcNestEngine] 配置: fabricWidth=${this.config.fabricWidth}, spacing=${this.config.spacing}`);
    console.error(`🔍 [CalcNestEngine] 裁片数量: ${this.pieces.length}`);

    for (const rectPiece of this.pieces) {
      for (let i = 0; i < rectPiece.quantity; i++) {
        let width = rectPiece.width;
        let height = rectPiece.height;

        if (rectPiece.onFold) {
          width *= 2;
        }

        const rotation = 0;

        console.error(`🔍 [CalcNestEngine] 处理裁片 "${rectPiece.name}": width=${width}, height=${height}, currentX=${currentX.toFixed(2)}, currentY=${currentY.toFixed(2)}`);
        console.error(`🔍 [CalcNestEngine] 检查换行: currentX(${currentX.toFixed(2)}) + width(${width}) + spacing(${this.config.spacing}) > fabricWidth(${this.config.fabricWidth})? ${currentX + width + this.config.spacing > this.config.fabricWidth}`);

        if (currentX + width + this.config.spacing > this.config.fabricWidth) {
          console.error(`🔍 [CalcNestEngine] ⚠️ 换行! currentX重置为${this.config.spacing}, currentY增加至${(currentY + rowHeight + this.config.spacing).toFixed(2)}`);
          currentX = this.config.spacing;
          currentY += rowHeight + this.config.spacing;
          rowHeight = 0;
        }

        placedPieces.push({
          pieceId: rectPiece.id,
          pieceName: rectPiece.name,
          x: currentX,
          y: currentY,
          rotation,
          width,
          height
        });

        console.error(`🔍 [CalcNestEngine] ✅ 放置 "${rectPiece.name}" 在 (${currentX.toFixed(2)}, ${currentY.toFixed(2)}) 尺寸(${width}×${height})`);

        currentX += width + this.config.spacing;
        rowHeight = Math.max(rowHeight, height);
      }
    }

    console.error(`🔍 [CalcNestEngine] 排料完成, 共放置${placedPieces.length}个裁片`);
    console.error(`🔍 [CalcNestEngine] 最终bounds: width=${this.config.fabricWidth}, height=${(currentY + rowHeight).toFixed(2)}`);

    const totalArea = this.config.fabricWidth * (currentY + rowHeight);
    const usedArea = placedPieces.reduce((sum, p) => sum + p.width * p.height, 0);

    return {
      positions: placedPieces,
      utilization: totalArea > 0 ? (usedArea / totalArea * 100) : 0,
      totalArea,
      usedArea,
      bounds: {
        width: this.config.fabricWidth,
        height: currentY + rowHeight
      }
    };
  }
}