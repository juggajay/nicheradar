class OpportunityScorer:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def calculate_momentum_score(self, signals):
        """Calculate external momentum score (0-100)"""
        score = 0

        # Reddit contribution (max 40 points)
        if signals.get('reddit_total_score'):
            reddit_score = min(signals['reddit_total_score'] / 500, 1) * 40
            score += reddit_score

        # HN contribution (max 30 points)
        if signals.get('hn_total_score'):
            hn_score = min(signals['hn_total_score'] / 300, 1) * 30
            score += hn_score

        # Google Trends contribution (max 30 points)
        if signals.get('google_trends_value'):
            trends_score = signals['google_trends_value'] / 100 * 30
            score += trends_score

        return min(score, 100)

    def calculate_supply_score(self, youtube_data):
        """Calculate YouTube supply score (0-100, lower = better opportunity)"""
        if not youtube_data:
            return 10  # Low supply = good opportunity

        score = 0

        # Total results (max 40 points)
        total = youtube_data.get('total_results', 0)
        if total > 100000:
            score += 40
        elif total > 10000:
            score += 30
        elif total > 1000:
            score += 20
        else:
            score += 10

        # Recent content velocity (max 30 points)
        recent = youtube_data.get('results_last_7_days', 0)
        if recent > 50:
            score += 30
        elif recent > 20:
            score += 20
        elif recent > 5:
            score += 10

        # Large channel presence (max 30 points)
        large = youtube_data.get('large_channel_count', 0)
        score += min(large * 10, 30)

        return min(score, 100)

    def calculate_gap_score(self, momentum, supply):
        """Calculate gap score: high momentum + low supply = high opportunity"""
        # Gap = momentum * (1 - supply/100)
        gap = momentum * (1 - supply / 100)
        return round(gap, 2)

    def classify_phase(self, momentum, supply, gap_score):
        """Classify the opportunity phase"""
        if gap_score >= 80 and supply < 20:
            return 'innovation'
        elif gap_score >= 60 and supply < 40:
            return 'emergence'
        elif gap_score >= 40:
            return 'growth'
        elif gap_score >= 20:
            return 'maturity'
        else:
            return 'saturated'

    def determine_confidence(self, sources_count, momentum):
        """Determine confidence level"""
        if sources_count >= 3 and momentum >= 70:
            return 'high'
        elif sources_count >= 2 and momentum >= 50:
            return 'medium'
        else:
            return 'low'
