import { type RectPiece } from '../core/patterns/index.js';
import { Path, type PathOperation, Point } from '../core/geometry/index.js';
import { CalcNestEngine, type NestResult, type NestConfig } from '../core/nesting/index.js';

export interface NestingLayoutRenderResult {
  svg: string;
  nestResult: NestResult;
  pieces: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
    onFold: boolean;
    pathOps?: PathOperation[];
  }>;
  fabricWidth: number;
  fabricHeight: number;
  utilization: number;
  statistics: {
    totalPieces: number;
    totalArea: number;
    usedArea: number;
    wasteArea: number;
    fabricLength: number;
  };
}

export class NestingLayoutRenderer {
  static render(
    pieces: RectPiece[],
    fabricWidth: number,
    seamDistance: number = 1.0,
    options?: {
      showGrid?: boolean;
      showUtilization?: boolean;
      showPieceLabels?: boolean;
      spacing?: number;
      padding?: number;
      piecePathOps?: Record<string, PathOperation[]>;
    }
  ): NestingLayoutRenderResult {
    const padding = options?.padding || 10;

    const nestConfig: NestConfig = {
      fabricWidth,
      fabricHeight: 1000,
      spacing: options?.spacing || 0.5,
      rotations: [0]
    };

    console.error('🔍 [NestingLayoutRenderer] 开始渲染');
    console.error(`🔍 [NestingLayoutRenderer] 输入pieces:`, JSON.stringify(pieces.map(p => ({
      name: p.name,
      id: p.id,
      width: p.width,
      height: p.height,
      quantity: p.quantity
    })), null, 2));
    console.error(`🔍 [NestingLayoutRenderer] 排料配置:`, JSON.stringify(nestConfig, null, 2));
    console.error(`🔍 [NestingLayoutRenderer] seamDistance=${seamDistance}`);

    const engine = new CalcNestEngine(nestConfig);
    engine.addPieces(pieces);
    
    const nestResult = engine.nest();

    console.error('🔍 [NestingLayoutRenderer] 引擎返回的positions:', JSON.stringify(nestResult.positions, null, 2));

    const renderedPieces = nestResult.positions.map(pos => {
      const rendered = {
        id: pos.pieceId,
        name: pos.pieceName,
        x: pos.x,
        y: pos.y,
        rotation: pos.rotation,
        width: pos.width,    // ✅ 直接使用引擎返回值（已含缝份）
        height: pos.height,   // ✅ 不再手动+seamDistance*2
        onFold: pieces.find(p => p.id === pos.pieceId)?.onFold ?? false,
        pathOps: options?.piecePathOps?.[pos.pieceId] || options?.piecePathOps?.[pos.pieceName]
      };
      console.error(`🔍 [NestingLayoutRenderer] 渲染裁片 "${rendered.name}": x=${rendered.x}, y=${rendered.y}, width=${rendered.width}, height=${rendered.height}`);
      return rendered;
    });

    console.error('🔍 [NestingLayoutRenderer] 最终renderedPieces数量:', renderedPieces.length);

    const svg = this.generateSVG(
      renderedPieces,
      fabricWidth,
      nestResult.bounds.height,
      nestResult.utilization,
      options
    );

    return {
      svg,
      nestResult,
      pieces: renderedPieces,
      fabricWidth,
      fabricHeight: nestResult.bounds.height,
      utilization: nestResult.utilization,
      statistics: {
        totalPieces: nestResult.positions.length,
        totalArea: nestResult.totalArea,
        usedArea: nestResult.usedArea,
        wasteArea: nestResult.totalArea - nestResult.usedArea,
        fabricLength: nestResult.bounds.height
      }
    };
  }

