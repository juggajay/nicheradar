import { ExternalLink } from 'lucide-react';

interface SourceLinksProps {
  sources: Array<{
    id: string;
    source: string;
    source_title: string;
    source_url: string;
    detected_at: string;
  }>;
}

const sourceConfig: Record<string, { label: string; color: string }> = {
  reddit: { label: 'Reddit', color: 'bg-orange-500/10 text-orange-400' },
  hackernews: { label: 'Hacker News', color: 'bg-orange-500/10 text-orange-500' },
  google_trends: { label: 'Google Trends', color: 'bg-blue-500/10 text-blue-400' },
  wikipedia: { label: 'Wikipedia', color: 'bg-slate-500/10 text-slate-300' },
};

export function SourceLinks({ sources }: SourceLinksProps) {
  return (
    <div className="space-y-3">
      {sources.map((source) => {
        const config = sourceConfig[source.source] || { label: source.source, color: 'bg-slate-500/10 text-slate-400' };
        return (
          <a
            key={source.id}
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-slate-800/50 p-4 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium mb-2 ${config.color}`}>
                  {config.label}
                </span>
                <p className="text-sm text-white line-clamp-2">{source.source_title}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(source.detected_at).toLocaleDateString()}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-500 flex-shrink-0" />
            </div>
          </a>
        );
      })}
    </div>
  );
}
