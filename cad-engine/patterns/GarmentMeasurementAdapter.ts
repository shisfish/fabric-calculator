import { createLogger } from '../utils/CADLogger.js';

const logger = createLogger('MEASUREMENT-ADAPTER');

export interface GarmentMeasurementInput {
  garment: string;
  front: FrontPieceInput;
  back: BackPieceInput;
  sleeve: SleeveInput;
}

export interface FrontPieceInput {
  chestWidth: number;
  bodyLength: number;
  shoulderWidth: number;
  neckWidth: number;
  neckDrop: number;
  armholeDepth: number;
}

export interface BackPieceInput {
  chestWidth: number;
  bodyLength: number;
  shoulderWidth: number;
  neckWidth: number;
  neckDrop: number;
  armholeDepth: number;
}

export interface SleeveInput {
  sleeveLength: number;
  bicepWidth: number;
  cuffWidth: number;
  sleeveCapHeight: number;
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
  hemWidth?: number;
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
  garment: 'basic_tshirt',
  front: {
    chestWidth: 59,
    bodyLength: 72,
    shoulderWidth: 25,
    neckWidth: 18,
    neckDrop: 8.5,
    armholeDepth: 26
  },
  back: {
    chestWidth: 59,
    bodyLength: 72,
    shoulderWidth: 25,
    neckWidth: 18,
    neckDrop: 2.5,
    armholeDepth: 26
  },
  sleeve: {
    sleeveLength: 24,
    bicepWidth: 22.5,
    cuffWidth: 17.5,
    sleeveCapHeight: 12.5
  }
};

export class GarmentMeasurementAdapter {
  static readonly DEFAULT_INPUT = DEFAULT_INPUT;

  static adapt(input: Partial<GarmentMeasurementInput> = {}): GarmentParams {
    const merged = { ...DEFAULT_INPUT, ...input };
    
    const front = merged.front || DEFAULT_INPUT.front;
    const back = merged.back || DEFAULT_INPUT.back;
    
    // 支持两种输入格式：
    // 1. 嵌套格式: { sleeve: { bicepWidth: 20, ... } }
    // 2. 扁平格式: { bicepsWidth: 20, sleeveLength: 60, ... }
    let sleeve = merged.sleeve || DEFAULT_INPUT.sleeve;
    
    const flatInput = input as any;
    
    logger.info(`\n🔍 [GarmentMeasurementAdapter] 输入处理:`);
    logger.info(`   merged.sleeve: ${JSON.stringify(merged.sleeve)}`);
    logger.info(`   flatInput.cuffWidth: ${flatInput.cuffWidth}`);
    logger.info(`   flatInput.bicepsWidth: ${flatInput.bicepsWidth}`);
    
    // 如果是扁平格式（直接包含sleeve相关字段），则转换为嵌套格式
    if (flatInput.bicepsWidth !== undefined || flatInput.sleeveLength !== undefined) {
      sleeve = {
        bicepWidth: flatInput.bicepsWidth ?? sleeve.bicepWidth,
        cuffWidth: flatInput.cuffWidth ?? sleeve.cuffWidth,
        sleeveLength: flatInput.sleeveLength ?? sleeve.sleeveLength,
        sleeveCapHeight: flatInput.sleeveCapHeight ?? sleeve.sleeveCapHeight
      };
      logger.info(`   ✅ 使用扁平格式转换后的 sleeve:`);
      logger.info(`      cuffWidth: ${sleeve.cuffWidth}`);
      logger.info(`      bicepWidth: ${sleeve.bicepWidth}`);
    } else {
      logger.info(`   ✅ 使用嵌套格式的 sleeve:`);
      logger.info(`      cuffWidth: ${sleeve.cuffWidth}`);
      logger.info(`      bicepWidth: ${sleeve.bicepWidth}`);
    }

    const halfChestFront = front.chestWidth / 2;
    const halfChestBack = back.chestWidth / 2;
    const halfShoulderFront = front.shoulderWidth / 2;
    const halfShoulderBack = back.shoulderWidth / 2;

    return {
      category: 'tshirt',

      backPanel: {
        width: halfChestBack,
        length: back.bodyLength,
        neckWidth: back.neckWidth / 2,
        neckDepth: back.neckDrop * 0.4,
        shoulderWidth: halfShoulderBack,
        shoulderSlope: this.calculateShoulderSlope(halfShoulderBack, back.armholeDepth),
        armholeDepth: back.armholeDepth,
        armholePitchX: halfShoulderBack * 0.55,
        hemExtension: back.bodyLength * 0.015
      },

      frontPanel: {
        width: halfChestFront,
        length: front.bodyLength - 1,
        neckWidth: front.neckWidth / 2,
        neckDepth: front.neckDrop * 0.6,
        shoulderWidth: halfShoulderFront,
        shoulderSlope: this.calculateShoulderSlope(halfShoulderFront, front.armholeDepth),
        armholeDepth: front.armholeDepth - 1,
        armholePitchX: halfShoulderFront * 0.58,
        hemExtension: front.bodyLength * 0.02
      },

      sleeve: {
        bicepsWidth: sleeve.bicepWidth,  // 保持原始值，不放大
        cuffWidth: sleeve.cuffWidth,      // 保持原始值，不放大
        sleeveLength: sleeve.sleeveLength,
        sleeveCapHeight: sleeve.sleeveCapHeight,
        capDepthRatio: 0.65
      },

      seamAllowance: 1.5
    };
  }

