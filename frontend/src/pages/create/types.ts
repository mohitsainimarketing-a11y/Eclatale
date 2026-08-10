export type AngleStyle = 'Contrarian' | 'Storyteller' | 'Data-driven' | 'Insider' | 'Teacher' | 'Motivator';

export interface Angle {
  id: string;
  style: AngleStyle;
  styleId: string; // maps to backend/lib/writingStyles.ts WRITING_STYLES id
  styleEmoji: string;
  hook: string;
  insight: string;
  performanceStat: string;
  performanceIcon: string;
  performanceColor: string;
  badgeColor: string;
  badgeTextColor: string;
}

export interface Source {
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  publishedDate: string | null;
  trustScore: number;
}

export type PostLength = 'micro' | 'short' | 'standard' | 'longform';

export const LENGTH_OPTIONS: { id: PostLength; emoji: string; label: string }[] = [
  { id: 'micro', emoji: '⚡', label: 'Micro' },
  { id: 'short', emoji: '📝', label: 'Short' },
  { id: 'standard', emoji: '📄', label: 'Std' },
  { id: 'longform', emoji: '📚', label: 'Long' },
];

export interface AuthenticityScoreResult {
  overallScore: number;
  readyToPost: boolean;
  accuracy: { score: number; [key: string]: any };
  freshness: { score: number; [key: string]: any };
  voice: { score: number; suggestion?: string; [key: string]: any };
  [key: string]: any;
}

export type GrowthStage = 'unknown' | 'emerging' | 'rising' | 'notable' | 'authority' | 'icon';

export const STAGE_META: Record<GrowthStage, { label: string; emoji: string }> = {
  unknown: { label: 'Getting started', emoji: '🌱' },
  emerging: { label: 'Emerging', emoji: '🌱' },
  rising: { label: 'Rising', emoji: '📈' },
  notable: { label: 'Notable', emoji: '⭐' },
  authority: { label: 'Authority', emoji: '🏆' },
  icon: { label: 'Icon', emoji: '👑' },
};

export interface GrowthCriterion { label: string; done: boolean; current: number; target: number; }

export interface GrowthJourneyResult {
  stage: GrowthStage;
  nextStage: GrowthStage | null;
  criteria: GrowthCriterion[];
  metrics: { postsPublished: number; currentStreak: number; longestStreak: number; [key: string]: any };
}

export interface HookTypeStat { type: string; percentage: number; relativePerformance?: string; }
export interface IndustryIntelligenceResult {
  topHookTypes: HookTypeStat[];
  bestLength: { min: number; max: number; insight: string };
  bestTimes: { day: string; time: string }[];
  trendingTopics: { topic: string; trendScore?: number }[];
  topStructureInsight: string;
  dataSource: 'real' | 'estimated';
  postsAnalyzed: number;
  generatedAt: string;
}

// Loose mapping between industry-intelligence hook-type names and the
// angle styles used in Phase 1 — the two vocabularies don't line up 1:1
// (e.g. "Question" has no matching angle style), so filtering falls back
// to "show all" when a mapped style has no matching angle.
export const HOOK_TYPE_TO_ANGLE_STYLE: Record<string, AngleStyle> = {
  Contrarian: 'Contrarian',
  'Story opener': 'Storyteller',
  'Bold stat': 'Data-driven',
  'Insider reveal': 'Insider',
};
