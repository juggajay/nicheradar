import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getYouTubeAutocomplete(query: string): Promise<string[]> {
  try {
    // YouTube's autocomplete API
    const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return [];

    const text = await response.text();
    // Response is JSONP, parse it
    const match = text.match(/\[.*\]/);
    if (!match) return [];

    const data = JSON.parse(match[0]);
    // Format: [query, [[suggestion1, 0], [suggestion2, 0], ...]]
    const suggestions = data[1] || [];
    return suggestions.map((s: [string, number]) => s[0]);
  } catch (e) {
    console.error('Autocomplete error:', e);
    return [];
  }
}

async function expandKeyword(seed: string): Promise<string[]> {
  const expansions = new Set<string>();

  // Get base suggestions
  const baseSuggestions = await getYouTubeAutocomplete(seed);
  baseSuggestions.forEach((s) => expansions.add(s));

  // Expand with common modifiers
  const modifiers = [
    ' tutorial',
    ' guide',
    ' for beginners',
    ' tips',
    ' how to',
    ' best',
    ' 2024',
    ' 2025',
  ];

  for (const mod of modifiers.slice(0, 3)) {
    const suggestions = await getYouTubeAutocomplete(seed + mod);
    suggestions.slice(0, 5).forEach((s) => expansions.add(s));
    await new Promise((r) => setTimeout(r, 100)); // Rate limit
  }

  // Also try alphabetic expansion
  for (const letter of 'abcdefgh'.split('').slice(0, 4)) {
    const suggestions = await getYouTubeAutocomplete(`${seed} ${letter}`);
    suggestions.slice(0, 3).forEach((s) => expansions.add(s));
    await new Promise((r) => setTimeout(r, 100));
  }

  return Array.from(expansions).slice(0, 50);
}

export async function POST(request: NextRequest) {
  try {
    const { seed } = await request.json();

    if (!seed || seed.length < 2) {
      return NextResponse.json({ error: 'Seed keyword required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Expand the seed keyword
    const subNiches = await expandKeyword(seed);

    // Check which ones we're already tracking
    const results = [];

    for (const keyword of subNiches) {
      const normalized = keyword.toLowerCase().replace(/[^\w\s]/g, '').trim();

      // Check if exists in opportunities
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id, gap_score, phase, confidence')
        .ilike('keyword', `%${normalized}%`)
        .limit(1)
        .single();

      if (existing) {
        results.push({
          keyword,
          gap_score: existing.gap_score,
          phase: existing.phase,
          confidence: existing.confidence,
          tracked: true,
          opportunity_id: existing.id,
        });
      } else {
        // Estimate based on keyword characteristics
        const hasYear = /202[4-6]/.test(keyword);
        const hasTutorial = /tutorial|guide|how to/i.test(keyword);
        const isLong = keyword.split(' ').length >= 4;

        // Long-tail + recent year = potentially good opportunity
        let estimatedGap = 30;
        if (hasYear) estimatedGap += 15;
        if (hasTutorial) estimatedGap += 10;
        if (isLong) estimatedGap += 20;

        results.push({
          keyword,
          gap_score: estimatedGap,
          phase: estimatedGap >= 60 ? 'emergence' : 'growth',
          confidence: 'low',
          tracked: false,
        });
      }
    }

    // Sort by gap score
    results.sort((a, b) => b.gap_score - a.gap_score);

    return NextResponse.json({
      seed,
      sub_niches_found: subNiches.length,
      results: results.slice(0, 30),
    });
  } catch (error) {
    console.error('Discover error:', error);
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
  }
}
