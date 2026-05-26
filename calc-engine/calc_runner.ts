import { getPiecesFromGarment, type RectPiece } from './core/patterns/index.js';
import { PatternPieceRenderer } from './renderers/PatternPieceRenderer.js';
import { SeamAllowanceRenderer } from './renderers/SeamAllowanceRenderer.js';
import { NestingLayoutRenderer } from './renderers/NestingLayoutRenderer.js';

interface CalcInput {
  mode: 'pattern' | 'seam' | 'nesting' | 'all';
  category?: string;
  pieces?: Array<{
    name: string;
    width: number;
    height: number;
    quantity?: number;
    onFold?: boolean;
  }>;
  seamAllowance?: number;
  fabricWidth?: number;
  options?: {
    showLabels?: boolean;
    showGrid?: boolean;
    showUtilization?: boolean;
    showPieceLabels?: boolean;
  };
}

function main() {
  const input: CalcInput = JSON.parse(process.argv[2]);

  const category = input.category || 'tshirt';
  const pieces = getPiecesFromGarment(category, input.pieces);
  
  if (pieces.length === 0) {
    process.stdout.write(JSON.stringify({ error: '没有可用的裁片数据' }));
    return;
  }

  const result: Record<string, any> = {};

  if (input.mode === 'pattern' || input.mode === 'all') {
    try {
      const patternResult = PatternPieceRenderer.render(pieces, {
        showLabels: true,
        showDimensions: true
      });
      
      result.pattern = {
        svg: patternResult.svg,
        pieces: patternResult.pieces.map(p => ({
          id: p.id,
          name: p.name,
          width: p.width,
          height: p.height,
          quantity: p.quantity,
          onFold: p.onFold,
          area: p.area
        })),
        totalPieces: patternResult.pieces.reduce((sum, p) => sum + p.quantity, 0),
        viewBox: patternResult.viewBox
      };
    } catch (error) {
      console.error('Error rendering pattern:', error);
      result.pattern = { error: String(error) };
    }
  }

  if (input.mode === 'seam' || input.mode === 'all') {
    const seamDist = input.seamAllowance || 1.0;
    
    try {
      const seamResult = SeamAllowanceRenderer.render(pieces, seamDist, {
        showStitchLine: true,
        showCuttingLine: true,
        showSeamLabels: true
      });
      
      result.seam = {
        svg: seamResult.svg,
        pieces: seamResult.pieces.map(p => ({
          id: p.id,
          name: p.name,
          originalSize: p.originalSize,
          seamSize: p.seamSize,
          seamDistance: p.seamDistance
        })),
        seamDistance: seamDist,
        viewBox: seamResult.viewBox
      };
    } catch (error) {
      console.error('Error rendering seam allowance:', error);
      result.seam = { error: String(error) };
    }
  }

  if (input.mode === 'nesting' || input.mode === 'all') {
    const fabricWidth = input.fabricWidth || 145;
    const seamDist = input.seamAllowance || 1.0;
    
    try {
      const nestingResult = NestingLayoutRenderer.render(
        pieces,
        fabricWidth,
        seamDist,
        {
          showGrid: true,
          showUtilization: true,
          showPieceLabels: true
        }
      );
      
      result.nesting = {
        svg: nestingResult.svg,
        pieces: nestingResult.pieces.map(p => ({
          id: p.id,
          name: p.name,
          position: { x: p.x, y: p.y },
          dimensions: { width: p.width, height: p.height },
          onFold: p.onFold
        })),
        fabricInfo: {
          width: nestingResult.fabricWidth,
          height: nestingResult.fabricHeight,
          utilization: nestingResult.utilization
        },
        statistics: nestingResult.statistics,
        nestPositions: nestingResult.nestResult.positions
      };
    } catch (error) {
      console.error('Error rendering nesting layout:', error);
      result.nesting = { error: String(error) };
    }
  }

  process.stdout.write(JSON.stringify(result, null, 2));
}

main();