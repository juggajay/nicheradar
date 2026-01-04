import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const phase = searchParams.get('phase');
    const category = searchParams.get('category');
    const confidence = searchParams.get('confidence');
    const sortBy = searchParams.get('sortBy') || 'gap_score';
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('opportunities')
      .select('*')
      .order(sortBy, { ascending: false })
      .limit(limit);

    if (phase) {
      query = query.eq('phase', phase);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (confidence) {
      query = query.eq('confidence', confidence);
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
