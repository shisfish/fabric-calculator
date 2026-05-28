# Shrinkage Compensation

Shrinkage compensation is a CAD geometry preprocessing stage. It runs after pattern and seam allowance generation, and before polygon conversion and nesting.

## Pipeline Position

```text
Garment measurements
  -> pattern outline generation
  -> seam allowance generation
  -> shrinkage compensation
  -> polygon conversion / simplification
  -> nesting / marker making
  -> fabric consumption and utilization
```

The nesting engine must only see compensated geometry. The marker length, occupied area, and utilization are then actual cutting-plan values, not post-processed estimates.

## Data Model

```ts
interface ShrinkageConfig {
  enabled?: boolean;
  fabricId?: string;
  fabricName?: string;
  warpPercent?: number;
  weftPercent?: number;
  direction?: 'warp' | 'weft' | 'both';
  localZones?: LocalCompensationZone[];
}

interface LocalCompensationZone {
  pieceName?: string;
  pointNames?: string[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  warpPercent?: number;
  weftPercent?: number;
}
```

Warp is the fabric length / grain direction. Weft is fabric width. In the current CAD piece coordinate system, `y` maps to warp and `x` maps to weft before nesting rotations are applied.

## Transformation Formula

For shrinkage percent `s`, the cutting compensation scale is:

```text
scale = 1 / (1 - s / 100)
```

For a point `(x, y)`:

```text
x' = x * (1 / (1 - weftShrinkage / 100))
y' = y * (1 / (1 - warpShrinkage / 100))
```

Example with warp `3%`, weft `5%`:

```text
sx = 1 / 0.95 = 1.0526316
sy = 1 / 0.97 = 1.0309278

(20, 50) -> (21.0526, 51.5464)
```

After washing:

```text
21.0526 * 0.95 = 20.0000
51.5464 * 0.97 = 50.0000
```

## Geometry Strategy

The compensator transforms every coordinate-bearing object with the same affine anisotropic scale:

- Pattern outline `Path`
- Seam allowance `Path`
- Bezier control points
- Drill holes and construction points in `piece.points`
- Notches
- Grainline endpoints
- Alignment marks represented as named construction points

Scaling the already-generated seam allowance path preserves final washed seam correctness: the prewash seam allowance is larger by the same directional shrinkage factors, and after laundering it returns to the intended allowance. The numeric `seamAllowance` field is kept as the design intent; `compensatedSeamAllowance` metadata reports the directional prewash values.

## Pseudo Code

```text
pieces = generatePattern(measurements)
pieces = generateSeamAllowance(pieces)

if shrinkage.enabled:
  for piece in pieces:
    sx = 1 / (1 - weftPercent / 100)
    sy = 1 / (1 - warpPercent / 100)

    piece.path = scalePath(piece.path, sx, sy)
    piece.seamAllowancePath = scalePath(piece.seamAllowancePath, sx, sy)
    piece.points = scalePointMap(piece.points, sx, sy)
    piece.notches = scalePoints(piece.notches, sx, sy)
    piece.grainline = scaleGrainline(piece.grainline, sx, sy)

nestingInput = convertToPolygons(pieces)
result = nest(nestingInput)
```

## Compatibility With Nesting

The existing `NestEngine` receives normal `PatternPiece` objects. No nesting algorithm changes are required because:

- polygons are generated from compensated paths;
- grain constraints remain on `allowedRotations`;
- fabric nap logic still restricts rotations;
- utilization is computed from compensated placed polygon area over actual marker area.

The output exposes:

- `dimensions.original`
- `dimensions.compensated`
- `shrinkage.config`
- `shrinkage.pieces`
- `actualNestingUtilization`

## Local Compensation

Local zones can override global warp/weft values for specific named construction points or for path coordinates inside a bounding box. This supports areas such as rib/collar zones, heat-pressed panels, fused sections, or fabric lots with directional behavior.

Keep local zones small and intentional. A discontinuity between two adjacent path points can create shape distortion; for production, zones should be paired with QA checks for curve smoothness and seam compatibility.

## Edge Cases

- `0%` shrinkage: no geometric change unless local zones are configured.
- `direction: 'warp'`: only `y` is scaled.
- `direction: 'weft'`: only `x` is scaled.
- Percent `>= 100`: rejected because the compensation scale is undefined.
- On-fold pieces: compensated first, then mirrored/expanded for display or marker output.
- Negative coordinates: scaled around origin; nesting normalization still removes negative local offsets.
- Bezier paths: endpoints and control points are scaled, preserving parametric curve continuity.
- Rotations: compensation is applied in pattern/grain coordinates before nesting rotations, preserving fabric grain constraints.

## Precision Handling

- Internal math keeps JavaScript double precision.
- Dimension metadata rounds to `0.0001` CAD units.
- Polygon simplification stays in the nesting layer and runs after compensation.
- Do not round transformed path coordinates before nesting; rounding too early can create small collision or seam-length errors.
