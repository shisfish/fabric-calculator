import { Point } from '../geometry/index.js';

export interface TemplatePoint {
  name: string;
  xFormula: string;
  yFormula: string;
  description: string;
}

export interface TemplateControlPoint {
  name: string;
  xFormula: string;
  yFormula: string;
  belongsToCurve: string;
  description: string;
}

export interface IndustrialTemplate {
  name: string;
  type: 'half_front' | 'half_back' | 'sleeve';
  unit: string;
  topology: string[];
  points: Record<string, TemplatePoint>;
  controlPoints: Record<string, TemplateControlPoint>;
  ratios: {
    shoulderSlope: number;
    armholeOutwardRatio: number;
    armholeHollowRatio: number;
    neckCpRatio: number;
    hemCpRatio: number;
  };
  referenceMeasurements: {
    chestWidth: number;
    bodyLength: number;
    shoulderWidth: number;
    neckWidth: number;
    neckDepth: number;
    armholeDepth: number;
  };
}

export const FRONT_TEMPLATE: IndustrialTemplate = {
  name: 'basic_tshirt_front',
  type: 'half_front',
  unit: 'cm',
  topology: [
    'move', 'quad', 'line',
    'curve', 'curve', 'curve',
    'line', 'quad', 'close'
  ],
  points: {
    cfNeck: {
      name: 'cfNeck',
      xFormula: '0',
      yFormula: '0',
      description: '前中领口起点（FOLD线）'
    },
    neckEnd: {
      name: 'neckEnd',
      xFormula: 'neckW',
      yFormula: 'neckD',
      description: '领口终点（肩颈点）'
    },
    shoulder: {
      name: 'shoulder',
      xFormula: 'shoulderW',
      yFormula: 'shoulderDrop',
      description: '肩端点'
    },
    armholePitch: {
      name: 'armholePitch',
      xFormula: 'shoulderW + armholeSpanX * 0.35',
      yFormula: 'shoulderDrop + (armholeD - shoulderDrop) * 0.30',
      description: '袖窿最大曲率点（pitch）'
    },
    armholeHollow: {
      name: 'armholeHollow',
      xFormula: 'W - W * 0.12',
      yFormula: 'armholeD * 0.65',
      description: '袖窿凹陷点（hollow）'
    },
    armholeEnd: {
      name: 'armholeEnd',
      xFormula: 'W',
      yFormula: 'armholeD',
      description: '腋下点'
    },
    sideBottom: {
      name: 'sideBottom',
      xFormula: 'W',
      yFormula: 'L',
      description: '侧缝底点'
    },
    hemFold: {
      name: 'hemFold',
      xFormula: '0',
      yFormula: 'L',
      description: '前中下摆（FOLD线）'
    }
  },
  controlPoints: {
    neckCp: {
      name: 'neckCp',
      xFormula: 'neckW * 0.42',
      yFormula: '0',
      belongsToCurve: 'neck',
      description: '前领口控制点'
    },
    armholeTopCp1: {
      name: 'armholeTopCp1',
      xFormula: 'shoulderW + armholeSpanX * 0.18',
      yFormula: 'shoulderDrop + (armholeD - shoulderDrop) * 0.08',
      belongsToCurve: 'armhole_top',
      description: '袖窿上段CP1（外鼓起始）'
    },
    armholeTopCp2: {
      name: 'armholeTopCp2',
      xFormula: 'pitchX - armholeSpanX * 0.08',
      yFormula: 'pitchY - (armholeD - shoulderDrop) * 0.05',
      belongsToCurve: 'armhole_top',
      description: '袖窿上段CP2（进入pitch）'
    },
    armholeMidCp1: {
      name: 'armholeMidCp1',
      xFormula: 'pitchX + armholeSpanX * 0.12',
      yFormula: 'pitchY + (armholeD - shoulderDrop) * 0.08',
      belongsToCurve: 'armhole_mid',
      description: '袖窿中段CP1（离开pitch）'
    },
    armholeMidCp2: {
      name: 'armholeMidCp2',
      xFormula: 'hollowX - armholeSpanX * 0.04',
      yFormula: 'hollowY - (armholeD - shoulderDrop) * 0.05',
      belongsToCurve: 'armhole_mid',
      description: '袖窿中段CP2（内收进入hollow）⚠️关键：必须内收'
    },
    armholeBottomCp1: {
      name: 'armholeBottomCp1',
      xFormula: 'hollowX - armholeSpanX * 0.03',
      yFormula: 'hollowY + (armholeD - shoulderDrop) * 0.08',
      belongsToCurve: 'armhole_bottom',
      description: '袖窿下段CP1（离开hollow持续内收）'
    },
    armholeBottomCp2: {
      name: 'armholeBottomCp2',
      xFormula: 'W - W * 0.08 * 0.6',
      yFormula: 'armholeD * 0.88',
      belongsToCurve: 'armhole_bottom',
      description: '袖窿下段CP2（接近腋下）'
    },
    hemCp: {
      name: 'hemCp',
      xFormula: 'W * 0.48',
      yFormula: 'L + 1',
      belongsToCurve: 'hem',
      description: '下摆控制点'
    }
  },
  ratios: {
    shoulderSlope: 12,
    armholeOutwardRatio: 0.18,
    armholeHollowRatio: 0.12,
    neckCpRatio: 0.42,
    hemCpRatio: 0.48
  },
  referenceMeasurements: {
    chestWidth: 29,
    bodyLength: 72,
    shoulderWidth: 24,
    neckWidth: 9,
    neckDepth: 8,
    armholeDepth: 26
  }
};

