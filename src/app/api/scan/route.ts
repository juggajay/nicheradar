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

// GIGA_TOPICS: Automatically saturated (Supply: 100)
// These are so massive that no small creator can compete
const GIGA_TOPICS = new Set([
  // Languages
  'python', 'javascript', 'java', 'typescript', 'rust', 'go', 'golang', 'swift',
  'kotlin', 'ruby', 'php', 'c++', 'c#', 'scala', 'perl', 'r', 'matlab',
  // Frameworks (generic)
  'react', 'angular', 'vue', 'node', 'nodejs', 'django', 'flask', 'rails',
  'spring', 'express', 'nextjs', 'next.js', 'laravel', 'dotnet', '.net',
  // Big Tech
  'google', 'apple', 'microsoft', 'amazon', 'meta', 'facebook', 'netflix',
  'openai', 'nvidia', 'intel', 'amd', 'tesla', 'spacex', 'twitter', 'x',
  // Platforms
  'android', 'ios', 'windows', 'linux', 'macos', 'ubuntu', 'docker', 'kubernetes',
  'aws', 'azure', 'gcp', 'heroku', 'vercel', 'netlify',
  // Mega sites
  'stackoverflow', 'stack overflow', 'github', 'gitlab', 'reddit', 'hackernews',
  'hacker news', 'youtube', 'twitch', 'discord', 'slack', 'notion',
  // Generic saturated terms
  'programming', 'coding', 'software', 'web development', 'machine learning',
  'artificial intelligence', 'ai', 'ml', 'data science', 'blockchain', 'crypto',
  'bitcoin', 'ethereum', 'nft', 'startup', 'saas', 'api', 'database', 'sql',
]);

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

  const prompt = `You are a YouTube content strategist finding NICHE opportunities. Extract SPECIFIC topics that a small creator could rank for.

CRITICAL RULES FOR TOPICS:
1. Topic must be 1-4 words MAX (e.g., "Xr0 Verifier", "DeepSeek R1", "Cursor IDE")
2. Topic must be a PROPER NOUN (product name, tool name, specific technology)
3. NEVER use generic terms alone: Python, JavaScript, React, AI, Docker, Linux, etc.
4. NEVER include sentence fragments like "interface for the" or "the best way to"
5. If the post is about a SPECIFIC TOOL/PRODUCT, extract JUST that name

SKIP posts that are:
- About massive topics (Google, Apple, Python, JavaScript, React, Docker)
- Generic advice ("how to learn coding", "best practices")
- Company news/drama without educational angle
- Too vague to make a focused video

For GOOD posts, extract:
- topic: The SPECIFIC product/tool name (1-4 words, capitalized)
- videoTitle: A clickable YouTube title (under 60 chars)
- contentType: tutorial | news | comparison | review | explainer | howto
- sourceIndex: The post number

POSTS:
${titlesText}

Respond with ONLY a JSON array. Examples of GOOD extractions:
[
  {"topic": "Xr0 Verifier", "videoTitle": "Xr0 Verifier: Memory Safety in C Without Rewrites", "contentType": "explainer", "sourceIndex": 1},
  {"topic": "DeepSeek R1", "videoTitle": "DeepSeek R1 vs GPT-4: Open Source Wins?", "contentType": "comparison", "sourceIndex": 3},
  {"topic": "Cursor IDE", "videoTitle": "I Coded for 30 Days with Cursor IDE", "contentType": "review", "sourceIndex": 5}
]

Examples of BAD extractions (DO NOT DO THIS):
- {"topic": "Python"} - TOO GENERIC
- {"topic": "interface for the"} - FRAGMENT
- {"topic": "Xr0 Verifier: Guaranteeing Memory Safety..."} - TOO LONG, use just "Xr0 Verifier"

If no posts have SPECIFIC, niche-worthy topics, return: []`;

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

    // Map back to full VideoIdea objects with validation
    return ideas
      .filter((idea) => idea.sourceIndex > 0 && idea.sourceIndex <= posts.length)
      .map((idea) => {
        const source = posts[idea.sourceIndex - 1];
        // Clean up topic (extract product name from full titles)
        const cleanedTopic = cleanupTopic(idea.topic);
        return {
          topic: cleanedTopic,
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
      })
      // VALIDATION: Filter out garbage topics
      .filter((idea) => {
        // Check if topic is valid
        if (!isValidTopic(idea.topic)) {
          console.log(`Rejected invalid topic: "${idea.topic}"`);
          return false;
        }
        // Check if it's a GIGA_TOPIC (will be marked saturated anyway, but skip entirely)
        if (isGigaTopic(idea.topic)) {
          console.log(`Rejected GIGA_TOPIC: "${idea.topic}"`);
          return false;
        }
        return true;
      });
  } catch (e) {
    console.error('Gemini extraction error:', e);
    return [];
  }
}

