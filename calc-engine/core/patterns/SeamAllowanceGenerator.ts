import { Point, Path, type PathOperation } from '../geometry/index.js';

export interface SeamAllowanceRule {
  segment: string;
  distance: number;
}

interface SourceSegment {
  ops: PathOperation[];
  name: string;
  type: string;
}

export class SeamAllowanceGenerator {
  static generate(outline: Path, rules: SeamAllowanceRule[]): Path {
    const segments = this.extractSegments(outline);
    const offsetSegments = segments.map(seg => {
      const rule = rules.find(r => r.segment === seg.name);
      const distance = rule?.distance || 0;
      
      if (distance <= 0) return seg.ops;
      
      return this.offsetSegment(seg.ops, distance);
    });

    const resultPath = new Path();
    for (const segOps of offsetSegments) {
      for (const op of segOps) {
        if (op.type === 'move') {
          resultPath.move(op.to!);
        } else if (op.type === 'line') {
          resultPath.line(op.to!);
        } else if (op.type === 'curve' && op.cp1 && op.cp2 && op.to) {
          resultPath.curve(op.cp1, op.cp2, op.to);
        } else if (op.type === 'quad' && op.cp1 && op.to) {
          resultPath.quad(op.cp1, op.to);
        }
      }
    }
    
    return resultPath;
  }

  private static extractSegments(path: Path): SourceSegment[] {
    const segments: SourceSegment[] = [];
    let currentSegment: PathOperation[] = [];
    let currentName = '';
    let currentType = '';

    for (const op of path.ops) {
      if (op.segmentName && (op.segmentName !== currentName || segments.length === 0)) {
        if (currentSegment.length > 0) {
          segments.push({
            ops: [...currentSegment],
            name: currentName,
            type: currentType
          });
        }
        currentSegment = [];
        currentName = op.segmentName;
        currentType = op.segmentType || '';
      }
      currentSegment.push(op);
    }

    if (currentSegment.length > 0) {
      segments.push({
        ops: currentSegment,
        name: currentName,
        type: currentType
      });
    }

    return segments;
  }

  private static offsetSegment(ops: PathOperation[], distance: number): PathOperation[] {
    const result: PathOperation[] = [];
    
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      
      if (op.type === 'move') {
        result.push({ ...op });
      } else if (op.type === 'line' && op.to) {
        const prevOp = i > 0 ? ops[i - 1] : null;
        const fromPoint = prevOp?.to || new Point(0, 0);
        
        const dx = op.to.x - fromPoint.x;
        const dy = op.to.y - fromPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len > 0) {
          const nx = -dy / len * distance;
          const ny = dx / len * distance;
          
          result.push({
            type: 'line',
            to: new Point(fromPoint.x + nx + dx, fromPoint.y + ny + dy)
          });
          
          if (i === 0 && result.length > 1) {
            result[0] = {
              type: 'move',
              to: new Point(fromPoint.x + nx, fromPoint.y + ny)
            };
          }
        }
      } else if (op.type === 'curve' && op.cp1 && op.cp2 && op.to) {
        const prevOp = i > 0 ? ops[i - 1] : null;
        const fromPoint = prevOp?.to || new Point(0, 0);
        
        const midX = (fromPoint.x + op.to.x + op.cp1.x + op.cp2.x) / 4;
        const midY = (fromPoint.y + op.to.y + op.cp1.y + op.cp2.y) / 4;
        
        const offsetX = (midX - fromPoint.x) * 0.3;
        const offsetY = (midY - fromPoint.y) * 0.3;
        const len = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        
        if (len > 0) {
          const nx = -offsetY / len * distance;
          const ny = offsetX / len * distance;
          
          result.push({
            type: 'curve',
            cp1: new Point(op.cp1.x + nx, op.cp1.y + ny),
            cp2: new Point(op.cp2.x + nx, op.cp2.y + ny),
            to: new Point(op.to.x + nx, op.to.y + ny)
          });
          
          if (i === 0 && result.length > 1) {
            result[0] = {
              type: 'move',
              to: new Point(fromPoint.x + nx, fromPoint.y + ny)
            };
          }
        }
      }
    }
    
    return result.length > 0 ? result : ops;
  }
}