import { type RectPiece, SeamAllowanceGenerator, type SeamAllowanceRule } from '../core/patterns/index.js';
import { Path, type PathOperation, Point } from '../core/geometry/index.js';

export interface SeamAllowanceRenderResult {
  svg: string;
  pieces: Array<{
    id: string;
    name: string;
    stitchLineOps: PathOperation[];
    cuttingLineOps: PathOperation[];
    seamDistance: number;
    originalSize: { width: number; height: number };
    seamSize: { width: number; height: number };
  }>;
  viewBox: { x: number; y: number; width: number; height: number };
}

export class SeamAllowanceRenderer {
  static render(
    pieces: RectPiece[],
    seamDistance: number = 1.0,
    options?: {
      showStitchLine?: boolean;
      showCuttingLine?: boolean;
      showSeamLabels?: boolean;
      padding?: number;
      customSeamRules?: Record<string, SeamAllowanceRule[]>;
    }
  ): SeamAllowanceRenderResult {
    const padding = options?.padding || 40;

    const defaultSeamRules: Record<string, SeamAllowanceRule[]> = {
      '前片': [
        { segment: 'top', distance: seamDistance },
        { segment: 'right', distance: seamDistance + 0.2 },
        { segment: 'bottom', distance: seamDistance + 1.5 },
        { segment: 'left', distance: seamDistance + 1.5 }
      ],
      '后片': [
        { segment: 'top', distance: seamDistance },
        { segment: 'right', distance: seamDistance + 0.2 },
        { segment: 'bottom', distance: seamDistance + 1.5 },
        { segment: 'left', distance: 0 }
      ],
      '袖子': [
        { segment: 'top', distance: seamDistance + 1.5 },
        { segment: 'right', distance: seamDistance },
        { segment: 'bottom', distance: seamDistance },
        { segment: 'left', distance: seamDistance }
      ],
      'default': [
        { segment: '*', distance: seamDistance }
      ]
    };

    const renderedPieces = pieces.map(piece => this.renderPieceWithSeam(piece, seamDistance, defaultSeamRules));

    let maxWidth = 0;
    let maxHeight = 0;

    for (const piece of renderedPieces) {
      maxWidth = Math.max(maxWidth, piece.seamSize.width);
      maxHeight = Math.max(maxHeight, piece.seamSize.height);
    }

    const viewBox = {
      x: -padding,
      y: -padding,
      width: maxWidth * renderedPieces.length + (renderedPieces.length + 1) * 30 + padding * 2,
      height: maxHeight + padding * 2 + 60
    };

    const svg = this.generateSVG(renderedPieces, viewBox, options);

    return {
      svg,
      pieces: renderedPieces,
      viewBox
    };
  }

  private static renderPieceWithSeam(
    piece: RectPiece,
    seamDistance: number,
    seamRules: Record<string, SeamAllowanceRule[]>
  ) {
    const displayWidth = piece.onFold ? piece.width * 2 : piece.width;

    const stitchPath = new Path()
      .move(new Point(0, 0))
      .line(new Point(displayWidth, 0))
      .line(new Point(displayWidth, piece.height))
      .line(new Point(0, piece.height))
      .close();

    const cuttingPath = new Path()
      .move(new Point(-seamDistance, -seamDistance))
      .line(new Point(displayWidth + seamDistance, -seamDistance))
      .line(new Point(displayWidth + seamDistance, piece.height + seamDistance))
      .line(new Point(-seamDistance, piece.height + seamDistance))
      .close();

    return {
      id: piece.id,
      name: piece.name,
      stitchLineOps: this.pathToOps(stitchPath.ops),
      cuttingLineOps: this.pathToOps(cuttingPath.ops),
      seamDistance,
      originalSize: { width: piece.width, height: piece.height },
      seamSize: { 
        width: displayWidth + seamDistance * 2, 
        height: piece.height + seamDistance * 2 
      }
    };
  }

  private static pathToOps(ops: Path['ops']): PathOperation[] {
    return ops.map(op => ({
      type: op.type,
      to: op.to
    }));
  }

  private static generateSVG(
    pieces: SeamAllowanceRenderResult['pieces'],
    viewBox: { x: number; y: number; width: number; height: number },
    options?: {
      showStitchLine?: boolean;
      showCuttingLine?: boolean;
      showSeamLabels?: boolean;
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

    let offsetX = 30;
    const offsetY = 30;

    for (const piece of pieces) {
      const color = colors[piece.name] || colors.default;
      const displayOriginalWidth = piece.originalSize.width * (piece.name === '前片' || piece.name === '后片' ? 2 : 1);

      svgContent += `  <g transform="translate(${offsetX}, ${offsetY})">\n`;

      if (options?.showCuttingLine !== false) {
        svgContent += `    <rect x="0" y="0" width="${piece.seamSize.width}" height="${piece.seamSize.height}" fill="${color}15" stroke="#999" stroke-width="0.6" stroke-dasharray="3,2" />\n`;
      }

      if (options?.showStitchLine !== false) {
        const innerX = piece.seamDistance;
        const innerY = piece.seamDistance;
        svgContent += `    <rect x="${innerX}" y="${innerY}" width="${displayOriginalWidth}" height="${piece.originalSize.height}" fill="${color}40" stroke="${color}" stroke-width="1.2" />\n`;
      }

      if (piece.name === '前片' || piece.name === '后片') {
        svgContent += `    <line x1="${piece.originalSize.width + piece.seamDistance}" y1="${-5}" x2="${piece.originalSize.width + piece.seamDistance}" y2="${piece.seamSize.height + 5}" stroke="#ff0000" stroke-width="0.8" stroke-dasharray="4,2" />\n`;
      }

      if (options?.showSeamLabels !== false) {
        const centerX = piece.seamSize.width / 2;
        const centerY = piece.seamSize.height / 2;
        
        svgContent += `    <text x="${centerX}" y="${centerY - 10}" text-anchor="middle" font-size="9" font-weight="bold" fill="#333">${piece.name}</text>\n`;
        svgContent += `    <text x="${centerX}" y="${centerY + 5}" text-anchor="middle" font-size="8" fill="#666">${displayOriginalWidth.toFixed(1)} × ${piece.originalSize.height.toFixed(1)} cm</text>\n`;
        svgContent += `    <text x="${centerX}" y="${centerY + 18}" text-anchor="middle" font-size="7" fill="#999">缝份: ±${piece.seamDistance}cm</text>\n`;
        
        svgContent += `    <line x1="${centerX - 20}" y1="${piece.seamSize.height + 15}" x2="${centerX + 20}" y2="${piece.seamSize.height + 15}" stroke="${color}" stroke-width="1.5" />\n`;
        svgContent += `    <text x="${centerX}" y="${piece.seamSize.height + 25}" text-anchor="middle" font-size="7" fill="${color}">净版</text>\n`;
        
        svgContent += `    <line x1="${centerX + 50}" y1="${piece.seamSize.height + 15}" x2="${centerX + 90}" y2="${piece.seamSize.height + 15}" stroke="#999" stroke-width="1.0" stroke-dasharray="3,2" />\n`;
        svgContent += `    <text x="${centerX + 70}" y="${piece.seamSize.height + 25}" text-anchor="middle" font-size="7" fill="#999">缝份</text>\n`;
      }
      
      svgContent += `  </g>\n`;

      offsetX += piece.seamSize.width + 35;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">
${svgContent}</svg>`;
  }
}