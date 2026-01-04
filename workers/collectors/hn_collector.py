import requests
from datetime import datetime, timezone

class HackerNewsCollector:
    BASE_URL = "https://hacker-news.firebaseio.com/v0"

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def get_item(self, item_id):
        """Fetch a single HN item"""
        response = requests.get(f"{self.BASE_URL}/item/{item_id}.json")
        return response.json() if response.ok else None

    def collect_top_stories(self, limit=100):
        """Collect top stories from Hacker News"""
        response = requests.get(f"{self.BASE_URL}/topstories.json")
        if not response.ok:
            return []

        story_ids = response.json()[:limit]
        stories = []

        for story_id in story_ids:
            item = self.get_item(story_id)
            if item and item.get('type') == 'story' and item.get('score', 0) >= 50:
                stories.append({
                    'title': item.get('title', ''),
                    'score': item.get('score', 0),
                    'url': item.get('url', f"https://news.ycombinator.com/item?id={story_id}"),
                    'hn_url': f"https://news.ycombinator.com/item?id={story_id}",
                    'num_comments': item.get('descendants', 0),
                    'created_utc': datetime.fromtimestamp(item.get('time', 0), tz=timezone.utc).isoformat()
                })

        return stories

    def run(self):
        """Main collection run"""
        print("Starting Hacker News collection...")
        stories = self.collect_top_stories()
        print(f"HN collection complete: {len(stories)} stories")
        return stories