  static fromLegacyMeasurements(legacy: Record<string, number>): GarmentParams {
    return this.adapt({
      front: {
        chestWidth: legacy.chest ?? legacy.chestWidth ?? DEFAULT_INPUT.front.chestWidth,
        bodyLength: legacy.hpsToWaistFront ?? legacy.bodyLength ?? DEFAULT_INPUT.front.bodyLength,
        shoulderWidth: legacy.shoulderToShoulder ?? DEFAULT_INPUT.front.shoulderWidth,
        neckWidth: legacy.neck ?? DEFAULT_INPUT.front.neckWidth,
        neckDrop: legacy.neckDrop ?? DEFAULT_INPUT.front.neckDrop,
        armholeDepth: legacy.armholeDepth ?? DEFAULT_INPUT.front.armholeDepth
      },
      back: {
        chestWidth: legacy.chest ?? legacy.chestWidth ?? DEFAULT_INPUT.back.chestWidth,
        bodyLength: legacy.hpsToWaistBack ?? legacy.bodyLength ?? DEFAULT_INPUT.back.bodyLength,
        shoulderWidth: legacy.shoulderToShoulder ?? DEFAULT_INPUT.back.shoulderWidth,
        neckWidth: legacy.neck ?? DEFAULT_INPUT.back.neckWidth,
        neckDrop: (legacy.neckDrop ?? DEFAULT_INPUT.back.neckDrop) * 0.3,
        armholeDepth: legacy.armholeDepth ?? DEFAULT_INPUT.back.armholeDepth
      },
      sleeve: {
        sleeveLength: legacy.sleeveLength ?? DEFAULT_INPUT.sleeve.sleeveLength,
        bicepWidth: legacy.bicepWidth ?? DEFAULT_INPUT.sleeve.bicepWidth,
        cuffWidth: legacy.cuffWidth ?? DEFAULT_INPUT.sleeve.cuffWidth,
        sleeveCapHeight: legacy.sleeveCapHeight ?? DEFAULT_INPUT.sleeve.sleeveCapHeight
      }
    });
  }

  static calculateShoulderSlope(halfShoulder: number, armholeDepth: number): number {
    const slopeRatio = Math.atan2(halfShoulder * 0.3, armholeDepth);
    return slopeRatio * (180 / Math.PI);
  }

  static adaptFromSimple(measurements: Record<string, number>): GarmentParams {
    const chestWidth = measurements.chestWidth ?? measurements.chest ?? DEFAULT_INPUT.front.chestWidth;
    const shoulderWidth = measurements.shoulderWidth ?? measurements.shoulderToShoulder ?? DEFAULT_INPUT.front.shoulderWidth;
    const bodyLength = measurements.bodyLength ?? measurements.length ?? DEFAULT_INPUT.front.bodyLength;
    const sleeveLength = measurements.sleeveLength ?? DEFAULT_INPUT.sleeve.sleeveLength;
    const neckWidth = measurements.neckWidth ?? measurements.neck ?? DEFAULT_INPUT.front.neckWidth;
    const armholeDepth = measurements.armholeDepth ?? DEFAULT_INPUT.front.armholeDepth;
    const cuffWidth = measurements.cuffWidth ?? DEFAULT_INPUT.sleeve.cuffWidth;

    return this.adapt({
      front: {
        chestWidth,
        bodyLength,
        shoulderWidth,
        neckWidth,
        neckDrop: neckWidth * 0.47,
        armholeDepth
      },
      back: {
        chestWidth,
        bodyLength,
        shoulderWidth,
        neckWidth,
        neckDrop: neckWidth * 0.14,
        armholeDepth
      },
      sleeve: {
        sleeveLength,
        bicepWidth: armholeDepth * 0.87,
        cuffWidth,
        sleeveCapHeight: armholeDepth * 0.48
      }
    });
  }
}
