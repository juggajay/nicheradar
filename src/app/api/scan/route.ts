import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SUBREDDITS = [
  { subreddit: 'technology', category: 'tech', min_score: 50 },
  { subreddit: 'programming', category: 'tech', min_score: 50 },
  { subreddit: 'webdev', category: 'tech', min_score: 30 },
  { subreddit: 'LocalLLaMA', category: 'ai', min_score: 20 },
  { subreddit: 'artificial', category: 'ai', min_score: 30 },
  { subreddit: 'MachineLearning', category: 'ai', min_score: 30 },
  { subreddit: 'Entrepreneur', category: 'business', min_score: 30 },
  { subreddit: 'SaaS', category: 'business', min_score: 20 },
];

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface VideoIdea {
  topic: string;
  videoTitle: string;
  contentType: 'tutorial' | 'news' | 'comparison' | 'review' | 'explainer' | 'howto';
  category: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceScore: number;
  sourceComments: number;
  sourcePlatform: 'reddit' | 'hackernews';
}

// Use Gemini to extract video ideas from post titles
async function extractVideoIdeasWithAI(
  posts: Array<{ title: string; url: string; score: number; comments: number; platform: string; category: string }>
): Promise<VideoIdea[]> {
  if (!GEMINI_API_KEY || posts.length === 0) {
    console.log('No Gemini API key or no posts');
    return [];
  }

  const titlesText = posts
    .map((p, i) => `${i + 1}. [${p.platform}/${p.category}] "${p.title}"`)
    .join('\n');

  const prompt = `You are a YouTube content strategist. Analyze these trending tech/business posts and extract YouTube video opportunities.

For each post that could make a good YouTube video, output a JSON object. Skip posts that are:
- Too vague or generic (like "thoughts on AI?")
- About company drama/layoffs/internal politics
- Not actionable as video content
- Pure news without educational angle

For good posts, extract:
- topic: The core subject (e.g., "Claude Code", "React Server Components", "Local LLM Setup")
- videoTitle: A clickable YouTube title (e.g., "I Tried Claude Code for 30 Days - Here's What Happened")
- contentType: One of: tutorial, news, comparison, review, explainer, howto
- sourceIndex: The post number from the list

POSTS:
${titlesText}

Respond with ONLY a JSON array. Example:
[
  {"topic": "Claude Code", "videoTitle": "Claude Code Tutorial: Build Apps 10x Faster", "contentType": "tutorial", "sourceIndex": 1},
  {"topic": "GPT-4 vs Claude 3.5", "videoTitle": "GPT-4 vs Claude 3.5: Which AI Wins in 2025?", "contentType": "comparison", "sourceIndex": 3}
]

If no posts are video-worthy, return an empty array: []`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in Gemini response:', text);
      return [];
    }

    const ideas = JSON.parse(jsonMatch[0]) as Array<{
      topic: string;
      videoTitle: string;
      contentType: string;
      sourceIndex: number;
    }>;

    // Map back to full VideoIdea objects
    return ideas
      .filter((idea) => idea.sourceIndex > 0 && idea.sourceIndex <= posts.length)
      .map((idea) => {
        const source = posts[idea.sourceIndex - 1];
        return {
          topic: idea.topic,
          videoTitle: idea.videoTitle,
          contentType: idea.contentType as VideoIdea['contentType'],
          category: source.category,
          sourceTitle: source.title,
          sourceUrl: source.url,
          sourceScore: source.score,
          sourceComments: source.comments,
          sourcePlatform: source.platform as 'reddit' | 'hackernews',
        };
      });
  } catch (e) {
    console.error('Gemini extraction error:', e);
    return [];
  }
}