// Check if topic is a GIGA_TOPIC (auto-saturated)
function isGigaTopic(topic: string): boolean {
  const normalized = topic.toLowerCase().trim();
  // Direct match
  if (GIGA_TOPICS.has(normalized)) return true;
  // Check if topic IS just a giga topic (e.g., "Swift" or "Python tutorial")
  for (const giga of GIGA_TOPICS) {
    if (normalized === giga || normalized === `${giga} tutorial` || normalized === `${giga} guide`) {
      return true;
    }
  }
  return false;
}

// Clean up topic - extract actual product name from full titles
function cleanupTopic(topic: string): string {
  let cleaned = topic.trim();

  // If contains colon, take only the part before it (e.g., "MyTorch: Autograd..." -> "MyTorch")
  if (cleaned.includes(':')) {
    const beforeColon = cleaned.split(':')[0].trim();
    if (beforeColon.length >= 3 && beforeColon.split(/\s+/).length <= 4) {
      cleaned = beforeColon;
    }
  }

  // If contains dash with long text after, take before (e.g., "Jujutsu - A Git-compatible VCS" -> "Jujutsu")
  if (cleaned.includes(' - ') || cleaned.includes(' – ')) {
    const beforeDash = cleaned.split(/\s[-–]\s/)[0].trim();
    if (beforeDash.length >= 3 && beforeDash.split(/\s+/).length <= 4) {
      cleaned = beforeDash;
    }
  }

  // Remove trailing version numbers (e.g., "React 19" -> "React 19" is ok, but "v1.0.0" patterns)
  cleaned = cleaned.replace(/\s+v?\d+\.\d+(\.\d+)?$/i, '');

  return cleaned;
}

// Validate topic quality - reject garbage
function isValidTopic(topic: string): boolean {
  if (!topic || topic.length < 3) return false;

  // Reject if too long in characters (full titles)
  if (topic.length > 40) return false;

  // Reject if too many words (should be 1-4 words)
  if (topic.split(/\s+/).length > 4) return false;

  // Reject if contains colon followed by text (full title pattern like "MyTorch: Autograd in...")
  if (/:.{5,}/.test(topic)) return false;

  // Reject if ends with connector words (fragments)
  if (/\s+(for|the|and|or|to|a|an|in|on|with|of|is|are|was|were)$/i.test(topic)) return false;

  // Reject if starts with connector words
  if (/^(the|a|an|and|or|but|for|to|in|on)\s+/i.test(topic)) return false;

  // Reject if it's mostly lowercase (not a proper noun/product)
  const words = topic.split(/\s+/);
  const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
  if (words.length > 1 && capitalizedWords.length === 0) return false;

  // Reject common garbage patterns
  const garbagePatterns = [
    /^(how|what|why|when|where|who)\s+/i, // Questions (not topics)
    /^(this|that|these|those)\s+/i,
    /^(my|your|our|their)\s+/i,
    /\.\.\./,  // Truncated titles
    /^\d+\s+/,  // Starts with number
    /\d+\s+(lines|ways|tips|steps|things)/i, // "450 lines of", "10 ways to"
  ];
  for (const pattern of garbagePatterns) {
    if (pattern.test(topic)) return false;
  }

  return true;
}

// STAGE 1: Heuristic supply estimation (no API calls)
function estimateHeuristicSupply(topic: string, contentType: string): number {
  // INSTANT KILL: If it's a GIGA_TOPIC, supply is maxed
  if (isGigaTopic(topic)) {
    return 100; // Fully saturated, no opportunity
  }

  let supply = 50; // Default medium

  // Very specific topics = lower supply
  const wordCount = topic.split(/\s+/).length;
  if (wordCount >= 4) supply -= 15;
  else if (wordCount >= 3) supply -= 10;
  else if (wordCount === 1) supply += 15; // Single words are usually saturated

  // Version numbers indicate specificity (React 19, GPT-4o)
  if (/\d+(\.\d+)?/.test(topic)) supply -= 20;

  // Comparison videos ("X vs Y") often have gaps
  if (/\bvs\.?\b/i.test(topic)) supply -= 15;

  // Tutorials for specific tools tend to have lower supply
  if (contentType === 'tutorial' && wordCount >= 2) supply -= 10;

  // Proper nouns (capitalized) are more specific
  const properNouns = topic.match(/\b[A-Z][a-z]+\b/g) || [];
  if (properNouns.length >= 2) supply -= 10;

  // Check for partial GIGA_TOPIC matches (e.g., "Python Flask" still has Python)
  const topicLower = topic.toLowerCase();
  for (const giga of GIGA_TOPICS) {
    if (topicLower.includes(giga) && topicLower !== giga) {
      // Contains a giga topic but isn't JUST that topic
      // e.g., "React Native Navigation" - still competitive
      supply += 15;
      break;
    }
  }

  // Common saturated patterns
  const saturatedPatterns = [
    /how to (make money|lose weight|start|learn|be|get)/i,
    /best (way|apps|tools|software|practices)/i,
    /beginner('s)? guide/i,
    /complete guide/i,
    /tutorial$/i, // Ends in just "tutorial"
  ];
  for (const pattern of saturatedPatterns) {
    if (pattern.test(topic)) {
      supply += 20;
      break;
    }
  }

  return Math.max(10, Math.min(100, supply));
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
          keyword: idea.topic,
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
