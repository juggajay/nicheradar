import os
import sys
import re
from datetime import datetime
from supabase import create_client

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import SUPABASE_URL, SUPABASE_KEY
from collectors.reddit_collector import RedditCollector
from collectors.hn_collector import HackerNewsCollector
from collectors.trends_collector import GoogleTrendsCollector
from collectors.youtube_collector import YouTubeCollector
from scoring.scorer import OpportunityScorer


def extract_keywords(text):
    """Extract searchable keywords from text (title)"""
    if not text:
        return []

    # Remove common prefixes
    text = re.sub(r'^(TIL|ELI5|CMV|TIFU|AMA|WIBTA|AITA|Show HN|Ask HN|Tell HN|Launch HN)\s*:?\s*', '', text, flags=re.IGNORECASE)

    keywords = []

    # Find quoted terms
    quoted = re.findall(r'"([^"]+)"', text)
    keywords.extend(quoted)

    # Find capitalized phrases (2-4 words) - potential product/project names
    phrases = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b', text)
    keywords.extend(phrases)

    # Also extract whole title if it's short enough and meaningful
    clean_title = re.sub(r'[^\w\s]', '', text).strip()
    if 3 <= len(clean_title.split()) <= 6:
        keywords.append(clean_title)

    # Normalize and deduplicate
    normalized = []
    seen = set()
    for k in keywords:
        k = k.lower().strip()
        if len(k) > 3 and k not in seen and not k.isdigit():
            seen.add(k)
            normalized.append(k)

    return normalized[:3]  # Max 3 keywords per item


def normalize_keyword(keyword):
    """Normalize keyword for deduplication"""
    return re.sub(r'[^\w\s]', '', keyword.lower()).strip()


def process_collected_data(supabase, reddit_posts, hn_stories, trend_queries):
    """Process raw collected data into topics and sources"""
    print("\n--- Processing collected data ---")

    topics_map = {}  # keyword_normalized -> topic data

    # Process Reddit posts
    for post in reddit_posts:
        keywords = extract_keywords(post['title'])
        for kw in keywords:
            kw_norm = normalize_keyword(kw)
            if kw_norm not in topics_map:
                topics_map[kw_norm] = {
                    'keyword': kw,
                    'keyword_normalised': kw_norm,
                    'category': post.get('category', 'uncategorised'),
                    'sources': []
                }
            topics_map[kw_norm]['sources'].append({
                'source': 'reddit',
                'source_url': post['url'],
                'source_title': post['title'],
                'source_metadata': {
                    'subreddit': post.get('subreddit'),
                    'score': post.get('score', 0),
                    'num_comments': post.get('num_comments', 0)
                }
            })

    # Process HN stories
    for story in hn_stories:
        keywords = extract_keywords(story['title'])
        for kw in keywords:
            kw_norm = normalize_keyword(kw)
            if kw_norm not in topics_map:
                topics_map[kw_norm] = {
                    'keyword': kw,
                    'keyword_normalised': kw_norm,
                    'category': 'tech',
                    'sources': []
                }
            topics_map[kw_norm]['sources'].append({
                'source': 'hackernews',
                'source_url': story['hn_url'],
                'source_title': story['title'],
                'source_metadata': {
                    'score': story.get('score', 0),
                    'num_comments': story.get('num_comments', 0)
                }
            })

    # Process Google Trends queries
    for query in trend_queries:
        kw = query.get('query', '')
        kw_norm = normalize_keyword(kw)
        if not kw_norm:
            continue

        if kw_norm not in topics_map:
            topics_map[kw_norm] = {
                'keyword': kw,
                'keyword_normalised': kw_norm,
                'category': query.get('category', 'uncategorised'),
                'sources': []
            }

        value = query.get('value', 0)
        is_breakout = value == 'Breakout' if isinstance(value, str) else False

        topics_map[kw_norm]['sources'].append({
            'source': 'google_trends',
            'source_url': f"https://trends.google.com/trends/explore?q={kw}",
            'source_title': f"Rising query for '{query.get('seed_keyword', '')}'",
            'source_metadata': {
                'seed_keyword': query.get('seed_keyword'),
                'trend_value': str(value),
                'is_breakout': is_breakout
            }
        })

    print(f"Extracted {len(topics_map)} unique topics from collected data")
    return topics_map


