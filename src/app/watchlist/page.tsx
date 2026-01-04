import { FadeIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { OpportunityCard } from '@/components/dashboard';
import { Bookmark } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Opportunity } from '@/types/database';

async function getWatchlist(): Promise<Opportunity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('is_watched', true)
    .order('gap_score', { ascending: false });

  if (error) {
    console.error('Error fetching watchlist:', error);
    return [];
  }

  return data || [];
}

export default async function WatchlistPage() {
  const watchlist = await getWatchlist();

  return (
    <div className="container mx-auto px-4 py-8">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Watchlist</h1>
          <p className="text-slate-400">Track opportunities you're interested in</p>
        </div>
      </FadeIn>

      {watchlist.length > 0 ? (
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
