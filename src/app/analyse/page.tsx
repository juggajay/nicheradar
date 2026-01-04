'use client';

import { useState } from 'react';
import { FadeIn } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GapScore, PhaseBadge } from '@/components/dashboard';
import { Search, Loader2, TrendingUp, Eye, Bookmark } from 'lucide-react';

export default function AnalysePage() {
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<null | {
    keyword: string;
    gap_score: number;
    momentum: number;
    supply: number;
    phase: 'innovation' | 'emergence' | 'growth' | 'maturity' | 'saturated';
    confidence: 'high' | 'medium' | 'low';
  }>(null);

  const handleAnalyse = async () => {
    if (!keyword.trim()) return;

    setIsLoading(true);

    // Simulate analysis - will be replaced with actual API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    setResult({
      keyword: keyword,
      gap_score: Math.floor(Math.random() * 40) + 50,
      momentum: Math.floor(Math.random() * 30) + 60,
      supply: Math.floor(Math.random() * 40) + 20,
      phase: ['emergence', 'growth', 'innovation'][Math.floor(Math.random() * 3)] as 'emergence',
      confidence: ['high', 'medium'][Math.floor(Math.random() * 2)] as 'high',
    });

    setIsLoading(false);
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

      {result && (
        <FadeIn>
          <Card className="border-slate-800/50 bg-slate-900/50 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-white">{result.keyword}</h2>
                  <PhaseBadge phase={result.phase} />
                </div>
                <p className="text-sm text-slate-400">Analysis complete</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Bookmark className="h-4 w-4" />
                Add to Watchlist
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                <GapScore score={result.gap_score} size="lg" />
              </div>
              <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-emerald-400">
                  <TrendingUp className="h-6 w-6" />
                  {result.momentum}
                </div>
                <span className="text-xs text-slate-500">Momentum</span>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-blue-400">
                  <Eye className="h-6 w-6" />
                  {result.supply}
                </div>
                <span className="text-xs text-slate-500">YT Supply</span>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {!result && !isLoading && (
        <FadeIn delay={0.2}>
          <div className="text-center py-16">
            <Search className="h-16 w-16 mx-auto text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">Enter a keyword to get started</h3>
            <p className="text-sm text-slate-500">We'll analyse YouTube competition and external momentum</p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
