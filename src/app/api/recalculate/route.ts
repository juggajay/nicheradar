import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateVolumeScore,
  calculateAuthorityScore,
  calculateFreshnessScore,
  calculateSupplyScore,
  calculateVelocity,
  getVelocityMultiplier,
  getNewTopicBonus,
} from '@/lib/scoring';
import type { TopVideoData } from '@/types/database';

/**
 * POST /api/recalculate
 * Recalculates all opportunity scores based on stored YouTube data
 * This fixes opportunities that have stale/placeholder values
 */
export async function POST() {
  const startTime = Date.now();
  const supabase = await createClient();

  try {
    // Get all opportunities with their topics
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('id, topic_id, keyword, external_momentum');

    if (oppError) {
      throw new Error(`Failed to fetch opportunities: ${oppError.message}`);
    }

    if (!opportunities || opportunities.length === 0) {
      return NextResponse.json({ message: 'No opportunities to recalculate' });
    }

    console.log(`Recalculating ${opportunities.length} opportunities...`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const opp of opportunities) {
      try {
        // Get the latest YouTube supply data for this topic
        const { data: youtubeData } = await supabase
          .from('youtube_supply')
          .select('*')
          .eq('topic_id', opp.topic_id)
          .order('checked_at', { ascending: false })
          .limit(1)
          .single();

        // Get the latest signal for momentum
        const { data: signal } = await supabase
          .from('topic_signals')
          .select('momentum_score, cross_platform_count')
          .eq('topic_id', opp.topic_id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();

        // Get topic for first_seen_at
        const { data: topic } = await supabase
          .from('topics')
          .select('first_seen_at')
          .eq('id', opp.topic_id)
          .single();

        // Use stored momentum from signal, or keep existing
        const momentum = signal?.momentum_score || opp.external_momentum || 50;
        const crossPlatformCount = signal?.cross_platform_count || 1;

        // Calculate supply score
        let supplyScore: number;
        let hasAuthorityGap = false;
        let hasFreshnessGap = false;
        let isUnderserved = false;

        if (youtubeData && youtubeData.top_10_videos && youtubeData.top_10_videos.length > 0) {
          // Use v2 scoring with actual YouTube data
          const videos = youtubeData.top_10_videos as TopVideoData[];
          const volumeScore = calculateVolumeScore(youtubeData.total_results || 0);
          const authorityScore = calculateAuthorityScore(videos);
          const freshnessScore = calculateFreshnessScore(videos);
          supplyScore = calculateSupplyScore(volumeScore, authorityScore, freshnessScore);

          // Calculate opportunity flags
          hasAuthorityGap = authorityScore < 30;
          hasFreshnessGap = freshnessScore < 20;
          isUnderserved = (youtubeData.total_results || 0) < 1000 && momentum > 40;
        } else if (youtubeData?.supply_score) {
          // Use pre-calculated supply score
          supplyScore = youtubeData.supply_score;
        } else {
          // No YouTube data - skip this opportunity (it needs a YouTube check first)
          skipped++;
          continue;
        }

        // Calculate velocity
        const velocityResult = await calculateVelocity(opp.topic_id, momentum, supabase);

        // Calculate gap score with bonuses
        const velocityMultiplier = getVelocityMultiplier(velocityResult.trend);
        const newTopicBonus = getNewTopicBonus(topic?.first_seen_at || new Date().toISOString());
        const baseGap = momentum * (1 - supplyScore / 100);
        const gapScore = Math.round(baseGap * velocityMultiplier * newTopicBonus * 10) / 10;

        // Determine phase
        const phase =
          gapScore >= 60 && supplyScore < 30
            ? 'innovation'
            : gapScore >= 45 && supplyScore < 50
            ? 'emergence'
            : gapScore >= 30
            ? 'growth'
            : gapScore >= 15
            ? 'maturity'
            : 'saturated';

        // Determine confidence
        const confidence =
          momentum >= 60 && supplyScore < 40
            ? 'high'
            : momentum >= 40
            ? 'medium'
            : 'low';

        // Update the opportunity
        const { error: updateError } = await supabase
          .from('opportunities')
          .update({
            external_momentum: momentum,
            youtube_supply: supplyScore,
            gap_score: gapScore,
            phase,
            confidence,
            velocity_24h: velocityResult.velocity24h,
            velocity_7d: velocityResult.velocity7d,
            velocity_trend: velocityResult.trend,
            cross_platform_count: crossPlatformCount,
            has_authority_gap: hasAuthorityGap,
            has_freshness_gap: hasFreshnessGap,
            is_underserved: isUnderserved,
            calculated_at: new Date().toISOString(),
          })
          .eq('id', opp.id);

        if (updateError) {
          console.error(`Failed to update ${opp.keyword}:`, updateError);
          errors++;
        } else {
          updated++;
          if (updated % 50 === 0) {
            console.log(`Progress: ${updated}/${opportunities.length} updated`);
          }
        }
      } catch (e) {
        console.error(`Error processing ${opp.keyword}:`, e);
        errors++;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      total: opportunities.length,
      updated,
      skipped,
      errors,
      duration_seconds: duration,
      message: `Recalculated ${updated} opportunities in ${duration}s (${skipped} skipped, ${errors} errors)`,
    });
  } catch (error) {
    console.error('Recalculation error:', error);
    return NextResponse.json(
      { error: 'Recalculation failed', details: String(error) },
      { status: 500 }
    );
  }
}
