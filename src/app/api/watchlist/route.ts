import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('is_watched', true)
      .order('gap_score', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { opportunity_id, is_watched, notes } = await request.json();

    if (!opportunity_id) {
      return NextResponse.json({ error: 'opportunity_id required' }, { status: 400 });
    }

    const supabase = await createClient();

    const updateData: { is_watched?: boolean; notes?: string } = {};
    if (typeof is_watched === 'boolean') {
      updateData.is_watched = is_watched;
    }
    if (typeof notes === 'string') {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('opportunities')
      .update(updateData)
      .eq('id', opportunity_id)
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
