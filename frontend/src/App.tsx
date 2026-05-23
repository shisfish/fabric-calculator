import React from 'react';
import { createRoot } from 'react-dom/client';
import { PatternViewer } from './PatternViewer';
import { NestingViewer } from './NestingViewer';
import type { PatternPiece, NestingResult } from './types';

interface CADAppProps {
  pieces: PatternPiece[];
  nestingResult: NestingResult | null;
  fabricWidth: number;
  mode: 'preview' | 'nesting';
}

const CADApp: React.FC<CADAppProps> = ({ pieces, nestingResult, fabricWidth, mode }) => {
  if (mode === 'preview' && pieces.length > 0) {
    return (
      <div className="cad-viewer">
        <PatternViewer
          pieces={pieces}
          width={800}
          height={500}
          showControlPoints={false}
          showDimensionLines={true}
          showLabels={true}
        />
      </div>
    );
  }

  if (mode === 'nesting' && nestingResult) {
    return (
      <div className="cad-viewer">
        <NestingViewer
          result={nestingResult}
          pieces={pieces}
          fabricWidth={fabricWidth}
          width={800}
          height={600}
          showGrid={true}
          showUtilization={true}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, color: '#666', textAlign: 'center' }}>
      暂无数据
    </div>
  );
};

declare global {
  interface Window {
    renderPatternPreview: (pieces: PatternPiece[]) => void;
    renderNestingResult: (pieces: PatternPiece[], result: NestingResult, fabricWidth: number) => void;
  }
}

// 缓存root实例，避免重复创建导致React警告
let previewRoot: any = null;
let nestingRoot: any = null;

window.renderPatternPreview = (pieces: PatternPiece[]) => {
  const container = document.getElementById('cad-pattern-viewer');
  if (container) {
    if (!previewRoot) {
      previewRoot = createRoot(container);
    }
    previewRoot.render(<CADApp pieces={pieces} nestingResult={null} fabricWidth={145} mode="preview" />);
  }
};

window.renderNestingResult = (pieces: PatternPiece[], result: NestingResult, fabricWidth: number) => {
  const container = document.getElementById('cad-nesting-viewer');
  if (container) {
    if (!nestingRoot) {
      nestingRoot = createRoot(container);
    }
    nestingRoot.render(<CADApp pieces={pieces} nestingResult={result} fabricWidth={fabricWidth} mode="nesting" />);
  }
};

export { CADApp };
