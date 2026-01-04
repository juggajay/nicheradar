import { cn } from '@/lib/utils';

interface GapScoreProps {
  score: number;
  scoreV2?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showComparison?: boolean;
}

export function GapScore({ score, scoreV2, size = 'md', showComparison = false }: GapScoreProps) {
  // Use V2 score if available, otherwise fall back to V1
  const displayScore = scoreV2 ?? score;

  const getColor = (score: number) => {
    if (score >= 80) return 'from-emerald-400 to-green-500 text-emerald-400';
    if (score >= 60) return 'from-yellow-400 to-amber-500 text-yellow-400';
    if (score >= 40) return 'from-orange-400 to-orange-500 text-orange-400';
    return 'from-red-400 to-red-500 text-red-400';
  };

  const sizeClasses = {
    sm: 'text-lg font-bold',
    md: 'text-2xl font-bold',
    lg: 'text-4xl font-extrabold',
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'bg-gradient-to-r bg-clip-text text-transparent',
            getColor(displayScore),
            sizeClasses[size]
          )}
        >
          {displayScore.toFixed(0)}
        </span>
        {showComparison && scoreV2 !== null && scoreV2 !== undefined && (
          <span className="text-xs text-slate-500">(v1: {Math.round(score)})</span>
        )}
      </div>
      <span className="text-xs text-slate-500">
        Gap Score{scoreV2 !== null && scoreV2 !== undefined ? ' v2' : ''}
      </span>
    </div>
  );
}
