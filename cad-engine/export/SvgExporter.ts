import { Path, Point } from '../geometry/index.js';
import { PatternPiece } from '../patterns/index.js';

export interface SvgExportOptions {
  width: number;
  height: number;
  padding: number;
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
  showGrainline: boolean;
  showNotches: boolean;
  showLabels: boolean;
  showSeamAllowance: boolean;
  units: 'mm' | 'cm' | 'in';
  scale: number;
}

export const DEFAULT_SVG_OPTIONS: SvgExportOptions = {
  width: 1000,
  height: 1500,
  padding: 50,
  strokeWidth: 1,
  strokeColor: '#000000',
  fillColor: 'none',
  showGrainline: true,
  showNotches: true,
  showLabels: true,
  showSeamAllowance: true,
  units: 'mm',
  scale: 1,
};

export class SvgExporter {
  private options: SvgExportOptions;

  constructor(options: Partial<SvgExportOptions> = {}) {
    this.options = { ...DEFAULT_SVG_OPTIONS, ...options };
  }

  exportPattern(pieces: PatternPiece[]): string {
    const lines: string[] = [];
    
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<svg xmlns="http://www.w3.org/2000/svg" ');
    lines.push(`width="${this.options.width}" height="${this.options.height}" `);
    lines.push(`viewBox="0 0 ${this.options.width} ${this.options.height}">`);
    lines.push('');
    lines.push('  <defs>');
    lines.push('    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">');
    lines.push('      <path d="M0,0 L0,6 L9,3 z" fill="#666"/>');
    lines.push('    </marker>');
    lines.push('  </defs>');
    lines.push('');

    let offsetX = this.options.padding;
    let offsetY = this.options.padding;
    let rowHeight = 0;

    for (const piece of pieces) {
      const bbox = piece.path.getBoundingBox();
      if (!bbox) continue;

      const width = (bbox.bottomRight.x - bbox.topLeft.x) * this.options.scale;
      const height = (bbox.bottomRight.y - bbox.topLeft.y) * this.options.scale;

      if (offsetX + width > this.options.width - this.options.padding) {
        offsetX = this.options.padding;
        offsetY += rowHeight + this.options.padding;
        rowHeight = 0;
      }

      lines.push(`  <g id="${piece.name}" transform="translate(${offsetX}, ${offsetY})">`);
      lines.push(this.exportPiece(piece, bbox.topLeft));
      lines.push('  </g>');
      lines.push('');

      offsetX += width + this.options.padding;
      rowHeight = Math.max(rowHeight, height);
    }

    lines.push('</svg>');
    return lines.join('\n');
  }

  private exportPiece(piece: PatternPiece, topLeft: Point): string {
    const lines: string[] = [];
    const scale = this.options.scale;

    const transform = (p: Point): Point => {
      return new Point(
        (p.x - topLeft.x) * scale,
        (p.y - topLeft.y) * scale
      );
    };

    const mainPath = this.transformPath(piece.path, topLeft);
    lines.push(`    <path d="${mainPath.toSVGPath()}" `);
    lines.push(`stroke="${this.options.strokeColor}" `);
    lines.push(`stroke-width="${this.options.strokeWidth}" `);
    lines.push(`fill="${this.options.fillColor}"/>`);

    if (this.options.showSeamAllowance && piece.seamAllowance) {
      const saPath = piece.path.offset(piece.seamAllowance * scale);
      const saTransformed = this.transformPath(saPath, topLeft);
      lines.push(`    <path d="${saTransformed.toSVGPath()}" `);
      lines.push(`stroke="${this.options.strokeColor}" `);
      lines.push(`stroke-width="${this.options.strokeWidth * 0.5}" `);
      lines.push(`stroke-dasharray="5,3" fill="none"/>`);
    }

    if (this.options.showGrainline && piece.grainline) {
      const gs = transform(piece.grainline.start);
      const ge = transform(piece.grainline.end);
      lines.push(`    <line x1="${gs.x}" y1="${gs.y}" x2="${ge.x}" y2="${ge.y}" `);
      lines.push(`stroke="#666" stroke-width="1" stroke-dasharray="10,5" marker-end="url(#arrow)"/>`);
    }

    if (this.options.showNotches && piece.notches) {
      for (const notch of piece.notches) {
        const n = transform(notch);
        lines.push(`    <circle cx="${n.x}" cy="${n.y}" r="3" fill="black"/>`);
      }
    }

    if (this.options.showLabels) {
      const bbox = piece.path.getBoundingBox();
      if (bbox) {
        const centerX = (bbox.bottomRight.x - topLeft.x) * scale / 2;
        const centerY = (bbox.bottomRight.y - topLeft.y) * scale + 20;
        
        let label = piece.name;
        if (piece.onFold) label += ' (对折)';
        if (piece.cutCount > 1) label += ` ×${piece.cutCount}`;
        
        lines.push(`    <text x="${centerX}" y="${centerY}" `);
        lines.push(`text-anchor="middle" font-size="12" font-family="sans-serif">${label}</text>`);
      }
    }

    return lines.join('\n');
  }

