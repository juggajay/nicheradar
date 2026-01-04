import { FadeIn } from '@/components/motion';
import { StatsBar } from '@/components/dashboard';
import { OpportunityCard } from '@/components/dashboard';
import type { Opportunity } from '@/types/database';

// Mock data for initial build - will be replaced with API calls
const mockOpportunities: Opportunity[] = [
  {
    id: '1',
    topic_id: 't1',
    calculated_at: new Date().toISOString(),
    external_momentum: 85,
    youtube_supply: 23,
    gap_score: 87,
    phase: 'emergence',
    confidence: 'high',
    is_watched: false,
    notes: null,
    big_channel_entered: false,
    big_channel_entered_at: null,
    keyword: 'Local LLM Fine-tuning',
    category: 'tech',
    sources: ['reddit', 'hackernews'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    topic_id: 't2',
    calculated_at: new Date().toISOString(),
    external_momentum: 72,
    youtube_supply: 35,
    gap_score: 73,
    phase: 'growth',
    confidence: 'medium',
    is_watched: true,
    notes: null,
    big_channel_entered: false,
    big_channel_entered_at: null,
    keyword: 'Obsidian PKM Workflows',
    category: 'productivity',
    sources: ['reddit', 'google_trends'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    topic_id: 't3',
    calculated_at: new Date().toISOString(),
    external_momentum: 91,
    youtube_supply: 15,
    gap_score: 92,
    phase: 'innovation',
    confidence: 'high',
    is_watched: false,
    notes: null,
    big_channel_entered: false,
    big_channel_entered_at: null,
    keyword: 'AI Agent Frameworks',
    category: 'tech',
    sources: ['hackernews', 'reddit', 'google_trends'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Opportunity Radar</h1>
          <p className="text-slate-400">Trending topics with low YouTube competition</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mb-8">
          <StatsBar
            totalOpportunities={mockOpportunities.length}
            highConfidence={mockOpportunities.filter(o => o.confidence === 'high').length}
            avgGapScore={mockOpportunities.reduce((acc, o) => acc + o.gap_score, 0) / mockOpportunities.length}
            lastScan="2 hours ago"
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="space-y-4">
          {mockOpportunities.map((opportunity, index) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} index={index} />
          ))}
        </div>
      </FadeIn>
    </div>
  );
}
