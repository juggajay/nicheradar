import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrendHealth, TrendResult } from '@/lib/trends';
import { TopVideoData } from '@/types/database';
import {
  calculateVolumeScore,
  calculateAuthorityScore,
  calculateFreshnessScore,
  calculateSupplyScoreV2,
  calculateOpportunityFlags,
  calculateVelocity,
  getVelocityMultiplier,
  getNewTopicBonus,
} from '@/lib/scoring-v2';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface YouTubeVideo {
  video_id: string;
  title: string;
  channel_name: string;
  channel_id: string;
  views: number;
  published_at: string;
  thumbnail: string;
  channel_subs: number;
  days_old: number;
}

async function fetchYouTubeData(query: string): Promise<{
  totalResults: number;
  recentCount: number;
  videos: YouTubeVideo[];
  avgViews: number;
  largeChannelCount: number;
  smallChannelCount: number;
  top10Videos: TopVideoData[];
}> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  // Search for videos
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
    query
  )}&type=video&maxResults=10&order=relevance&key=${YOUTUBE_API_KEY}`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error('YouTube search failed');
  }

  const searchData = await searchRes.json();
  const totalResults = searchData.pageInfo?.totalResults || 0;

  // Extract video IDs
  const videoIds = (searchData.items || []).map(
    (item: { id: { videoId: string } }) => item.id.videoId
  );

  if (videoIds.length === 0) {
    return {
      totalResults,
      recentCount: 0,
      videos: [],
      avgViews: 0,
      largeChannelCount: 0,
      smallChannelCount: 0,
      top10Videos: [],
    };
  }

  // Get video statistics
  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(
    ','
  )}&key=${YOUTUBE_API_KEY}`;

  const statsRes = await fetch(statsUrl);
  if (!statsRes.ok) {
    throw new Error('YouTube stats fetch failed');
  }

  const statsData = await statsRes.json();

  // Get channel info for subscriber counts
  const channelIds = [
    ...new Set(
      (statsData.items || []).map(
        (v: { snippet: { channelId: string } }) => v.snippet.channelId
      )
    ),
  ];

  let channelSubs: Record<string, number> = {};
  if (channelIds.length > 0) {
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(
      ','
    )}&key=${YOUTUBE_API_KEY}`;

    const channelsRes = await fetch(channelsUrl);
    if (channelsRes.ok) {
      const channelsData = await channelsRes.json();
      for (const channel of channelsData.items || []) {
        channelSubs[channel.id] = parseInt(
          channel.statistics?.subscriberCount || '0',
          10
        );
      }
    }
  }

  // Process videos
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let recentCount = 0;
  let totalViews = 0;
  let largeChannelCount = 0;
  let smallChannelCount = 0;

  const videos: YouTubeVideo[] = (statsData.items || []).map(
    (v: {
      id: string;
      snippet: {
        title: string;
        channelTitle: string;
        channelId: string;
        publishedAt: string;
        thumbnails: { medium: { url: string } };
      };
      statistics: { viewCount: string };
    }) => {
      const views = parseInt(v.statistics?.viewCount || '0', 10);
      const publishedAt = new Date(v.snippet.publishedAt);
      const subs = channelSubs[v.snippet.channelId] || 0;
      const daysOld = Math.floor(
        (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      totalViews += views;
      if (publishedAt > thirtyDaysAgo) recentCount++;
      if (subs > 100000) largeChannelCount++;
      else if (subs < 10000) smallChannelCount++;

      return {
        video_id: v.id,
        title: v.snippet.title,
        channel_name: v.snippet.channelTitle,
        channel_id: v.snippet.channelId,
        views,
        published_at: v.snippet.publishedAt,
        thumbnail: v.snippet.thumbnails?.medium?.url || '',
        channel_subs: subs,
        days_old: daysOld,
      };
    }
  );

  const avgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

  // Build top_10_videos array for V2 scoring
  const top10Videos: TopVideoData[] = videos.map((v) => ({
    video_id: v.video_id,
    title: v.title,
    channel_id: v.channel_id,
    channel_name: v.channel_name,
    channel_subs: v.channel_subs,
    publish_date: v.published_at,
    view_count: v.views,
    days_old: v.days_old,
  }));

  return {
    totalResults,
    recentCount,
    videos,
    avgViews,
    largeChannelCount,
    smallChannelCount,
    top10Videos,
  };
}

// V1 supply score calculation (kept for backwards compatibility)
function calculateSupplyScore(data: {
  totalResults: number;
  recentCount: number;
  largeChannelCount: number;
}): number {
  let supply = 50;

  // Total results
  if (data.totalResults > 500000) supply = 95;
  else if (data.totalResults > 100000) supply = 85;
  else if (data.totalResults > 50000) supply = 70;
  else if (data.totalResults > 10000) supply = 55;
  else if (data.totalResults > 5000) supply = 45;
  else if (data.totalResults > 1000) supply = 35;
  else if (data.totalResults > 100) supply = 25;
  else supply = 15;

  // Adjust for recent activity
  if (data.recentCount >= 5) supply += 10;
  else if (data.recentCount >= 2) supply += 5;
  else if (data.recentCount === 0) supply -= 10;

  // Adjust for large channels dominating
  if (data.largeChannelCount >= 5) supply += 10;
  else if (data.largeChannelCount === 0) supply -= 10;

  return Math.max(10, Math.min(100, supply));
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key first
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: 'YouTube API key not configured', details: 'YOUTUBE_API_KEY environment variable is missing' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { opportunity_id, keyword } = body;

    if (!opportunity_id && !keyword) {
      return NextResponse.json(
        { error: 'opportunity_id or keyword required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    let topicId: string | null = null;
    let searchQuery = keyword;

    // If opportunity_id provided, get the keyword
    if (opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('keyword, topic_id')
        .eq('id', opportunity_id)
        .single();

      if (opp) {
        searchQuery = opp.keyword;
        topicId = opp.topic_id;
      }
    }

    if (!searchQuery) {
      return NextResponse.json({ error: 'No keyword found' }, { status: 400 });
    }

    // Fetch YouTube data and Google Trends in parallel
    const [ytData, trendData] = await Promise.all([
      fetchYouTubeData(searchQuery),
      getTrendHealth(searchQuery).catch((): TrendResult => ({
        status: 'unavailable',
        trend: 'unknown',
      })),
    ]);

    // V1 supply score (backwards compatible)
    const supply = calculateSupplyScore(ytData);

    // V2 scoring calculations
    const volumeScore = calculateVolumeScore(ytData.totalResults);
    const authorityScore = calculateAuthorityScore(ytData.top10Videos);
    const freshnessScore = calculateFreshnessScore(ytData.top10Videos);
    const supplyScoreV2 = calculateSupplyScoreV2(volumeScore, authorityScore, freshnessScore);

    // Calculate V2 channel breakdowns
    const largeChannelCountV2 = ytData.top10Videos.filter(
      (v) => v.channel_subs > 1_000_000
    ).length;
    const mediumChannelCount = ytData.top10Videos.filter(
      (v) => v.channel_subs > 100_000 && v.channel_subs <= 1_000_000
    ).length;
    const smallChannelCountV2 = ytData.top10Videos.filter(
      (v) => v.channel_subs <= 100_000
    ).length;

    // Calculate freshness breakdowns
    const videosLast7Days = ytData.top10Videos.filter(
      (v) => v.days_old <= 7
    ).length;
    const videosLast30Days = ytData.top10Videos.filter(
      (v) => v.days_old <= 30
    ).length;
    const videosLast90Days = ytData.top10Videos.filter(
      (v) => v.days_old <= 90
    ).length;

    // Calculate demand signals
    const avgViewsTop10 =
      ytData.top10Videos.length > 0
        ? Math.round(
            ytData.top10Videos.reduce((sum, v) => sum + v.view_count, 0) /
              ytData.top10Videos.length
          )
        : 0;
    const maxViewsTop10 =
      ytData.top10Videos.length > 0
        ? Math.max(...ytData.top10Videos.map((v) => v.view_count))
        : 0;

    // Update youtube_supply table if we have a topic
    if (topicId) {
      await supabase.from('youtube_supply').upsert(
        {
          topic_id: topicId,
          checked_at: new Date().toISOString(),
          // V1 fields (unchanged)
          total_results: ytData.totalResults,
          results_last_7_days: ytData.recentCount,
          results_last_30_days: ytData.recentCount,
          large_channel_count: ytData.largeChannelCount,
          small_channel_count: ytData.smallChannelCount,
          top_results: ytData.videos,
          supply_score: supply,
          // V2 fields
          top_10_videos: ytData.top10Videos,
          volume_score: volumeScore,
          authority_score: authorityScore,
          freshness_score: freshnessScore,
          supply_score_v2: supplyScoreV2,
          large_channel_count_v2: largeChannelCountV2,
          medium_channel_count: mediumChannelCount,
          small_channel_count_v2: smallChannelCountV2,
          videos_last_7_days: videosLast7Days,
          videos_last_30_days: videosLast30Days,
          videos_last_90_days: videosLast90Days,
          avg_views_top_10: avgViewsTop10,
          max_views_top_10: maxViewsTop10,
        },
        { onConflict: 'topic_id' }
      );

      // Update opportunity with both V1 and V2 scores
      if (opportunity_id) {
        // Get current opportunity data including V2 momentum and topic first_seen_at
        const { data: opp } = await supabase
          .from('opportunities')
          .select('external_momentum, external_momentum_v2, velocity_trend, topic_id')
          .eq('id', opportunity_id)
          .single();

        // Get topic first_seen_at for new topic bonus
        const { data: topic } = await supabase
          .from('topics')
          .select('first_seen_at')
          .eq('id', topicId)
          .single();

        const momentum = opp?.external_momentum || 50;
        const momentumV2 = opp?.external_momentum_v2 || momentum;
        const velocityTrend = opp?.velocity_trend as 'accelerating' | 'stable' | 'declining' | null;
        const firstSeenAt = topic?.first_seen_at || new Date().toISOString();

        // V1 gap score (unchanged)
        const gap = Math.round(momentum * (1 - supply / 100) * 10) / 10;

        // V2 gap score with velocity and new topic bonus
        const baseGapV2 = momentumV2 * (1 - supplyScoreV2 / 100);
        const velocityMultiplier = getVelocityMultiplier(velocityTrend);
        const newTopicBonus = getNewTopicBonus(firstSeenAt);
        const gapScoreV2 = Math.round(baseGapV2 * velocityMultiplier * newTopicBonus * 10) / 10;

        // Opportunity flags
        const flags = calculateOpportunityFlags(
          authorityScore,
          freshnessScore,
          ytData.totalResults,
          momentumV2
        );

        // V1 phase (unchanged)
        const phase =
          gap >= 60 && supply < 30
            ? 'innovation'
            : gap >= 45 && supply < 50
            ? 'emergence'
            : gap >= 30
            ? 'growth'
            : gap >= 15
            ? 'maturity'
            : 'saturated';

        await supabase
          .from('opportunities')
          .update({
            // V1 fields (unchanged)
            youtube_supply: supply,
            gap_score: gap,
            phase,
            confidence: 'high',
            calculated_at: new Date().toISOString(),
            // V2 fields
            youtube_supply_v2: supplyScoreV2,
            gap_score_v2: gapScoreV2,
            has_authority_gap: flags.hasAuthorityGap,
            has_freshness_gap: flags.hasFreshnessGap,
            is_underserved: flags.isUnderserved,
          })
          .eq('id', opportunity_id);
      }
    }

    return NextResponse.json({
      success: true,
      keyword: searchQuery,
      supply,
      supply_v2: supplyScoreV2,
      data: {
        total_results: ytData.totalResults,
        recent_count: ytData.recentCount,
        avg_views: ytData.avgViews,
        large_channel_count: ytData.largeChannelCount,
        small_channel_count: ytData.smallChannelCount,
        top_videos: ytData.videos.slice(0, 5),
        // V2 data
        volume_score: volumeScore,
        authority_score: authorityScore,
        freshness_score: freshnessScore,
        large_channel_count_v2: largeChannelCountV2,
        medium_channel_count: mediumChannelCount,
        small_channel_count_v2: smallChannelCountV2,
        videos_last_7_days: videosLast7Days,
        videos_last_30_days: videosLast30Days,
        videos_last_90_days: videosLast90Days,
        avg_views_top_10: avgViewsTop10,
        max_views_top_10: maxViewsTop10,
      },
      trends: {
        status: trendData.status,
        direction: trendData.trend,
        sparkline: trendData.sparkline || [],
      },
    });
  } catch (error) {
    console.error('YouTube check error:', error);
    return NextResponse.json(
      { error: 'YouTube check failed', details: String(error) },
      { status: 500 }
    );
  }
}
