import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/cleanup
 * Removes opportunities with placeholder/stale data that can't be recalculated
 *
 * Options:
 * - mode: 'dry-run' (default) or 'delete'
 * - minMomentum: Delete opps with momentum below this (default: exclude)
 * - maxSupply: Delete opps with supply above this (default: exclude)
 * - noYoutubeData: Delete opps without youtube_supply records (default: false)
 * - placeholderValues: Delete opps with exact placeholder values (100, 10, 90) (default: true)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json().catch(() => ({}));
  const mode = body.mode || 'dry-run';
  const deletePlaceholders = body.placeholderValues !== false;
  const deleteNoYoutubeData = body.noYoutubeData === true;

  try {
    const toDelete: { id: string; keyword: string; reason: string }[] = [];

    // Find opportunities with placeholder values (momentum=100, supply=10, gap=90)
    if (deletePlaceholders) {
      const { data: placeholders } = await supabase
        .from('opportunities')
        .select('id, keyword, external_momentum, youtube_supply, gap_score')
        .eq('external_momentum', 100)
        .eq('youtube_supply', 10)
        .gte('gap_score', 89)
        .lte('gap_score', 91);

      for (const opp of placeholders || []) {
        toDelete.push({
          id: opp.id,
          keyword: opp.keyword,
          reason: `Placeholder values (momentum=${opp.external_momentum}, supply=${opp.youtube_supply}, gap=${opp.gap_score})`,
        });
      }
    }

    // Find opportunities without youtube_supply data
    if (deleteNoYoutubeData) {
      const { data: allOpps } = await supabase
        .from('opportunities')
        .select('id, keyword, topic_id');

      for (const opp of allOpps || []) {
        // Check if this topic has youtube_supply data
        const { data: ytData } = await supabase
          .from('youtube_supply')
          .select('id')
          .eq('topic_id', opp.topic_id)
          .limit(1)
          .single();

        if (!ytData) {
          // Check if not already in toDelete
          if (!toDelete.find((d) => d.id === opp.id)) {
            toDelete.push({
              id: opp.id,
              keyword: opp.keyword,
              reason: 'No youtube_supply data available',
            });
          }
        }
      }
    }

    if (mode === 'delete' && toDelete.length > 0) {
      const ids = toDelete.map((d) => d.id);
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .in('id', ids);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        mode: 'delete',
        deleted: toDelete.length,
        opportunities: toDelete,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      wouldDelete: toDelete.length,
      opportunities: toDelete,
      message: `Found ${toDelete.length} opportunities to clean up. Use mode='delete' to remove them.`,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: String(error) },
      { status: 500 }
    );
  }
}
