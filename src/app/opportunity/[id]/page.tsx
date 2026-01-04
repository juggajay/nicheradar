import { FadeIn, SlideIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { PhaseBadge, GapScore, SourceIcons, WatchButton } from '@/components/dashboard';
import { TrendChart } from '@/components/charts/trend-chart';
import { YouTubeResults } from '@/components/opportunity/youtube-results';
import { SourceLinks } from '@/components/opportunity/source-links';
import { ArrowLeft, TrendingUp, Eye, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getOpportunityData(id: string) {
  const supabase = await createClient();

  // Get opportunity
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !opportunity) {
    return null;
  }

  // Get topic sources
  const { data: sources } = await supabase
    .from('topic_sources')
    .select('*')
    .eq('topic_id', opportunity.topic_id)
    .order('detected_at', { ascending: false })
    .limit(10);

  // Get topic signals for trend chart
  const { data: signals } = await supabase
    .from('topic_signals')
    .select('recorded_at, momentum_score')
    .eq('topic_id', opportunity.topic_id)
    .order('recorded_at', { ascending: true })
    .limit(30);

  // Get YouTube supply data
  const { data: youtubeSupply } = await supabase
    .from('youtube_supply')
    .select('*')
    .eq('topic_id', opportunity.topic_id)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single();

  return {
    opportunity,
    sources: sources || [],
    signals: signals || [],
    youtubeSupply,
  };
}

export default async function OpportunityPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOpportunityData(id);

  if (!data) {
    notFound();
  }

  const { opportunity, sources, signals, youtubeSupply } = data;

  // Format signals for chart
  const chartData = signals.map((s) => ({
    date: new Date(s.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    momentum: s.momentum_score || 0,
  }));

  // Format sources for display
  const formattedSources = sources.map((s) => ({
    id: s.id,
    source: s.source,
    source_title: s.source_title,
    source_url: s.source_url,
    detected_at: new Date(s.detected_at).toLocaleDateString(),
  }));

  // Format YouTube data
  const youtubeData = youtubeSupply ? {
    total_results: youtubeSupply.total_results || 0,
    results_last_7_days: youtubeSupply.results_last_7_days || 0,
    results_last_30_days: youtubeSupply.results_last_30_days || 0,
    avg_channel_subscribers: youtubeSupply.avg_channel_subscribers || 0,
    large_channel_count: youtubeSupply.large_channel_count || 0,
    small_channel_count: youtubeSupply.small_channel_count || 0,
    top_results: (youtubeSupply.top_results || []).slice(0, 5).map((v: Record<string, unknown>) => ({
      video_id: v.video_id,
      title: v.title,
      channel_name: 'Channel',
      channel_subscribers: v.subs,
      views: v.views,
      published_at: `${v.age_days} days ago`,
    })),
  } : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <FadeIn>
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Radar
        </Link>
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <FadeIn>
            <Card className="border-slate-800/50 bg-slate-900/50 p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-white">{opportunity.keyword}</h1>
                    <PhaseBadge phase={opportunity.phase} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="capitalize">{opportunity.category}</span>
                    <SourceIcons sources={opportunity.sources || []} />
                  </div>
                </div>
                <WatchButton
                  opportunityId={opportunity.id}
                  initialWatched={opportunity.is_watched}
                  variant="full"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                  <GapScore score={opportunity.gap_score} size="lg" />
                </div>
                <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold text-emerald-400">
                    <TrendingUp className="h-6 w-6" />
                    {Math.round(opportunity.external_momentum)}
                  </div>
                  <span className="text-xs text-slate-500">Momentum</span>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold text-blue-400">
                    <Eye className="h-6 w-6" />
                    {Math.round(opportunity.youtube_supply)}
                  </div>
                  <span className="text-xs text-slate-500">YT Supply</span>
                </div>
              </div>

              {opportunity.confidence === 'high' && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
                  <AlertTriangle className="h-4 w-4" />
                  High confidence opportunity — Strong signals with low competition
                </div>
              )}
            </Card>
          </FadeIn>

          <SlideIn direction="up" delay={0.1}>
            <Card className="border-slate-800/50 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Momentum Trend</h2>
              {chartData.length > 0 ? (
                <TrendChart data={chartData} />
              ) : (
                <p className="text-slate-400 text-center py-8">No trend data available yet</p>
              )}
            </Card>
          </SlideIn>

          <SlideIn direction="up" delay={0.2}>
            <Card className="border-slate-800/50 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">YouTube Landscape</h2>
              {youtubeData ? (
                <YouTubeResults data={youtubeData} />
              ) : (
                <p className="text-slate-400 text-center py-8">YouTube data not yet available</p>
              )}
            </Card>
          </SlideIn>
        </div>

        <div className="space-y-6">
          <SlideIn direction="right" delay={0.1}>
            <Card className="border-slate-800/50 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Source Signals</h2>
              {formattedSources.length > 0 ? (
                <SourceLinks sources={formattedSources} />
              ) : (
                <p className="text-slate-400 text-center py-4">No source links available</p>
              )}
            </Card>
          </SlideIn>
        </div>
      </div>
    </div>
  );
}
