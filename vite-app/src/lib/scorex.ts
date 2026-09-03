import { quickScore } from './score';
import type { ScoreWeights } from './types';
import type { BikeModel } from './types';

/** Re-export wrapper keeping pages import surface small. */
export const quickScoreFor = (m: BikeModel, w: ScoreWeights): number => quickScore(m, w);

export { getScoreWeights } from './api';
