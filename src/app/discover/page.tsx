'use client';

import { useState } from 'react';
import { FadeIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OpportunityCard } from '@/components/dashboard';
import { Compass, Loader2, Sparkles } from 'lucide-react';
import type { Opportunity } from '@/types/database';

export default function DiscoverPage() {
  const [seedKeyword, setSeedKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Opportunity[]>([]);

  const handleDiscover = async () => {
    if (!seedKeyword.trim()) return;

    setIsLoading(true);

    // Simulate discovery - will be replaced with actual API call
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock discovered sub-niches
    const mockResults: Opportunity[] = [
      {
        id: 'd1',
        topic_id: 't1',
        calculated_at: new Date().toISOString(),
        external_momentum: 78,
        youtube_supply: 28,
        gap_score: 76,
        phase: 'emergence',
        confidence: 'high',
        is_watched: false,
        notes: null,
        big_channel_entered: false,
        big_channel_entered_at: null,
        keyword: `${seedKeyword} for beginners`,
        category: 'education',
        sources: ['google_trends'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'd2',
        topic_id: 't2',
        calculated_at: new Date().toISOString(),
        external_momentum: 65,
        youtube_supply: 35,
        gap_score: 62,
        phase: 'growth',
        confidence: 'medium',
        is_watched: false,
        notes: null,
        big_channel_entered: false,
        big_channel_entered_at: null,
        keyword: `${seedKeyword} tutorial 2024`,
        category: 'education',
        sources: ['google_trends'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'd3',
        topic_id: 't3',
        calculated_at: new Date().toISOString(),
        external_momentum: 82,
        youtube_supply: 18,
        gap_score: 85,
        phase: 'innovation',
        confidence: 'high',
        is_watched: false,
        notes: null,
        big_channel_entered: false,
        big_channel_entered_at: null,
        keyword: `best ${seedKeyword} tools`,
        category: 'tools',
        sources: ['google_trends', 'reddit'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    setResults(mockResults);
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Discover Sub-Niches</h1>
          <p className="text-slate-400">Enter a seed keyword to discover related content opportunities</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card className="border-slate-800/50 bg-slate-900/50 p-6 mb-8">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Compass className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                type="text"
                placeholder="Enter a seed keyword (e.g., 'gardening', 'productivity')"
                value={seedKeyword}
                onChange={(e) => setSeedKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-12"
              />
            </div>
            <Button
              onClick={handleDiscover}
              disabled={isLoading || !seedKeyword.trim()}
              className="h-12 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Discover
                </>
              )}
            </Button>
          </div>
        </Card>
      </FadeIn>

      {results.length > 0 && (
        <FadeIn>
          <div className="mb-4">
            <h2 className="text-lg font-medium text-white">
              Found {results.length} related opportunities
            </h2>
          </div>
          <div className="space-y-4">
            {results.map((opportunity, index) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} index={index} />
            ))}
          </div>
        </FadeIn>
      )}

      {results.length === 0 && !isLoading && (
        <FadeIn delay={0.2}>
          <div className="text-center py-16">
            <Compass className="h-16 w-16 mx-auto text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">Explore content niches</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Enter a broad topic and we'll find related sub-niches with content opportunities using YouTube autocomplete
            </p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
