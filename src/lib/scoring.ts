/**
 * Scoring Utilities
 *
 * Contains:
 * - Recency decay (plateau-based)
 * - Competition quality scoring (volume, authority, freshness)
 * - Cross-platform detection
 * - Velocity calculation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TopVideoData } from '@/types/database';

// ============================================
// RECENCY DECAY (Plateau-Based)
// ============================================

/**
 * Calculate recency multiplier using plateau-based decay.
 * Rewards posts that have proven staying power.
 *
 * @param hoursOld - Hours since the post was created
 * @returns Multiplier between 0.3 and 1.2
 */
export function calculateRecencyMultiplier(hoursOld: number): number {
  if (hoursOld <= 6) {
    // Fresh posts: full boost, still proving themselves
    return 1.2;
  } else if (hoursOld <= 24) {
    // Validated posts: gradual decline from 1.2 to 1.0
    return 1.0 + (0.2 * (1 - (hoursOld - 6) / 18));
  } else if (hoursOld <= 48) {
    // Aging posts: decline from 1.0 to 0.7
    return 1.0 - (0.3 * (hoursOld - 24) / 24);
  } else {
    // Old posts: continue declining, floor at 0.3
    const decay = 0.7 - (0.02 * (hoursOld - 48));
    return Math.max(decay, 0.3);
  }
}

// ============================================
// COMPETITION QUALITY SCORING
// ============================================

/**
 * Calculate volume score based on total YouTube search results.
 *
 * @param totalResults - Total number of search results from YouTube API
 * @returns Score 5-100
 */
export function calculateVolumeScore(totalResults: number): number {
  if (totalResults > 1_000_000) return 100;
  if (totalResults > 500_000) return 90;
  if (totalResults > 100_000) return 75;
  if (totalResults > 50_000) return 60;
  if (totalResults > 10_000) return 45;
  if (totalResults > 1_000) return 30;
  if (totalResults > 100) return 15;
  return 5;
}

/**
 * Calculate authority score - how dominated top results are by large channels.
 * Normalized by video count to handle cases with fewer than 10 results.
 *
 * @param videos - Array of top video data with channel subscriber counts
 * @returns Score 0-100 (higher = more dominated by big channels)
 */
export function calculateAuthorityScore(videos: TopVideoData[]): number {
  if (videos.length === 0) return 0;

  let rawScore = 0;
  for (const video of videos) {
    if (video.channel_subs > 1_000_000) {
      rawScore += 10; // Mega channel
    } else if (video.channel_subs > 500_000) {
      rawScore += 7; // Large channel
    } else if (video.channel_subs > 100_000) {
      rawScore += 4; // Medium channel
    }
    // <100K subs = 0 points (small creators, easier to compete)
  }

  // Normalize to 10-video equivalent
  const normalized = (rawScore / videos.length) * 10;
  return Math.min(Math.round(normalized), 100);
}

/**
 * Calculate freshness score - how recently existing content was published.
 * Normalized by video count to handle cases with fewer than 10 results.
 *
 * @param videos - Array of top video data with days_old field
 * @returns Score 0-100 (higher = more recent content = active competition)
 */
export function calculateFreshnessScore(videos: TopVideoData[]): number {
  if (videos.length === 0) return 0;

  let rawScore = 0;
  for (const video of videos) {
    if (video.days_old <= 7) {
      rawScore += 10; // Very recent, active competition
    } else if (video.days_old <= 30) {
      rawScore += 5; // Recent
    } else if (video.days_old <= 90) {
      rawScore += 2; // Moderately old
    }
    // >90 days = 0 points (stale content, opportunity)
  }

  // Normalize to 10-video equivalent
  const normalized = (rawScore / videos.length) * 10;
  return Math.min(Math.round(normalized), 100);
}

/**
 * Calculate composite supply score using volume, authority, and freshness.
 *
 * Weights:
 * - Volume (40%): Primary signal — more videos = more competition
 * - Authority (35%): Who made those videos matters almost as much
 * - Freshness (25%): Stale content is beatable
 *
 * @param volumeScore - Score from calculateVolumeScore
 * @param authorityScore - Score from calculateAuthorityScore
 * @param freshnessScore - Score from calculateFreshnessScore
 * @returns Composite score 0-100
 */
export function calculateSupplyScore(
  volumeScore: number,
  authorityScore: number,
  freshnessScore: number
): number {
  const composite =
    volumeScore * 0.40 +
    authorityScore * 0.35 +
    freshnessScore * 0.25;

  return Math.round(composite);
}