def upsert_topics(supabase, topics_map):
    """Upsert topics and their sources to database"""
    print("\n--- Upserting topics to database ---")

    upserted_topics = []

    for kw_norm, topic_data in topics_map.items():
        try:
            # Check if topic exists
            existing = supabase.table('topics').select('id').eq('keyword_normalised', kw_norm).execute()

            if existing.data:
                # Update existing topic
                topic_id = existing.data[0]['id']
                supabase.table('topics').update({
                    'last_seen_at': datetime.now().isoformat(),
                    'is_active': True
                }).eq('id', topic_id).execute()
            else:
                # Insert new topic
                result = supabase.table('topics').insert({
                    'keyword': topic_data['keyword'],
                    'keyword_normalised': kw_norm,
                    'category': topic_data['category']
                }).execute()
                topic_id = result.data[0]['id']

            # Insert sources (ignore duplicates)
            for source in topic_data['sources']:
                try:
                    supabase.table('topic_sources').insert({
                        'topic_id': topic_id,
                        'source': source['source'],
                        'source_url': source['source_url'],
                        'source_title': source['source_title'],
                        'source_metadata': source['source_metadata']
                    }).execute()
                except Exception:
                    pass  # Duplicate source, ignore

            upserted_topics.append({
                'id': topic_id,
                'keyword': topic_data['keyword'],
                'keyword_normalised': kw_norm,
                'category': topic_data['category'],
                'sources': topic_data['sources']
            })

        except Exception as e:
            print(f"Error upserting topic '{topic_data['keyword']}': {e}")
            continue

    print(f"Upserted {len(upserted_topics)} topics")
    return upserted_topics


def calculate_signals(supabase, topics):
    """Calculate and store signals for each topic"""
    print("\n--- Calculating signals ---")

    for topic in topics:
        try:
            # Aggregate source signals
            reddit_score = 0
            reddit_comments = 0
            reddit_posts = 0
            hn_score = 0
            hn_posts = 0
            trends_value = 0
            is_breakout = False

            for source in topic['sources']:
                meta = source.get('source_metadata', {})
                if source['source'] == 'reddit':
                    reddit_score += meta.get('score', 0)
                    reddit_comments += meta.get('num_comments', 0)
                    reddit_posts += 1
                elif source['source'] == 'hackernews':
                    hn_score += meta.get('score', 0)
                    hn_posts += 1
                elif source['source'] == 'google_trends':
                    val = meta.get('trend_value', '0')
                    if val == 'Breakout':
                        is_breakout = True
                        trends_value = max(trends_value, 100)
                    elif val.isdigit():
                        trends_value = max(trends_value, int(val))

            # Calculate momentum score
            scorer = OpportunityScorer(supabase)
            momentum = scorer.calculate_momentum_score({
                'reddit_total_score': reddit_score,
                'hn_total_score': hn_score,
                'google_trends_value': trends_value
            })

            # Store signal
            supabase.table('topic_signals').insert({
                'topic_id': topic['id'],
                'reddit_total_score': reddit_score or None,
                'reddit_total_comments': reddit_comments or None,
                'reddit_post_count': reddit_posts or None,
                'hn_total_score': hn_score or None,
                'hn_post_count': hn_posts or None,
                'google_trends_value': trends_value or None,
                'google_trends_is_breakout': is_breakout,
                'momentum_score': momentum
            }).execute()

            topic['momentum'] = momentum
            topic['source_count'] = len(set(s['source'] for s in topic['sources']))

        except Exception as e:
            print(f"Error calculating signals for '{topic['keyword']}': {e}")
            topic['momentum'] = 0
            topic['source_count'] = 0

    print(f"Calculated signals for {len(topics)} topics")


def check_youtube_supply(supabase, topics, limit=50):
    """Check YouTube supply for topics"""
    print(f"\n--- Checking YouTube supply (limit: {limit}) ---")

    youtube = YouTubeCollector(supabase)
    checked = 0

    # Sort by momentum to prioritize high-potential topics
    sorted_topics = sorted(topics, key=lambda t: t.get('momentum', 0), reverse=True)

    for topic in sorted_topics[:limit]:
        try:
            supply_data = youtube.check_supply(topic['keyword'])

            if supply_data:
                # Store YouTube supply data
                supabase.table('youtube_supply').insert({
                    'topic_id': topic['id'],
                    'total_results': supply_data['total_results'],
                    'results_last_7_days': supply_data['results_last_7_days'],
                    'results_last_30_days': supply_data['results_last_30_days'],
                    'results_last_90_days': supply_data['results_last_90_days'],
                    'avg_video_age_days': supply_data['avg_video_age_days'],
                    'median_video_age_days': supply_data['median_video_age_days'],
                    'title_match_ratio': supply_data['title_match_ratio'],
                    'avg_channel_subscribers': supply_data['avg_channel_subscribers'],
                    'median_channel_subscribers': supply_data['median_channel_subscribers'],
                    'large_channel_count': supply_data['large_channel_count'],
                    'small_channel_count': supply_data['small_channel_count'],
                    'outlier_videos': supply_data['outlier_videos'],
                    'outlier_count': supply_data['outlier_count'],
                    'top_results': supply_data['top_results']
                }).execute()

                topic['youtube_data'] = supply_data
                checked += 1
                print(f"  Checked: {topic['keyword']} ({supply_data['total_results']} results)")
            else:
                topic['youtube_data'] = None

        except Exception as e:
            print(f"Error checking YouTube for '{topic['keyword']}': {e}")
            topic['youtube_data'] = None

    print(f"Checked YouTube supply for {checked} topics")
    return checked


