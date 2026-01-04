import os
import re
from datetime import datetime, timezone
from googleapiclient.discovery import build

YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')

class YouTubeCollector:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        if YOUTUBE_API_KEY:
            self.youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
        else:
            self.youtube = None
            print("Warning: YOUTUBE_API_KEY not set, YouTube checks will be skipped")

    def check_supply(self, keyword):
        """Analyze YouTube supply/competition for a keyword"""
        if not self.youtube:
            return None

        try:
            # Search for keyword
            search_response = self.youtube.search().list(
                q=keyword,
                part='snippet',
                type='video',
                maxResults=50,
                order='relevance'
            ).execute()

            if not search_response.get('items'):
                return self._empty_result()

            video_ids = [item['id']['videoId'] for item in search_response['items']]
            channel_ids = list(set(item['snippet']['channelId'] for item in search_response['items']))

            # Batch fetch video stats
            videos_response = self.youtube.videos().list(
                id=','.join(video_ids),
                part='statistics,snippet'
            ).execute()

            # Batch fetch channel stats
            channels_response = self.youtube.channels().list(
                id=','.join(channel_ids[:50]),
                part='statistics'
            ).execute()

            # Build channel subscriber lookup
            channel_subs = {}
            for ch in channels_response.get('items', []):
                subs = int(ch['statistics'].get('subscriberCount', 0))
                if ch['statistics'].get('hiddenSubscriberCount'):
                    subs = 0
                channel_subs[ch['id']] = subs

            # Analyze results
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
                published = datetime.fromisoformat(
                    video['snippet']['publishedAt'].replace('Z', '+00:00')
                )
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
                'outlier_videos': outliers[:10],
                'outlier_count': len(outliers),
                'top_results': videos_data[:10]
            }

        except Exception as e:
            print(f"Error checking YouTube supply for '{keyword}': {e}")
            return None

    def _empty_result(self):
        return {
            'total_results': 0,
            'results_last_7_days': 0,
            'results_last_30_days': 0,
            'results_last_90_days': 0,
            'avg_video_age_days': 0,
            'median_video_age_days': 0,
            'title_match_ratio': 0,
            'avg_channel_subscribers': 0,
            'median_channel_subscribers': 0,
            'large_channel_count': 0,
            'small_channel_count': 0,
            'outlier_videos': [],
            'outlier_count': 0,
            'top_results': []
        }
