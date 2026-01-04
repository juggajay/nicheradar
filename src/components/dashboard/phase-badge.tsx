import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const phaseConfig = {
  innovation: { label: 'Innovation', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  emergence: { label: 'Emergence', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  growth: { label: 'Growth', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  maturity: { label: 'Maturity', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  saturated: { label: 'Saturated', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

interface PhaseBadgeProps {
  phase: keyof typeof phaseConfig;
}

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  const config = phaseConfig[phase];
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
