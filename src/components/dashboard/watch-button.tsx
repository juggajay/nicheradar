'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark, Loader2 } from 'lucide-react';

interface WatchButtonProps {
  opportunityId: string;
  initialWatched: boolean;
  variant?: 'icon' | 'full';
}

export function WatchButton({ opportunityId, initialWatched, variant = 'icon' }: WatchButtonProps) {
  const [isWatched, setIsWatched] = useState(initialWatched);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          is_watched: !isWatched,
        }),
      });

      if (response.ok) {
        setIsWatched(!isWatched);
      }
    } catch (error) {
      console.error('Failed to toggle watch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`p-2 rounded-lg transition-colors ${
          isWatched
            ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
        }`}
        title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bookmark className={`h-4 w-4 ${isWatched ? 'fill-current' : ''}`} />
        )}
      </button>
    );
  }

  return (
    <Button
      onClick={handleToggle}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bookmark className={`h-4 w-4 ${isWatched ? 'fill-current' : ''}`} />
      )}
      {isWatched ? 'Watching' : 'Watch'}
    </Button>
  );
}
