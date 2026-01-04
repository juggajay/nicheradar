import { Card } from '@/components/ui/card';
import { TrendingUp, Zap, Target, Clock } from 'lucide-react';

interface StatsBarProps {
  totalOpportunities: number;
  highConfidence: number;
  avgGapScore: number;
  lastScan: string | null;
}

export function StatsBar({ totalOpportunities, highConfidence, avgGapScore, lastScan }: StatsBarProps) {
  const stats = [
    { label: 'Opportunities', value: totalOpportunities, icon: Target, color: 'text-violet-400' },
    { label: 'High Confidence', value: highConfidence, icon: Zap, color: 'text-emerald-400' },
    { label: 'Avg Gap Score', value: avgGapScore.toFixed(1), icon: TrendingUp, color: 'text-yellow-400' },
    { label: 'Last Scan', value: lastScan || 'Never', icon: Clock, color: 'text-blue-400' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border-slate-800/50 bg-slate-900/30 p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg bg-slate-800 p-2 ${stat.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
