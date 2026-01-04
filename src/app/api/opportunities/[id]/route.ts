import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get opportunity with related data
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .single();

    if (oppError) {
      if (oppError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      throw oppError;
    }

    // Get topic sources
    const { data: sources } = await supabase
      .from('topic_sources')
      .select('*')
      .eq('topic_id', opportunity.topic_id)
      .order('detected_at', { ascending: false });

    // Get recent signals for trend chart
    const { data: signals } = await supabase
      .from('topic_signals')
      .select('*')
      .eq('topic_id', opportunity.topic_id)
      .order('recorded_at', { ascending: false })
      .limit(30);

    // Get YouTube supply data
    const { data: youtubeData } = await supabase
      .from('youtube_supply')
      .select('*')
      .eq('topic_id', opportunity.topic_id)
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      opportunity,
      sources: sources || [],
      signals: signals || [],
      youtube: youtubeData || null,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('opportunities')
      .update({
        is_watched: body.is_watched,
        notes: body.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
