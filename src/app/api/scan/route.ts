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
  sourceCreatedAt?: number; // Unix timestamp
  // Stage 1 scores (heuristic)
  heuristicSupply?: number;
  momentum?: number;
  initialGap?: number;
  // Stage 2 scores (YouTube API verified)
  verifiedSupply?: number;
  finalGap?: number;
}

// Use Gemini to extract video ideas from post titles
async function extractVideoIdeasWithAI(
  posts: Array<{ title: string; url: string; score: number; comments: number; platform: string; category: string; createdAt: number }>
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
          sourceCreatedAt: source.createdAt,
        };
      });
  } catch (e) {
    console.error('Gemini extraction error:', e);
    return [];
  }
}

// STAGE 1: Heuristic supply estimation (no API calls)
// This is a rough estimate based on topic characteristics
function estimateHeuristicSupply(topic: string, contentType: string): number {
  let supply = 50; // Default medium

  // Very specific topics = lower supply
  const wordCount = topic.split(/\s+/).length;
  if (wordCount >= 4) supply -= 15;
  else if (wordCount >= 3) supply -= 10;
  else if (wordCount === 1) supply += 10; // Single words are often saturated

  // Version numbers indicate specificity (React 19, GPT-4o)
  if (/\d+(\.\d+)?/.test(topic)) supply -= 15;

  // Comparison videos ("X vs Y") often have gaps
  if (/\bvs\.?\b/i.test(topic)) supply -= 10;

  // Tutorials for specific tools tend to have lower supply
  if (contentType === 'tutorial' && wordCount >= 2) supply -= 10;

  // Proper nouns (capitalized) are more specific
  const properNouns = topic.match(/\b[A-Z][a-z]+\b/g) || [];
  if (properNouns.length >= 2) supply -= 10;

  // Common saturated patterns
  const saturatedPatterns = [
    /how to (make money|lose weight|start|learn|be)/i,
    /best (way|apps|tools|software)/i,
    /beginner('s)? guide/i,
    /\b(python|javascript|react|tutorial)\b$/i, // Generic tech terms alone
  ];
  for (const pattern of saturatedPatterns) {
    if (pattern.test(topic)) {
      supply += 20;
      break;
    }
  }

  return Math.max(10, Math.min(90, supply));
}

// Calculate momentum with RECENCY DECAY
// Fresh posts get boosted, stale posts get penalized
function calculateMomentumWithRecency(
  score: number,
  comments: number,
  createdAt: number
): number {
  // Base momentum from engagement
  const baseMomentum = Math.min(50, Math.log10(score + 1) * 25);
  const commentBonus = Math.min(25, comments / 5);

  // Recency decay: 1 / sqrt(hours_since_post)
  const nowSeconds = Date.now() / 1000;
  const hoursSincePost = Math.max(0.5, (nowSeconds - createdAt) / 3600);

  // Fresh posts (< 2 hours) get up to 1.4x boost
  // Old posts (> 24 hours) get penalized down to 0.5x
  const recencyMultiplier = Math.min(1.4, 1 / Math.sqrt(hoursSincePost / 2));

  const momentum = Math.round((baseMomentum + commentBonus) * recencyMultiplier);
  return Math.min(100, Math.max(10, momentum));
}

// STAGE 2: Check YouTube supply for a topic (uses API quota)
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
    createdAt: number;
  }> = [];

  try {
    // Try both rising and hot - rising catches emerging trends
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
            createdAt: p.created_utc || Date.now() / 1000,
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
    createdAt: number;
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
          createdAt: item.time || Date.now() / 1000,
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
    // ========== STEP 1: Collect posts from all sources ==========
    console.log('Step 1: Collecting posts...');
    const allPosts: Array<{
      title: string;
      url: string;
      score: number;
      comments: number;
      platform: string;
      category: string;
      createdAt: number;
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

    // ========== STEP 2: AI extraction ==========
    console.log('Step 2: Extracting video ideas with AI...');
    const videoIdeas = await extractVideoIdeasWithAI(allPosts);
    console.log(`AI extracted ${videoIdeas.length} video ideas`);

    if (videoIdeas.length === 0) {
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

    // ========== STAGE 1: Heuristic scoring (NO YouTube API) ==========
    console.log('Stage 1: Calculating heuristic scores...');
    for (const idea of videoIdeas) {
      // Calculate momentum with recency decay
      idea.momentum = calculateMomentumWithRecency(
        idea.sourceScore,
        idea.sourceComments,
        idea.sourceCreatedAt || Date.now() / 1000
      );

      // Estimate supply heuristically (no API call)
      idea.heuristicSupply = estimateHeuristicSupply(idea.topic, idea.contentType);

      // Calculate initial gap score
      idea.initialGap = Math.round(idea.momentum * (1 - idea.heuristicSupply / 100) * 10) / 10;
    }

    // Sort by initial gap score (highest first)
    videoIdeas.sort((a, b) => (b.initialGap || 0) - (a.initialGap || 0));

    console.log(`Stage 1 complete. Top idea: "${videoIdeas[0]?.topic}" (gap: ${videoIdeas[0]?.initialGap})`);

    // ========== STAGE 2: YouTube API verification (TOP 15 ONLY) ==========
    const TOP_N = 15; // Only verify top 15 to save API quota
    const topIdeas = videoIdeas.slice(0, TOP_N);

    console.log(`Stage 2: Verifying top ${topIdeas.length} ideas with YouTube API...`);

    for (const idea of topIdeas) {
      const { supply } = await getYouTubeSupply(idea.topic);
      idea.verifiedSupply = supply;
      idea.finalGap = Math.round((idea.momentum || 50) * (1 - supply / 100) * 10) / 10;
      await new Promise((r) => setTimeout(r, 150)); // Rate limit YouTube API
    }

    // Re-sort by FINAL gap score (verified supply)
    topIdeas.sort((a, b) => (b.finalGap || 0) - (a.finalGap || 0));

    console.log(`Stage 2 complete. Top verified: "${topIdeas[0]?.topic}" (gap: ${topIdeas[0]?.finalGap})`);

    // ========== STEP 3: Save to database ==========
    console.log('Step 3: Saving opportunities to database...');
    let opportunitiesCreated = 0;
    let topicsUpdated = 0;

    for (const idea of topIdeas) {
      try {
        const momentum = idea.momentum || 50;
        const supply = idea.verifiedSupply ?? idea.heuristicSupply ?? 50;
        const gap = idea.finalGap ?? idea.initialGap ?? 0;

        // Determine phase
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

        // Determine confidence (higher if we verified with YouTube)
        const isVerified = idea.verifiedSupply !== undefined;
        const confidence =
          isVerified && momentum >= 60 && supply < 40
            ? 'high'
            : isVerified && momentum >= 40
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
              heuristic_supply: idea.heuristicSupply,
              verified_supply: idea.verifiedSupply,
            },
          },
          { onConflict: 'topic_id,source,source_url' }
        );

        // Add signal with momentum
        await supabase.from('topic_signals').insert({
          topic_id: topicId,
          momentum_score: momentum,
          reddit_total_score: idea.sourcePlatform === 'reddit' ? idea.sourceScore : null,
          hn_total_score: idea.sourcePlatform === 'hackernews' ? idea.sourceScore : null,
        });

        // Get previous gap score for velocity tracking
        const { data: existingOpp } = await supabase
          .from('opportunities')
          .select('id, gap_score')
          .eq('topic_id', topicId)
          .single();

        const previousGap = existingOpp?.gap_score || null;

        const oppData = {
          topic_id: topicId,
          keyword: idea.videoTitle,
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
          // Log velocity if score changed significantly
          if (previousGap !== null && Math.abs(gap - previousGap) > 5) {
            console.log(`Velocity alert: "${idea.topic}" gap changed ${previousGap} -> ${gap}`);
          }
        } else {
          await supabase.from('opportunities').insert(oppData);
          opportunitiesCreated++;
        }

        topicsUpdated++;
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
        ai_ideas_extracted: videoIdeas.length,
        youtube_verified: topIdeas.length,
        topics_updated: topicsUpdated,
        opportunities_created: opportunitiesCreated,
        duration_seconds: duration,
        top_opportunity: topIdeas[0] ? {
          topic: topIdeas[0].topic,
          title: topIdeas[0].videoTitle,
          gap: topIdeas[0].finalGap,
          supply: topIdeas[0].verifiedSupply,
          momentum: topIdeas[0].momentum,
        } : null,
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
