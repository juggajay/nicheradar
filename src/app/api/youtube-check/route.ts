import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface YouTubeVideo {
  video_id: string;
  title: string;
  channel_name: string;
  channel_id: string;
  views: number;
  published_at: string;
  thumbnail: string;
}

async function fetchYouTubeData(query: string): Promise<{
  totalResults: number;
  recentCount: number;
  videos: YouTubeVideo[];
  avgViews: number;
  largeChannelCount: number;
  smallChannelCount: number;
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
      };
    }
  );

  const avgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

  return {
    totalResults,
    recentCount,
    videos,
    avgViews,
    largeChannelCount,
    smallChannelCount,
  };
}

// Calculate supply score from YouTube data
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
    const { opportunity_id, keyword } = await request.json();

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

    // Fetch fresh YouTube data
    const ytData = await fetchYouTubeData(searchQuery);
    const supply = calculateSupplyScore(ytData);

    // Update youtube_supply table if we have a topic
    if (topicId) {
      await supabase.from('youtube_supply').upsert(
        {
          topic_id: topicId,
          total_results: ytData.totalResults,
          results_last_7_days: ytData.recentCount,
          results_last_30_days: ytData.recentCount,
          avg_views: ytData.avgViews,
          large_channel_count: ytData.largeChannelCount,
          small_channel_count: ytData.smallChannelCount,
          top_results: ytData.videos,
          checked_at: new Date().toISOString(),
        },
        { onConflict: 'topic_id' }
      );

      // Update opportunity with new supply score
      if (opportunity_id) {
        const { data: opp } = await supabase
          .from('opportunities')
          .select('external_momentum')
          .eq('id', opportunity_id)
          .single();

        const momentum = opp?.external_momentum || 50;
        const gap = Math.round(momentum * (1 - supply / 100) * 10) / 10;

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
            youtube_supply: supply,
            gap_score: gap,
            phase,
            confidence: 'high', // We verified with real data
            calculated_at: new Date().toISOString(),
          })
          .eq('id', opportunity_id);
      }
    }

    return NextResponse.json({
      success: true,
      keyword: searchQuery,
      supply,
      data: {
        total_results: ytData.totalResults,
        recent_count: ytData.recentCount,
        avg_views: ytData.avgViews,
        large_channel_count: ytData.largeChannelCount,
        small_channel_count: ytData.smallChannelCount,
        top_videos: ytData.videos.slice(0, 5),
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
