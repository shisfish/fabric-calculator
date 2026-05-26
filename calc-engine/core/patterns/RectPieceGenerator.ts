export interface RectPiece {
  id: string;
  name: string;
  width: number;
  height: number;
  quantity: number;
  onFold: boolean;
  seamAllowance?: number;
}

export interface GarmentTemplate {
  category: string;
  defaultPieces: Omit<RectPiece, 'id'>[];
}

export const GARMENT_TEMPLATES: Record<string, GarmentTemplate> = {
  tshirt: {
    category: 'tshirt',
    defaultPieces: [
      { name: '前片', width: 29, height: 72, quantity: 1, onFold: true },
      { name: '后片', width: 29, height: 74, quantity: 1, onFold: true },
      { name: '袖子', width: 20, height: 60, quantity: 2, onFold: false }
    ]
  },
  windbreaker: {
    category: 'windbreaker',
    defaultPieces: [
      { name: '前片', width: 32, height: 75, quantity: 1, onFold: true },
      { name: '后片', width: 34, height: 77, quantity: 1, onFold: true },
      { name: '袖子', width: 22, height: 65, quantity: 2, onFold: false },
      { name: '领口罗纹', width: 10, height: 30, quantity: 1, onFold: false },
      { name: '口袋', width: 15, height: 15, quantity: 2, onFold: false }
    ]
  },
  hoodie: {
    category: 'hoodie',
    defaultPieces: [
      { name: '前片', width: 35, height: 78, quantity: 1, onFold: true },
      { name: '后片', width: 37, height: 80, quantity: 1, onFold: true },
      { name: '袖子', width: 24, height: 68, quantity: 2, onFold: false },
      { name: '帽子', width: 30, height: 35, quantity: 1, onFold: false },
      { name: '口袋', width: 18, height: 18, quantity: 1, onFold: false }
    ]
  }
};

export function getPiecesFromGarment(
  category: string,
  customPieces?: Array<{ name: string; width: number; height: number; quantity?: number; onFold?: boolean }>
): RectPiece[] {
  
  const template = GARMENT_TEMPLATES[category] || GARMENT_TEMPLATES.tshirt;
  let pieces: RectPiece[] = template.defaultPieces.map((p, index) => ({
    ...p,
    id: `${category}_${p.name}_${index}`
  }));

  if (customPieces && customPieces.length > 0) {
    const customRects: RectPiece[] = customPieces.map((cp, index) => ({
      id: `custom_${cp.name || '配件'}_${index}`,
      name: cp.name || '配件',
      width: cp.width,
      height: cp.height,
      quantity: cp.quantity || 1,
      onFold: cp.onFold ?? false
    }));
    
    pieces = [...pieces, ...customRects];
  }

  return pieces;
}