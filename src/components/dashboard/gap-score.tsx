import { cn } from '@/lib/utils';

interface GapScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function GapScore({ score, size = 'md' }: GapScoreProps) {
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
      <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', getColor(score), sizeClasses[size])}>
        {score.toFixed(0)}
      </span>
      <span className="text-xs text-slate-500">Gap Score</span>
    </div>
  );
}