/**
 * Determine opportunity flags based on scoring components.
 */
export function calculateOpportunityFlags(
  authorityScore: number,
  freshnessScore: number,
  totalResults: number,
  momentum: number
): {
  hasAuthorityGap: boolean;
  hasFreshnessGap: boolean;
  isUnderserved: boolean;
} {
  return {
    hasAuthorityGap: authorityScore < 30,
    hasFreshnessGap: freshnessScore < 20,
    isUnderserved: totalResults < 1000 && momentum > 40,
  };
}

// ============================================
// CROSS-PLATFORM DETECTION
// ============================================

export interface CollectedPost {
  topic: string;
  source: 'reddit' | 'hackernews';
  score: number;
  comments: number;
  hoursOld: number;
  subreddit?: string;
  url: string;
}

export interface PlatformPresence {
  platforms: Set<string>;
  posts: CollectedPost[];
  totalScore: number;
}

/**
 * Normalize topic name for cross-platform matching.
 * Handles case, whitespace, and punctuation differences.
 */
export function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\.+#]/g, ''); // Preserve + and # for C++, C#
}

/**
 * Detect cross-platform presence of topics within a single scan.
 * Groups posts by normalized topic name.
 */
export function detectCrossPlatform(
  posts: CollectedPost[]
): Map<string, PlatformPresence> {
  const topicMap = new Map<string, PlatformPresence>();

  for (const post of posts) {
    const normalized = normalizeTopic(post.topic);

    if (!topicMap.has(normalized)) {
      topicMap.set(normalized, {
        platforms: new Set(),
        posts: [],
        totalScore: 0,
      });
    }

    const entry = topicMap.get(normalized)!;
    entry.platforms.add(post.source);
    entry.posts.push(post);
    entry.totalScore += post.score;
  }

  return topicMap;
}

/**
 * Get cross-platform momentum multiplier.
 *
 * @param platformCount - Number of distinct platforms where topic appeared
 * @returns Multiplier 1.0-1.7
 */
export function getCrossPlatformMultiplier(platformCount: number): number {
  switch (platformCount) {
    case 1:
      return 1.0; // Single platform, no boost
    case 2:
      return 1.4; // Two platforms, strong signal
    default:
      return 1.7; // Three+ platforms, very strong signal
  }
}

/**
 * Calculate cross-platform strength score (0-100).
 * Measures how strong the signal is on each platform based on ranking.
 */
export function calculateCrossPlatformStrength(
  posts: CollectedPost[],
  allPosts: CollectedPost[]
): number {
  // Group posts by platform
  const byPlatform: Record<string, CollectedPost[]> = {};
  for (const post of posts) {
    if (!byPlatform[post.source]) {
      byPlatform[post.source] = [];
    }
    byPlatform[post.source].push(post);
  }

  const platformScores: number[] = [];

  for (const [platform, platformPosts] of Object.entries(byPlatform)) {
    // Get all posts from this platform in the scan
    const allPlatformPosts = allPosts.filter((p) => p.source === platform);

    // Sort by score descending
    const sorted = [...allPlatformPosts].sort((a, b) => b.score - a.score);

    // Find best post for this topic on this platform
    const bestPost = platformPosts.reduce((a, b) =>
      a.score > b.score ? a : b
    );

    // Find rank by URL (unique identifier)
    const rank = sorted.findIndex((p) => p.url === bestPost.url) + 1;

    // Convert rank to percentile (1st place = 100, last = 0)
    const percentile = Math.round(
      (1 - (rank - 1) / Math.max(sorted.length, 1)) * 100
    );
    platformScores.push(percentile);
  }

  if (platformScores.length === 0) return 0;

  // Average percentile across platforms
  return Math.round(
    platformScores.reduce((a, b) => a + b, 0) / platformScores.length
  );
}

// ============================================
// VELOCITY CALCULATION
// ============================================

export interface VelocityResult {
  velocity24h: number | null;
  velocity7d: number | null;
  trend: 'accelerating' | 'stable' | 'declining' | null;
}

interface HistoricalSignal {
  momentum_score: number | null;
  recorded_at: string;
}

/**
 * Find the signal closest to a target time ago within tolerance.
 */
