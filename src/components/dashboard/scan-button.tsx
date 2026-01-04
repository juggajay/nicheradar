'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';

export function ScanButton() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [stats, setStats] = useState<{
    reddit_posts: number;
    hn_stories: number;
    topics_updated: number;
    opportunities_created: number;
  } | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setResult(null);
    setStats(null);

    try {
      const response = await fetch('/api/scan', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setResult('success');
        setStats(data.stats);
        // Reload page after 2 seconds to show new data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setResult('error');
      }
    } catch {
      setResult('error');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleScan}
        disabled={isScanning}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
        {isScanning ? 'Scanning...' : 'Run Scan'}
      </Button>

      {result === 'success' && stats && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Check className="h-4 w-4" />
          <span>
            {stats.topics_updated} topics, {stats.opportunities_created} new opportunities
          </span>
        </div>
      )}

      {result === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>Scan failed</span>
        </div>
      )}
    </div>
  );
}