  private transformPath(path: Path, topLeft: Point): Path {
    const transformed = new Path();
    
    for (const op of path.ops) {
      const newOp = { ...op };
      if (op.to) newOp.to = new Point((op.to.x - topLeft.x) * this.options.scale, (op.to.y - topLeft.y) * this.options.scale);
      if (op.cp1) newOp.cp1 = new Point((op.cp1.x - topLeft.x) * this.options.scale, (op.cp1.y - topLeft.y) * this.options.scale);
      if (op.cp2) newOp.cp2 = new Point((op.cp2.x - topLeft.x) * this.options.scale, (op.cp2.y - topLeft.y) * this.options.scale);
      transformed.ops.push(newOp);
    }
    
    return transformed;
  }

  exportPieces(pieces: PatternPiece[]): string[] {
    return pieces.map(piece => this.exportSinglePiece(piece));
  }

  exportSinglePiece(piece: PatternPiece): string {
    const lines: string[] = [];
    const bbox = piece.path.getBoundingBox();
    if (!bbox) return '';

    const width = (bbox.bottomRight.x - bbox.topLeft.x) * this.options.scale + this.options.padding * 2;
    const height = (bbox.bottomRight.y - bbox.topLeft.y) * this.options.scale + this.options.padding * 2;

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`);
    lines.push(this.exportPiece(piece, bbox.topLeft));
    lines.push('</svg>');

    return lines.join('\n');
  }

  exportNestingResult(
    pieces: PatternPiece[],
    positions: Array<{ x: number; y: number; rotation: number }>,
    fabricWidth: number,
    fabricHeight: number
  ): string {
    const lines: string[] = [];
    const scale = this.options.scale;

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" `);
    lines.push(`width="${fabricWidth * scale}" height="${fabricHeight * scale}" `);
    lines.push(`viewBox="0 0 ${fabricWidth * scale} ${fabricHeight * scale}">`);
    lines.push('');

    lines.push(`  <rect x="0" y="0" width="${fabricWidth * scale}" height="${fabricHeight * scale}" `);
    lines.push(`fill="none" stroke="#ccc" stroke-width="2" stroke-dasharray="10,5"/>`);
    lines.push('');

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const pos = positions[i];
      if (!pos) continue;

      const bbox = piece.path.getBoundingBox();
      if (!bbox) continue;

      lines.push(`  <g id="${piece.name}_${i}" transform="translate(${pos.x * scale}, ${pos.y * scale}) rotate(${pos.rotation})">`);

      const transformedPath = piece.path
        .translate(-bbox.topLeft.x, -bbox.topLeft.y)
        .scale(scale);

      lines.push(`    <path d="${transformedPath.toSVGPath()}" `);
      lines.push(`stroke="${this.options.strokeColor}" `);
      lines.push(`stroke-width="${this.options.strokeWidth}" `);
      lines.push(`fill="rgba(200,200,200,0.3)"/>`);
      lines.push('  </g>');
      lines.push('');
    }

    lines.push('</svg>');
    return lines.join('\n');
  }
}
