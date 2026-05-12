export interface GarmentMeasurementInput {
  chestWidth: number;
  shoulderWidth: number;
  bodyLength: number;
  sleeveLength: number;
  neckWidth: number;
  armholeDepth: number;
  cuffWidth: number;
  hemCurve?: number;
  shoulderSlope?: number;
}

export interface BackPanelParams {
  width: number;
  length: number;
  neckWidth: number;
  neckDepth: number;
  shoulderWidth: number;
  shoulderSlope: number;
  armholeDepth: number;
  armholePitchX: number;
  hemExtension: number;
}

export interface FrontPanelParams {
  width: number;
  length: number;
  neckWidth: number;
  neckDepth: number;
  shoulderWidth: number;
  shoulderSlope: number;
  armholeDepth: number;
  armholePitchX: number;
  hemExtension: number;
}

export interface SleeveParams {
  bicepsWidth: number;
  cuffWidth: number;
  sleeveLength: number;
  sleeveCapHeight: number;
  capDepthRatio?: number;
}

export interface GarmentParams {
  category: 'tshirt';
  backPanel: BackPanelParams;
  frontPanel: FrontPanelParams;
  sleeve: SleeveParams;
  seamAllowance: number;
}

const DEFAULT_INPUT: GarmentMeasurementInput = {
  chestWidth: 52,
  shoulderWidth: 44,
  bodyLength: 68,
  sleeveLength: 22,
  neckWidth: 18,
  armholeDepth: 20,
  cuffWidth: 16,
  hemCurve: 0,
  shoulderSlope: 18,
};

export class GarmentMeasurementAdapter {
  static readonly DEFAULT_INPUT = DEFAULT_INPUT;

  static adapt(input: Partial<GarmentMeasurementInput> = {}): GarmentParams {
    const merged = { ...DEFAULT_INPUT, ...input };

    const halfChest = merged.chestWidth / 2;
    const halfShoulder = merged.shoulderWidth / 2;

    return {
      category: 'tshirt',

      backPanel: {
        width: halfChest,
        length: merged.bodyLength,
        neckWidth: merged.neckWidth / 2.5,
        neckDepth: merged.neckWidth * 0.15,
        shoulderWidth: halfShoulder,
        shoulderSlope: merged.shoulderSlope ?? 18,
        armholeDepth: merged.armholeDepth * 1.05,
        armholePitchX: halfShoulder * 0.45,
        hemExtension: merged.bodyLength * 0.02 + (merged.hemCurve ?? 0),
      },

      frontPanel: {
        width: halfChest,
        length: merged.bodyLength - 2,
        neckWidth: merged.neckWidth / 2.5,
        neckDepth: merged.neckWidth * 0.25,
        shoulderWidth: halfShoulder,
        shoulderSlope: merged.shoulderSlope ?? 18,
        armholeDepth: merged.armholeDepth,
        armholePitchX: halfShoulder * 0.48,
        hemExtension: merged.bodyLength * 0.02 + (merged.hemCurve ?? 0),
      },

      sleeve: {
        bicepsWidth: merged.armholeDepth * 2.2,
        cuffWidth: merged.cuffWidth,
        sleeveLength: merged.sleeveLength,
        sleeveCapHeight: merged.armholeDepth * 0.85,
        capDepthRatio: 0.6,
      },

      seamAllowance: 1,
    };
  }

  static fromLegacyMeasurements(legacy: Record<string, number>): GarmentParams {
    return this.adapt({
      chestWidth: legacy.chest ?? legacy.chestWidth ?? DEFAULT_INPUT.chestWidth,
      shoulderWidth: legacy.shoulderToShoulder ?? DEFAULT_INPUT.shoulderWidth,
      bodyLength: legacy.hpsToWaistBack ?? legacy.bodyLength ?? DEFAULT_INPUT.bodyLength,
      sleeveLength: (legacy.hpsToWaistFront ?? 45) * 0.35,
      neckWidth: legacy.neck ?? DEFAULT_INPUT.neckWidth,
      armholeDepth: (legacy.biceps ?? 35) * 0.55,
      cuffWidth: legacy.wrist ? legacy.wrist * 1.1 : DEFAULT_INPUT.cuffWidth,
      shoulderSlope: legacy.shoulderSlope,
    });
  }
}