// Check YouTube supply for a topic
async function getYouTubeSupply(query: string): Promise<{ supply: number; totalResults: number }> {
  if (!YOUTUBE_API_KEY) return { supply: 50, totalResults: 0 };

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) return { supply: 50, totalResults: 0 };

    const data = await res.json();
    const total = data.pageInfo?.totalResults || 0;

    // Convert to 0-100 supply score (lower = better opportunity)
    let supply = 50;
    if (total > 500000) supply = 95;
    else if (total > 100000) supply = 85;
    else if (total > 50000) supply = 70;
    else if (total > 10000) supply = 55;
    else if (total > 5000) supply = 40;
    else if (total > 1000) supply = 30;
    else if (total > 100) supply = 20;
    else supply = 10;

    return { supply, totalResults: total };
  } catch {
    return { supply: 50, totalResults: 0 };
  }
}

async function fetchRedditPosts(subreddit: string, minScore: number, category: string) {
  const posts: Array<{
    title: string;
    url: string;
    score: number;
    comments: number;
    platform: string;
    category: string;
  }> = [];

  try {
    // Try both rising and hot
    for (const sort of ['rising', 'hot']) {
      const response = await fetch(
        `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=15`,
        {
          headers: { 'User-Agent': 'NicheRadar/1.0' },
          next: { revalidate: 0 },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();

      for (const post of data?.data?.children || []) {
        const p = post.data;
        if (p.score >= minScore && !posts.some((x) => x.title === p.title)) {
          posts.push({
            title: p.title,
            url: `https://reddit.com${p.permalink}`,
            score: p.score,
            comments: p.num_comments,
            platform: 'reddit',
            category,
          });
        }
      }
    }
  } catch (e) {
    console.error(`Reddit error for r/${subreddit}:`, e);
  }

  return posts;
}

async function fetchHNStories() {
  const stories: Array<{
    title: string;
    url: string;
    score: number;
    comments: number;
    platform: string;
    category: string;
  }> = [];

  try {
    const topRes = await fetch(`${HN_API}/topstories.json`);
    const topIds = (await topRes.json()).slice(0, 40);

    // Fetch in parallel for speed
    const items = await Promise.all(
      topIds.map(async (id: number) => {
        const res = await fetch(`${HN_API}/item/${id}.json`);
        return res.json();
      })
    );

    for (const item of items) {
      if (item?.type === 'story' && (item.score || 0) >= 30) {
        stories.push({
          title: item.title || '',
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          score: item.score || 0,
          comments: item.descendants || 0,
          platform: 'hackernews',
          category: 'tech',
        });
      }
    }
  } catch (e) {
    console.error('HN error:', e);
  }

  return stories;
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
    // Step 1: Collect posts from all sources
    console.log('Collecting posts...');
    const allPosts: Array<{
      title: string;
      url: string;
      score: number;
      comments: number;
      platform: string;
      category: string;
    }> = [];

    // Fetch Reddit posts
    for (const config of SUBREDDITS) {
      const posts = await fetchRedditPosts(config.subreddit, config.min_score, config.category);
      allPosts.push(...posts);
      await new Promise((r) => setTimeout(r, 300)); // Rate limit
    }

    // Fetch HN stories
    const hnStories = await fetchHNStories();
    allPosts.push(...hnStories);

    console.log(`Collected ${allPosts.length} posts`);

    if (allPosts.length === 0) {
      throw new Error('No posts collected from any source');
    }

    // Step 2: Use Gemini AI to extract video ideas
    console.log('Extracting video ideas with AI...');
    const videoIdeas = await extractVideoIdeasWithAI(allPosts);
    console.log(`AI extracted ${videoIdeas.length} video ideas`);

    if (videoIdeas.length === 0) {
      // Update scan log with no results
      await supabase
        .from('scan_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          topics_detected: allPosts.length,
          topics_updated: 0,
          opportunities_created: 0,
          duration_seconds: Math.round((Date.now() - startTime) / 1000),
        })
        .eq('id', scanId);

      return NextResponse.json({
        success: true,
        stats: {
          posts_collected: allPosts.length,
          video_ideas: 0,
          opportunities_created: 0,
          message: 'No video-worthy topics found in current trending posts',
        },
      });
    }

    // Step 3: Check YouTube supply and create opportunities
    console.log('Checking YouTube supply...');
    let opportunitiesCreated = 0;
    let topicsUpdated = 0;

    for (const idea of videoIdeas) {
      try {
        // Check YouTube supply
        const { supply, totalResults } = await getYouTubeSupply(idea.topic);

        // Calculate momentum based on source engagement
        const baseMomentum = Math.min(50, Math.log10(idea.sourceScore + 1) * 25);
        const commentBonus = Math.min(25, idea.sourceComments / 5);
        const momentum = Math.min(100, Math.round(baseMomentum + commentBonus));

        // Calculate gap score
        const gap = Math.round(momentum * (1 - supply / 100) * 10) / 10;

        // Determine phase
        const phase =
          gap >= 70 && supply < 30
            ? 'innovation'
            : gap >= 50 && supply < 50
            ? 'emergence'
            : gap >= 35
            ? 'growth'
            : gap >= 20
            ? 'maturity'
            : 'saturated';

        // Determine confidence
        const confidence =
          momentum >= 60 && supply < 40
            ? 'high'
            : momentum >= 40
            ? 'medium'
            : 'low';

        // Normalize topic for deduplication
        const normalized = idea.topic.toLowerCase().replace(/[^\w\s]/g, '').trim();

        // Check if topic exists
        const { data: existingTopic } = await supabase
          .from('topics')
          .select('id')
          .eq('keyword_normalised', normalized)
          .single();

        let topicId: string;

        if (existingTopic) {
          topicId = existingTopic.id;
          await supabase
            .from('topics')
            .update({ last_seen_at: new Date().toISOString(), is_active: true })
            .eq('id', topicId);
        } else {
          const { data: newTopic } = await supabase
            .from('topics')
            .insert({
              keyword: idea.topic,
              keyword_normalised: normalized,
              category: idea.category,
            })
            .select()
            .single();
          topicId = newTopic!.id;
        }

        // Add source
        await supabase.from('topic_sources').upsert(
          {
            topic_id: topicId,
            source: idea.sourcePlatform,
            source_url: idea.sourceUrl,
            source_title: idea.sourceTitle,
            source_metadata: {
              score: idea.sourceScore,
              num_comments: idea.sourceComments,
              video_title_suggestion: idea.videoTitle,
              content_type: idea.contentType,
            },
          },
          { onConflict: 'topic_id,source,source_url' }
        );

        // Add signal
        await supabase.from('topic_signals').insert({
          topic_id: topicId,
          momentum_score: momentum,
          reddit_total_score: idea.sourcePlatform === 'reddit' ? idea.sourceScore : null,
          hn_total_score: idea.sourcePlatform === 'hackernews' ? idea.sourceScore : null,
        });

        // Upsert opportunity
        const { data: existingOpp } = await supabase
          .from('opportunities')
          .select('id')
          .eq('topic_id', topicId)
          .single();

        const oppData = {
          topic_id: topicId,
          keyword: idea.videoTitle, // Use the AI-generated title as the display keyword
          category: idea.category,
          external_momentum: momentum,
          youtube_supply: supply,
          gap_score: gap,
          phase,
          confidence,
          sources: [idea.sourcePlatform],
          calculated_at: new Date().toISOString(),
        };

        if (existingOpp) {
          await supabase.from('opportunities').update(oppData).eq('id', existingOpp.id);
        } else {
          await supabase.from('opportunities').insert(oppData);
          opportunitiesCreated++;
        }

        topicsUpdated++;

        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        console.error(`Error processing idea ${idea.topic}:`, e);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Update scan log
    await supabase
      .from('scan_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        topics_detected: allPosts.length,
        topics_updated: topicsUpdated,
        opportunities_created: opportunitiesCreated,
        duration_seconds: duration,
      })
      .eq('id', scanId);

    return NextResponse.json({
      success: true,
      stats: {
        posts_collected: allPosts.length,
        video_ideas: videoIdeas.length,
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

    return NextResponse.json({ error: 'Scan failed', details: String(error) }, { status: 500 });
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
