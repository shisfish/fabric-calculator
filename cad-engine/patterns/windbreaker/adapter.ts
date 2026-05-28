import type { WindbreakerParams } from './Windbreaker.js';

export function adaptWindbreakerInput(garmentInput: any, seamAllowance: number): WindbreakerParams {
  const gi = garmentInput || {};
  const back = gi.back || {};
  const front = gi.front || {};
  const sleeve = gi.sleeve || {};
  const collar = gi.collar || {};

  const neckWidth = gi.neckWidth || 18.5;
  const defaultArmholeDepth = gi.armholeDepth || 30;
  const backLength = back.bodyLength || 95;
  const frontLength = front.bodyLength || 96;
  const clampArmholeDepth = (value: any, length: number) => {
    const numeric = Number(value) || defaultArmholeDepth;
    return Math.min(Math.max(numeric, 20), Math.max(20, length - 8));
  };

  return {
    category: 'windbreaker',
    backPanel: {
      width: back.chestWidth || 49.5,
      length: backLength,
      neckWidth: neckWidth * 0.45,
      neckDepth: neckWidth * 0.10,
      shoulderWidth: back.shoulderWidth || 26.75,
      shoulderSlope: 3.5,
      armholeDepth: clampArmholeDepth(back.armholeDepth, backLength),
      yokeDepth: back.yokeDepth || 12,
      ventLength: back.ventLength || 35,
      hemExtension: 2,
    },
    frontPanel: {
      width: front.chestWidth || 49.5,
      length: frontLength,
      neckWidth: neckWidth * 0.45,
      neckDepth: front.neckDrop || 19,
      shoulderWidth: front.shoulderWidth || 26,
      shoulderSlope: 4,
      armholeDepth: clampArmholeDepth(front.armholeDepth, frontLength),
      yokeDepth: front.yokeDepth || 12,
      placketWidth: front.placketWidth || 6,
      hemExtension: 2,
    },
    sleeve: {
      bicepsWidth: sleeve.bicepsWidth || sleeve.bicepWidth || 25,
      elbowWidth: sleeve.elbowWidth || 23,
      cuffWidth: sleeve.cuffWidth || 16.5,
      sleeveLength: sleeve.sleeveLength || 62,
      sleeveCapHeight: sleeve.sleeveCapHeight || 17,
    },
    collar: collar.collarWidth ? {
      collarWidth: collar.collarWidth || 8,
      standHeight: collar.standHeight || 4.2,
      collarLength: collar.collarLength || neckWidth * 2.6 + 8,
    } : undefined,
    seamAllowance,
    hasStormFlap: true,
    hasBelt: true,
    hasEpaulettes: true,
  };
}
