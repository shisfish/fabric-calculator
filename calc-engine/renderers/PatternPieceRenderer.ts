import { type RectPiece } from '../core/patterns/index.js';
import { Path, type PathOperation, Point } from '../core/geometry/index.js';

export interface PatternRenderResult {
  svg: string;
  pieces: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    quantity: number;
    onFold: boolean;
    pathOps: PathOperation[];
    area: number;
  }>;
  viewBox: { x: number; y: number; width: number; height: number };
}

export class PatternPieceRenderer {
  static render(pieces: RectPiece[], options?: {
    showLabels?: boolean;
    showDimensions?: boolean;
    padding?: number;
  }): PatternRenderResult {
    const padding = options?.padding || 20;

    const renderedPieces = pieces.map(piece => this.renderRectPiece(piece));

    let totalWidth = 0;
    let totalHeight = 0;

    for (const piece of renderedPieces) {
      totalWidth = Math.max(totalWidth, piece.width * (piece.onFold ? 2 : 1));
      totalHeight = Math.max(totalHeight, piece.height);
    }

    const viewBox = {
      x: -padding,
      y: -padding,
      width: totalWidth + padding * 2 + 100,
      height: totalHeight + padding * 2 + 50
    };

    const svg = this.generateSVG(renderedPieces, viewBox, options);

    return {
      svg,
      pieces: renderedPieces,
      viewBox
    };
  }

  private static renderRectPiece(piece: RectPiece) {
    const displayWidth = piece.onFold ? piece.width * 2 : piece.width;
    
    const path = new Path()
      .move(new Point(0, 0))
      .line(new Point(displayWidth, 0))
      .line(new Point(displayWidth, piece.height))
      .line(new Point(0, piece.height))
      .close();

    if (piece.onFold) {
      path.ops[0].segmentName = 'foldLine';
    }

    const pathOps: PathOperation[] = path.ops.map(op => ({
      type: op.type,
      to: op.to
    }));

    return {
      id: piece.id,
      name: piece.name,
      width: piece.width,
      height: piece.height,
      quantity: piece.quantity,
      onFold: piece.onFold,
      pathOps,
      area: displayWidth * piece.height
    };
  }

  private static generateSVG(
    pieces: PatternRenderResult['pieces'],
    viewBox: { x: number; y: number; width: number; height: number },
    options?: {
      showLabels?: boolean;
      showDimensions?: boolean;
    }
  ): string {
    const colors: Record<string, string> = {
      '前片': '#ffcc99',
      '后片': '#99ccff',
      '袖子': '#99ff99',
      '领口罗纹': '#ff99cc',
      '口袋': '#cccc99',
      '帽子': '#cc99ff',
      'default': '#dddddd'
    };

    let svgContent = `  <rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" fill="#fafafa" />\n`;

    let offsetX = 20;
    let offsetY = 20;

    for (const piece of pieces) {
      const color = colors[piece.name] || colors.default;
      const displayWidth = piece.onFold ? piece.width * 2 : piece.width;

      svgContent += `  <g transform="translate(${offsetX}, ${offsetY})">\n`;
      
      if (piece.onFold) {
        svgContent += `    <line x1="${piece.width}" y1="-5" x2="${piece.width}" y2="${piece.height + 5}" stroke="#ff0000" stroke-width="0.8" stroke-dasharray="4,2" />\n`;
        svgContent += `    <text x="${piece.width}" y="-8" text-anchor="middle" font-size="7" fill="#ff0000">FOLD</text>\n`;
      }
      
      svgContent += `    <rect x="0" y="0" width="${displayWidth}" height="${piece.height}" fill="${color}40" stroke="${color}" stroke-width="1.0" />\n`;

      if (options?.showLabels !== false) {
        svgContent += `    <text x="${displayWidth / 2}" y="${piece.height / 2 - 5}" text-anchor="middle" font-size="10" font-weight="bold" fill="#333">${piece.name}</text>\n`;
        
        if (options?.showDimensions && piece.quantity > 1) {
          svgContent += `    <text x="${displayWidth / 2}" y="${piece.height / 2 + 10}" text-anchor="middle" font-size="9" fill="#666">×${piece.quantity}</text>\n`;
        }

        svgContent += `    <text x="${displayWidth / 2}" y="${piece.height / 2 + (piece.quantity > 1 ? 22 : 12)}" text-anchor="middle" font-size="8" fill="#999">${displayWidth.toFixed(1)} × ${piece.height.toFixed(1)} cm</text>\n`;
      }
      
      svgContent += `  </g>\n`;

      offsetX += displayWidth + 30;
      
      if (offsetX + displayWidth > viewBox.width - 40) {
        offsetX = 20;
        offsetY += piece.height + 60;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">
${svgContent}</svg>`;
  }
}