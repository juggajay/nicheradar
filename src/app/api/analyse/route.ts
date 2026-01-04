import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateVolumeScore,
  calculateSupplyScore as calculateCompositeSupply,
  calculateGapScore as calculateGapWithBonuses,
} from '@/lib/scoring';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function getYouTubeStats(query: string): Promise<{
  totalResults: number;
  recentCount: number;
  avgViews: number;
}> {
  if (!YOUTUBE_API_KEY) {
    return { totalResults: 0, recentCount: 0, avgViews: 0 };
  }

  try {
    // Search for videos with this keyword
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&type=video&maxResults=20&order=relevance&key=${YOUTUBE_API_KEY}`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return { totalResults: 0, recentCount: 0, avgViews: 0 };

    const searchData = await searchRes.json();
    const totalResults = searchData.pageInfo?.totalResults || 0;

    // Count recent videos (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let recentCount = 0;
    const videoIds: string[] = [];

    for (const item of searchData.items || []) {
      const publishedAt = new Date(item.snippet?.publishedAt);
      if (publishedAt > thirtyDaysAgo) {
        recentCount++;
      }
      videoIds.push(item.id.videoId);
    }

    // Get video statistics for average views
    let avgViews = 0;
    if (videoIds.length > 0) {
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(
        ','
      )}&key=${YOUTUBE_API_KEY}`;
      const statsRes = await fetch(statsUrl);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const views = (statsData.items || []).map(
          (v: { statistics?: { viewCount?: string } }) =>
            parseInt(v.statistics?.viewCount || '0', 10)
        );
        if (views.length > 0) {
          avgViews = views.reduce((a: number, b: number) => a + b, 0) / views.length;
        }
      }
    }

    return { totalResults, recentCount, avgViews };
  } catch (e) {
    console.error('YouTube API error:', e);
    return { totalResults: 0, recentCount: 0, avgViews: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();

    if (!keyword || keyword.length < 2) {
      return NextResponse.json({ error: 'Keyword required' }, { status: 400 });
    }

    const supabase = await createClient();
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Check if this keyword already exists in opportunities
    const { data: existingOpportunity } = await supabase
      .from('opportunities')
      .select('*')
      .ilike('keyword', `%${normalizedKeyword}%`)
      .limit(1)
      .single();

    if (existingOpportunity) {
      return NextResponse.json({
        keyword: existingOpportunity.keyword,
        gap_score: existingOpportunity.gap_score,
        momentum: existingOpportunity.external_momentum,
        supply: existingOpportunity.youtube_supply,
        phase: existingOpportunity.phase,
        confidence: existingOpportunity.confidence,
        sources: existingOpportunity.sources,
        existing: true,
        opportunity_id: existingOpportunity.id,
        is_watched: existingOpportunity.is_watched || false,
      });
    }

    // Check if it exists in topics but not yet as opportunity
    const { data: existingTopic } = await supabase
      .from('topics')
      .select('*')
      .ilike('keyword', `%${normalizedKeyword}%`)
      .limit(1)
      .single();

    if (existingTopic) {
      // Get the latest signal if available
      const { data: signal } = await supabase
        .from('topic_signals')
        .select('momentum_score')
        .eq('topic_id', existingTopic.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      const { data: supplyData } = await supabase
        .from('youtube_supply')
        .select('supply_score, volume_score, authority_score, freshness_score')
        .eq('topic_id', existingTopic.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single();

      const momentum = signal?.momentum_score || 30;
      // Use stored v2 supply_score if available, otherwise calculate from components
      const supplyScore = supplyData?.supply_score ??
        (supplyData ? calculateCompositeSupply(
          supplyData.volume_score || 50,
          supplyData.authority_score || 50,
          supplyData.freshness_score || 50
        ) : 50);
      const gapScore = calculateGapWithBonuses(momentum, supplyScore, null, existingTopic.first_seen_at || new Date());

      return NextResponse.json({
        keyword: existingTopic.keyword,
        gap_score: Math.round(gapScore * 10) / 10,
        momentum: momentum,
        supply: supplyScore,
        phase: classifyPhase(momentum, supplyScore, gapScore),
        confidence: 'medium',
        sources: ['database'],
        existing: true,
        topic_id: existingTopic.id,
      });
    }

    // For new keywords, fetch real YouTube data to estimate supply
    const ytStats = await getYouTubeStats(keyword);

    // Calculate supply using v2 volume score (authority/freshness unknown for new keywords)
    const volumeScore = calculateVolumeScore(ytStats.totalResults);
    // Estimate authority (50 = unknown) and adjust freshness based on recent activity
    const estimatedAuthority = 50;
    const estimatedFreshness = ytStats.recentCount >= 10 ? 70 : ytStats.recentCount >= 5 ? 50 : 30;
    const supply = calculateCompositeSupply(volumeScore, estimatedAuthority, estimatedFreshness);

    // Estimate momentum (low for new untracked keywords)
    const momentum = 20;
    const gap = calculateGapWithBonuses(momentum, supply, null, new Date());
    const phase = classifyPhase(momentum, supply, gap);

    return NextResponse.json({
      keyword: keyword,
      gap_score: Math.round(gap * 10) / 10,
      momentum: momentum,
      supply: supply,
      phase: phase,
      confidence: 'low',
      sources: [],
      existing: false,
      message: `Found ${ytStats.totalResults.toLocaleString()} YouTube videos. Run a scan to track this keyword and get momentum data.`,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

function classifyPhase(momentum: number, supply: number, gap: number): string {
  if (gap >= 60 && supply < 30) return 'innovation';
  if (gap >= 45 && supply < 50) return 'emergence';
  if (gap >= 30) return 'growth';
  if (gap >= 15) return 'maturity';
  return 'saturated';
}
