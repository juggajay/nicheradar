import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get opportunity counts
    const { count: totalCount } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true });

    const { count: highConfidenceCount } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('confidence', 'high');

    // Get average gap score
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('gap_score');

    const avgGapScore = opportunities?.length
      ? opportunities.reduce((sum, o) => sum + o.gap_score, 0) / opportunities.length
      : 0;

    // Get last scan
    const { data: lastScan } = await supabase
      .from('scan_log')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      totalOpportunities: totalCount || 0,
      highConfidence: highConfidenceCount || 0,
      avgGapScore,
      lastScan: lastScan?.completed_at || null,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
