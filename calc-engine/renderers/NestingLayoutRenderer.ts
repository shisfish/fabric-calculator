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
    const colorPalette = [
      { fill: 'rgba(255, 99, 132, 0.35)', stroke: '#FF6384' },
      { fill: 'rgba(54, 162, 235, 0.35)', stroke: '#36A2EB' },
      { fill: 'rgba(255, 206, 86, 0.35)', stroke: '#FFCE56' },
      { fill: 'rgba(75, 192, 192, 0.35)', stroke: '#4BC0C0' },
      { fill: 'rgba(153, 102, 255, 0.35)', stroke: '#9966FF' },
      { fill: 'rgba(255, 159, 64, 0.35)', stroke: '#FF9F40' },
      { fill: 'rgba(199, 199, 199, 0.35)', stroke: '#C7C7C7' },
      { fill: 'rgba(83, 102, 255, 0.35)', stroke: '#5366FF' },
      { fill: 'rgba(255, 99, 255, 0.35)', stroke: '#FF63FF' },
      { fill: 'rgba(99, 255, 132, 0.35)', stroke: '#63FF84' },
      { fill: 'rgba(255, 165, 0, 0.35)', stroke: '#FFA500' },
      { fill: 'rgba(100, 149, 237, 0.35)', stroke: '#6495ED' },
      { fill: 'rgba(50, 205, 50, 0.35)', stroke: '#32CD32' },
      { fill: 'rgba(255, 105, 180, 0.35)', stroke: '#FF69B4' },
      { fill: 'rgba(204, 153, 255, 0.35)', stroke: '#CC99FF' }
    ];

    const pieceColorMap = new Map<string, { fill: string; stroke: string }>();
    let colorIndex = 0;

    const getPieceBaseName = (pieceName: string): string => {
      return pieceName.replace(/\(\d+缝\)$/, '').replace(/_\d+$/, '');
    };

    const getConsistentColor = (pieceName: string): { fill: string; stroke: string } => {
      const baseName = getPieceBaseName(pieceName);
      
      if (!pieceColorMap.has(baseName)) {
        pieceColorMap.set(baseName, colorPalette[colorIndex % colorPalette.length]);
        colorIndex++;
      }
      
      return pieceColorMap.get(baseName)!;
    };

    const showLabels = options?.showPieceLabels !== false;

    let svgContent = '';

    if (options?.showGrid) {
      svgContent += this.generateGrid(fabricWidth, fabricHeight);
    }

    for (const piece of placedPieces) {
      const color = getConsistentColor(piece.name);

      svgContent += `  <g transform="translate(${piece.x}, ${piece.y})">\n`;

      if (piece.onFold) {
        const foldX = piece.width / 2;
        svgContent += `    <line x1="${foldX}" y1="-3" x2="${foldX}" y2="${piece.height + 3}" stroke="#ff0000" stroke-width="0.6" stroke-dasharray="3,2" />\n`;
      }

      if (piece.pathOps && piece.pathOps.length > 0) {
        svgContent += this.pathOpsToSVGPath(piece.pathOps, color);
      } else {
        svgContent += `    <rect x="0" y="0" width="${piece.width}" height="${piece.height}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="0.8" rx="1" ry="1" />\n`;
      }

      if (showLabels) {
        const displayName = piece.name.replace(/\(\d+缝\)$/, '');
        const centerX = piece.width / 2;
        const centerY = piece.height / 2;
        
        const fontSize = Math.min(piece.width, piece.height) > 20 ? 8 : 6;
        const textFillColor = this.getContrastColor(color.stroke);

        svgContent += `    <text x="${centerX}" y="${centerY + fontSize/3}" text-anchor="middle" font-size="${fontSize}" font-weight="600" fill="${textFillColor}" style="pointer-events:none;">${displayName}</text>\n`;
      }

      svgContent += `  </g>\n`;
    }

    if (options?.showUtilization) {
      svgContent += this.generateUtilizationInfo(utilization, fabricWidth, fabricHeight, pieceColorMap);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fabricWidth} ${fabricHeight}">
  <rect x="0" y="0" width="${fabricWidth}" height="${fabricHeight}" fill="#fffef8" stroke="#333" stroke-width="1"/>
${svgContent}</svg>`;
  }

  private static getContrastColor(hexColor: string): string {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#333333' : '#FFFFFF';
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
    fabricHeight: number,
    pieceColorMap: Map<string, { fill: string; stroke: string }>
  ): string {
    const boxX = fabricWidth - 130;
    const boxY = 10;
    
    const legendItems = Array.from(pieceColorMap.entries());
    const legendHeight = Math.max(70, 20 + legendItems.length * 14);

    let legendContent = '';
    legendItems.forEach(([name, color], index) => {
      const y = 25 + index * 13;
      legendContent += `
    <rect x="10" y="${y - 6}" width="12" height="8" fill="${color.fill}" stroke="${color.stroke}" stroke-width="0.5" rx="1" />
    <text x="26" y="${y + 1}" font-size="7" fill="#333">${name}</text>`;
    });

    return `
  <g transform="translate(${boxX}, ${boxY})">
    <rect x="0" y="0" width="120" height="${legendHeight}" fill="white" fill-opacity="0.92" stroke="#999" stroke-width="0.3" rx="3" />
    <text x="60" y="13" text-anchor="middle" font-size="9" font-weight="bold" fill="#333">排料统计</text>
    <line x1="5" y1="18" x2="115" y2="18" stroke="#ddd" />
    ${legendContent}
    <line x1="5" y2="${legendHeight - 22}" x2="115" y2="${legendHeight - 22}" stroke="#ddd" />
    <text x="10" y="${legendHeight - 9}" font-size="7" fill="#666">利用率:</text>
    <text x="110" y="${legendHeight - 9}" text-anchor="end" font-size="8" font-weight="bold" fill="${utilization >= 80 ? '#228B22' : utilization >= 70 ? '#FF8C00' : '#ff0000'}">${utilization.toFixed(1)}%</text>
  </g>`;
  }
}