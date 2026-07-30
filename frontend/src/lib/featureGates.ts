export type Tier = 'free' | 'individual';

interface Gates {
  postsPerWeek: number;
  contentGeneration: boolean;
  guidedCreation: boolean;
  repurposeContent: boolean;
  personaLearning: boolean;
  semanticAnalysis: boolean;
  authenticityScore: boolean;
  supportingReferences: boolean;
  visualCreator: boolean;
  competitorIntelligence: boolean;
  profileOptimizer: boolean;
  voiceMatchScore: boolean;
  bestTimeToPost: boolean;
  weeklyDigest: boolean;
  schedulePost: boolean;
  contentHistoryLimit: number;
  writingInsights: boolean;
  analyticsPage: boolean;
  linkedinPublishing: boolean;
}

export const FEATURE_LABELS: Record<keyof Gates, string> = {
  postsPerWeek: 'Unlimited posts',
  contentGeneration: 'AI content generation',
  guidedCreation: 'Guided Creation mode',
  repurposeContent: 'Repurpose Content',
  personaLearning: 'Persona learning',
  semanticAnalysis: 'Semantic analysis',
  authenticityScore: 'Authenticity Score',
  supportingReferences: 'Supporting references',
  visualCreator: 'Visual Creator',
  competitorIntelligence: 'Competitor Intelligence',
  profileOptimizer: 'Profile Optimizer',
  voiceMatchScore: 'Voice Match Score',
  bestTimeToPost: 'Best Time to Post',
  weeklyDigest: 'Weekly digest',
  schedulePost: 'Post scheduling',
  contentHistoryLimit: 'Full content history',
  writingInsights: 'Writing Insights',
  analyticsPage: 'Analytics',
  linkedinPublishing: 'LinkedIn publishing',
};

const FEATURE_GATES: Record<Tier, Gates> = {
  free: {
    postsPerWeek: 3,
    contentGeneration: true,
    guidedCreation: false,
    repurposeContent: false,
    personaLearning: false,
    semanticAnalysis: false,
    authenticityScore: false,
    supportingReferences: false,
    visualCreator: false,
    competitorIntelligence: false,
    profileOptimizer: false,
    voiceMatchScore: false,
    bestTimeToPost: false,
    weeklyDigest: false,
    schedulePost: false,
    contentHistoryLimit: 10,
    writingInsights: false,
    analyticsPage: false,
    linkedinPublishing: true,
  },
  individual: {
    postsPerWeek: Infinity,
    contentGeneration: true,
    guidedCreation: true,
    repurposeContent: true,
    personaLearning: true,
    semanticAnalysis: true,
    authenticityScore: true,
    supportingReferences: true,
    visualCreator: true,
    competitorIntelligence: true,
    profileOptimizer: true,
    voiceMatchScore: true,
    bestTimeToPost: true,
    weeklyDigest: true,
    schedulePost: true,
    contentHistoryLimit: Infinity,
    writingInsights: true,
    analyticsPage: true,
    linkedinPublishing: true,
  },
};

export function canAccess(tier: Tier | string, feature: keyof Gates): boolean {
  const gates = FEATURE_GATES[(tier as Tier)] || FEATURE_GATES.free;
  const value = gates[feature];
  return value !== false && value !== 0;
}
