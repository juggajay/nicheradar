# Phase 1: Scoring Improvements Design

**Date:** 2026-01-04
**Status:** Approved
**Scope:** Competition Quality Scoring, Recency Decay, Cross-Platform Momentum, Velocity Tracking

---

## Overview

Phase 1 improves the accuracy of gap score calculation through four refinements:

1. **Competition Quality Scoring** — Replace simple result-count supply score with a composite of volume, authority, and freshness
2. **Recency Decay** — Replace aggressive sqrt decay with plateau-based formula that rewards proven staying power
3. **Cross-Platform Momentum** — Boost topics appearing on multiple platforms simultaneously
4. **Velocity Tracking** — Track momentum change over time to identify accelerating vs declining topics

### Approach: Incremental Rollout

New scoring runs in parallel with existing v1 scoring:
- New fields: `gap_score_v2`, `supply_score_v2`, `external_momentum_v2`
- Old fields remain unchanged for comparison
- UI can show both during validation period
- Once validated, v1 fields can be deprecated

---

## Database Schema Changes

### `youtube_supply` Table Additions

```sql
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS top_10_videos JSONB DEFAULT '[]'::jsonb;

ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS authority_score SMALLINT DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS large_channel_count_v2 SMALLINT DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS medium_channel_count SMALLINT DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS small_channel_count_v2 SMALLINT DEFAULT NULL;

ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS freshness_score SMALLINT DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS videos_last_7_days SMALLINT DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS videos_last_30_days SMALLINT DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS videos_last_90_days SMALLINT DEFAULT NULL;

ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS volume_score SMALLINT DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS supply_score_v2 SMALLINT DEFAULT NULL;

ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS avg_views_top_10 INTEGER DEFAULT NULL;
ALTER TABLE youtube_supply ADD COLUMN IF NOT EXISTS max_views_top_10 INTEGER DEFAULT NULL;
```

### `topic_signals` Table Additions

```sql
ALTER TABLE topic_signals ADD COLUMN IF NOT EXISTS source_platforms TEXT[] DEFAULT '{}';
ALTER TABLE topic_signals ADD COLUMN IF NOT EXISTS cross_platform_count SMALLINT DEFAULT 1;
ALTER TABLE topic_signals ADD COLUMN IF NOT EXISTS cross_platform_strength SMALLINT DEFAULT NULL;
```

### `opportunities` Table Additions

```sql
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS gap_score_v2 DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_momentum_v2 DECIMAL(6,2) DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS youtube_supply_v2 SMALLINT DEFAULT NULL;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS has_authority_gap BOOLEAN DEFAULT FALSE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS has_freshness_gap BOOLEAN DEFAULT FALSE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_underserved BOOLEAN DEFAULT FALSE;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS velocity_24h DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS velocity_7d DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS velocity_trend TEXT DEFAULT NULL;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cross_platform_count SMALLINT DEFAULT 1;
```

---

## Algorithm 1: Competition Quality Scoring

### Data Collection

Fetch detailed data for top 10 YouTube search results:

```typescript
interface TopVideoData {
  video_id: string;
  title: string;
  channel_id: string;
  channel_name: string;
  channel_subs: number;
  publish_date: string;
  view_count: number;
  days_old: number;
}
```

### Volume Score (0-100)

Based on total search results:

```typescript
function calculateVolumeScore(totalResults: number): number {
  if (totalResults > 1_000_000) return 100;
  if (totalResults > 500_000)   return 90;
  if (totalResults > 100_000)   return 75;
  if (totalResults > 50_000)    return 60;
  if (totalResults > 10_000)    return 45;
  if (totalResults > 1_000)     return 30;
  if (totalResults > 100)       return 15;
  return 5;
}
```

### Authority Score (0-100)

Measures channel size dominance, normalized by video count:

```typescript
function calculateAuthorityScore(videos: TopVideoData[]): number {
  if (videos.length === 0) return 0;

  let rawScore = 0;
  for (const video of videos) {
    if (video.channel_subs > 1_000_000) rawScore += 10;
    else if (video.channel_subs > 500_000) rawScore += 7;
    else if (video.channel_subs > 100_000) rawScore += 4;
  }

  const normalized = (rawScore / videos.length) * 10;
  return Math.min(Math.round(normalized), 100);
}
```

### Freshness Score (0-100)

Measures content recency, normalized by video count:

