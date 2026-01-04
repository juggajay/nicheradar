from pytrends.request import TrendReq
import time

class GoogleTrendsCollector:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.pytrends = TrendReq(hl='en-US', tz=360)

    def get_seed_keywords(self):
        """Fetch active seed keywords from config table"""
        result = self.supabase.table('seed_keywords').select('*').eq('is_active', True).execute()
        return result.data

    def get_related_queries(self, keyword):
        """Get related rising queries for a keyword"""
        try:
            self.pytrends.build_payload([keyword], timeframe='now 7-d')
            related = self.pytrends.related_queries()

            rising = related.get(keyword, {}).get('rising')
            if rising is not None and not rising.empty:
                return rising.to_dict('records')
            return []
        except Exception as e:
            print(f"Error getting trends for '{keyword}': {e}")
            return []

    def run(self):
        """Main collection run"""
        print("Starting Google Trends collection...")
        keywords = self.get_seed_keywords()
        all_queries = []

        for kw in keywords:
            queries = self.get_related_queries(kw['keyword'])
            for q in queries:
                q['seed_keyword'] = kw['keyword']
                q['category'] = kw.get('category', 'uncategorised')
            all_queries.extend(queries)
            time.sleep(1)  # Rate limiting

        print(f"Trends collection complete: {len(all_queries)} related queries")
        return all_queries
