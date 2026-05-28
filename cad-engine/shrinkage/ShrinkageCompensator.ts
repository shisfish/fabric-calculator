import { Path, Point } from '../geometry/index.js';
import type { PathOperation } from '../geometry/Path.js';
import type { PatternPiece } from '../patterns/index.js';

export type ShrinkageDirection = 'warp' | 'weft' | 'both';

export interface DirectionalShrinkage {
  warpPercent?: number;
  weftPercent?: number;
}

export interface LocalCompensationZone extends DirectionalShrinkage {
  pieceName?: string;
  pointNames?: string[];
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface ShrinkageConfig extends DirectionalShrinkage {
  enabled?: boolean;
  fabricId?: string;
  fabricName?: string;
  direction?: ShrinkageDirection;
  localZones?: LocalCompensationZone[];
}

export interface PieceDimensionSnapshot {
  width: number;
  height: number;
  area: number;
}

export interface PieceShrinkageMetadata {
  pieceName: string;
  original: PieceDimensionSnapshot;
  compensated: PieceDimensionSnapshot;
  warpPercent: number;
  weftPercent: number;
  warpScale: number;
  weftScale: number;
}

export interface ShrinkageResult {
  pieces: PatternPiece[];
  config: Required<Omit<ShrinkageConfig, 'fabricId' | 'fabricName' | 'localZones'>> & {
    fabricId?: string;
    fabricName?: string;
    localZones: LocalCompensationZone[];
  };
  pieceMetadata: PieceShrinkageMetadata[];
}

type TransformContext = {
  pieceName: string;
  pointKey?: string;
};

export class ShrinkageCompensator {
  static apply(pieces: PatternPiece[], config?: ShrinkageConfig | null): ShrinkageResult {
    const normalizedConfig = this.normalizeConfig(config);

    if (!normalizedConfig.enabled) {
      return {
        pieces,
        config: normalizedConfig,
        pieceMetadata: pieces.map(piece => this.createMetadata(piece, piece, normalizedConfig))
      };
    }

    const compensatedPieces = pieces.map(piece => this.compensatePiece(piece, normalizedConfig));

    return {
      pieces: compensatedPieces,
      config: normalizedConfig,
      pieceMetadata: compensatedPieces.map((piece, index) =>
        this.createMetadata(pieces[index], piece, normalizedConfig)
      )
    };
  }

  private static normalizeConfig(config?: ShrinkageConfig | null): ShrinkageResult['config'] {
    const direction = config?.direction ?? 'both';
    const inputWarp = this.toFinitePercent(config?.warpPercent);
    const inputWeft = this.toFinitePercent(config?.weftPercent);

    return {
      enabled: config?.enabled !== false && (inputWarp !== 0 || inputWeft !== 0 || !!config?.localZones?.length),
      warpPercent: direction === 'weft' ? 0 : inputWarp,
      weftPercent: direction === 'warp' ? 0 : inputWeft,
      direction,
      fabricId: config?.fabricId,
      fabricName: config?.fabricName,
      localZones: config?.localZones ?? []
    };
  }

  private static compensatePiece(piece: PatternPiece, config: ShrinkageResult['config']): PatternPiece {
    const compensated: PatternPiece = {
      ...piece,
      path: this.transformPath(piece.path, config, { pieceName: piece.name }),
      points: this.transformPointMap(piece.points || {}, config, piece.name),
      seamAllowancePath: piece.seamAllowancePath
        ? this.transformPath(piece.seamAllowancePath, config, { pieceName: piece.name })
        : undefined,
      grainline: piece.grainline
        ? {
            start: this.transformPoint(piece.grainline.start, config, { pieceName: piece.name }),
            end: this.transformPoint(piece.grainline.end, config, { pieceName: piece.name })
          }
        : undefined,
      notches: piece.notches?.map(point =>
        this.transformPoint(point, config, { pieceName: piece.name })
      ),
      seamAllowance: piece.seamAllowance
    };

    (compensated as any).shrinkageCompensated = true;
    (compensated as any).originalSeamAllowance = piece.seamAllowance;
    (compensated as any).compensatedSeamAllowance = piece.seamAllowance
      ? {
          warp: piece.seamAllowance * this.scaleFromPercent(config.warpPercent),
          weft: piece.seamAllowance * this.scaleFromPercent(config.weftPercent)
        }
      : undefined;

    return compensated;
  }

