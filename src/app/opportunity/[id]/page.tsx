import { FadeIn, SlideIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhaseBadge, GapScore, SourceIcons } from '@/components/dashboard';
import { TrendChart } from '@/components/charts/trend-chart';
import { YouTubeResults } from '@/components/opportunity/youtube-results';
import { SourceLinks } from '@/components/opportunity/source-links';
import { ArrowLeft, Bookmark, TrendingUp, Eye, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

// Mock data - will be replaced with API call
const mockOpportunity = {
  id: '1',
  topic_id: 't1',
  keyword: 'Local LLM Fine-tuning',
  category: 'tech',
  phase: 'emergence' as const,
  confidence: 'high' as const,
  gap_score: 87,
  external_momentum: 85,
  youtube_supply: 23,
  is_watched: false,
  sources: ['reddit', 'hackernews'],
  created_at: new Date().toISOString(),
  calculated_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  notes: null,
  big_channel_entered: false,
  big_channel_entered_at: null,
};

const mockSignals = [
  { date: '2024-01-01', momentum: 45 },
  { date: '2024-01-02', momentum: 52 },
  { date: '2024-01-03', momentum: 58 },
  { date: '2024-01-04', momentum: 63 },
  { date: '2024-01-05', momentum: 71 },
  { date: '2024-01-06', momentum: 78 },
  { date: '2024-01-07', momentum: 85 },
];

const mockSources = [
  { id: '1', source: 'reddit', source_title: 'Best tools for local LLM fine-tuning in 2024?', source_url: 'https://reddit.com/r/LocalLLaMA/...', detected_at: '2024-01-05' },
  { id: '2', source: 'hackernews', source_title: 'Show HN: Fine-tune LLMs on consumer hardware', source_url: 'https://news.ycombinator.com/...', detected_at: '2024-01-06' },
];

const mockYouTube = {
  total_results: 1250,
  results_last_7_days: 12,
  results_last_30_days: 45,
  avg_channel_subscribers: 15000,
  large_channel_count: 2,
  small_channel_count: 8,
  top_results: [
    { video_id: 'abc123', title: 'Complete Guide to Fine-tuning Local LLMs', channel_name: 'AI Explained', channel_subscribers: 125000, views: 45000, published_at: '2024-01-02' },
    { video_id: 'def456', title: 'Fine-tune Mistral 7B on Your Own Data', channel_name: 'Code Monkey', channel_subscribers: 8500, views: 12000, published_at: '2024-01-04' },
  ],
};

export default function OpportunityPage() {
  const opportunity = mockOpportunity;

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
                    <SourceIcons sources={opportunity.sources} />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  Watch
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                  <GapScore score={opportunity.gap_score} size="lg" />
                </div>
                <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold text-emerald-400">
                    <TrendingUp className="h-6 w-6" />
                    {opportunity.external_momentum}
                  </div>
                  <span className="text-xs text-slate-500">Momentum</span>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold text-blue-400">
                    <Eye className="h-6 w-6" />
                    {opportunity.youtube_supply}
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
              <TrendChart data={mockSignals} />
            </Card>
          </SlideIn>

          <SlideIn direction="up" delay={0.2}>
            <Card className="border-slate-800/50 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">YouTube Landscape</h2>
              <YouTubeResults data={mockYouTube} />
            </Card>
          </SlideIn>
        </div>

        <div className="space-y-6">
          <SlideIn direction="right" delay={0.1}>
            <Card className="border-slate-800/50 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Source Signals</h2>
              <SourceLinks sources={mockSources} />
            </Card>
          </SlideIn>
        </div>
      </div>
    </div>
  );
}