export function calculateTemplatePoint(
  template: IndustrialTemplate,
  pointName: string,
  _params: {
    W: number; L: number; neckW: number; neckD: number;
    shoulderW: number; shoulderDrop: number; armholeD: number;
    armholeSpanX: number; pitchX: number; pitchY: number;
    hollowX: number; hollowY: number;
  }
): Point {
  const point = template.points[pointName];
  if (!point) {
    throw new Error(`Template point '${pointName}' not found`);
  }

  try {
    const x = eval(point.xFormula);
    const y = eval(point.yFormula);
    return new Point(x, y);
  } catch (error) {
    throw new Error(`Failed to evaluate formula for point '${pointName}': ${error}`);
  }
}

export function calculateTemplateControlPoint(
  template: IndustrialTemplate,
  cpName: string,
  _params: {
    W: number; L: number; neckW: number; neckD: number;
    shoulderW: number; shoulderDrop: number; armholeD: number;
    armholeSpanX: number; pitchX: number; pitchY: number;
    hollowX: number; hollowY: number;
  }
): Point {
  const cp = template.controlPoints[cpName];
  if (!cp) {
    throw new Error(`Template control point '${cpName}' not found`);
  }

  try {
    const x = eval(cp.xFormula);
    const y = eval(cp.yFormula);
    return new Point(x, y);
  } catch (error) {
    throw new Error(`Failed to evaluate formula for control point '${cpName}': ${error}`);
  }
}

export function getTemplateDebugInfo(template: IndustrialTemplate): string {
  let info = `\n${'═'.repeat(70)}\n`;
  info += `📐 工业模板: ${template.name}\n`;
  info += `${'═'.repeat(70)}\n\n`;

  info += `类型: ${template.type}\n`;
  info += `单位: ${template.unit}\n`;
  info += `拓扑: ${template.topology.join(' → ')}\n\n`;

  info += `参考尺寸:\n`;
  info += `  ${'─'.repeat(50)}\n`;
  const ref = template.referenceMeasurements;
  Object.entries(ref).forEach(([key, value]) => {
    info += `  ${key}: ${value} cm\n`;
  });

  info += `\n工业比例系统:\n`;
  info += `  ${'─'.repeat(50)}\n`;
  Object.entries(template.ratios).forEach(([key, value]) => {
    info += `  ${key}: ${value}\n`;
  });

  info += `\n关键点结构 (${Object.keys(template.points).length}个):\n`;
  info += `  ${'─'.repeat(50)}\n`;
  Object.values(template.points).forEach(p => {
    info += `  • ${p.name}: ${p.description}\n`;
    info += `    X=${p.xFormula}, Y=${p.yFormula}\n`;
  });

  info += `\nBezier控制点 (${Object.keys(template.controlPoints).length}个):\n`;
  info += `  ${'─'.repeat(50)}\n`;
  Object.values(template.controlPoints).forEach(cp => {
    info += `  • ${cp.name} [${cp.belongsToCurve}]: ${cp.description}\n`;
    info += `    X=${cp.xFormula}, Y=${cp.yFormula}\n`;
  });

  info += `\n${'═'.repeat(70)}\n`;
  return info;
}
