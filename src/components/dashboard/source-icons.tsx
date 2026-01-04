import { cn } from '@/lib/utils';

const sourceConfig = {
  reddit: { color: 'text-orange-400', label: 'Reddit' },
  hackernews: { color: 'text-orange-500', label: 'HN' },
  google_trends: { color: 'text-blue-400', label: 'Trends' },
  wikipedia: { color: 'text-slate-300', label: 'Wiki' },
};

interface SourceIconsProps {
  sources: string[];
}

export function SourceIcons({ sources }: SourceIconsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {sources.map((source) => {
        const config = sourceConfig[source as keyof typeof sourceConfig];
        if (!config) return null;
        return (
          <span
            key={source}
            className={cn(
              'rounded-md bg-slate-800/50 px-2 py-0.5 text-xs font-medium',
              config.color
            )}
          >
            {config.label}
          </span>
        );
      })}
    </div>
  );
}
