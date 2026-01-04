import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SUBREDDITS = [
  { subreddit: 'technology', category: 'tech', min_score: 100 },
  { subreddit: 'programming', category: 'tech', min_score: 75 },
  { subreddit: 'webdev', category: 'tech', min_score: 50 },
  { subreddit: 'LocalLLaMA', category: 'tech', min_score: 30 },
  { subreddit: 'Entrepreneur', category: 'business', min_score: 50 },
  { subreddit: 'SaaS', category: 'business', min_score: 30 },
  { subreddit: 'startups', category: 'business', min_score: 50 },
];

const HN_API = 'https://hacker-news.firebaseio.com/v0';

async function fetchRedditPosts(subreddit: string, minScore: number) {
  const posts: Array<{
    title: string;
    score: number;
    num_comments: number;
    url: string;
    subreddit: string;
  }> = [];

  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/rising.json?limit=25`,
      {
        headers: { 'User-Agent': 'NicheRadar/1.0' },
        next: { revalidate: 0 },
      }
    );

    if (!response.ok) return posts;

    const data = await response.json();

    for (const post of data?.data?.children || []) {
      const p = post.data;
      if (p.score >= minScore) {
        posts.push({
          title: p.title,
          score: p.score,
          num_comments: p.num_comments,
          url: `https://reddit.com${p.permalink}`,
          subreddit,
        });
      }
    }
  } catch (e) {
    console.error(`Reddit error for r/${subreddit}:`, e);
  }

  return posts;
}

async function fetchHNStories(limit = 50) {
  const stories: Array<{
    title: string;
    score: number;
    num_comments: number;
    url: string;
    hn_url: string;
  }> = [];

  try {
    const topRes = await fetch(`${HN_API}/topstories.json`);
    const topIds = (await topRes.json()).slice(0, limit);

    for (const id of topIds.slice(0, 30)) {
      const itemRes = await fetch(`${HN_API}/item/${id}.json`);
      const item = await itemRes.json();

      if (item?.type === 'story' && (item.score || 0) >= 50) {
        stories.push({
          title: item.title || '',
          score: item.score || 0,
          num_comments: item.descendants || 0,
          url: item.url || `https://news.ycombinator.com/item?id=${id}`,
          hn_url: `https://news.ycombinator.com/item?id=${id}`,
        });
      }
    }
  } catch (e) {
    console.error('HN error:', e);
  }

  return stories;
}

