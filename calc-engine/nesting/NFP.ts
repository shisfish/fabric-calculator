import { Point } from './geometry/index.js';
import { Polygon } from './Polygon.js';
import { SATCollision } from './Collision.js';

export class NFP {
  static calculateNFP(staticPoly: Polygon, orbitingPoly: Polygon): Polygon[] {
    const nfps: Polygon[] = [];

    const orbitingReversed = new Polygon(
      [...orbitingPoly.points].reverse(),
      orbitingPoly.id
    );

    const slidingEdges = this.getSlidingEdges(staticPoly, orbitingReversed);
    
    for (const edge of slidingEdges) {
      const nfpPoints = this.traceNFP(staticPoly, orbitingReversed, edge);
      if (nfpPoints.length >= 3) {
        try {
          nfps.push(new Polygon(nfpPoints, `nfp_${staticPoly.id}_${orbitingPoly.id}`));
        } catch {
          // Invalid polygon, skip
        }
      }
    }

    if (nfps.length === 0) {
      const innerNFP = this.calculateInnerNFP(staticPoly, orbitingReversed);
      if (innerNFP) {
        nfps.push(innerNFP);
      }
    }

    return nfps;
  }

  private static getSlidingEdges(staticPoly: Polygon, orbitingPoly: Polygon): Array<{
    staticEdge: { start: Point; end: Point };
    orbitingVertex: Point;
  }> {
    const edges: Array<{
      staticEdge: { start: Point; end: Point };
      orbitingVertex: Point;
    }> = [];

    const staticPoints = staticPoly.points;
    const orbitingPoints = orbitingPoly.points;

    for (let i = 0; i < staticPoints.length; i++) {
      const staticStart = staticPoints[i];
      const staticEnd = staticPoints[(i + 1) % staticPoints.length];

      for (let j = 0; j < orbitingPoints.length; j++) {
        const orbitingVertex = orbitingPoints[j];
        edges.push({
          staticEdge: { start: staticStart, end: staticEnd },
          orbitingVertex,
        });
      }
    }

    return edges;
  }

  private static traceNFP(
    staticPoly: Polygon,
    orbitingPoly: Polygon,
    startEdge: { staticEdge: { start: Point; end: Point }; orbitingVertex: Point }
  ): Point[] {
    const points: Point[] = [];
    const visited = new Set<string>();

    const initialOffset = new Point(
      startEdge.staticEdge.start.x - startEdge.orbitingVertex.x,
      startEdge.staticEdge.start.y - startEdge.orbitingVertex.y
    );

    let currentOffset = initialOffset;
    let iterations = 0;
    const maxIterations = staticPoly.points.length * orbitingPoly.points.length * 4;

    while (iterations < maxIterations) {
      iterations++;

      const key = `${currentOffset.x.toFixed(2)},${currentOffset.y.toFixed(2)}`;
      if (visited.has(key)) break;
      visited.add(key);

      const translatedOrbiting = orbitingPoly.translate(currentOffset.x, currentOffset.y);
      const centroid = translatedOrbiting.getCentroid();
      points.push(new Point(centroid.x, centroid.y));

      const nextOffset = this.findNextValidPosition(staticPoly, translatedOrbiting, currentOffset);
      if (!nextOffset) break;

      currentOffset = nextOffset;
    }

    return points;
  }

