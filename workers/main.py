import os
import sys
from datetime import datetime
from supabase import create_client

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import SUPABASE_URL, SUPABASE_KEY
from collectors.reddit_collector import RedditCollector
from collectors.hn_collector import HackerNewsCollector
from collectors.trends_collector import GoogleTrendsCollector
from scoring.scorer import OpportunityScorer

def run_scan():
    """Run a complete scan cycle"""
    print(f"\n{'='*50}")
    print(f"Starting scan at {datetime.now().isoformat()}")
    print(f"{'='*50}\n")

    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Create scan log entry
    scan_log = supabase.table('scan_log').insert({
        'status': 'running',
        'started_at': datetime.now().isoformat()
    }).execute()
    scan_id = scan_log.data[0]['id']

    try:
        # Run collectors
        reddit = RedditCollector(supabase)
        reddit_posts = reddit.run()

        hn = HackerNewsCollector(supabase)
        hn_stories = hn.run()

        trends = GoogleTrendsCollector(supabase)
        trend_queries = trends.run()

        # TODO: Process collected data
        # - Extract keywords/topics
        # - Deduplicate across sources
        # - Upsert to topics table
        # - Calculate signals
        # - Check YouTube supply
        # - Score opportunities

        # Update scan log
        supabase.table('scan_log').update({
            'status': 'completed',
            'completed_at': datetime.now().isoformat(),
            'topics_detected': len(reddit_posts) + len(hn_stories) + len(trend_queries)
        }).eq('id', scan_id).execute()

        print(f"\nScan completed successfully!")

    except Exception as e:
        print(f"\nScan failed: {e}")
        supabase.table('scan_log').update({
            'status': 'failed',
            'completed_at': datetime.now().isoformat(),
            'errors': [str(e)]
        }).eq('id', scan_id).execute()

if __name__ == '__main__':
    run_scan()
