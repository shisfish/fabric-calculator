import { Path } from './geometry/index.js';
import { Point } from './geometry/Point.js';

export interface PatternPiece {
  name: string;
  path: Path;
  points: Record<string, Point>;
  seamAllowance?: number;
  seamAllowancePath?: Path;
  grainline?: { start: Point; end: Point };
  notches?: Point[];
  cutCount: number;
  onFold: boolean;

  frontCapLength?: number;
  backCapLength?: number;
  totalCapLength?: number;
  frontArmholeLength?: number;
  backArmholeLength?: number;
  ease?: number;

  allowedRotations?: number[];
  isMirrorable?: boolean;

  _custom?: boolean;
}
