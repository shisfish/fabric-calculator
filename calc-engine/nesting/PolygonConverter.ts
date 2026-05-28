import { Path, Point } from './geometry/index.js';
import { Polygon } from './Polygon.js';

export class PolygonConverter {
  static pathToPolygon(path: Path, id: string = '', resolution: number = 50): Polygon {
    const points = path.toPoints(resolution);
    if (points.length < 3) {
      throw new Error('Path must generate at least 3 points');
    }
    return new Polygon(points, id);
  }

  static pathsToPolygons(paths: Path[], ids: string[] = []): Polygon[] {
    return paths.map((path, index) => {
      const id = ids[index] || `piece_${index}`;
      return this.pathToPolygon(path, id);
    });
  }

  static polygonToPath(polygon: Polygon): Path {
    return Path.fromPoints(polygon.points, true);
  }

  static simplifyPolygon(polygon: Polygon, tolerance: number = 0.5): Polygon {
    const points = polygon.points;
    if (points.length < 3) return polygon;

    const simplified: Point[] = [points[0]];
    
    for (let i = 1; i < points.length; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = points[i];
      
      if (prev.dist(curr) > tolerance) {
        simplified.push(curr);
      }
    }

    if (simplified.length < 3) return polygon;
    return new Polygon(simplified, polygon.id);
  }

  static reducePoints(polygon: Polygon, maxPoints: number): Polygon {
    if (polygon.points.length <= maxPoints) return polygon;

    const points = [...polygon.points];
    
    while (points.length > maxPoints) {
      let minArea = Infinity;
      let minIndex = 0;

      for (let i = 0; i < points.length; i++) {
        const prev = points[(i - 1 + points.length) % points.length];
        const curr = points[i];
        const next = points[(i + 1) % points.length];

        const area = Math.abs(
          (prev.x - curr.x) * (next.y - curr.y) -
          (next.x - curr.x) * (prev.y - curr.y)
        ) / 2;

        if (area < minArea) {
          minArea = area;
          minIndex = i;
        }
      }

      points.splice(minIndex, 1);
    }

    return new Polygon(points, polygon.id);
  }

  static ensureMinimumPoints(polygon: Polygon, minPoints: number = 8): Polygon {
    if (polygon.points.length >= minPoints) return polygon;

    const points = [...polygon.points];

    while (points.length < minPoints) {
      const newPoints: Point[] = [];
      
      for (let i = 0; i < points.length; i++) {
        newPoints.push(points[i]);
        const next = points[(i + 1) % points.length];
        const midpoint = Point.midpoint(points[i], next);
        newPoints.push(midpoint);
      }
      
      points.length = 0;
      points.push(...newPoints);
    }

    return new Polygon(points.slice(0, minPoints), polygon.id);
  }
}