def create_opportunities(supabase, topics):
    """Score topics and create/update opportunities"""
    print("\n--- Creating opportunities ---")

    scorer = OpportunityScorer(supabase)
    created = 0

    for topic in topics:
        try:
            momentum = topic.get('momentum', 0)
            youtube_data = topic.get('youtube_data')

            # Calculate supply score
            supply = scorer.calculate_supply_score(youtube_data)

            # Calculate gap score
            gap = scorer.calculate_gap_score(momentum, supply)

            # Classify phase
            phase = scorer.classify_phase(momentum, supply, gap)

            # Determine confidence
            confidence = scorer.determine_confidence(topic.get('source_count', 1), momentum)

            # Get source names
            sources = list(set(s['source'] for s in topic.get('sources', [])))

            # Upsert opportunity
            existing = supabase.table('opportunities').select('id').eq('topic_id', topic['id']).execute()

            opportunity_data = {
                'topic_id': topic['id'],
                'external_momentum': momentum,
                'youtube_supply': supply,
                'gap_score': gap,
                'phase': phase,
                'confidence': confidence,
                'keyword': topic['keyword'],
                'category': topic.get('category', 'uncategorised'),
                'sources': sources,
                'calculated_at': datetime.now().isoformat()
            }

            if existing.data:
                # Update existing opportunity
                supabase.table('opportunities').update(opportunity_data).eq('id', existing.data[0]['id']).execute()
            else:
                # Insert new opportunity
                supabase.table('opportunities').insert(opportunity_data).execute()

            created += 1

            if gap >= 50:
                print(f"  High opportunity: {topic['keyword']} (gap: {gap}, phase: {phase})")

        except Exception as e:
            print(f"Error creating opportunity for '{topic['keyword']}': {e}")

    print(f"Created/updated {created} opportunities")
    return created


def run_scan():
    """Run a complete scan cycle"""
    print(f"\n{'='*60}")
    print(f"Starting scan at {datetime.now().isoformat()}")
    print(f"{'='*60}\n")

    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Create scan log entry
    scan_log = supabase.table('scan_log').insert({
        'status': 'running',
        'started_at': datetime.now().isoformat()
    }).execute()
    scan_id = scan_log.data[0]['id']

    stats = {
        'topics_detected': 0,
        'topics_updated': 0,
        'youtube_checks': 0,
        'opportunities_created': 0
    }

    try:
        # Phase 1: Run collectors
        print("=== Phase 1: Data Collection ===")

        reddit_posts = []
        try:
            reddit = RedditCollector(supabase)
            reddit_posts = reddit.run()
        except Exception as e:
            print(f"Reddit collection failed: {e}")

        hn_stories = []
        try:
            hn = HackerNewsCollector(supabase)
            hn_stories = hn.run()
        except Exception as e:
            print(f"HN collection failed: {e}")

        trend_queries = []
        try:
            trends = GoogleTrendsCollector(supabase)
            trend_queries = trends.run()
        except Exception as e:
            print(f"Trends collection failed: {e}")

        stats['topics_detected'] = len(reddit_posts) + len(hn_stories) + len(trend_queries)

        # Phase 2: Process and deduplicate
        print("\n=== Phase 2: Processing ===")
        topics_map = process_collected_data(supabase, reddit_posts, hn_stories, trend_queries)

        # Phase 3: Upsert topics
        print("\n=== Phase 3: Database Upsert ===")
        topics = upsert_topics(supabase, topics_map)
        stats['topics_updated'] = len(topics)

        # Phase 4: Calculate signals
        print("\n=== Phase 4: Signal Calculation ===")
        calculate_signals(supabase, topics)

        # Phase 5: Check YouTube supply
        print("\n=== Phase 5: YouTube Supply Check ===")
        stats['youtube_checks'] = check_youtube_supply(supabase, topics, limit=50)

        # Phase 6: Create opportunities
        print("\n=== Phase 6: Opportunity Scoring ===")
        stats['opportunities_created'] = create_opportunities(supabase, topics)

        # Complete scan
        completed_at = datetime.now()
        started_at = datetime.fromisoformat(scan_log.data[0]['started_at'].replace('Z', '+00:00'))
        duration = int((completed_at - started_at.replace(tzinfo=None)).total_seconds())

        supabase.table('scan_log').update({
            'status': 'completed',
            'completed_at': completed_at.isoformat(),
            'topics_detected': stats['topics_detected'],
            'topics_updated': stats['topics_updated'],
            'youtube_checks': stats['youtube_checks'],
            'opportunities_created': stats['opportunities_created'],
            'duration_seconds': duration
        }).eq('id', scan_id).execute()

        print(f"\n{'='*60}")
        print(f"Scan completed successfully!")
        print(f"  Topics detected: {stats['topics_detected']}")
        print(f"  Topics updated: {stats['topics_updated']}")
        print(f"  YouTube checks: {stats['youtube_checks']}")
        print(f"  Opportunities: {stats['opportunities_created']}")
        print(f"  Duration: {duration}s")
        print(f"{'='*60}")

    except Exception as e:
        print(f"\nScan failed: {e}")
        import traceback
        traceback.print_exc()

        supabase.table('scan_log').update({
            'status': 'failed',
            'completed_at': datetime.now().isoformat(),
            'errors': [{'message': str(e)}]
        }).eq('id', scan_id).execute()


if __name__ == '__main__':
    run_scan()
