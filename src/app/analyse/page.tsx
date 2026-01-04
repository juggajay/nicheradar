'use client';

import { useState } from 'react';
import { FadeIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GapScore, PhaseBadge, SourceIcons } from '@/components/dashboard';
import { Search, Loader2, TrendingUp, Eye, Bookmark, BookmarkCheck, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface AnalysisResult {
  keyword: string;
  gap_score: number;
  momentum: number;
  supply: number;
  phase: 'innovation' | 'emergence' | 'growth' | 'maturity' | 'saturated';
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  existing: boolean;
  opportunity_id?: string;
  topic_id?: string;
  message?: string;
  is_watched?: boolean;
}

export default function AnalysePage() {
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  const handleToggleWatch = async () => {
    if (!result?.opportunity_id) return;

    setWatchLoading(true);
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: result.opportunity_id,
          is_watched: !isWatched,
        }),
      });

      if (response.ok) {
        setIsWatched(!isWatched);
      }
    } catch (err) {
      console.error('Failed to update watchlist:', err);
    } finally {
      setWatchLoading(false);
    }
  };

  const handleAnalyse = async () => {
    if (!keyword.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setResult(data);
      setIsWatched(data.is_watched || false);
    } catch (err) {
      setError('Failed to analyse keyword. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Analyse Keyword</h1>
          <p className="text-slate-400">Enter any keyword to analyse its YouTube opportunity potential</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card className="border-slate-800/50 bg-slate-900/50 p-6 mb-8">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                type="text"
                placeholder="Enter a keyword to analyse..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyse()}
                className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-12"
              />
            </div>
            <Button
              onClick={handleAnalyse}
              disabled={isLoading || !keyword.trim()}
              className="h-12 px-8 bg-violet-600 hover:bg-violet-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analysing...
                </>
              ) : (
                'Analyse'
              )}
            </Button>
          </div>
        </Card>
      </FadeIn>

      {error && (
        <FadeIn>
          <Card className="border-red-800/50 bg-red-900/20 p-4 mb-8">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          </Card>
        </FadeIn>
      )}

      {result && (
        <FadeIn>
          <Card className="border-slate-800/50 bg-slate-900/50 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-white">{result.keyword}</h2>
                  <PhaseBadge phase={result.phase} />
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="capitalize">{result.confidence} confidence</span>
                  {result.sources.length > 0 && <SourceIcons sources={result.sources} />}
                </div>
              </div>
              <div className="flex gap-2">
                {result.opportunity_id && (
                  <Link href={`/opportunity/${result.opportunity_id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      View Details
                    </Button>
                  </Link>
                )}
                {result.opportunity_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-2 ${isWatched ? 'border-emerald-500 text-emerald-400' : ''}`}
                    onClick={handleToggleWatch}
                    disabled={watchLoading}
                  >
                    {watchLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isWatched ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                    {isWatched ? 'Watching' : 'Add to Watchlist'}
                  </Button>
                )}
              </div>
            </div>

            {result.message && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-400 mb-6">
                <AlertCircle className="h-4 w-4" />
                {result.message}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                <GapScore score={result.gap_score} size="lg" />
              </div>
              <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-emerald-400">
                  <TrendingUp className="h-6 w-6" />
                  {Math.round(result.momentum)}
                </div>
                <span className="text-xs text-slate-500">Momentum</span>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-blue-400">
                  <Eye className="h-6 w-6" />
                  {Math.round(result.supply)}
                </div>
                <span className="text-xs text-slate-500">YT Supply</span>
              </div>
            </div>

            {result.existing && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-sm text-slate-400">
                  This keyword is already being tracked by NicheRadar.{' '}
                  {result.opportunity_id && (
                    <Link href={`/opportunity/${result.opportunity_id}`} className="text-violet-400 hover:text-violet-300">
                      View full analysis
                    </Link>
                  )}
                </p>
              </div>
            )}
          </Card>
        </FadeIn>
      )}

      {!result && !isLoading && !error && (
        <FadeIn delay={0.2}>
          <div className="text-center py-16">
            <Search className="h-16 w-16 mx-auto text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">Enter a keyword to get started</h3>
            <p className="text-sm text-slate-500">We'll check if it's being tracked and show its opportunity score</p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
