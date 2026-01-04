import { ExternalLink, Users, Eye, Calendar } from 'lucide-react';

interface YouTubeResultsProps {
  data: {
    total_results: number;
    results_last_7_days: number;
    results_last_30_days: number;
    avg_channel_subscribers: number;
    large_channel_count: number;
    small_channel_count: number;
    top_results: Array<{
      video_id: string;
      title: string;
      channel_name: string;
      channel_subscribers: number;
      views: number;
      published_at: string;
    }>;
  };
}

export function YouTubeResults({ data }: YouTubeResultsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{formatNumber(data.total_results)}</p>
          <p className="text-xs text-slate-500">Total Results</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">{data.results_last_7_days}</p>
          <p className="text-xs text-slate-500">Last 7 Days</p>
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

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">Top Results</h3>
        {data.top_results.map((video) => (
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
                    <Users className="h-3 w-3" />
                    {formatNumber(video.channel_subscribers)} subs
                  </span>
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
    </div>
  );
}
