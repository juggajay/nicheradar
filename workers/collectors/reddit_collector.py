import requests
import time
from datetime import datetime, timezone
from typing import List, Dict

class RedditCollector:
    """Reddit data collector using public JSON endpoints (no API key needed)"""

    BASE_URL = "https://www.reddit.com"

    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.headers = {'User-Agent': 'NicheRadar/1.0 (Trend Detection Tool)'}
        self.request_delay = 2  # seconds between requests

    def _get(self, endpoint: str, params: dict = None) -> dict:
        """Make a request with rate limiting."""
        url = f"{self.BASE_URL}{endpoint}"

        try:
            response = requests.get(url, params=params, headers=self.headers, timeout=10)
            response.raise_for_status()
            time.sleep(self.request_delay)
            return response.json()
        except Exception as e:
            print(f"  Error fetching {endpoint}: {e}")
            return {}

    def get_configured_subreddits(self) -> List[Dict]:
        """Fetch active subreddits from config table"""
        result = self.supabase.table('subreddit_config').select('*').eq('is_active', True).execute()
        return result.data

    def collect_rising_posts(self, subreddit: str, min_score: int = 50, limit: int = 50) -> List[Dict]:
        """Get rising posts from a subreddit - the key signal for emerging trends."""
        posts = []

        # Get rising posts (posts gaining momentum)
        data = self._get(f"/r/{subreddit}/rising.json", {'limit': limit})

        for post in data.get('data', {}).get('children', []):
            p = post['data']
            if p.get('score', 0) >= min_score:
                posts.append({
                    'title': p['title'],
                    'score': p['score'],
                    'upvote_ratio': p.get('upvote_ratio', 0),
                    'num_comments': p['num_comments'],
                    'created_utc': datetime.fromtimestamp(p['created_utc'], tz=timezone.utc).isoformat(),
                    'subreddit': subreddit,
                    'url': f"https://reddit.com{p['permalink']}",
                    'author': p.get('author', ''),
                })

        # Also get hot posts for sustained trends
        data = self._get(f"/r/{subreddit}/hot.json", {'limit': limit})

        for post in data.get('data', {}).get('children', []):
            p = post['data']
            # Hot posts need higher threshold
            if p.get('score', 0) >= min_score * 2:
                posts.append({
                    'title': p['title'],
                    'score': p['score'],
                    'upvote_ratio': p.get('upvote_ratio', 0),
                    'num_comments': p['num_comments'],
                    'created_utc': datetime.fromtimestamp(p['created_utc'], tz=timezone.utc).isoformat(),
                    'subreddit': subreddit,
                    'url': f"https://reddit.com{p['permalink']}",
                    'author': p.get('author', ''),
                })

        return posts

    def run(self) -> List[Dict]:
        """Main collection run"""
        print("Starting Reddit collection (JSON endpoint)...")

        subreddits = self.get_configured_subreddits()
        all_posts = []

        for config in subreddits:
            subreddit = config['subreddit']
            min_score = config.get('min_score', 50)
            category = config.get('category', 'uncategorised')

            posts = self.collect_rising_posts(subreddit, min_score=min_score)

            # Add category to each post
            for post in posts:
                post['category'] = category

            all_posts.extend(posts)
            print(f"  r/{subreddit}: {len(posts)} posts")

        print(f"Reddit collection complete: {len(all_posts)} total posts")
        return all_posts

    def search_reddit(self, query: str, limit: int = 25) -> List[Dict]:
        """Search all of Reddit for a keyword."""
        data = self._get("/search.json", {
            'q': query,
            'limit': limit,
            'sort': 'relevance',
            't': 'week'
        })

        results = []
        for post in data.get('data', {}).get('children', []):
            p = post['data']
            results.append({
                'title': p['title'],
                'score': p['score'],
                'subreddit': p['subreddit'],
                'url': f"https://reddit.com{p['permalink']}",
                'created_utc': datetime.fromtimestamp(p['created_utc'], tz=timezone.utc).isoformat(),
            })

        return results
