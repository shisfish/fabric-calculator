import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NestingResult, Point, PatternPiece, PathOperation } from './types';
import {
  pathOpsToSVGPath,
  getBoundingBox,
  rotatePathOps,
  translatePathOps
} from './svgUtils';

interface NestingViewerProps {
  result: NestingResult;
  pieces: PatternPiece[];
  fabricWidth: number;
  width?: number;
  height?: number;
  showGrid?: boolean;
  showUtilization?: boolean;
  onPieceClick?: (pieceName: string) => void;
}

const PIECE_COLORS: Record<string, { fill: string; stroke: string }> = {
  back: { fill: 'rgba(100, 149, 237, 0.5)', stroke: '#4169E1' },
  front: { fill: 'rgba(255, 165, 0, 0.5)', stroke: '#FF8C00' },
  sleeve: { fill: 'rgba(50, 205, 50, 0.5)', stroke: '#228B22' },
  collar: { fill: 'rgba(255, 105, 180, 0.5)', stroke: '#FF69B4' },
  default: { fill: 'rgba(169, 169, 169, 0.5)', stroke: '#696969' }
};

export const NestingViewer: React.FC<NestingViewerProps> = ({
  result,
  pieces,
  fabricWidth,
  width = 800,
  height = 600,
  showGrid = true,
  showUtilization = true,
  onPieceClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [hoveredPiece, setHoveredPiece] = useState<string | null>(null);

  const fabricHeight = result.bounds.height;
  const viewBox = {
    x: -20,
    y: -20,
    width: fabricWidth + 40,
    height: fabricHeight + 40
  };

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

  const getPiecePathOps = (pieceName: string): PathOperation[] => {
    const piece = pieces.find(p => p.name === pieceName);
    return piece?.pathOps || [];
  };

  const renderGrid = () => {
    if (!showGrid) return null;
    
    const gridLines: JSX.Element[] = [];
    const gridSize = 10;
    
    for (let x = 0; x <= fabricWidth; x += gridSize) {
      gridLines.push(
        <line
          key={`v_${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={fabricHeight}
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      );
    }
    
    for (let y = 0; y <= fabricHeight; y += gridSize) {
      gridLines.push(
        <line
          key={`h_${y}`}
          x1={0}
          y1={y}
          x2={fabricWidth}
          y2={y}
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      );
    }
    
    return gridLines;
  };

  const renderFabricBoundary = () => (
    <g>
      <rect
        x={0}
        y={0}
        width={fabricWidth}
        height={fabricHeight}
        fill="none"
        stroke="#333"
        strokeWidth={2}
        strokeDasharray="10,5"
      />
      <text
        x={fabricWidth / 2}
        y={-8}
        textAnchor="middle"
        fontSize="12"
        fontFamily="sans-serif"
        fill="#333"
      >
        面料门幅: {fabricWidth} cm
      </text>
    </g>
  );

  const renderPlacedPiece = (position: { name: string; x: number; y: number; rotation: number }, index: number) => {
    const pathOps = getPiecePathOps(position.name);
    if (pathOps.length === 0) return null;
    
    const bbox = getBoundingBox(pathOps);
    if (!bbox) return null;
    
    const color = getPieceColor(position.name);
    const isHovered = hoveredPiece === position.name;
    
    const centeredOps = translatePathOps(pathOps, -bbox.min.x, -bbox.min.y);
    const rotatedOps = rotatePathOps(centeredOps, position.rotation);
    const finalOps = translatePathOps(rotatedOps, position.x, position.y);
    
    const pathD = pathOpsToSVGPath(finalOps);
    
    return (
      <g
        key={`placed_${position.name}_${index}`}
        onMouseEnter={() => setHoveredPiece(position.name)}
        onMouseLeave={() => setHoveredPiece(null)}
        onClick={() => onPieceClick?.(position.name)}
        style={{ cursor: onPieceClick ? 'pointer' : 'default' }}
      >
        <path
          d={pathD}
          fill={color.fill}
          stroke={isHovered ? '#ff0000' : color.stroke}
          strokeWidth={isHovered ? 2 : 1}
        />
        {isHovered && (
          <text
            x={position.x + (bbox.max.x - bbox.min.x) / 2}
            y={position.y - 5}
            textAnchor="middle"
            fontSize="10"
            fontFamily="sans-serif"
            fill="#333"
            fontWeight="bold"
          >
            {position.name} ({position.rotation}°)
          </text>
        )}
      </g>
    );
  };

  const renderUtilizationOverlay = () => {
    if (!showUtilization) return null;
    
    const utilization = result.utilization;
    const usedArea = result.usedArea;
    const totalArea = result.totalArea;
    
    return (
      <g transform={`translate(${fabricWidth + 30}, 0)`}>
        <rect
          x={0}
          y={0}
          width={20}
          height={100}
          fill="#e0e0e0"
          stroke="#333"
          strokeWidth={1}
        />
        <rect
          x={0}
          y={100 - utilization}
          width={20}
          height={utilization}
          fill={utilization > 80 ? '#4CAF50' : utilization > 60 ? '#FFC107' : '#F44336'}
        />
        <text
          x={10}
          y={120}
          textAnchor="middle"
          fontSize="10"
          fontFamily="sans-serif"
          fill="#333"
        >
          {utilization.toFixed(1)}%
        </text>
        <text
          x={10}
          y={-10}
          textAnchor="middle"
          fontSize="9"
          fontFamily="sans-serif"
          fill="#666"
        >
          利用率
        </text>
      </g>
    );
  };

  const renderStats = () => (
    <g transform={`translate(10, ${fabricHeight + 30})`}>
      <text fontSize="11" fontFamily="sans-serif" fill="#333">
        <tspan x={0} dy="0">排料长度: {fabricHeight.toFixed(1)} cm</tspan>
        <tspan x={0} dy="15">使用面积: {(usedArea / 100).toFixed(1)} cm²</tspan>
        <tspan x={0} dy="15">利用率: {result.utilization.toFixed(1)}%</tspan>
        <tspan x={0} dy="15">裁片数量: {result.positions.length}</tspan>
      </text>
    </g>
  );

  const usedArea = result.usedArea;

  return (
    <div className="nesting-viewer" style={{ width, height, overflow: 'hidden', border: '1px solid #ccc', position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width + 80} ${viewBox.height + 60}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ backgroundColor: '#fafafa', cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <defs>
          <pattern
            id="grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
          </pattern>
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
        </defs>
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {showGrid && <rect x={0} y={0} width={fabricWidth} height={fabricHeight} fill="url(#grid)" />}
          {renderGrid()}
          {renderFabricBoundary()}
          {result.positions.map((pos, idx) => renderPlacedPiece(pos, idx))}
          {renderUtilizationOverlay()}
          {renderStats()}
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

export default NestingViewer;
