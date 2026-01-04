'use client';

import { useState } from 'react';
import { FadeIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PhaseBadge, GapScore } from '@/components/dashboard';
import { Compass, Loader2, Sparkles, ExternalLink, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface DiscoveryResult {
  keyword: string;
  gap_score: number;
  phase: string;
  confidence: string;
  tracked: boolean;
  opportunity_id?: string;
}

export default function DiscoverPage() {
  const [seedKeyword, setSeedKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async () => {
    if (!seedKeyword.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seedKeyword.trim() }),
      });

      if (!response.ok) {
        throw new Error('Discovery failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotalFound(data.sub_niches_found || 0);
    } catch (err) {
      setError('Failed to discover sub-niches. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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
                placeholder="Enter a seed keyword (e.g., 'gardening', 'productivity', 'AI tools')"
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

      {results.length > 0 && (
        <FadeIn>
          <div className="mb-4">
            <h2 className="text-lg font-medium text-white">
              Found {totalFound} sub-niches, showing top {results.length}
            </h2>
          </div>
          <div className="space-y-3">
            {results.map((result, index) => (
              <Card
                key={index}
                className="border-slate-800/50 bg-slate-900/50 p-4 hover:border-violet-500/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-medium">{result.keyword}</h3>
                      <PhaseBadge phase={result.phase as 'innovation' | 'emergence' | 'growth' | 'maturity' | 'saturated'} />
                      {result.tracked && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <Check className="h-3 w-3" />
                          Tracked
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">
                      {result.confidence} confidence
                      {!result.tracked && ' • Not yet tracked'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <GapScore score={result.gap_score} />
                    {result.opportunity_id && (
                      <Link href={`/opportunity/${result.opportunity_id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <ExternalLink className="h-4 w-4" />
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </FadeIn>
      )}

      {results.length === 0 && !isLoading && !error && (
        <FadeIn delay={0.2}>
          <div className="text-center py-16">
            <Compass className="h-16 w-16 mx-auto text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">Explore content niches</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Enter a broad topic and we'll use YouTube autocomplete to find related sub-niches
              with potential content opportunities
            </p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
