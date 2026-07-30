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

export function canAccess(userTier: string, feature: keyof Gates): boolean {
  const gates = FEATURE_GATES[(userTier as Tier)] || FEATURE_GATES.free;
  const value = gates[feature];
  return value !== false && value !== 0;
}

export function getLimit(userTier: string, feature: keyof Gates): number | boolean {
  const gates = FEATURE_GATES[(userTier as Tier)] || FEATURE_GATES.free;
  return gates[feature];
}

function mostRecentMonday(from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export interface WeeklyLimitResult {
  allowed: boolean;
  postsUsed: number;
  postsAllowed: number;
  resetsAt: string;
}

/** Checks + resets the rolling weekly post counter for a user, without incrementing it. */
export async function checkWeeklyPostLimit(supabase: any, userId: string): Promise<WeeklyLimitResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, posts_this_week, week_reset_at')
    .eq('id', userId)
    .maybeSingle();

  const tier = (profile?.subscription_tier as Tier) || 'free';
  const limit = getLimit(tier, 'postsPerWeek') as number;

  const thisMonday = mostRecentMonday(new Date());
  const weekResetAt = profile?.week_reset_at ? new Date(profile.week_reset_at) : new Date(0);
  let postsUsed = profile?.posts_this_week || 0;

  if (weekResetAt < thisMonday) {
    postsUsed = 0;
    await supabase.from('profiles').update({ posts_this_week: 0, week_reset_at: thisMonday.toISOString() }).eq('id', userId);
  }

  const nextMonday = new Date(thisMonday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

  return {
    allowed: limit === Infinity || postsUsed < limit,
    postsUsed,
    postsAllowed: limit === Infinity ? -1 : limit,
    resetsAt: nextMonday.toISOString(),
  };
}

export async function incrementWeeklyPostCount(supabase: any, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('posts_this_week').eq('id', userId).maybeSingle();
  await supabase.from('profiles').update({ posts_this_week: (profile?.posts_this_week || 0) + 1 }).eq('id', userId);
}

export function featureLockedResponse(feature: string) {
  return {
    error: 'feature_locked',
    feature,
    requiredTier: 'individual',
    upgradeUrl: 'https://eclatale.com/pricing',
    message: 'Upgrade to Individual to unlock this feature',
  };
}

/** Fetches the user's tier and returns a locked-response payload if the feature is gated, else null. */
export async function requireFeature(supabase: any, userId: string, feature: keyof Gates): Promise<ReturnType<typeof featureLockedResponse> | null> {
  const { data: profile } = await supabase.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle();
  const tier = (profile?.subscription_tier as Tier) || 'free';
  if (canAccess(tier, feature)) return null;
  return featureLockedResponse(feature);
}
