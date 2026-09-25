export type AchievementId =
  | 'random-sampling-specialist'
  | 'data-detective'
  | 'outlier-hunter'
  | 'transect-explorer'
  | 'statistical-investigator'
  | 'evidence-defender'
  | 'field-ecologist'
  | 'bias-aware';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  /** Adds to the student's scientific reputation. */
  points: number;
  icon: 'dice' | 'search' | 'target' | 'route' | 'sigma' | 'shield' | 'leaf' | 'scale';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'random-sampling-specialist', title: 'Random Sampling Specialist', description: 'Collect 10 or more random quadrats in one site without a bias warning.', points: 20, icon: 'dice' },
  { id: 'bias-aware', title: 'Bias Aware', description: 'Receive a sampling-bias warning, then resample until the warning clears.', points: 25, icon: 'scale' },
  { id: 'transect-explorer', title: 'Transect Explorer', description: 'Complete both a line transect and a belt transect.', points: 20, icon: 'route' },
  { id: 'field-ecologist', title: 'Field Ecologist', description: 'Collect samples in three different ecosystems.', points: 30, icon: 'leaf' },
  { id: 'data-detective', title: 'Data Detective', description: 'Enter or import your own data and analyse it in My Data mode.', points: 15, icon: 'search' },
  { id: 'outlier-hunter', title: 'Outlier Hunter', description: 'Spot an outlier beyond the whiskers of a box plot.', points: 15, icon: 'target' },
  { id: 'statistical-investigator', title: 'Statistical Investigator', description: 'Run both a t-test and a chi-squared test.', points: 30, icon: 'sigma' },
  { id: 'evidence-defender', title: 'Evidence Defender', description: 'Save a notebook entry that includes a conclusion and its limitations.', points: 25, icon: 'shield' },
];

export const getAchievement = (id: AchievementId) => ACHIEVEMENTS.find((a) => a.id === id)!;
