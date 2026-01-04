'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhaseBadge } from './phase-badge';
import { SourceIcons } from './source-icons';
import { GapScore } from './gap-score';
import { WatchButton } from './watch-button';
import { TrendingUp, Eye, ArrowUp, ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import type { Opportunity, Topic } from '@/types/database';
import { cn } from '@/lib/utils';

interface OpportunityCardProps {
  opportunity: Opportunity;
  index?: number;
  topic?: Topic;
}

// Trend arrow component
function TrendArrow({ trend }: { trend: string | null }) {
  if (trend === 'accelerating') {
    return <ArrowUp className="h-4 w-4 text-emerald-400" />;
  }
  if (trend === 'declining') {
    return <ArrowDown className="h-4 w-4 text-red-400" />;
  }
  if (trend === 'stable') {
    return <ArrowRight className="h-4 w-4 text-slate-400" />;
  }
  return null;
}

// Check if topic is new (first seen < 48 hours ago)
function isNewTopic(firstSeenAt: string | undefined): boolean {
  if (!firstSeenAt) return false;
  const firstSeen = new Date(firstSeenAt);
  const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
  return firstSeen.getTime() > fortyEightHoursAgo;
}

export function OpportunityCard({
  opportunity,
  index = 0,
  topic,
}: OpportunityCardProps) {
  const isCrossPlatform = (opportunity.cross_platform_count || 1) >= 2;
  const topicIsNew = topic ? isNewTopic(topic.first_seen_at) : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/opportunity/${opportunity.id}`}>
        <Card
          className={cn(
            'group relative overflow-hidden border-slate-800/50 bg-slate-900/50 p-5 backdrop-blur-sm transition-all duration-300 hover:border-violet-500/30 hover:bg-slate-900/80',
            isCrossPlatform && 'ring-1 ring-blue-500/30'
          )}
        >
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
                  <span>Momentum: {Math.round(opportunity.external_momentum)}</span>
                  <TrendArrow trend={opportunity.velocity_trend} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-blue-400" />
                  <span>Supply: {Math.round(opportunity.youtube_supply)}</span>
                </div>
              </div>

              {/* Opportunity Flags */}
              <div className="flex items-center gap-2 flex-wrap">
                <SourceIcons sources={opportunity.sources || []} />

                {opportunity.has_authority_gap && (
                  <Badge
                    variant="outline"
                    className="text-xs text-emerald-400 border-emerald-400/50 bg-emerald-400/10"
                  >
                    Small creators
                  </Badge>
                )}
                {opportunity.has_freshness_gap && (
                  <Badge
                    variant="outline"
                    className="text-xs text-blue-400 border-blue-400/50 bg-blue-400/10"
                  >
                    Stale content
                  </Badge>
                )}
                {topicIsNew && (
                  <Badge
                    variant="outline"
                    className="text-xs text-purple-400 border-purple-400/50 bg-purple-400/10"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    New
                  </Badge>
                )}
                {isCrossPlatform && (
                  <Badge
                    variant="outline"
                    className="text-xs text-amber-400 border-amber-400/50 bg-amber-400/10"
                  >
                    Cross-platform
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <GapScore score={opportunity.gap_score} />
              <WatchButton
                opportunityId={opportunity.id}
                initialWatched={opportunity.is_watched}
                variant="icon"
              />
            </div>
          </div>

          {/* Only show "Verified" badge for actually good opportunities */}
          {opportunity.confidence === 'high' &&
            opportunity.gap_score >= 30 &&
            opportunity.phase !== 'saturated' && (
              <div className="absolute top-0 right-0 h-20 w-20 overflow-hidden">
                <div className="absolute -right-6 top-3 w-24 rotate-45 bg-gradient-to-r from-emerald-500 to-green-500 py-1 text-center text-xs font-medium text-white">
                  Verified
                </div>
              </div>
            )}
        </Card>
      </Link>
    </motion.div>
  );
}