function findClosestSignal(
  signals: HistoricalSignal[],
  now: Date,
  targetHoursAgo: number
): HistoricalSignal | null {
  const tolerance = targetHoursAgo * 0.25; // 25% tolerance

  let closest: HistoricalSignal | null = null;
  let closestDiff = Infinity;

  for (const signal of signals) {
    const signalTime = new Date(signal.recorded_at);
    const hoursAgo =
      (now.getTime() - signalTime.getTime()) / (1000 * 60 * 60);
    const diff = Math.abs(hoursAgo - targetHoursAgo);

    if (diff < closestDiff && diff <= tolerance) {
      closest = signal;
      closestDiff = diff;
    }
  }

  return closest;
}

/**
 * Determine trend direction from 7-day velocity.
 */
export function determineTrend(
  velocity7d: number | null
): 'accelerating' | 'stable' | 'declining' | null {
  if (velocity7d === null) return null;

  if (velocity7d > 30) return 'accelerating'; // Grew 30%+ in a week
  if (velocity7d < -15) return 'declining'; // Dropped 15%+ in a week
  return 'stable'; // Between -15% and +30%
}

/**
 * Calculate velocity based on historical momentum data.
 *
 * @param topicId - The topic ID to calculate velocity for
 * @param currentMomentum - Current momentum score
 * @param supabase - Supabase client instance
 */
export async function calculateVelocity(
  topicId: string,
  currentMomentum: number,
  supabase: SupabaseClient
): Promise<VelocityResult> {
  const { data: signals } = await supabase
    .from('topic_signals')
    .select('momentum_score, recorded_at')
    .eq('topic_id', topicId)
    .order('recorded_at', { ascending: false })
    .limit(50);

  if (!signals || signals.length < 2) {
    return { velocity24h: null, velocity7d: null, trend: null };
  }

  const now = new Date();

  // Find signals closest to 24 hours and 7 days ago
  const signal24h = findClosestSignal(signals, now, 24);
  const signal7d = findClosestSignal(signals, now, 24 * 7);

  // Calculate velocity as percentage change (with division by zero guard)
  const velocity24h =
    signal24h && signal24h.momentum_score && signal24h.momentum_score > 0
      ? ((currentMomentum - signal24h.momentum_score) /
          signal24h.momentum_score) *
        100
      : null;

  const velocity7d =
    signal7d && signal7d.momentum_score && signal7d.momentum_score > 0
      ? ((currentMomentum - signal7d.momentum_score) /
          signal7d.momentum_score) *
        100
      : null;

  const trend = determineTrend(velocity7d);

  return { velocity24h, velocity7d, trend };
}

/**
 * Get velocity multiplier for gap score adjustment.
 */
export function getVelocityMultiplier(
  trend: 'accelerating' | 'stable' | 'declining' | null
): number {
  switch (trend) {
    case 'accelerating':
      return 1.2;
    case 'stable':
      return 1.0;
    case 'declining':
      return 0.7;
    default:
      return 1.0; // No data, neutral
  }
}

/**
 * Check if a topic is new (first seen < 48 hours ago).
 */
export function isNewTopic(firstSeenAt: string | Date): boolean {
  const firstSeen =
    typeof firstSeenAt === 'string' ? new Date(firstSeenAt) : firstSeenAt;
  const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
  return firstSeen.getTime() > fortyEightHoursAgo;
}

/**
 * Get new topic bonus multiplier.
 */
export function getNewTopicBonus(firstSeenAt: string | Date): number {
  return isNewTopic(firstSeenAt) ? 1.15 : 1.0;
}

// ============================================
// GAP SCORE CALCULATION
// ============================================

/**
 * Calculate the gap score with all improvements applied.
 *
 * @param momentum - Momentum after recency decay and cross-platform boost
 * @param supplyScore - Composite supply score
 * @param velocityTrend - Velocity trend direction
 * @param firstSeenAt - When the topic was first detected
 * @returns Final gap score
 */
export function calculateGapScore(
  momentum: number,
  supplyScore: number,
  velocityTrend: 'accelerating' | 'stable' | 'declining' | null,
  firstSeenAt: string | Date
): number {
  // Base gap calculation
  const baseGap = momentum * (1 - supplyScore / 100);

  // Apply velocity multiplier
  const velocityMultiplier = getVelocityMultiplier(velocityTrend);

  // Apply new topic bonus
  const newTopicBonus = getNewTopicBonus(firstSeenAt);

  // Final gap score
  return baseGap * velocityMultiplier * newTopicBonus;
}
