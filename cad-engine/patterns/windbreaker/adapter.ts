import type { WindbreakerParams } from './Windbreaker.js';

export function adaptWindbreakerInput(garmentInput: any, seamAllowance: number): WindbreakerParams {
  const gi = garmentInput || {};
  const back = gi.back || {};
  const front = gi.front || {};
  const sleeve = gi.sleeve || {};
  const collar = gi.collar || {};

  const neckWidth = gi.neckWidth || 18.5;
  const armholeDepth = gi.armholeDepth || 62.5;

  return {
    category: 'windbreaker',
    backPanel: {
      width: back.chestWidth || 49.5,
      length: back.bodyLength || 60,
      neckWidth: neckWidth * 0.45,
      neckDepth: neckWidth * 0.10,
      shoulderWidth: back.shoulderWidth || 26.75,
      shoulderSlope: 3.5,
      armholeDepth: back.armholeDepth || armholeDepth,
      yokeDepth: back.yokeDepth || 12,
      ventLength: back.ventLength || 18,
      hemExtension: 2,
    },
    frontPanel: {
      width: front.chestWidth || 49.5,
      length: front.bodyLength || 61,
      neckWidth: neckWidth * 0.45,
      neckDepth: front.neckDrop || 19,
      shoulderWidth: front.shoulderWidth || 26,
      shoulderSlope: 4,
      armholeDepth: front.armholeDepth || armholeDepth,
      yokeDepth: front.yokeDepth || 12,
      placketWidth: front.placketWidth || 6,
      hemExtension: 2,
    },
    sleeve: {
      bicepsWidth: sleeve.bicepsWidth || sleeve.bicepWidth || 25,
      elbowWidth: sleeve.elbowWidth || 23,
      cuffWidth: sleeve.cuffWidth || 16.5,
      sleeveLength: sleeve.sleeveLength || 55.5,
      sleeveCapHeight: sleeve.sleeveCapHeight || 17,
    },
    collar: collar.collarWidth ? {
      collarWidth: collar.collarWidth || 8,
      standHeight: collar.standHeight || 8.2,
      collarLength: collar.collarLength || neckWidth * 2 + 4,
    } : undefined,
    seamAllowance,
    hasStormFlap: true,
    hasBelt: true,
    hasEpaulettes: true,
  };
}