  private static findNextValidPosition(
    staticPoly: Polygon,
    orbitingPoly: Polygon,
    currentOffset: Point
  ): Point | null {
    const staticPoints = staticPoly.points;
    const orbitingPoints = orbitingPoly.points;

    let bestOffset: Point | null = null;
    let bestDistance = Infinity;

    for (let i = 0; i < staticPoints.length; i++) {
      const staticStart = staticPoints[i];
      const staticEnd = staticPoints[(i + 1) % staticPoints.length];

      for (let j = 0; j < orbitingPoints.length; j++) {
        const orbitingVertex = orbitingPoints[j];

        const edgeDir = new Point(
          staticEnd.x - staticStart.x,
          staticEnd.y - staticStart.y
        );
        const edgeLen = Math.sqrt(edgeDir.x * edgeDir.x + edgeDir.y * edgeDir.y);

        if (edgeLen < 0.001) continue;

        const normalizedEdge = new Point(edgeDir.x / edgeLen, edgeDir.y / edgeLen);

        const step = Math.min(5, edgeLen / 10);
        for (let t = step; t <= edgeLen; t += step) {
          const newStaticPoint = new Point(
            staticStart.x + normalizedEdge.x * t,
            staticStart.y + normalizedEdge.y * t
          );

          const newOffset = new Point(
            newStaticPoint.x - orbitingVertex.x + currentOffset.x - orbitingPoly.points[j].x,
            newStaticPoint.y - orbitingVertex.y + currentOffset.y - orbitingPoly.points[j].y
          );

          const testPoly = orbitingPoly.translate(newOffset.x, newOffset.y);
          const collision = SATCollision.testCollisionRobust(staticPoly, testPoly);

          if (!collision.collides || collision.overlap < 0.1) {
            const dist = Math.sqrt(
              (newOffset.x - currentOffset.x) ** 2 +
              (newOffset.y - currentOffset.y) ** 2
            );

            if (dist > 0.1 && dist < bestDistance) {
              bestDistance = dist;
              bestOffset = newOffset;
            }
          }
        }
      }
    }

    return bestOffset;
  }

  private static calculateInnerNFP(container: Polygon, part: Polygon): Polygon | null {
    const containerBbox = container.getBoundingBox();
    const partBbox = part.getBoundingBox();

    const innerWidth = containerBbox.width - partBbox.width;
    const innerHeight = containerBbox.height - partBbox.height;

    if (innerWidth <= 0 || innerHeight <= 0) {
      return null;
    }

    const innerPoints: Point[] = [
      new Point(containerBbox.minX + partBbox.width / 2, containerBbox.minY + partBbox.height / 2),
      new Point(containerBbox.maxX - partBbox.width / 2, containerBbox.minY + partBbox.height / 2),
      new Point(containerBbox.maxX - partBbox.width / 2, containerBbox.maxY - partBbox.height / 2),
      new Point(containerBbox.minX + partBbox.width / 2, containerBbox.maxY - partBbox.height / 2),
    ];

    return new Polygon(innerPoints, `inner_nfp_${container.id}_${part.id}`);
  }

  static calculateIFP(width: number, height: number, part: Polygon): Polygon {
    const partBbox = part.getBoundingBox();

    const innerWidth = width - partBbox.width;
    const innerHeight = height - partBbox.height;

    const points: Point[] = [
      new Point(partBbox.width / 2, partBbox.height / 2),
      new Point(innerWidth + partBbox.width / 2, partBbox.height / 2),
      new Point(innerWidth + partBbox.width / 2, innerHeight + partBbox.height / 2),
      new Point(partBbox.width / 2, innerHeight + partBbox.height / 2),
    ];

    return new Polygon(points, `ifp_${part.id}`);
  }

  static isPositionValid(part: Polygon, position: Point, nfp: Polygon): boolean {
    const centroid = part.getCentroid();
    const translatedCentroid = new Point(
      position.x + centroid.x,
      position.y + centroid.y
    );

    return SATCollision.testPointInPolygon(translatedCentroid, nfp);
  }

  static findValidPosition(
    part: Polygon,
    nfp: Polygon,
    startX: number = 0,
    startY: number = 0,
    stepSize: number = 5
  ): Point | null {
    const nfpBbox = nfp.getBoundingBox();
    const partBbox = part.getBoundingBox();

    for (let y = startY; y <= nfpBbox.maxY - partBbox.height / 2; y += stepSize) {
      for (let x = startX; x <= nfpBbox.maxX - partBbox.width / 2; x += stepSize) {
        const position = new Point(x, y);
        if (this.isPositionValid(part, position, nfp)) {
          return position;
        }
      }
    }

    return null;
  }
}
