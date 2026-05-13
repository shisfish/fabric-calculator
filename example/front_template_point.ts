export const FRONT_TEMPLATE_POINTS = {
  neckLeft: { x: 120, y: 120 },

  neckCurveControl: { x: 145, y: 90 },

  neckCenter: { x: 180, y: 100 },

  shoulderEnd: { x: 240, y: 140 },

  armholeControl1: { x: 270, y: 180 },

  armholeControl2: { x: 285, y: 230 },

  armholeBottom: { x: 290, y: 300 },

  sideBottom: { x: 290, y: 680 },

  hemCurveControl: { x: 220, y: 705 },

  hemCenter: { x: 180, y: 710 },

  hemLeftControl: { x: 140, y: 700 },

  leftBottom: { x: 120, y: 680 }
}

export function buildFrontPath(p) {
  return `
    M ${p.neckLeft.x} ${p.neckLeft.y}

    Q
    ${p.neckCurveControl.x} ${p.neckCurveControl.y}
    ${p.neckCenter.x} ${p.neckCenter.y}

    L
    ${p.shoulderEnd.x} ${p.shoulderEnd.y}

    C
    ${p.armholeControl1.x} ${p.armholeControl1.y},
    ${p.armholeControl2.x} ${p.armholeControl2.y},
    ${p.armholeBottom.x} ${p.armholeBottom.y}

    L
    ${p.sideBottom.x} ${p.sideBottom.y}

    Q
    ${p.hemCurveControl.x} ${p.hemCurveControl.y}
    ${p.hemCenter.x} ${p.hemCenter.y}

    Q
    ${p.hemLeftControl.x} ${p.hemLeftControl.y}
    ${p.leftBottom.x} ${p.leftBottom.y}

    Z
  `
}

尺寸变化规则：

1. chestWidth 增加：
影响：
- armholeBottom.x
- sideBottom.x

2. bodyLength 增加：
影响：
- sideBottom.y
- hemCenter.y
- leftBottom.y

3. shoulderWidth 增加：
影响：
- shoulderEnd.x

4. neckWidth 增加：
影响：
- neckCenter.x

禁止：
修改 path 拓扑。