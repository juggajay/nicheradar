# Niche Radar - Product Requirements Document

## Executive Summary

Niche Radar is a trend detection and YouTube opportunity analysis tool that monitors external platforms (Reddit, Google Trends, Hacker News, Wikipedia) to identify trending topics BEFORE they become saturated on YouTube. The tool cross-references external momentum against YouTube content supply to surface first-mover opportunities for content creators.

**Core Value Proposition:** Find trending topics where demand is high but YouTube supply is low.

---

## Table of Contents

1. [Product Goals](#1-product-goals)
2. [User Stories](#2-user-stories)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [Data Collectors](#5-data-collectors)
6. [Scoring Algorithms](#6-scoring-algorithms)
7. [API Specifications](#7-api-specifications)
8. [Frontend Requirements](#8-frontend-requirements)
9. [Configuration](#9-configuration)
10. [Build Phases](#10-build-phases)
11. [Environment Variables](#11-environment-variables)
12. [Error Handling](#12-error-handling)
13. [Testing Requirements](#13-testing-requirements)

---

## 1. Product Goals

### Primary Goals

1. **Detect emerging trends** from external platforms before YouTube saturation
2. **Quantify opportunity** by calculating gap between external demand and YouTube supply
3. **Classify trend phase** (Innovation, Emergence, Growth, Maturity, Saturated)
4. **Track opportunities over time** to identify optimal entry windows

### Success Metrics

- Surface opportunities with Gap Score > 70 at least 2 weeks before mainstream YouTube coverage
- Achieve < 20% false positive rate (trends that don't materialise)
- Process all data sources within 15-minute scan window

### Non-Goals (Out of Scope for V1)

- Multi-user authentication/accounts
- Paid tier or monetisation
- Mobile app
- Browser extension
- Automated video creation suggestions
- RPM/monetisation estimation (deferred to V2)

---

## 2. User Stories

### 2.1 Radar Feed (Primary Use Case)

**As a** content creator
**I want to** see a ranked list of trending topics with low YouTube competition
**So that** I can identify first-mover content opportunities

**Acceptance Criteria:**
- Dashboard displays opportunities sorted by Gap Score (descending)
- Each opportunity shows: keyword, sources detected, external momentum score, YouTube supply score, phase classification, confidence level
- Can filter by: category, phase, confidence, date range
- Can sort by: gap score, recency, external momentum
- Updates automatically when new scan completes

### 2.2 Deep Dive Analysis

**As a** content creator
**I want to** drill into a specific opportunity to see underlying data
**So that** I can validate the opportunity before committing to content creation

**Acceptance Criteria:**
- Shows source links (Reddit posts, HN threads, Google Trends chart)
- Shows YouTube search results with: video title, channel name, subscriber count, view count, publish date, VPS ratio
- Shows trend velocity chart (momentum over last 7/14/30 days)
- Highlights outlier videos (small channels with disproportionate views)
- Shows "supply gap" indicator (how well current videos match search intent)

### 2.3 Watchlist

**As a** content creator
**I want to** save interesting opportunities and track them over time
**So that** I can monitor trends and act at the optimal moment

**Acceptance Criteria:**
- Can add/remove topics from watchlist
- Watchlist shows trend direction (↑ improving, → stable, ↓ declining)
- Can add personal notes to watched topics
- Visual indicator if a large channel (>100k subs) enters the space

### 2.4 Keyword Scanner (Manual Analysis)

**As a** content creator
**I want to** analyse a specific keyword I'm curious about
**So that** I can validate my hunches about potential niches

**Acceptance Criteria:**
- Input field to enter any keyword
- Runs full analysis pipeline on-demand
- Returns: YouTube supply analysis, any external signals found, phase classification, gap score
- Option to add to watchlist after analysis

### 2.5 Discovery Mode

**As a** content creator
**I want to** explore sub-niches within a broad category
**So that** I can find opportunities I wouldn't have thought to search for

**Acceptance Criteria:**
- Input a seed keyword (e.g., "gardening")
- System expands via YouTube autocomplete to find 50-100 related searches
- Batch analyses all sub-niches
- Returns ranked list of opportunities within that category

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VERCEL                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Next.js 14 (App Router)                    │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │  │
│  │  │  Dashboard  │ │  Deep Dive  │ │  Manual Keyword Scanner │  │  │
│  │  │    Page     │ │    Page     │ │         Page            │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                    API Routes                           │  │  │
│  │  │  /api/opportunities  /api/analyse  /api/watchlist       │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      PostgreSQL                               │  │
│  │  topics │ topic_signals │ youtube_supply │ opportunities      │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                         RAILWAY                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Python Worker Service                       │  │
│  │                                                               │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │  │
│  │  │   Reddit    │ │   Google    │ │  Hacker     │             │  │
│  │  │  Collector  │ │   Trends    │ │   News      │             │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘             │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │  │
│  │  │  Wikipedia  │ │   YouTube   │ │   Scorer    │             │  │
│  │  │  Collector  │ │   Checker   │ │   Engine    │             │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘             │  │
│  │                                                               │  │
│  │  Cron: Every 6 hours (0 */6 * * *)                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| Frontend | Next.js 14 (App Router) | Server components, API routes, Vercel deployment |
| Styling | Tailwind CSS | Rapid UI development |
| UI Components | shadcn/ui | Pre-built, customisable components |
| Database | Supabase (PostgreSQL) | Free tier, good DX, realtime subscriptions |
| DB Client | Supabase JS SDK (frontend), supabase-py (workers) | Native SDKs |
| Workers | Python 3.11 | Best library support for data collection |
| Worker Host | Railway | Cron support, long-running processes |
| Charts | Recharts | React-native, good for time series |

### 3.3 Data Flow

```
1. COLLECTION (Every 6 hours)
   ├── Reddit Collector → Scans configured subreddits for rising posts
   ├── HackerNews Collector → Scans front page and rising
   ├── Google Trends Collector → Pulls breakout queries for seed terms
   └── Wikipedia Collector → Checks pageview velocity for known topics

2. PROCESSING
   ├── Entity Extraction → Extracts searchable keywords from collected items
   ├── Deduplication → Merges same topic from multiple sources
   └── Categorisation → Auto-tags topics by niche category

3. YOUTUBE CROSS-REFERENCE
   ├── For each new/updated topic:
   │   ├── Search YouTube API for keyword
   │   ├── Batch fetch video statistics
   │   ├── Batch fetch channel statistics
   │   └── Calculate supply metrics

4. SCORING
   ├── Calculate external momentum score (0-100)
   ├── Calculate YouTube supply score (0-100, lower = better)
   ├── Calculate gap score (momentum / supply normalised)
   ├── Classify phase (Innovation/Emergence/Growth/Maturity/Saturated)
   └── Assign confidence level (High/Medium/Low)

5. STORAGE
   └── Upsert to opportunities table
```

---

## 4. Database Schema

### 4.1 Complete Schema (Supabase/PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TOPICS: Unique trending topics detected
-- ============================================
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT NOT NULL,
    keyword_normalised TEXT NOT NULL, -- lowercase, trimmed for dedup
    category TEXT DEFAULT 'uncategorised',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_keyword UNIQUE(keyword_normalised)
);

CREATE INDEX idx_topics_category ON topics(category);
CREATE INDEX idx_topics_last_seen ON topics(last_seen_at DESC);
CREATE INDEX idx_topics_active ON topics(is_active) WHERE is_active = TRUE;

-- ============================================
-- TOPIC_SOURCES: Which platforms detected this topic
-- ============================================
CREATE TABLE topic_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'reddit', 'hackernews', 'google_trends', 'wikipedia'
    source_url TEXT,
    source_title TEXT,
    source_metadata JSONB DEFAULT '{}', -- flexible storage for source-specific data
    detected_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_topic_source_url UNIQUE(topic_id, source, source_url)
);

CREATE INDEX idx_topic_sources_topic ON topic_sources(topic_id);
CREATE INDEX idx_topic_sources_source ON topic_sources(source);

-- ============================================
-- TOPIC_SIGNALS: Time-series momentum data
-- ============================================
CREATE TABLE topic_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Reddit metrics (nullable - not all topics from Reddit)
    reddit_total_score INT,
    reddit_total_comments INT,
    reddit_post_count INT,

    -- Hacker News metrics
    hn_total_score INT,
    hn_post_count INT,

    -- Google Trends (0-100 scale)
    google_trends_value INT,
    google_trends_is_breakout BOOLEAN DEFAULT FALSE,

    -- Wikipedia daily pageviews
    wikipedia_views INT,
    wikipedia_views_change_pct FLOAT, -- vs 7 days ago

    -- Calculated aggregate momentum
    momentum_score FLOAT, -- normalised 0-100
    velocity FLOAT -- change from previous signal
);

CREATE INDEX idx_topic_signals_topic ON topic_signals(topic_id);
CREATE INDEX idx_topic_signals_recorded ON topic_signals(recorded_at DESC);

-- ============================================
-- YOUTUBE_SUPPLY: YouTube competition analysis
-- ============================================
CREATE TABLE youtube_supply (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ DEFAULT NOW(),

    -- Search results overview
    total_results INT,
    results_last_7_days INT,
    results_last_30_days INT,
    results_last_90_days INT,

    -- Content quality signals
    avg_video_age_days FLOAT,
    median_video_age_days FLOAT,
    title_match_ratio FLOAT, -- 0-1, how many titles contain the keyword

    -- Competition analysis
    avg_channel_subscribers INT,
    median_channel_subscribers INT,
    large_channel_count INT, -- channels > 100k subs in top 20
    small_channel_count INT, -- channels < 10k subs in top 20

    -- Outlier detection (emergence signal)
    outlier_videos JSONB DEFAULT '[]', -- array of {video_id, title, views, subs, vps_ratio}
    outlier_count INT DEFAULT 0,

    -- Top results snapshot for deep dive
    top_results JSONB DEFAULT '[]', -- array of top 10 videos with full details

    -- Calculated supply score (lower = less competition = better)
    supply_score FLOAT -- normalised 0-100
);

CREATE INDEX idx_youtube_supply_topic ON youtube_supply(topic_id);
CREATE INDEX idx_youtube_supply_checked ON youtube_supply(checked_at DESC);

-- ============================================
-- OPPORTUNITIES: The money table - scored opportunities
-- ============================================
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Scores
    external_momentum FLOAT NOT NULL, -- 0-100
    youtube_supply FLOAT NOT NULL, -- 0-100 (lower = better)
    gap_score FLOAT NOT NULL, -- the key metric

    -- Classification
    phase TEXT NOT NULL, -- 'innovation', 'emergence', 'growth', 'maturity', 'saturated'
    confidence TEXT NOT NULL, -- 'high', 'medium', 'low'

    -- Tracking
    is_watched BOOLEAN DEFAULT FALSE,
    notes TEXT,

    -- Alerts
    big_channel_entered BOOLEAN DEFAULT FALSE,
    big_channel_entered_at TIMESTAMPTZ,

    -- Denormalised for query performance
    keyword TEXT NOT NULL,
    category TEXT,
    sources TEXT[], -- array of source names for filtering

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_gap ON opportunities(gap_score DESC);
CREATE INDEX idx_opportunities_phase ON opportunities(phase);
CREATE INDEX idx_opportunities_confidence ON opportunities(confidence);
CREATE INDEX idx_opportunities_category ON opportunities(category);
CREATE INDEX idx_opportunities_watched ON opportunities(is_watched) WHERE is_watched = TRUE;
CREATE INDEX idx_opportunities_recent ON opportunities(calculated_at DESC);

-- Unique constraint: one active opportunity per topic
CREATE UNIQUE INDEX idx_opportunities_topic_unique ON opportunities(topic_id);

-- ============================================
-- SCAN_LOG: Track worker runs
-- ============================================
CREATE TABLE scan_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'

    -- Metrics
    topics_detected INT DEFAULT 0,
    topics_updated INT DEFAULT 0,
    youtube_checks INT DEFAULT 0,
    opportunities_created INT DEFAULT 0,

    -- Error tracking
    errors JSONB DEFAULT '[]',

    -- Performance
    duration_seconds INT
);

CREATE INDEX idx_scan_log_status ON scan_log(status);
CREATE INDEX idx_scan_log_started ON scan_log(started_at DESC);

-- ============================================
-- SEED_KEYWORDS: Configured keywords for Google Trends monitoring
-- ============================================
CREATE TABLE seed_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBREDDIT_CONFIG: Configured subreddits to monitor
-- ============================================
CREATE TABLE subreddit_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subreddit TEXT NOT NULL UNIQUE,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    min_score INT DEFAULT 50, -- minimum upvotes to consider
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER topics_updated_at
    BEFORE UPDATE ON topics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA: Default subreddits and keywords
-- ============================================

-- Popular subreddits across categories
INSERT INTO subreddit_config (subreddit, category, min_score) VALUES
-- Technology
('technology', 'tech', 100),
('programming', 'tech', 75),
('webdev', 'tech', 50),
('machinelearning', 'tech', 50),
('LocalLLaMA', 'tech', 30),
('selfhosted', 'tech', 50),
-- Finance
('personalfinance', 'finance', 100),
('investing', 'finance', 75),
('stocks', 'finance', 50),
('cryptocurrency', 'finance', 100),
-- Business
('Entrepreneur', 'business', 50),
('smallbusiness', 'business', 50),
('SaaS', 'business', 30),
-- Health & Fitness
('fitness', 'health', 100),
('nutrition', 'health', 50),
('loseit', 'health', 75),
-- Home & DIY
('DIY', 'diy', 100),
('HomeImprovement', 'diy', 75),
('gardening', 'diy', 50),
-- Gaming
('gaming', 'gaming', 200),
('pcgaming', 'gaming', 100),
('Games', 'gaming', 100),
-- Education & Productivity
('productivity', 'productivity', 50),
('learnprogramming', 'education', 50),
('GetStudying', 'education', 30),
-- Lifestyle
('minimalism', 'lifestyle', 50),
('simpleliving', 'lifestyle', 30),
('BuyItForLife', 'lifestyle', 75)
ON CONFLICT (subreddit) DO NOTHING;

-- Seed keywords for Google Trends monitoring
INSERT INTO seed_keywords (keyword, category) VALUES
-- Tech
('artificial intelligence', 'tech'),
('machine learning', 'tech'),
('programming', 'tech'),
('software', 'tech'),
('cybersecurity', 'tech'),
('cloud computing', 'tech'),
('automation', 'tech'),
-- Finance
('investing', 'finance'),
('cryptocurrency', 'finance'),
('stock market', 'finance'),
('personal finance', 'finance'),
('real estate', 'finance'),
-- Health
('weight loss', 'health'),
('fitness', 'health'),
('mental health', 'health'),
('nutrition', 'health'),
('supplements', 'health'),
-- Business
('entrepreneurship', 'business'),
('marketing', 'business'),
('ecommerce', 'business'),
('passive income', 'business'),
('side hustle', 'business'),
-- DIY/Home
('home improvement', 'diy'),
('gardening', 'diy'),
('woodworking', 'diy'),
('organization', 'diy'),
-- Productivity
('productivity', 'productivity'),
('time management', 'productivity'),
('note taking', 'productivity'),
-- Gaming
('gaming', 'gaming'),
('video games', 'gaming'),
-- Education
('online learning', 'education'),
('study tips', 'education'),
('career', 'education')
ON CONFLICT (keyword) DO NOTHING;
```

### 4.2 Key Queries

```sql
-- Get top opportunities for dashboard
SELECT
    o.*,
    t.first_seen_at,
    t.last_seen_at,
    (SELECT COUNT(*) FROM topic_sources ts WHERE ts.topic_id = o.topic_id) as source_count
FROM opportunities o
JOIN topics t ON t.id = o.topic_id
WHERE o.gap_score >= 50
ORDER BY o.gap_score DESC
LIMIT 50;

-- Get opportunity with full details for deep dive
SELECT
    o.*,
    t.*,
    ys.top_results,
    ys.outlier_videos,
    ys.title_match_ratio,
    (
        SELECT json_agg(ts.*)
        FROM topic_sources ts
        WHERE ts.topic_id = o.topic_id
    ) as sources,
    (
        SELECT json_agg(sig.* ORDER BY sig.recorded_at DESC)
        FROM topic_signals sig
        WHERE sig.topic_id = o.topic_id
        AND sig.recorded_at > NOW() - INTERVAL '30 days'
    ) as signal_history
FROM opportunities o
JOIN topics t ON t.id = o.topic_id
LEFT JOIN youtube_supply ys ON ys.topic_id = o.topic_id
WHERE o.id = $1;

-- Get watchlist with trend direction
WITH recent_scores AS (
    SELECT
        topic_id,
        gap_score,
        calculated_at,
        LAG(gap_score) OVER (PARTITION BY topic_id ORDER BY calculated_at) as prev_gap_score
    FROM opportunities
    WHERE is_watched = TRUE
)
SELECT
    o.*,
    CASE
        WHEN rs.gap_score > rs.prev_gap_score * 1.1 THEN 'up'
        WHEN rs.gap_score < rs.prev_gap_score * 0.9 THEN 'down'
        ELSE 'stable'
    END as trend_direction
FROM opportunities o
JOIN recent_scores rs ON rs.topic_id = o.topic_id
WHERE o.is_watched = TRUE
ORDER BY o.gap_score DESC;
```

---

## 5. Data Collectors

### 5.1 Reddit Collector

**Purpose:** Detect trending topics from rising posts across configured subreddits.

**Library:** `praw` (Python Reddit API Wrapper)

**Configuration:**
- Subreddits: Loaded from `subreddit_config` table
- Sort: `rising` and `hot` (top 25 from each)
- Minimum score threshold: Per-subreddit config (default 50)
- Post age filter: < 48 hours

**Logic:**
```python
def collect_reddit():
    """
    Collect rising posts from configured subreddits.
    Returns list of detected topics with metadata.
    """
    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent="NicheRadar/1.0"
    )

    subreddits = get_active_subreddits()  # from DB
    detected_topics = []

    for config in subreddits:
        subreddit = reddit.subreddit(config.subreddit)

        # Get rising posts
        for post in subreddit.rising(limit=25):
            if post.score >= config.min_score:
                # Extract potential keywords from title
                keywords = extract_keywords(post.title)

                for keyword in keywords:
                    detected_topics.append({
                        'keyword': keyword,
                        'source': 'reddit',
                        'source_url': f"https://reddit.com{post.permalink}",
                        'source_title': post.title,
                        'source_metadata': {
                            'subreddit': config.subreddit,
                            'score': post.score,
                            'num_comments': post.num_comments,
                            'created_utc': post.created_utc
                        },
                        'category': config.category
                    })

        # Also check hot for sustained trends
        for post in subreddit.hot(limit=25):
            # Similar logic...
            pass

    return detected_topics
```

**Keyword Extraction Rules:**
1. Extract noun phrases from title (2-4 words)
2. Look for quoted terms, product names, proper nouns
3. Filter out common words, subreddit names, meta terms
4. Normalise: lowercase, strip punctuation, collapse whitespace

### 5.2 Hacker News Collector

**Purpose:** Detect tech/startup trends from HN front page and rising stories.

**Library:** `requests` (HN has a simple REST API)

**API Endpoints:**
- `https://hacker-news.firebaseio.com/v0/topstories.json`
- `https://hacker-news.firebaseio.com/v0/newstories.json`
- `https://hacker-news.firebaseio.com/v0/item/{id}.json`

**Configuration:**
- Top stories: 30
- New stories: 50 (filter by score > 20)
- Story age filter: < 72 hours

**Logic:**
```python
def collect_hackernews():
    """
    Collect trending stories from Hacker News.
    """
    detected_topics = []

    # Get top story IDs
    top_ids = requests.get(HN_TOP_URL).json()[:30]

    for story_id in top_ids:
        story = requests.get(f"{HN_ITEM_URL}/{story_id}.json").json()

        if story.get('type') != 'story':
            continue

        if story.get('score', 0) < 50:
            continue

        title = story.get('title', '')
        keywords = extract_keywords(title)

        # Also check URL domain for product names
        url = story.get('url', '')
        if url:
            domain_keyword = extract_domain_keyword(url)
            if domain_keyword:
                keywords.append(domain_keyword)

        for keyword in keywords:
            detected_topics.append({
                'keyword': keyword,
                'source': 'hackernews',
                'source_url': f"https://news.ycombinator.com/item?id={story_id}",
                'source_title': title,
                'source_metadata': {
                    'score': story.get('score'),
                    'descendants': story.get('descendants', 0),  # comment count
                    'time': story.get('time')
                },
                'category': 'tech'
            })

    return detected_topics
```

### 5.3 Google Trends Collector

**Purpose:** Detect breakout search terms and validate trend momentum.

**Library:** `pytrends`

**Configuration:**
- Seed keywords: Loaded from `seed_keywords` table
- Timeframe: 'today 1-m' (last 30 days)
- Geographic: '' (worldwide) or 'AU' (configurable)

**Logic:**
```python
def collect_google_trends():
    """
    Get breakout/rising related queries for seed keywords.
    """
    from pytrends.request import TrendReq

    pytrends = TrendReq(hl='en-US', tz=360)
    detected_topics = []

    seed_keywords = get_active_seed_keywords()  # from DB

    for seed in seed_keywords:
        try:
            pytrends.build_payload([seed.keyword], timeframe='today 1-m')

            # Get related queries
            related = pytrends.related_queries()

            if seed.keyword in related:
                rising = related[seed.keyword].get('rising')

                if rising is not None and not rising.empty:
                    for _, row in rising.iterrows():
                        query = row['query']
                        value = row['value']  # % increase or "Breakout"

                        is_breakout = value == 'Breakout' or (isinstance(value, int) and value > 500)

                        if is_breakout or value > 200:
                            detected_topics.append({
                                'keyword': query,
                                'source': 'google_trends',
                                'source_url': f"https://trends.google.com/trends/explore?q={quote(query)}",
                                'source_title': f"Rising query for '{seed.keyword}'",
                                'source_metadata': {
                                    'seed_keyword': seed.keyword,
                                    'trend_value': str(value),
                                    'is_breakout': is_breakout
                                },
                                'category': seed.category
                            })

            # Rate limiting - pytrends gets blocked easily
            time.sleep(2)

        except Exception as e:
            log_error('google_trends', seed.keyword, str(e))
            continue

    return detected_topics
```

**Fallback for pytrends failures:**
If pytrends is blocked, skip Google Trends collection for this scan cycle. The tool remains useful with other sources.

### 5.4 Wikipedia Pageviews Collector

**Purpose:** Validate mainstream awareness of detected topics.

**Library:** `requests` (Wikimedia REST API)

**API Endpoint:**
```
https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/{title}/daily/{start}/{end}
```

**Configuration:**
- Check topics detected in current scan
- Compare: last 7 days vs previous 7 days
- Velocity threshold: > 50% increase = significant

**Logic:**
```python
def collect_wikipedia_signals(topics: list[str]):
    """
    Check Wikipedia pageview velocity for detected topics.
    Only called for topics already detected by other sources.
    """
    signals = {}

    today = datetime.now()
    week_ago = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)

    for topic in topics:
        # Convert topic to Wikipedia title format
        wiki_title = topic.replace(' ', '_').title()

        try:
            # Get last 7 days
            recent_views = get_pageviews(wiki_title, week_ago, today)

            # Get previous 7 days
            previous_views = get_pageviews(wiki_title, two_weeks_ago, week_ago)

            if previous_views > 0:
                velocity = ((recent_views - previous_views) / previous_views) * 100
            else:
                velocity = 100 if recent_views > 100 else 0

            signals[topic] = {
                'wikipedia_views': recent_views,
                'wikipedia_views_change_pct': velocity
            }

        except Exception:
            # Page doesn't exist or API error - not a problem
            signals[topic] = {
                'wikipedia_views': 0,
                'wikipedia_views_change_pct': 0
            }

    return signals


def get_pageviews(title: str, start: datetime, end: datetime) -> int:
    """Fetch total pageviews for a Wikipedia article in date range."""
    url = (
        f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
        f"en.wikipedia/all-access/all-agents/{quote(title)}/daily/"
        f"{start.strftime('%Y%m%d')}/{end.strftime('%Y%m%d')}"
    )

    response = requests.get(url, headers={'User-Agent': 'NicheRadar/1.0'})

    if response.status_code != 200:
        return 0

    data = response.json()
    total = sum(item['views'] for item in data.get('items', []))
    return total
```

### 5.5 YouTube Supply Checker

**Purpose:** Analyse YouTube competition for each detected topic.

**Library:** `google-api-python-client`

**API Quota Management:**
- Search: 100 units
- Videos.list (batch 50): 1 unit
- Channels.list (batch 50): 1 unit
- Total per keyword: ~102 units
- Daily budget: 10,000 units = ~95 keywords

**Logic:**
```python
def check_youtube_supply(keyword: str) -> dict:
    """
    Analyse YouTube supply/competition for a keyword.
    Uses batching to minimise API quota usage.
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

    # 1. Search for keyword (100 units)
    search_response = youtube.search().list(
        q=keyword,
        part='snippet',
        type='video',
        maxResults=50,
        order='relevance'
    ).execute()

    if not search_response.get('items'):
        return empty_supply_result()

    video_ids = [item['id']['videoId'] for item in search_response['items']]
    channel_ids = list(set(item['snippet']['channelId'] for item in search_response['items']))

    # 2. Batch fetch video stats (1 unit)
    videos_response = youtube.videos().list(
        id=','.join(video_ids),
        part='statistics,snippet'
    ).execute()

    # 3. Batch fetch channel stats (1 unit)
    channels_response = youtube.channels().list(
        id=','.join(channel_ids[:50]),  # Max 50 per request
        part='statistics'
    ).execute()

    # Build channel subscriber lookup
    channel_subs = {}
    for ch in channels_response.get('items', []):
        subs = int(ch['statistics'].get('subscriberCount', 0))
        if ch['statistics'].get('hiddenSubscriberCount'):
            subs = 0
        channel_subs[ch['id']] = subs

    # 4. Analyse results
    now = datetime.now(timezone.utc)
    keyword_lower = keyword.lower()

    videos_data = []
    outliers = []
    title_matches = 0
    ages_days = []
    channel_sizes = []

    for video in videos_response.get('items', []):
        vid_id = video['id']
        title = video['snippet']['title']
        channel_id = video['snippet']['channelId']
        published = datetime.fromisoformat(video['snippet']['publishedAt'].replace('Z', '+00:00'))
        views = int(video['statistics'].get('viewCount', 0))

        age_days = (now - published).days
        subs = channel_subs.get(channel_id, 0)

        # Check title match
        if keyword_lower in title.lower():
            title_matches += 1

        ages_days.append(age_days)
        channel_sizes.append(subs)

        # Calculate VPS ratio
        vps_ratio = views / (subs + 1)

        # Detect outliers: small channel (<10k), high VPS (>5), recent (<90 days)
        if subs < 10000 and vps_ratio > 5 and age_days < 90:
            outliers.append({
                'video_id': vid_id,
                'title': title,
                'views': views,
                'subs': subs,
                'vps_ratio': round(vps_ratio, 2),
                'age_days': age_days
            })

        videos_data.append({
            'video_id': vid_id,
            'title': title,
            'channel_id': channel_id,
            'views': views,
            'subs': subs,
            'age_days': age_days,
            'vps_ratio': round(vps_ratio, 2)
        })

    # 5. Calculate metrics
    total_videos = len(videos_data)

    return {
        'total_results': search_response.get('pageInfo', {}).get('totalResults', 0),
        'results_last_7_days': len([v for v in videos_data if v['age_days'] <= 7]),
        'results_last_30_days': len([v for v in videos_data if v['age_days'] <= 30]),
        'results_last_90_days': len([v for v in videos_data if v['age_days'] <= 90]),
        'avg_video_age_days': sum(ages_days) / len(ages_days) if ages_days else 0,
        'median_video_age_days': sorted(ages_days)[len(ages_days)//2] if ages_days else 0,
        'title_match_ratio': title_matches / total_videos if total_videos else 0,
        'avg_channel_subscribers': sum(channel_sizes) / len(channel_sizes) if channel_sizes else 0,
        'median_channel_subscribers': sorted(channel_sizes)[len(channel_sizes)//2] if channel_sizes else 0,
        'large_channel_count': len([s for s in channel_sizes if s > 100000]),
        'small_channel_count': len([s for s in channel_sizes if s < 10000]),
        'outlier_videos': outliers[:10],  # Top 10 outliers
        'outlier_count': len(outliers),
        'top_results': videos_data[:10]
    }
```

---

## 6. Scoring Algorithms

### 6.1 External Momentum Score (0-100)

Aggregates signals from all external sources into a single momentum score.

```python
def calculate_momentum_score(topic_id: str) -> float:
    """
    Calculate normalised momentum score from external signals.
    Each source contributes 0-25 points (total max 100).
    """
    signals = get_latest_signals(topic_id)
    sources = get_topic_sources(topic_id)

    score = 0

    # Reddit contribution (0-25)
    if signals.reddit_total_score:
        # Log scale: 100 upvotes = 10pts, 1000 = 20pts, 5000+ = 25pts
        reddit_score = min(25, math.log10(signals.reddit_total_score + 1) * 10)
        score += reddit_score

    # Hacker News contribution (0-25)
    if signals.hn_total_score:
        # Log scale: 100 points = 15pts, 500 = 22pts, 1000+ = 25pts
        hn_score = min(25, math.log10(signals.hn_total_score + 1) * 12)
        score += hn_score

    # Google Trends contribution (0-25)
    if signals.google_trends_value:
        if signals.google_trends_is_breakout:
            score += 25
        else:
            # Linear: trend value 50 = 12.5pts, 100 = 25pts
            score += min(25, signals.google_trends_value * 0.25)

    # Wikipedia contribution (0-25)
    if signals.wikipedia_views and signals.wikipedia_views_change_pct:
        if signals.wikipedia_views > 1000 and signals.wikipedia_views_change_pct > 100:
            score += 25
        elif signals.wikipedia_views > 500 and signals.wikipedia_views_change_pct > 50:
            score += 15
        elif signals.wikipedia_views_change_pct > 25:
            score += 10

    # Bonus for multiple sources (network effect)
    source_count = len(set(s.source for s in sources))
    if source_count >= 3:
        score = min(100, score * 1.2)  # 20% bonus
    elif source_count >= 2:
        score = min(100, score * 1.1)  # 10% bonus

    return round(min(100, score), 1)
```

### 6.2 YouTube Supply Score (0-100, Lower = Better)

Measures how saturated the YouTube market is for this topic.

```python
def calculate_supply_score(youtube_data: dict) -> float:
    """
    Calculate supply score. Lower = less competition = better opportunity.
    """
    score = 0

    # Factor 1: Volume of recent content (0-30 points)
    recent_30 = youtube_data['results_last_30_days']
    if recent_30 == 0:
        score += 0  # No recent content = great
    elif recent_30 < 5:
        score += 10
    elif recent_30 < 15:
        score += 20
    else:
        score += 30  # Lots of recent content = saturated

    # Factor 2: Large channel presence (0-30 points)
    large_channels = youtube_data['large_channel_count']
    if large_channels == 0:
        score += 0
    elif large_channels < 3:
        score += 10
    elif large_channels < 7:
        score += 20
    else:
        score += 30  # Big players dominating

    # Factor 3: Title match ratio (0-20 points)
    # Low match = videos aren't targeting this keyword well = opportunity
    match_ratio = youtube_data['title_match_ratio']
    if match_ratio < 0.2:
        score += 0  # Poor targeting = opportunity
    elif match_ratio < 0.5:
        score += 10
    else:
        score += 20  # Well-targeted = competitive

    # Factor 4: Content freshness (0-20 points)
    avg_age = youtube_data['avg_video_age_days']
    if avg_age > 365:
        score += 0  # Stale content = opportunity
    elif avg_age > 180:
        score += 5
    elif avg_age > 90:
        score += 10
    else:
        score += 20  # Fresh content = active competition

    return round(score, 1)
```

### 6.3 Gap Score (The Key Metric)

```python
def calculate_gap_score(momentum: float, supply: float) -> float:
    """
    Calculate opportunity gap score.
    High momentum + low supply = high gap = good opportunity.

    Formula: momentum * (1 - supply/100) * multiplier
    """
    if momentum == 0:
        return 0

    # Invert supply (lower supply = better)
    supply_factor = 1 - (supply / 100)

    # Base gap calculation
    gap = momentum * supply_factor

    # Normalise to 0-100 scale
    # Theoretical max: 100 * 1.0 = 100
    return round(gap, 1)
```

### 6.4 Phase Classification

```python
def classify_phase(momentum: float, supply: float, outlier_count: int, avg_age: float) -> str:
    """
    Classify the trend phase based on multiple signals.
    """
    gap = calculate_gap_score(momentum, supply)

    # INNOVATION: High demand signal, almost no YouTube supply
    if momentum > 30 and supply < 20 and avg_age > 180:
        return 'innovation'

    # EMERGENCE: Growing demand, low supply, outliers appearing
    if momentum > 40 and supply < 40 and outlier_count >= 2:
        return 'emergence'

    # GROWTH: Strong demand, moderate supply, still opportunity
    if momentum > 50 and supply < 60:
        return 'growth'

    # MATURITY: High supply, big channels present
    if supply > 60:
        return 'maturity'

    # SATURATED: Very high supply, low gap score
    if supply > 80 or gap < 20:
        return 'saturated'

    # Default to growth if signals are mixed
    return 'growth'
```

### 6.5 Confidence Level

```python
def calculate_confidence(
    source_count: int,
    momentum: float,
    outlier_count: int,
    wikipedia_validated: bool
) -> str:
    """
    Determine confidence level in the opportunity assessment.
    """
    confidence_score = 0

    # Multiple sources = more confident
    if source_count >= 3:
        confidence_score += 3
    elif source_count >= 2:
        confidence_score += 2
    else:
        confidence_score += 1

    # Strong momentum signal
    if momentum > 60:
        confidence_score += 2
    elif momentum > 40:
        confidence_score += 1

    # Outliers confirm emergence
    if outlier_count >= 3:
        confidence_score += 2
    elif outlier_count >= 1:
        confidence_score += 1

    # Wikipedia validates mainstream awareness
    if wikipedia_validated:
        confidence_score += 1

    if confidence_score >= 7:
        return 'high'
    elif confidence_score >= 4:
        return 'medium'
    else:
        return 'low'
```

---

## 7. API Specifications

### 7.1 Next.js API Routes

#### GET /api/opportunities

Returns paginated list of opportunities for dashboard.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | int | 1 | Page number |
| limit | int | 20 | Results per page (max 50) |
| category | string | null | Filter by category |
| phase | string | null | Filter by phase |
| confidence | string | null | Filter by confidence |
| min_gap | float | 0 | Minimum gap score |
| sort | string | 'gap_desc' | Sort order |
| watched_only | bool | false | Only show watchlist |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "keyword": "obsidian plugin development",
      "category": "tech",
      "phase": "emergence",
      "confidence": "high",
      "gap_score": 84.5,
      "external_momentum": 72.0,
      "youtube_supply": 15.0,
      "sources": ["reddit", "hackernews"],
      "is_watched": false,
      "calculated_at": "2024-01-15T10:30:00Z",
      "first_seen_at": "2024-01-14T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  },
  "last_scan": "2024-01-15T10:00:00Z"
}
```

#### GET /api/opportunities/[id]

Returns full details for deep dive view.

**Response:**
```json
{
  "opportunity": {
    "id": "uuid",
    "keyword": "obsidian plugin development",
    "category": "tech",
    "phase": "emergence",
    "confidence": "high",
    "gap_score": 84.5,
    "external_momentum": 72.0,
    "youtube_supply": 15.0,
    "is_watched": false,
    "notes": null
  },
  "topic": {
    "id": "uuid",
    "first_seen_at": "2024-01-14T08:00:00Z",
    "last_seen_at": "2024-01-15T10:00:00Z"
  },
  "sources": [
    {
      "source": "reddit",
      "source_url": "https://reddit.com/r/ObsidianMD/...",
      "source_title": "Looking for plugins to...",
      "detected_at": "2024-01-14T08:00:00Z",
      "metadata": {
        "subreddit": "ObsidianMD",
        "score": 847,
        "num_comments": 234
      }
    }
  ],
  "youtube_analysis": {
    "total_results": 1240,
    "results_last_30_days": 8,
    "avg_video_age_days": 245,
    "title_match_ratio": 0.35,
    "large_channel_count": 1,
    "small_channel_count": 7,
    "outlier_count": 3,
    "outlier_videos": [
      {
        "video_id": "abc123",
        "title": "How I Built My First Obsidian Plugin",
        "views": 45000,
        "subs": 1200,
        "vps_ratio": 37.5,
        "age_days": 12
      }
    ],
    "top_results": [...]
  },
  "signal_history": [
    {
      "recorded_at": "2024-01-15T10:00:00Z",
      "momentum_score": 72.0,
      "reddit_total_score": 847,
      "google_trends_value": 68
    },
    {
      "recorded_at": "2024-01-14T16:00:00Z",
      "momentum_score": 58.0,
      "reddit_total_score": 423,
      "google_trends_value": 52
    }
  ]
}
```

#### POST /api/opportunities/[id]/watch

Toggle watchlist status.

**Request:**
```json
{
  "is_watched": true,
  "notes": "Consider for new channel"
}
```

#### POST /api/analyse

Run on-demand analysis for a keyword.

**Request:**
```json
{
  "keyword": "claude mcp servers"
}
```

**Response:**
```json
{
  "keyword": "claude mcp servers",
  "analysis": {
    "youtube_supply": { ... },
    "external_signals": {
      "reddit": null,
      "hackernews": { "found": true, "score": 234 },
      "google_trends": { "value": 45, "is_breakout": false }
    },
    "calculated_scores": {
      "momentum": 45.0,
      "supply": 12.0,
      "gap": 39.6
    },
    "phase": "innovation",
    "confidence": "medium"
  },
  "add_to_tracking": true
}
```

#### GET /api/discover

Run discovery mode for a seed keyword.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| seed | string | required | Seed keyword to expand |
| limit | int | 50 | Max sub-niches to analyse |

**Response:**
```json
{
  "seed": "gardening",
  "sub_niches_found": 67,
  "sub_niches_analysed": 50,
  "opportunities": [
    {
      "keyword": "no dig gardening",
      "gap_score": 78.5,
      "phase": "emergence",
      "confidence": "high"
    }
  ],
  "quota_used": 5100,
  "quota_remaining": 4900
}
```

#### GET /api/status

Returns system status and last scan info.

**Response:**
```json
{
  "status": "healthy",
  "last_scan": {
    "id": "uuid",
    "started_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:12:34Z",
    "status": "completed",
    "topics_detected": 234,
    "opportunities_created": 45
  },
  "next_scan_at": "2024-01-15T16:00:00Z",
  "youtube_quota": {
    "used_today": 4200,
    "remaining": 5800
  }
}
```

---

## 8. Frontend Requirements

### 8.1 Pages

#### Dashboard Page (`/`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Niche Radar                                Last scan: 2 hours ago │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Filters:                                                     │   │
│  │ [Category ▼] [Phase ▼] [Confidence ▼] [Min Gap: 50 ___]     │   │
│  │ [ ] Watchlist only                          [Search...]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Showing 156 opportunities                    Sort: [Gap ▼]   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │ obsidian plugin development              Gap: 84.5  │ │   │
│  │  │ tech • emergence • high confidence                      │ │   │
│  │  │ Sources: Reddit, HackerNews                            │ │   │
│  │  │ YouTube: 8 videos (30d), 3 outliers found              │ │   │
│  │  │ First seen: 2 days ago                    [☆] [View →] │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │ weight loss injections                   Gap: 81.2  │ │   │
│  │  │ ...                                                     │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [← Prev] Page 1 of 8 [Next →]                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
- `FilterBar` - Category, phase, confidence dropdowns + gap slider
- `OpportunityCard` - Summary card for each opportunity
- `Pagination` - Page navigation

**Interactions:**
- Click card → Navigate to `/opportunity/[id]`
- Click star → Toggle watchlist (optimistic update)
- Change filters → URL params update, refetch data

#### Deep Dive Page (`/opportunity/[id]`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  obsidian plugin development                          [☆ Watch]    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │   Gap: 84.5  │ │ Phase:       │ │ Confidence:  │ │ Category:  │ │
│  │   ████████░░ │ │ Emergence │ │ High      │ │ tech       │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│  EXTERNAL SIGNALS                                                   │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Momentum Trend (Last 30 Days)                            │   │
│  │ [═══════════════════════ CHART ═══════════════════════════] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Sources:                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Reddit • r/ObsidianMD • 847 upvotes                      │   │
│  │ "Looking for plugins to automate my PKM workflow..."        │   │
│  │ [View on Reddit →]                                          │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ HackerNews • 234 points                                  │   │
│  │ "Show HN: I built an Obsidian plugin for..."                │   │
│  │ [View on HN →]                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│  YOUTUBE ANALYSIS                                                   │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  Supply Score: 15/100 (Low competition)                          │
│                                                                     │
│  • 8 videos in last 30 days                                        │
│  • Average video age: 245 days (stale content)                   │
│  • Title match ratio: 35% (poor targeting)                       │
│  • Large channels (>100k): 1                                       │
│  • Outlier videos found: 3                                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ OUTLIER VIDEOS (Small channels, big views)               │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ "How I Built My First Obsidian Plugin"                      │   │
│  │ 45,000 views • 1,200 subs • VPS: 37.5x • 12 days ago        │   │
│  │ [Watch →]                                                    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ "Obsidian Plugin Development Tutorial"                       │   │
│  │ 23,000 views • 890 subs • VPS: 25.8x • 8 days ago           │   │
│  │ [Watch →]                                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TOP 10 SEARCH RESULTS                                    │   │
│  │ [Expandable table with video details]                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│  NOTES                                                              │
│  ───────────────────────────────────────────────────────────────   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [Add your notes about this opportunity...]                  │   │
│  │                                                   [Save]    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
- `ScoreCards` - Gap, phase, confidence, category badges
- `MomentumChart` - Line chart of momentum over time (Recharts)
- `SourcesList` - Expandable list of external sources
- `OutlierVideos` - Highlighted small-channel breakouts
- `TopResults` - Collapsible table of YouTube results
- `NotesEditor` - Textarea with save

#### Analyse Page (`/analyse`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Keyword Analyser                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Enter a keyword to analyse:                                  │   │
│  │ [claude mcp servers_________________________] [Analyse →]    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Loading state / Results displayed here]                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Discover Page (`/discover`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Discovery Mode                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Enter a broad topic to explore:                              │   │
│  │ [gardening____________________________] [Discover →]         │   │
│  │                                                              │   │
│  │ This will find 50+ sub-niches and analyse each one.         │   │
│  │ Uses approximately 5,000 API quota.                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Progress bar during discovery]                                   │
│  [Results table when complete]                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Watchlist Page (`/watchlist`)

Filtered view of dashboard showing only watched opportunities with trend indicators.

### 8.2 Shared Components

| Component | Description |
|-----------|-------------|
| `Header` | Logo, nav links, status indicator |
| `OpportunityCard` | Reusable card for opportunity summaries |
| `PhraseBadge` | Coloured badge for phase (innovation=purple, emergence=green, etc.) |
| `ConfidenceBadge` | Stars or icon for confidence level |
| `GapMeter` | Visual bar showing gap score |
| `SourceIcon` | Icons for Reddit, HN, Google Trends, Wikipedia |
| `VideoCard` | YouTube video preview with stats |
| `LoadingSpinner` | Consistent loading state |
| `EmptyState` | Friendly empty state messages |

### 8.3 Styling

- **Framework:** Tailwind CSS
- **Components:** shadcn/ui
- **Theme:** Dark mode default (content creator preference)
- **Accent colour:** Green (#22c55e) for positive signals
- **Charts:** Recharts with dark theme

---

## 9. Configuration

### 9.1 Subreddit Configuration

Stored in `subreddit_config` table. Initial seed data provided in schema.

Admin can add/remove subreddits via direct database access (no UI in V1).

### 9.2 Seed Keywords Configuration

Stored in `seed_keywords` table. Initial seed data provided in schema.

These drive Google Trends monitoring.

### 9.3 Scoring Thresholds

Configurable via environment variables or constants file:

```python
# scoring_config.py

# Momentum calculation weights
REDDIT_WEIGHT = 0.25
HN_WEIGHT = 0.25
GOOGLE_TRENDS_WEIGHT = 0.25
WIKIPEDIA_WEIGHT = 0.25

# VPS outlier detection
OUTLIER_VPS_THRESHOLD = 5.0
OUTLIER_MAX_SUBS = 10000
OUTLIER_MAX_AGE_DAYS = 90

# Phase classification thresholds
INNOVATION_MIN_MOMENTUM = 30
INNOVATION_MAX_SUPPLY = 20
INNOVATION_MIN_AVG_AGE = 180

EMERGENCE_MIN_MOMENTUM = 40
EMERGENCE_MAX_SUPPLY = 40
EMERGENCE_MIN_OUTLIERS = 2

# Confidence scoring
CONFIDENCE_HIGH_THRESHOLD = 7
CONFIDENCE_MEDIUM_THRESHOLD = 4
```

---

## 10. Build Phases

### Phase 1: Foundation
**Goal:** Database and basic infrastructure

- [ ] Set up Supabase project
- [ ] Run database schema SQL
- [ ] Set up Railway project for Python workers
- [ ] Set up Vercel project for Next.js
- [ ] Configure environment variables in all services
- [ ] Verify connectivity between services

**Deliverable:** Empty dashboard that connects to database

### Phase 2: Reddit Collector
**Goal:** First data source working end-to-end

- [ ] Implement Reddit collector in Python
- [ ] Implement entity extraction (keyword from title)
- [ ] Implement topic upsert logic
- [ ] Set up cron schedule (every 6 hours)
- [ ] Test with 5 subreddits

**Deliverable:** Topics appearing in database from Reddit

### Phase 3: Basic Scoring & Dashboard
**Goal:** Viewable opportunities

- [ ] Implement basic momentum scoring (Reddit only)
- [ ] Implement basic supply scoring (placeholder)
- [ ] Implement gap score calculation
- [ ] Implement phase classification
- [ ] Build dashboard page with opportunity cards
- [ ] Build basic filtering

**Deliverable:** Dashboard showing Reddit-sourced opportunities

### Phase 4: YouTube Integration
**Goal:** Real supply analysis

- [ ] Implement YouTube supply checker
- [ ] Implement API quota management
- [ ] Implement batching logic
- [ ] Implement outlier detection
- [ ] Update supply scoring with real data
- [ ] Add YouTube data to opportunity cards

**Deliverable:** Opportunities with real YouTube supply analysis

### Phase 5: Deep Dive Page
**Goal:** Full opportunity analysis view

- [ ] Build deep dive page layout
- [ ] Display external sources with links
- [ ] Display YouTube analysis details
- [ ] Display outlier videos
- [ ] Display top results table
- [ ] Implement watchlist toggle
- [ ] Implement notes saving

**Deliverable:** Complete deep dive view

### Phase 6: Additional Collectors
**Goal:** Multiple data sources

- [ ] Implement Hacker News collector
- [ ] Implement Google Trends collector
- [ ] Implement Wikipedia pageviews checker
- [ ] Update momentum scoring for multi-source
- [ ] Update confidence calculation
- [ ] Add source icons to UI

**Deliverable:** Full multi-source radar

### Phase 7: Analyse & Discover
**Goal:** Manual keyword analysis and discovery mode

- [ ] Build analyse page
- [ ] Implement on-demand keyword analysis API
- [ ] Build discover page
- [ ] Implement YouTube autocomplete expansion
- [ ] Implement batch analysis for discovery

**Deliverable:** Complete feature set

### Phase 8: Polish & Deploy
**Goal:** Production-ready

- [ ] Add loading states throughout
- [ ] Add error handling and error states
- [ ] Add empty states
- [ ] Implement status page/indicator
- [ ] Performance optimisation
- [ ] Mobile responsiveness
- [ ] Deploy to production
- [ ] Monitor first full scan cycle

**Deliverable:** Production deployment

---

## 11. Environment Variables

### Vercel (Next.js)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# YouTube (for on-demand analysis)
YOUTUBE_API_KEY=AIza...
```

### Railway (Python Workers)

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Reddit
REDDIT_CLIENT_ID=xxxxx
REDDIT_CLIENT_SECRET=xxxxx

# YouTube
YOUTUBE_API_KEY=AIza...

# Optional: Google Trends (no auth needed for pytrends)
```

---

## 12. Error Handling

### Collector Errors

Each collector should:
1. Catch all exceptions
2. Log error with context to `scan_log.errors`
3. Continue processing other items
4. Not fail the entire scan

```python
def collect_with_error_handling(collector_fn, source_name):
    try:
        return collector_fn()
    except Exception as e:
        log_error(source_name, str(e))
        return []
```

### API Rate Limits

- **YouTube:** Track quota usage, stop YouTube checks when approaching limit
- **Reddit:** Built-in rate limiting in praw
- **Google Trends:** Add 2-second delays between requests, retry on 429
- **Wikipedia:** Generally unlimited, add 0.5s delay to be polite

### Frontend Error States

- Network errors → Show retry button
- Empty results → Show friendly empty state with suggestions
- Analysis in progress → Show progress indicator with ETA

---

## 13. Testing Requirements

### Unit Tests (Python Workers)

- [ ] Entity extraction extracts correct keywords
- [ ] Momentum score calculation is correct
- [ ] Supply score calculation is correct
- [ ] Gap score calculation is correct
- [ ] Phase classification is correct for known scenarios
- [ ] Confidence calculation is correct

### Integration Tests

- [ ] Reddit collector successfully fetches and stores data
- [ ] YouTube checker correctly analyses and stores supply data
- [ ] Full scan cycle completes without errors
- [ ] API routes return correct data shapes

### Manual Testing Checklist

- [ ] Dashboard loads and displays opportunities
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] Deep dive page shows all expected data
- [ ] Watchlist toggle works
- [ ] Notes save correctly
- [ ] Analyse page runs and displays results
- [ ] Discover mode completes and shows results
- [ ] Mobile responsive at 375px, 768px breakpoints

---

## Appendix A: API Keys Setup

### Reddit API
1. Go to https://www.reddit.com/prefs/apps
2. Create new app (script type)
3. Note client ID and secret

### YouTube Data API
1. Go to https://console.cloud.google.com
2. Create new project
3. Enable YouTube Data API v3
4. Create API key (restrict to YouTube API)

### Supabase
1. Create project at https://supabase.com
2. Get URL and anon key from Settings → API
3. Get service key from Settings → API (keep secret)

---

## Appendix B: Cron Schedule

Railway cron expression: `0 */6 * * *`

Runs at: 00:00, 06:00, 12:00, 18:00 UTC

Adjust based on your timezone preference.

---

## Appendix C: Future Enhancements (V2)

- RPM estimation by category
- Email/Discord alerts for high-confidence opportunities
- Historical trend comparison
- Competitor channel tracking
- Video title/thumbnail suggestions
- Multi-user support with auth
- Browser extension for quick analysis
- TikTok trend migration tracking (if API becomes available)