```typescript
function calculateFreshnessScore(videos: TopVideoData[]): number {
  if (videos.length === 0) return 0;

  let rawScore = 0;
  for (const video of videos) {
    if (video.days_old <= 7) rawScore += 10;
    else if (video.days_old <= 30) rawScore += 5;
    else if (video.days_old <= 90) rawScore += 2;
  }

  const normalized = (rawScore / videos.length) * 10;
  return Math.min(Math.round(normalized), 100);
}
```

### Composite Supply Score

```typescript
function calculateSupplyScoreV2(
  volumeScore: number,
  authorityScore: number,
  freshnessScore: number
): number {
  const composite =
    (volumeScore * 0.40) +
    (authorityScore * 0.35) +
    (freshnessScore * 0.25);

  return Math.round(composite);
}
```

### Opportunity Flags

```typescript
const has_authority_gap = authorityScore < 30;
const has_freshness_gap = freshnessScore < 20;
const is_underserved = totalResults < 1000 && momentum > 40;
```

---

## Algorithm 2: Recency Decay (Plateau-Based)

Replaces: `1 / sqrt(hoursOld / 2)`

```typescript
function calculateRecencyMultiplier(hoursOld: number): number {
  if (hoursOld <= 6) {
    // Fresh posts: full boost
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
```

| Hours Old | Old Formula | New Formula |
|-----------|-------------|-------------|
| 1 hour    | 1.40x       | 1.20x       |
| 6 hours   | 0.58x       | 1.20x       |
| 12 hours  | 0.41x       | 1.13x       |
| 24 hours  | 0.29x       | 1.00x       |
| 48 hours  | 0.20x       | 0.70x       |

---

## Algorithm 3: Cross-Platform Momentum

### Topic Normalization

```typescript
function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\.+#]/g, '');  // Preserve + and # for C++, C#
}
```

### Cross-Platform Detection

Within a single scan, group posts by normalized topic and detect multi-platform presence:

```typescript
interface PlatformPresence {
  platforms: Set<string>;
  posts: CollectedPost[];
  totalScore: number;
}

function detectCrossPlatform(posts: CollectedPost[]): Map<string, PlatformPresence> {
  const topicMap = new Map<string, PlatformPresence>();

  for (const post of posts) {
    const normalized = normalizeTopic(post.topic);

    if (!topicMap.has(normalized)) {
      topicMap.set(normalized, {
        platforms: new Set(),
        posts: [],
        totalScore: 0
      });
    }

    const entry = topicMap.get(normalized)!;
    entry.platforms.add(post.source);
    entry.posts.push(post);
    entry.totalScore += post.score;
  }

  return topicMap;
}
```

### Cross-Platform Multiplier

```typescript
function getCrossPlatformMultiplier(platformCount: number): number {
  switch (platformCount) {
    case 1:  return 1.0;
    case 2:  return 1.4;
    default: return 1.7;
  }
}
```

### Cross-Platform Strength Score (0-100)

```typescript
function calculateCrossPlatformStrength(
  posts: CollectedPost[],
  allPosts: CollectedPost[]
): number {
  const byPlatform = groupBy(posts, p => p.source);
  const platformScores: number[] = [];

  for (const [platform, platformPosts] of Object.entries(byPlatform)) {
    const allPlatformPosts = allPosts.filter(p => p.source === platform);
    const sorted = [...allPlatformPosts].sort((a, b) => b.score - a.score);

    const bestPost = platformPosts.reduce((a, b) => a.score > b.score ? a : b);
    const rank = sorted.findIndex(p => p.url === bestPost.url) + 1;

    const percentile = Math.round((1 - (rank - 1) / sorted.length) * 100);
    platformScores.push(percentile);
  }

  return Math.round(platformScores.reduce((a, b) => a + b, 0) / platformScores.length);
}
```

---

## Algorithm 4: Velocity Tracking

### Velocity Calculation

```typescript
async function calculateVelocity(
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
  const signal24h = findClosestSignal(signals, now, 24);
  const signal7d = findClosestSignal(signals, now, 24 * 7);

  const velocity24h = signal24h && signal24h.momentum_score > 0
    ? ((currentMomentum - signal24h.momentum_score) / signal24h.momentum_score) * 100
    : null;

  const velocity7d = signal7d && signal7d.momentum_score > 0
    ? ((currentMomentum - signal7d.momentum_score) / signal7d.momentum_score) * 100
    : null;

  const trend = determineTrend(velocity7d);

  return { velocity24h, velocity7d, trend };
}
```

