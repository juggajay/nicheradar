import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

      const { data: supply } = await supabase
        .from('youtube_supply')
        .select('*')
        .eq('topic_id', existingTopic.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single();

      const momentum = signal?.momentum_score || 30;
      const supplyScore = calculateSupplyScore(supply);
      const gapScore = calculateGapScore(momentum, supplyScore);

      return NextResponse.json({
        keyword: existingTopic.keyword,
        gap_score: gapScore,
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

    // Calculate supply based on YouTube data
    let supply = 30; // Base supply for new keywords
    if (ytStats.totalResults > 100000) supply = 80;
    else if (ytStats.totalResults > 50000) supply = 70;
    else if (ytStats.totalResults > 10000) supply = 60;
    else if (ytStats.totalResults > 1000) supply = 45;
    else if (ytStats.totalResults > 100) supply = 30;
    else supply = 15;

    // Adjust for recent activity
    if (ytStats.recentCount >= 10) supply += 10;
    else if (ytStats.recentCount >= 5) supply += 5;

    supply = Math.min(95, supply);

    // Estimate momentum (low for new untracked keywords)
    const momentum = 20;
    const gap = calculateGapScore(momentum, supply);
    const phase = classifyPhase(momentum, supply, gap);

    return NextResponse.json({
      keyword: keyword,
      gap_score: gap,
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

function calculateSupplyScore(youtubeData: Record<string, unknown> | null): number {
  if (!youtubeData) return 50; // Default medium supply

  let score = 0;
  const total = (youtubeData.total_results as number) || 0;
  const recent = (youtubeData.results_last_7_days as number) || 0;
  const large = (youtubeData.large_channel_count as number) || 0;

  // Volume
  if (total > 100000) score += 40;
  else if (total > 10000) score += 30;
  else if (total > 1000) score += 20;
  else score += 10;

  // Recent velocity
  if (recent > 50) score += 30;
  else if (recent > 20) score += 20;
  else if (recent > 5) score += 10;

  // Large channels
  score += Math.min(large * 10, 30);

  return Math.min(score, 100);
}

function calculateGapScore(momentum: number, supply: number): number {
  const gap = momentum * (1 - supply / 100);
  return Math.round(gap * 10) / 10;
}

function classifyPhase(momentum: number, supply: number, gap: number): string {
  if (gap >= 80 && supply < 20) return 'innovation';
  if (gap >= 60 && supply < 40) return 'emergence';
  if (gap >= 40) return 'growth';
  if (gap >= 20) return 'maturity';
  return 'saturated';
}
