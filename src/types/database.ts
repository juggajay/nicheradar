export interface Topic {
  id: string;
  keyword: string;
  keyword_normalised: string;
  category: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TopicSource {
  id: string;
  topic_id: string;
  source: 'reddit' | 'hackernews' | 'google_trends' | 'wikipedia';
  source_url: string | null;
  source_title: string | null;
  source_metadata: Record<string, unknown>;
  detected_at: string;
}

export interface TopicSignal {
  id: string;
  topic_id: string;
  recorded_at: string;
  reddit_total_score: number | null;
  reddit_total_comments: number | null;
  reddit_post_count: number | null;
  hn_total_score: number | null;
  hn_post_count: number | null;
  google_trends_value: number | null;
  google_trends_is_breakout: boolean;
  wikipedia_views: number | null;
  wikipedia_views_change_pct: number | null;
  momentum_score: number | null;
  velocity: number | null;
  // V2 cross-platform fields
  source_platforms: string[];
  cross_platform_count: number;
  cross_platform_strength: number | null;
}

// Detailed video data for top 10 YouTube results
export interface TopVideoData {
  video_id: string;
  title: string;
  channel_id: string;
  channel_name: string;
  channel_subs: number;
  publish_date: string;
  view_count: number;
  days_old: number;
}

export interface YouTubeSupply {
  id: string;
  topic_id: string;
  checked_at: string;
  total_results: number | null;
  results_last_7_days: number | null;
  results_last_30_days: number | null;
  results_last_90_days: number | null;
  avg_video_age_days: number | null;
  median_video_age_days: number | null;
  title_match_ratio: number | null;
  avg_channel_subscribers: number | null;
  median_channel_subscribers: number | null;
  large_channel_count: number | null;
  small_channel_count: number | null;
  outlier_videos: OutlierVideo[];
  outlier_count: number;
  top_results: TopYouTubeResult[];
  supply_score: number | null;
  // V2 competition quality fields
  top_10_videos: TopVideoData[];
  authority_score: number | null;
  large_channel_count_v2: number | null;
  medium_channel_count: number | null;
  small_channel_count_v2: number | null;
  freshness_score: number | null;
  videos_last_7_days: number | null;
  videos_last_30_days: number | null;
  videos_last_90_days: number | null;
  volume_score: number | null;
  supply_score_v2: number | null;
  avg_views_top_10: number | null;
  max_views_top_10: number | null;
}

export interface OutlierVideo {
  video_id: string;
  title: string;
  views: number;
  subs: number;
  vps_ratio: number;
}

export interface TopYouTubeResult {
  video_id: string;
  title: string;
  channel_name: string;
  channel_subscribers: number;
  views: number;
  published_at: string;
}

export interface Opportunity {
  id: string;
  topic_id: string;
  calculated_at: string;
  external_momentum: number;
  youtube_supply: number;
  gap_score: number;
  phase: 'innovation' | 'emergence' | 'growth' | 'maturity' | 'saturated';
  confidence: 'high' | 'medium' | 'low';
  is_watched: boolean;
  notes: string | null;
  big_channel_entered: boolean;
  big_channel_entered_at: string | null;
  keyword: string;
  category: string | null;
  sources: string[];
  created_at: string;
  updated_at: string;
  // V2 scoring fields
  gap_score_v2: number | null;
  external_momentum_v2: number | null;
  youtube_supply_v2: number | null;
  has_authority_gap: boolean;
  has_freshness_gap: boolean;
  is_underserved: boolean;
  velocity_24h: number | null;
  velocity_7d: number | null;
  velocity_trend: 'accelerating' | 'stable' | 'declining' | null;
  cross_platform_count: number;
}

export interface ScanLog {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  topics_detected: number;
  topics_updated: number;
  youtube_checks: number;
  opportunities_created: number;
  errors: unknown[];
  duration_seconds: number | null;
}

export interface Database {
  public: {
    Tables: {
      topics: { Row: Topic; Insert: Partial<Topic>; Update: Partial<Topic> };
      topic_sources: { Row: TopicSource; Insert: Partial<TopicSource>; Update: Partial<TopicSource> };
      topic_signals: { Row: TopicSignal; Insert: Partial<TopicSignal>; Update: Partial<TopicSignal> };
      youtube_supply: { Row: YouTubeSupply; Insert: Partial<YouTubeSupply>; Update: Partial<YouTubeSupply> };
      opportunities: { Row: Opportunity; Insert: Partial<Opportunity>; Update: Partial<Opportunity> };
      scan_log: { Row: ScanLog; Insert: Partial<ScanLog>; Update: Partial<ScanLog> };
    };
  };
}
