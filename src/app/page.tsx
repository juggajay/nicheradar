import { FadeIn } from '@/components/motion';
import { StatsBar, ScanButton } from '@/components/dashboard';
import { OpportunityCard } from '@/components/dashboard';
import { createClient } from '@/lib/supabase/server';
import type { Opportunity } from '@/types/database';

async function getOpportunities(): Promise<Opportunity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('gap_score', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching opportunities:', error);
    return [];
  }

  return data || [];
}

async function getStats() {
  const supabase = await createClient();

  const { count: totalCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true });

  const { count: highConfidenceCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('confidence', 'high');

  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('gap_score');

  const avgGapScore = opportunities?.length
    ? opportunities.reduce((sum, o) => sum + o.gap_score, 0) / opportunities.length
    : 0;

  const { data: lastScan } = await supabase
    .from('scan_log')
    .select('completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  return {
    totalOpportunities: totalCount || 0,
    highConfidence: highConfidenceCount || 0,
    avgGapScore,
    lastScan: lastScan?.completed_at || null,
  };
}

function formatLastScan(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

export default async function DashboardPage() {
  const [opportunities, stats] = await Promise.all([
    getOpportunities(),
    getStats(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <FadeIn>
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Opportunity Radar</h1>
            <p className="text-slate-400">Trending topics with low YouTube competition</p>
          </div>
          <ScanButton />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mb-8">
          <StatsBar
            totalOpportunities={stats.totalOpportunities}
            highConfidence={stats.highConfidence}
            avgGapScore={Math.round(stats.avgGapScore * 10) / 10}
            lastScan={formatLastScan(stats.lastScan)}
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        {opportunities.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📡</div>
            <h2 className="text-xl font-semibold text-white mb-2">No opportunities yet</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              The radar is scanning for trending topics. Opportunities will appear here
              once the worker processes data from Reddit, Hacker News, and Google Trends.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((opportunity, index) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} index={index} />
            ))}
          </div>
        )}
      </FadeIn>
    </div>
  );
}
