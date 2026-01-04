// Google Trends integration - Simple trend direction detection
// Only used in Stage 2 (on-demand) to avoid rate limits

import googleTrends from 'google-trends-api';

export interface TrendResult {
  status: 'success' | 'insufficient_data' | 'error' | 'unavailable';
  trend: 'spiking' | 'growing' | 'stable' | 'dropping' | 'unknown';
  sparkline?: number[];
  message?: string;
}

export async function getTrendHealth(keyword: string): Promise<TrendResult> {
  try {
    const results = await googleTrends.interestOverTime({
      keyword: keyword,
      startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
      geo: 'US',
    });

    const data = JSON.parse(results);
    const timeline = data.default?.timelineData;

    if (!timeline || timeline.length < 5) {
      return { status: 'insufficient_data', trend: 'unknown' };
    }

    // Dynamic slicing - split available data in half
    const midpoint = Math.floor(timeline.length / 2);
    const firstHalf = timeline.slice(0, midpoint);
    const secondHalf = timeline.slice(midpoint);

    // Calculate averages
    const avg1 = firstHalf.reduce((sum: number, p: { value: number[] }) => sum + p.value[0], 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((sum: number, p: { value: number[] }) => sum + p.value[0], 0) / secondHalf.length;

    // Determine direction based on growth ratio
    const growth = avg2 / (avg1 || 1); // Avoid divide by zero

    let trend: TrendResult['trend'] = 'stable';
    if (growth > 2.0) trend = 'spiking';      // >100% growth
    else if (growth > 1.3) trend = 'growing'; // >30% growth
    else if (growth < 0.5) trend = 'dropping'; // >50% drop
    else if (growth < 0.8) trend = 'dropping'; // >20% drop

    // Extract sparkline data for mini chart
    const sparkline = timeline.map((t: { value: number[] }) => t.value[0]);

    return {
      status: 'success',
      trend,
      sparkline,
    };
  } catch (error) {
    console.error('Google Trends error:', error);

    // Rate limit or API failure - graceful degradation
    return {
      status: 'error',
      trend: 'unknown',
      message: error instanceof Error ? error.message : 'Trend data unavailable',
    };
  }
}
