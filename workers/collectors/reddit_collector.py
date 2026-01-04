import praw
from datetime import datetime, timezone
from config import REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT

class RedditCollector:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.reddit = praw.Reddit(
            client_id=REDDIT_CLIENT_ID,
            client_secret=REDDIT_CLIENT_SECRET,
            user_agent=REDDIT_USER_AGENT
        )

    def get_configured_subreddits(self):
        """Fetch active subreddits from config table"""
        result = self.supabase.table('subreddit_config').select('*').eq('is_active', True).execute()
        return result.data

    def collect_rising_posts(self, subreddit_config):
        """Collect rising posts from a subreddit"""
        subreddit = self.reddit.subreddit(subreddit_config['subreddit'])
        min_score = subreddit_config.get('min_score', 50)

        posts = []
        try:
            for post in subreddit.hot(limit=50):
                if post.score >= min_score:
                    posts.append({
                        'title': post.title,
                        'score': post.score,
                        'num_comments': post.num_comments,
                        'url': f"https://reddit.com{post.permalink}",
                        'created_utc': datetime.fromtimestamp(post.created_utc, tz=timezone.utc).isoformat(),
                        'subreddit': subreddit_config['subreddit'],
                        'category': subreddit_config.get('category', 'uncategorised')
                    })
        except Exception as e:
            print(f"Error collecting from r/{subreddit_config['subreddit']}: {e}")

        return posts

    def run(self):
        """Main collection run"""
        print("Starting Reddit collection...")
        subreddits = self.get_configured_subreddits()
        all_posts = []

        for config in subreddits:
            posts = self.collect_rising_posts(config)
            all_posts.extend(posts)
            print(f"  r/{config['subreddit']}: {len(posts)} posts")

        print(f"Reddit collection complete: {len(all_posts)} total posts")
        return all_posts
