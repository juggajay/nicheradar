import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    // Existing filters
    const phase = searchParams.get('phase');
    const category = searchParams.get('category');
    const confidence = searchParams.get('confidence');

    // V2 filters
    const crossPlatformOnly = searchParams.get('crossPlatformOnly') === 'true';
    const acceleratingOnly = searchParams.get('acceleratingOnly') === 'true';
    const hasAuthorityGap = searchParams.get('hasAuthorityGap') === 'true';
    const hasFreshnessGap = searchParams.get('hasFreshnessGap') === 'true';

    // Sorting - support both v1 and v2 scores
    const sortBy = searchParams.get('sortBy') || 'gap_score';
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('opportunities')
      .select('*')
      .order(sortBy, { ascending: false, nullsFirst: false })
      .limit(limit);

    // Existing filters
    if (phase) {
      query = query.eq('phase', phase);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (confidence) {
      query = query.eq('confidence', confidence);
    }

    // V2 filters
    if (crossPlatformOnly) {
      query = query.gte('cross_platform_count', 2);
    }
    if (acceleratingOnly) {
      query = query.eq('velocity_trend', 'accelerating');
    }
    if (hasAuthorityGap) {
      query = query.eq('has_authority_gap', true);
    }
    if (hasFreshnessGap) {
      query = query.eq('has_freshness_gap', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