### Signal Lookup with Tolerance

```typescript
function findClosestSignal(
  signals: Array<{ momentum_score: number; recorded_at: string }>,
  now: Date,
  targetHoursAgo: number
): { momentum_score: number } | null {
  const tolerance = targetHoursAgo * 0.25;

  let closest = null;
  let closestDiff = Infinity;

  for (const signal of signals) {
    const signalTime = new Date(signal.recorded_at);
    const hoursAgo = (now.getTime() - signalTime.getTime()) / (1000 * 60 * 60);
    const diff = Math.abs(hoursAgo - targetHoursAgo);

    if (diff < closestDiff && diff <= tolerance) {
      closest = signal;
      closestDiff = diff;
    }
  }

  return closest;
}
```

### Trend Classification

```typescript
function determineTrend(velocity7d: number | null): 'accelerating' | 'stable' | 'declining' | null {
  if (velocity7d === null) return null;

  if (velocity7d > 30) return 'accelerating';
  if (velocity7d < -15) return 'declining';
  return 'stable';
}
```

### Velocity Multiplier

```typescript
function getVelocityMultiplier(trend: string | null): number {
  switch (trend) {
    case 'accelerating': return 1.2;
    case 'stable':       return 1.0;
    case 'declining':    return 0.7;
    default:             return 1.0;
  }
}
```

---

## Final Gap Score Calculation

```typescript
// After all components calculated:
const baseGap = momentumV2 * (1 - supplyScoreV2 / 100);
const velocityMultiplier = getVelocityMultiplier(velocityTrend);

// New topic bonus (first seen < 48 hours)
const isNewTopic = new Date(firstSeenAt) > new Date(Date.now() - 48 * 60 * 60 * 1000);
const newTopicBonus = isNewTopic ? 1.15 : 1.0;

const gapScoreV2 = baseGap * velocityMultiplier * newTopicBonus;
```

---

## API Changes

### POST /api/scan

1. Use new recency formula
2. Detect cross-platform presence after collecting posts
3. Apply cross-platform multiplier to momentum
4. Calculate velocity after storing signals
5. Store v2 fields alongside v1 fields

### POST /api/youtube-check

1. Fetch detailed top 10 video data (channel subs, publish dates, view counts)
2. Calculate volume, authority, freshness scores
3. Calculate composite supply_score_v2
4. Set opportunity flags
5. Calculate final gap_score_v2

### GET /api/opportunities

New query parameters:
- `crossPlatformOnly=true` — filter `cross_platform_count >= 2`
- `acceleratingOnly=true` — filter `velocity_trend = 'accelerating'`
- `hasAuthorityGap=true` — filter `has_authority_gap = true`
- `hasFreshnessGap=true` — filter `has_freshness_gap = true`

Sorting:
```typescript
query = query.order(sortBy, { ascending: false, nullsFirst: false });
```

---

## UI Changes

### Opportunity Card

- Platform badges (Reddit/HN icons)
- Cross-platform highlight (ring glow when count >= 2)
- Trend arrow (green up, gray right, red down)
- Gap flag badges: "Small creators", "Stale content", "New"

### Gap Score Component

- Optional v1/v2 comparison mode during validation
- Show v2 score by default

### Opportunity Detail Page

- Supply breakdown: Volume / Authority / Freshness cards
- Velocity metrics: 24h change, 7d change with color coding
- Null velocity shows "—"

### Dashboard Filters

- Cross-platform only
- Accelerating only
- Authority gap
- Freshness gap

---

## Implementation Order

1. **Database migrations** — Add all new columns
2. **Scoring utilities** — Implement calculation functions
3. **YouTube check endpoint** — Expand data collection, add v2 scoring
4. **Scan endpoint** — Add recency formula, cross-platform detection, velocity
5. **Opportunities endpoint** — Add filters and v2 sorting
6. **UI components** — Add badges, trend arrows, supply breakdown
7. **Validation** — Compare v1 vs v2 scores over 1-2 weeks

---

## Testing Notes

- Backtest new supply scoring against known saturated topics (should score high)
- Backtest against known opportunities (should have scored as opportunities)
- Compare old vs new gap scores for same dataset
- Verify cross-platform detection catches Reddit + HN overlap
- Test velocity with sparse historical data (should return null gracefully)
