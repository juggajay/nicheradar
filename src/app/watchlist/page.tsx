'use client';

import { useState, useEffect } from 'react';
import { FadeIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { OpportunityCard } from '@/components/dashboard';
import { Bookmark, Loader2 } from 'lucide-react';
import type { Opportunity } from '@/types/database';

export default function WatchlistPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Opportunity[]>([]);

  useEffect(() => {
    // Simulate loading - will be replaced with actual API call
    const loadWatchlist = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock watched items
      setWatchlist([
        {
          id: 'w1',
          topic_id: 't1',
          calculated_at: new Date().toISOString(),
          external_momentum: 72,
          youtube_supply: 35,
          gap_score: 73,
          phase: 'growth',
          confidence: 'medium',
          is_watched: true,
          notes: 'Tracking for next video idea',
          big_channel_entered: false,
          big_channel_entered_at: null,
          keyword: 'Obsidian PKM Workflows',
          category: 'productivity',
          sources: ['reddit', 'google_trends'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      setIsLoading(false);
    };

    loadWatchlist();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Watchlist</h1>
          <p className="text-slate-400">Track opportunities you're interested in</p>
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : watchlist.length > 0 ? (
        <FadeIn delay={0.1}>
          <div className="space-y-4">
            {watchlist.map((opportunity, index) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} index={index} />
            ))}
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <Card className="border-slate-800/50 bg-slate-900/30 p-12">
            <div className="text-center">
              <Bookmark className="h-16 w-16 mx-auto text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">No watched topics yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Add opportunities to your watchlist to track their progress over time
              </p>
            </div>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