  private static generateSVG(
    placedPieces: NestingLayoutRenderResult['pieces'],
    fabricWidth: number,
    fabricHeight: number,
    utilization: number,
    options?: {
      showGrid?: boolean;
      showUtilization?: boolean;
      showPieceLabels?: boolean;
    }
  ): string {
    const colors: Record<string, { fill: string; stroke: string }> = {
      '前片': { fill: 'rgba(255, 165, 0, 0.4)', stroke: '#FF8C00' },
      '后片': { fill: 'rgba(100, 149, 237, 0.4)', stroke: '#4169E1' },
      '袖子': { fill: 'rgba(50, 205, 50, 0.4)', stroke: '#228B22' },
      '领口罗纹': { fill: 'rgba(255, 105, 180, 0.4)', stroke: '#FF69B4' },
      '口袋': { fill: 'rgba(204, 204, 153, 0.4)', stroke: '#999966' },
      '帽子': { fill: 'rgba(204, 153, 255, 0.4)', stroke: '#CC99FF' },
      'default': { fill: 'rgba(169, 169, 169, 0.4)', stroke: '#696969' }
    };

    let svgContent = '';

    if (options?.showGrid) {
      svgContent += this.generateGrid(fabricWidth, fabricHeight);
    }

    for (const piece of placedPieces) {
      const color = colors[piece.name] || colors.default;

      svgContent += `  <g transform="translate(${piece.x}, ${piece.y})">\n`;

      if (piece.onFold) {
        const foldX = piece.width / 2;
        svgContent += `    <line x1="${foldX}" y1="-3" x2="${foldX}" y2="${piece.height + 3}" stroke="#ff0000" stroke-width="0.6" stroke-dasharray="3,2" />\n`;
      }

      if (piece.pathOps && piece.pathOps.length > 0) {
        svgContent += this.pathOpsToSVGPath(piece.pathOps, color);
      } else {
        svgContent += `    <rect x="0" y="0" width="${piece.width}" height="${piece.height}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="0.8" />\n`;
      }

      if (options?.showPieceLabels) {
        const centerX = piece.width / 2;
        const centerY = piece.height / 2;

        svgContent += `    <text x="${centerX}" y="${centerY - 4}" text-anchor="middle" font-size="7" font-weight="bold" fill="#333">${piece.name}</text>\n`;
        svgContent += `    <text x="${centerX}" y="${centerY + 7}" text-anchor="middle" font-size="6" fill="#666">${piece.width.toFixed(1)}×${piece.height.toFixed(1)}</text>\n`;
      }

      svgContent += `  </g>\n`;
    }

    if (options?.showUtilization) {
      svgContent += this.generateUtilizationInfo(utilization, fabricWidth, fabricHeight);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fabricWidth} ${fabricHeight}">
  <rect x="0" y="0" width="${fabricWidth}" height="${fabricHeight}" fill="#fffef8" stroke="#333" stroke-width="1"/>
${svgContent}</svg>`;
  }

  private static generateGrid(width: number, height: number): string {
    let gridLines = '';
    const gridSize = 10;

    for (let x = 0; x <= width; x += gridSize) {
      const isMajor = x % 50 === 0;
      gridLines += `  <line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${isMajor ? '#999' : '#ddd'}" stroke-width="${isMajor ? 0.3 : 0.15}" />\n`;
    }

    for (let y = 0; y <= height; y += gridSize) {
      const isMajor = y % 50 === 0;
      gridLines += `  <line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${isMajor ? '#999' : '#ddd'}" stroke-width="${isMajor ? 0.3 : 0.15}" />\n`;
    }

    return gridLines;
  }

  private static pathOpsToSVGPath(
    pathOps: PathOperation[],
    color: { fill: string; stroke: string }
  ): string {
    let d = '';

    for (const op of pathOps) {
      switch (op.type) {
        case 'move':
          if (op.to) d += `M ${op.to.x} ${op.to.y} `;
          break;
        case 'line':
          if (op.to) d += `L ${op.to.x} ${op.to.y} `;
          break;
        case 'quad':
          if (op.cp1 && op.to) d += `Q ${op.cp1.x} ${op.cp1.y} ${op.to.x} ${op.to.y} `;
          break;
        case 'curve':
          if (op.cp1 && op.cp2 && op.to) d += `C ${op.cp1.x} ${op.cp1.y} ${op.cp2.x} ${op.cp2.y} ${op.to.x} ${op.to.y} `;
          break;
        case 'close':
          d += 'Z ';
          break;
      }
    }

    if (d.length === 0) {
      return '';
    }

    return `    <path d="${d.trim()}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="0.8" stroke-linejoin="round" />\n`;
  }

  private static generateUtilizationInfo(
    utilization: number,
    fabricWidth: number,
    fabricHeight: number
  ): string {
    const boxX = fabricWidth - 120;
    const boxY = 10;

    return `
  <g transform="translate(${boxX}, ${boxY})">
    <rect x="0" y="0" width="110" height="70" fill="white" fill-opacity="0.9" stroke="#999" stroke-width="0.3" rx="3" />
    <text x="55" y="15" text-anchor="middle" font-size="9" font-weight="bold" fill="#333">排料统计</text>
    <line x1="10" y1="20" x2="100" y2="20" stroke="#ddd" />
    <text x="10" y="35" font-size="8" fill="#666">利用率:</text>
    <text x="100" y="35" text-anchor="end" font-size="9" font-weight="bold" fill="${utilization >= 75 ? '#228B22' : utilization >= 60 ? '#FF8C00' : '#ff0000'}">${utilization.toFixed(1)}%</text>
    <text x="10" y="48" font-size="8" fill="#666">门幅:</text>
    <text x="100" y="48" text-anchor="end" font-size="8" fill="#333">${fabricWidth.toFixed(1)} cm</text>
    <text x="10" y="61" font-size="8" fill="#666">用料长:</text>
    <text x="100" y="61" text-anchor="end" font-size="8" fill="#333">${fabricHeight.toFixed(1)} cm</text>
  </g>`;
  }
}