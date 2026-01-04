'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PhaseBadge } from './phase-badge';
import { SourceIcons } from './source-icons';
import { GapScore } from './gap-score';
import { TrendingUp, Eye, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Opportunity } from '@/types/database';

interface OpportunityCardProps {
  opportunity: Opportunity;
  index?: number;
}

export function OpportunityCard({ opportunity, index = 0 }: OpportunityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/opportunity/${opportunity.id}`}>
        <Card className="group relative overflow-hidden border-slate-800/50 bg-slate-900/50 p-5 backdrop-blur-sm transition-all duration-300 hover:border-violet-500/30 hover:bg-slate-900/80">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white group-hover:text-violet-300 transition-colors">
                  {opportunity.keyword}
                </h3>
                <PhaseBadge phase={opportunity.phase} />
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span>Momentum: {opportunity.external_momentum.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-blue-400" />
                  <span>Supply: {opportunity.youtube_supply.toFixed(0)}</span>
                </div>
              </div>

              <SourceIcons sources={opportunity.sources || []} />
            </div>

            <div className="flex flex-col items-end gap-2">
              <GapScore score={opportunity.gap_score} />
              {opportunity.is_watched && (
                <Bookmark className="h-4 w-4 text-violet-400 fill-violet-400" />
              )}
            </div>
          </div>

          {opportunity.confidence === 'high' && (
            <div className="absolute top-0 right-0 h-20 w-20 overflow-hidden">
              <div className="absolute -right-6 top-3 w-24 rotate-45 bg-gradient-to-r from-emerald-500 to-green-500 py-1 text-center text-xs font-medium text-white">
                High
              </div>
            </div>
          )}
        </Card>
      </Link>
    </motion.div>
  );
}
