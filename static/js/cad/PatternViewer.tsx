import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PatternPiece, Point } from './types';
import {
  pathOpsToSVGPath,
  getBoundingBox,
  getControlPoints,
  calculateDimensionLines,
  translatePathOps
} from './svgUtils';

interface PatternViewerProps {
  pieces: PatternPiece[];
  width?: number;
  height?: number;
  showControlPoints?: boolean;
  showDimensionLines?: boolean;
  showLabels?: boolean;
  showSeamAllowance?: boolean;
  selectedPiece?: string;
  onPieceClick?: (pieceName: string) => void;
}

const PIECE_COLORS: Record<string, { fill: string; stroke: string }> = {
  back: { fill: 'rgba(200, 220, 255, 0.4)', stroke: '#3366cc' },
  front: { fill: 'rgba(255, 220, 200, 0.4)', stroke: '#cc6633' },
  sleeve: { fill: 'rgba(220, 255, 200, 0.4)', stroke: '#33cc66' },
  collar: { fill: 'rgba(255, 200, 220, 0.4)', stroke: '#cc3366' },
  default: { fill: 'rgba(220, 220, 220, 0.4)', stroke: '#666666' }
};

export const PatternViewer: React.FC<PatternViewerProps> = ({
  pieces,
  width = 800,
  height = 600,
  showControlPoints = false,
  showDimensionLines = true,
  showLabels = true,
  showSeamAllowance = true,
  selectedPiece,
  onPieceClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });

  const allPieces = pieces.flatMap(p => p.pathOps);
  const bbox = getBoundingBox(allPieces);
  
  const viewBox = bbox
    ? {
        x: bbox.min.x - 20,
        y: bbox.min.y - 20,
        width: (bbox.max.x - bbox.min.x) + 40,
        height: (bbox.max.y - bbox.min.y) + 40
      }
    : { x: 0, y: 0, width: width, height: height };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.1, Math.min(5, s * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const getPieceColor = (name: string) => {
    const key = name.toLowerCase().split('_')[0];
    return PIECE_COLORS[key] || PIECE_COLORS.default;
  };

  const renderPiece = (piece: PatternPiece, index: number) => {
    const color = getPieceColor(piece.name);
    const isSelected = selectedPiece === piece.name;
    const pathD = pathOpsToSVGPath(piece.pathOps);
    const pieceBbox = getBoundingBox(piece.pathOps);
    const dimensionLines = showDimensionLines && pieceBbox ? calculateDimensionLines(piece) : [];
    const controlPoints = showControlPoints ? getControlPoints(piece.pathOps) : [];

    return (
      <g
        key={`${piece.name}_${index}`}
        transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
        onClick={() => onPieceClick?.(piece.name)}
        style={{ cursor: onPieceClick ? 'pointer' : 'default' }}
      >
        <path
          d={pathD}
          fill={color.fill}
          stroke={isSelected ? '#ff0000' : color.stroke}
          strokeWidth={isSelected ? 2 : 1}
          strokeDasharray={piece.onFold ? '5,3' : undefined}
        />
        
        {showSeamAllowance && piece.seamAllowance && pieceBbox && (
          <path
            d={pathD}
            fill="none"
            stroke="#999"
            strokeWidth={0.5}
            strokeDasharray="3,2"
            transform={`scale(${1 + piece.seamAllowance / 100})`}
          />
        )}
        
        {piece.grainline && (
          <line
            x1={piece.grainline.start.x}
            y1={piece.grainline.start.y}
            x2={piece.grainline.end.x}
            y2={piece.grainline.end.y}
            stroke="#666"
            strokeWidth={1}
            strokeDasharray="10,5"
            markerEnd="url(#arrow)"
          />
        )}
        
        {piece.notches?.map((notch, i) => (
          <circle
            key={`notch_${i}`}
            cx={notch.x}
            cy={notch.y}
            r={2}
            fill="#000"
          />
        ))}
        
        {controlPoints.map((cp, i) => (
          <circle
            key={`cp_${i}`}
            cx={cp.x}
            cy={cp.y}
            r={3}
            fill="rgba(255, 0, 0, 0.5)"
            stroke="#f00"
            strokeWidth={0.5}
          />
        ))}
        
        {dimensionLines.map((dim, i) => (
          <g key={`dim_${i}`}>
            <line
              x1={dim.start.x}
              y1={dim.start.y}
              x2={dim.end.x}
              y2={dim.end.y}
              stroke="#333"
              strokeWidth={0.5}
              markerStart="url(#dimStart)"
              markerEnd="url(#dimEnd)"
            />
            <text
              x={(dim.start.x + dim.end.x) / 2}
              y={dim.start.y + 12}
              textAnchor="middle"
              fontSize="10"
              fontFamily="sans-serif"
              fill="#333"
            >
              {dim.label}
            </text>
          </g>
        ))}
        
        {showLabels && pieceBbox && (
          <text
            x={(pieceBbox.min.x + pieceBbox.max.x) / 2}
            y={pieceBbox.max.y + 25}
            textAnchor="middle"
            fontSize="12"
            fontFamily="sans-serif"
            fontWeight="bold"
            fill="#333"
          >
            {piece.name}
            {piece.onFold && ' (对折)'}
            {piece.cutCount > 1 && ` ×${piece.cutCount}`}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="pattern-viewer" style={{ width, height, overflow: 'hidden', border: '1px solid #ccc' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ backgroundColor: '#f9f9f9', cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#666" />
          </marker>
          <marker
            id="dimStart"
            markerWidth="6"
            markerHeight="6"
            refX="0"
            refY="3"
            orient="auto"
          >
            <circle cx="3" cy="3" r="2" fill="#333" />
          </marker>
          <marker
            id="dimEnd"
            markerWidth="6"
            markerHeight="6"
            refX="6"
            refY="3"
            orient="auto"
          >
            <circle cx="3" cy="3" r="2" fill="#333" />
          </marker>
        </defs>
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {pieces.map((piece, index) => renderPiece(piece, index))}
        </g>
      </svg>
      
      <div className="viewer-controls" style={{
        position: 'absolute',
        top: 10,
        right: 10,
        display: 'flex',
        gap: 8
      }}>
        <button onClick={() => setScale(s => Math.min(5, s * 1.2))}>+</button>
        <button onClick={() => setScale(s => Math.max(0.1, s / 1.2))}>-</button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>重置</button>
      </div>
      
      <div className="scale-indicator" style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        fontSize: 12,
        color: '#666'
      }}>
        缩放: {(scale * 100).toFixed(0)}%
      </div>
    </div>
  );
};

export default PatternViewer;