function extractKeywords(text: string): string[] {
  if (!text) return [];

  // Remove common prefixes
  let cleaned = text.replace(
    /^(TIL|ELI5|CMV|TIFU|AMA|WIBTA|AITA|Show HN|Ask HN|Tell HN|Launch HN)\s*:?\s*/i,
    ''
  );

  const keywords: string[] = [];

  // Find quoted terms
  const quoted = cleaned.match(/"([^"]+)"/g);
  if (quoted) {
    keywords.push(...quoted.map((q) => q.replace(/"/g, '')));
  }

  // Find capitalized phrases
  const phrases = cleaned.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g);
  if (phrases) {
    keywords.push(...phrases);
  }

  // Use whole title if short
  const words = cleaned.replace(/[^\w\s]/g, '').trim().split(/\s+/);
  if (words.length >= 3 && words.length <= 6) {
    keywords.push(cleaned.replace(/[^\w\s]/g, '').trim());
  }

  // Normalize and dedupe
  const seen = new Set<string>();
  return keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => {
      if (k.length <= 3 || seen.has(k) || /^\d+$/.test(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3);
}

export async function POST() {
  const startTime = Date.now();
  const supabase = await createClient();

  // Create scan log
  const { data: scanLog } = await supabase
    .from('scan_log')
    .insert({ status: 'running', started_at: new Date().toISOString() })
    .select()
    .single();

  const scanId = scanLog?.id;

  try {
    // Collect from Reddit
    const redditPosts: Array<{
      title: string;
      score: number;
      num_comments: number;
      url: string;
      subreddit: string;
      category?: string;
    }> = [];
    for (const config of SUBREDDITS) {
      const posts = await fetchRedditPosts(config.subreddit, config.min_score);
      redditPosts.push(...posts.map((p) => ({ ...p, category: config.category })));
      await new Promise((r) => setTimeout(r, 500)); // Rate limit
    }

    // Collect from HN
    const hnStories = await fetchHNStories();

    // Process into topics
    const topicsMap = new Map<
      string,
      {
        keyword: string;
        category: string;
        sources: Array<{
          source: string;
          source_url: string;
          source_title: string;
          source_metadata: Record<string, unknown>;
        }>;
      }
    >();

    // Process Reddit
    for (const post of redditPosts) {
      const keywords = extractKeywords(post.title);
      for (const kw of keywords) {
        const norm = kw.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (!topicsMap.has(norm)) {
          topicsMap.set(norm, {
            keyword: kw,
            category: post.category || 'uncategorised',
            sources: [],
          });
        }
        topicsMap.get(norm)!.sources.push({
          source: 'reddit',
          source_url: post.url,
          source_title: post.title,
          source_metadata: {
            subreddit: post.subreddit,
            score: post.score,
            num_comments: post.num_comments,
          },
        });
      }
    }

    // Process HN
    for (const story of hnStories) {
      const keywords = extractKeywords(story.title);
      for (const kw of keywords) {
        const norm = kw.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (!topicsMap.has(norm)) {
          topicsMap.set(norm, {
            keyword: kw,
            category: 'tech',
            sources: [],
          });
        }
        topicsMap.get(norm)!.sources.push({
          source: 'hackernews',
          source_url: story.hn_url,
          source_title: story.title,
          source_metadata: {
            score: story.score,
            num_comments: story.num_comments,
          },
        });
      }
    }

    let topicsUpdated = 0;
    let opportunitiesCreated = 0;

    // Upsert topics and create opportunities
    for (const [norm, topicData] of topicsMap) {
      try {
        // Check if topic exists
        const { data: existing } = await supabase
          .from('topics')
          .select('id')
          .eq('keyword_normalised', norm)
          .single();

        let topicId: string;

        if (existing) {
          topicId = existing.id;
          await supabase
            .from('topics')
            .update({ last_seen_at: new Date().toISOString(), is_active: true })
            .eq('id', topicId);
        } else {
          const { data: newTopic } = await supabase
            .from('topics')
            .insert({
              keyword: topicData.keyword,
              keyword_normalised: norm,
              category: topicData.category,
            })
            .select()
            .single();
          topicId = newTopic!.id;
        }

        // Insert sources
        for (const source of topicData.sources) {
          await supabase.from('topic_sources').upsert(
            {
              topic_id: topicId,
              source: source.source,
              source_url: source.source_url,
              source_title: source.source_title,
              source_metadata: source.source_metadata,
            },
            { onConflict: 'topic_id,source,source_url' }
          );
        }

        // Calculate scores
        let redditScore = 0;
        let hnScore = 0;

        for (const s of topicData.sources) {
          const meta = s.source_metadata as Record<string, number>;
          if (s.source === 'reddit') redditScore += meta.score || 0;
          if (s.source === 'hackernews') hnScore += meta.score || 0;
        }

        const momentum = Math.min(
          100,
          (Math.min(redditScore / 500, 1) * 40) + (Math.min(hnScore / 300, 1) * 30)
        );
        const supply = 50; // Default until YouTube check
        const gap = momentum * (1 - supply / 100);

        // Store signal
        await supabase.from('topic_signals').insert({
          topic_id: topicId,
          reddit_total_score: redditScore || null,
          hn_total_score: hnScore || null,
          momentum_score: momentum,
        });

        // Determine phase and confidence
        const phase =
          gap >= 80 && supply < 20
            ? 'innovation'
            : gap >= 60 && supply < 40
            ? 'emergence'
            : gap >= 40
            ? 'growth'
            : gap >= 20
            ? 'maturity'
            : 'saturated';

        const sourceCount = new Set(topicData.sources.map((s) => s.source)).size;
        const confidence =
          sourceCount >= 3 && momentum >= 70
            ? 'high'
            : sourceCount >= 2 && momentum >= 50
            ? 'medium'
            : 'low';

        // Upsert opportunity
        const { data: existingOpp } = await supabase
          .from('opportunities')
          .select('id')
          .eq('topic_id', topicId)
          .single();

        const oppData = {
          topic_id: topicId,
          external_momentum: momentum,
          youtube_supply: supply,
          gap_score: gap,
          phase,
          confidence,
          keyword: topicData.keyword,
          category: topicData.category,
          sources: [...new Set(topicData.sources.map((s) => s.source))],
          calculated_at: new Date().toISOString(),
        };

        if (existingOpp) {
          await supabase.from('opportunities').update(oppData).eq('id', existingOpp.id);
        } else {
          await supabase.from('opportunities').insert(oppData);
          opportunitiesCreated++;
        }

        topicsUpdated++;
      } catch (e) {
        console.error(`Error processing topic ${norm}:`, e);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Update scan log
    await supabase
      .from('scan_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        topics_detected: redditPosts.length + hnStories.length,
        topics_updated: topicsUpdated,
        opportunities_created: opportunitiesCreated,
        duration_seconds: duration,
      })
      .eq('id', scanId);

    return NextResponse.json({
      success: true,
      stats: {
        reddit_posts: redditPosts.length,
        hn_stories: hnStories.length,
        topics_updated: topicsUpdated,
        opportunities_created: opportunitiesCreated,
        duration_seconds: duration,
      },
    });
  } catch (error) {
    console.error('Scan error:', error);

    if (scanId) {
      await supabase
        .from('scan_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [{ message: String(error) }],
        })
        .eq('id', scanId);
    }

    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();

  const { data: lastScan } = await supabase
    .from('scan_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ lastScan });
}
