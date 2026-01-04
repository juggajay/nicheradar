'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Youtube, ExternalLink, Eye, Calendar, TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';

interface YouTubeVideo {
  video_id: string;
  title: string;
  channel_name: string;
  views: number;
  published_at: string;
}

interface YouTubeData {
  total_results: number;
  recent_count: number;
  avg_views: number;
  large_channel_count: number;
  small_channel_count: number;
  top_videos: YouTubeVideo[];
}

interface TrendsData {
  status: 'success' | 'insufficient_data' | 'error' | 'unavailable';
  direction: 'spiking' | 'growing' | 'stable' | 'dropping' | 'unknown';
  sparkline: number[];
}

interface YouTubeCheckerProps {
  opportunityId: string;
  keyword: string;
  initialData?: {
    total_results: number;
    results_last_7_days: number;
    large_channel_count: number;
    small_channel_count: number;
    top_results: Array<{
      video_id: string;
      title: string;
      channel_name: string;
      views: number;
      published_at: string;
    }>;
  } | null;
}

export function YouTubeChecker({ opportunityId, keyword, initialData }: YouTubeCheckerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<YouTubeData | null>(
    initialData
      ? {
          total_results: initialData.total_results,
          recent_count: initialData.results_last_7_days,
          avg_views: 0,
          large_channel_count: initialData.large_channel_count,
          small_channel_count: initialData.small_channel_count,
          top_videos: initialData.top_results.map((v) => ({
            video_id: v.video_id,
            title: v.title,
            channel_name: v.channel_name,
            views: v.views,
            published_at: v.published_at,
          })),
        }
      : null
  );
  const [supply, setSupply] = useState<number | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/youtube-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId, keyword }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'YouTube check failed');
      }
      setData(result.data);
      setSupply(result.supply);
      if (result.trends) {
        setTrends(result.trends);
      }
    } catch (err) {
      setError('Failed to check YouTube. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getTrendBadge = () => {
    if (!trends || trends.status !== 'success') {
      return null;
    }

    const config = {
      spiking: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Spiking' },
      growing: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Growing' },
      stable: { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Stable' },
      dropping: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Dropping' },
      unknown: { icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'Unknown' },
    };

    const { icon: Icon, color, bg, label } = config[trends.direction];

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bg}`}>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className={`text-xs font-medium ${color}`}>{label}</span>
      </div>
    );
  };

  const renderSparkline = () => {
    if (!trends || !trends.sparkline || trends.sparkline.length < 2) return null;

    const data = trends.sparkline;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    // Create SVG path
    const width = 80;
    const height = 24;
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    });

    const pathD = `M${points.join(' L')}`;

    return (
      <svg width={width} height={height} className="inline-block ml-2">
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={
            trends.direction === 'spiking' || trends.direction === 'growing'
              ? 'text-emerald-400'
              : trends.direction === 'dropping'
              ? 'text-red-400'
              : 'text-slate-400'
          }
        />
      </svg>
    );
  };

  // No data yet - show check button
  if (!data) {
    return (
      <div className="text-center py-8">
        <Youtube className="h-12 w-12 mx-auto text-slate-600 mb-4" />
        <p className="text-slate-400 mb-4">YouTube data not yet available</p>
        <Button
          onClick={handleCheck}
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking YouTube...
            </>
          ) : (
            <>
              <Youtube className="mr-2 h-4 w-4" />
              Analyze Live on YouTube
            </>
          )}
        </Button>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  // Data exists - show results with refresh button
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{formatNumber(data.total_results)}</p>
            <p className="text-xs text-slate-500">Total Results</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{data.recent_count}</p>
            <p className="text-xs text-slate-500">Last 30 Days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{data.large_channel_count}</p>
            <p className="text-xs text-slate-500">Large Channels</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{data.small_channel_count}</p>
            <p className="text-xs text-slate-500">Small Channels</p>
          </div>
        </div>
        <Button
          onClick={handleCheck}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="ml-4"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {(supply !== null || trends) && (
        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="flex items-center justify-center gap-6">
            {supply !== null && (
              <p className="text-sm text-slate-400">
                Supply Score: <span className="font-bold text-white">{supply}</span>
              </p>
            )}
            {trends && trends.status === 'success' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Google Trend:</span>
                {getTrendBadge()}
                {renderSparkline()}
              </div>
            )}
            {trends && trends.status === 'error' && (
              <p className="text-xs text-slate-500">Trend data unavailable</p>
            )}
          </div>
        </div>
      )}

      {data.top_videos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400">Top Results</h3>
          {data.top_videos.map((video) => (
            <a
              key={video.video_id}
              href={`https://youtube.com/watch?v=${video.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg bg-slate-800/50 p-4 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{video.title}</p>
                  <p className="text-sm text-slate-400">{video.channel_name}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatNumber(video.views)} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(video.published_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-500 flex-shrink-0" />
              </div>
            </a>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}