  private static transformPointMap(
    points: Record<string, Point>,
    config: ShrinkageResult['config'],
    pieceName: string
  ): Record<string, Point> {
    return Object.fromEntries(
      Object.entries(points).map(([key, point]) => [
        key,
        this.transformPoint(point, config, { pieceName, pointKey: key })
      ])
    );
  }

  private static transformPath(path: Path, config: ShrinkageResult['config'], context: TransformContext): Path {
    const result = new Path();
    result.ops = path.ops.map((op): PathOperation => {
      const transformed: PathOperation = {
        type: op.type,
        segmentName: op.segmentName,
        segmentType: op.segmentType
      };
      if (op.to) transformed.to = this.transformPoint(op.to, config, context);
      if (op.cp1) transformed.cp1 = this.transformPoint(op.cp1, config, context);
      if (op.cp2) transformed.cp2 = this.transformPoint(op.cp2, config, context);
      return transformed;
    });
    result.attributes = path.attributes.clone();
    result.hidden = path.hidden;
    result.name = path.name;
    return result;
  }

  private static transformPoint(point: Point, config: ShrinkageResult['config'], context: TransformContext): Point {
    const local = this.findLocalZone(point, config.localZones, context);
    const warpPercent = local?.warpPercent ?? config.warpPercent;
    const weftPercent = local?.weftPercent ?? config.weftPercent;
    const sx = this.scaleFromPercent(weftPercent);
    const sy = this.scaleFromPercent(warpPercent);
    return new Point(point.x * sx, point.y * sy);
  }

  private static findLocalZone(
    point: Point,
    zones: LocalCompensationZone[],
    context: TransformContext
  ): LocalCompensationZone | undefined {
    return zones.find(zone => {
      if (zone.pieceName && zone.pieceName !== context.pieceName) return false;
      if (zone.pointNames?.length) {
        return !!context.pointKey && zone.pointNames.includes(context.pointKey);
      }
      if (!zone.bounds) return false;
      return point.x >= zone.bounds.minX &&
        point.x <= zone.bounds.maxX &&
        point.y >= zone.bounds.minY &&
        point.y <= zone.bounds.maxY;
    });
  }

  private static createMetadata(
    originalPiece: PatternPiece,
    compensatedPiece: PatternPiece,
    config: ShrinkageResult['config']
  ): PieceShrinkageMetadata {
    return {
      pieceName: originalPiece.name,
      original: this.measurePiece(originalPiece),
      compensated: this.measurePiece(compensatedPiece),
      warpPercent: config.warpPercent,
      weftPercent: config.weftPercent,
      warpScale: this.scaleFromPercent(config.warpPercent),
      weftScale: this.scaleFromPercent(config.weftPercent)
    };
  }

  private static measurePiece(piece: PatternPiece): PieceDimensionSnapshot {
    const path = piece.seamAllowancePath || piece.path;
    const bbox = path.getBoundingBox();
    if (!bbox) {
      return { width: 0, height: 0, area: 0 };
    }

    const width = bbox.bottomRight.x - bbox.topLeft.x;
    const height = bbox.bottomRight.y - bbox.topLeft.y;
    return {
      width: this.round(width),
      height: this.round(height),
      area: this.round(width * height)
    };
  }

  private static scaleFromPercent(percent: number | undefined): number {
    const p = this.toFinitePercent(percent);
    if (p >= 100) {
      throw new Error(`Invalid shrinkage percent ${p}; value must be less than 100`);
    }
    return 1 / (1 - p / 100);
  }

  private static toFinitePercent(value: number | string | undefined): number {
    if (value === undefined || value === null || value === '') return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
  }

  private static round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
