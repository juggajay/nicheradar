import { NextRequest, NextResponse } from 'next/server';
import playbooks from '@/data/viral_playbooks.json';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface BlueprintRequest {
  topic_name: string;
  context_summary: string;
  archetype_id: string;
}

interface HookScript {
  [timestamp: string]: string;
}

interface BlueprintResponse {
  title: string;
  thumbnail_description: string;
  hook_script: HookScript;
  structure_notes: string;
  full_outline: string[];
}

// Get archetype by ID (e.g., "ARCH_009" or "09_the_verdict_matrix")
function getArchetype(archetypeId: string) {
  const archetypes = playbooks.archetypes as Record<string, any>;

  // Try direct key match first
  if (archetypes[archetypeId]) {
    return archetypes[archetypeId];
  }

  // Try matching by archetype_id field
  for (const [key, value] of Object.entries(archetypes)) {
    if (value.archetype_id === archetypeId) {
      return value;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const body: BlueprintRequest = await request.json();
    const { topic_name, context_summary, archetype_id } = body;

    if (!topic_name || !archetype_id) {
      return NextResponse.json(
        { error: 'topic_name and archetype_id are required' },
        { status: 400 }
      );
    }

    const archetype = getArchetype(archetype_id);
    if (!archetype) {
      return NextResponse.json(
        { error: `Archetype not found: ${archetype_id}` },
        { status: 404 }
      );
    }

    // Extract key constraints from archetype
    const titleSyntax = archetype.click_logic?.title_syntax;
    const thumbnailMeta = archetype.click_logic?.thumbnail_meta;
    const hookScript = archetype.hook_script;
    const narrativeStructure = archetype.narrative_structure;
    const psychMechanics = archetype.psychological_mechanics;

    // Build strict system prompt
    const systemPrompt = `You are a YouTube content strategist. Your job is to fill in a PROVEN VIRAL BLUEPRINT, not be creative.

ARCHETYPE: ${archetype.archetype_name}
CATEGORY: ${archetype.category} / ${archetype.sub_category}

PSYCHOLOGICAL DRIVER: ${psychMechanics?.primary_driver || 'Curiosity Gap'}
${psychMechanics?.explanation || ''}

=== STRICT CONSTRAINTS ===

TITLE RULES:
- Primary Formula: "${titleSyntax?.primary_formula || '[Topic]: [Strong Opinion]'}"
- Alternate Formulas: ${JSON.stringify(titleSyntax?.alternate_formulas || [])}
- Rules: ${JSON.stringify(titleSyntax?.rules || [])}
- Examples: ${JSON.stringify(titleSyntax?.examples || [])}

THUMBNAIL RULES:
- Face Expression: ${thumbnailMeta?.face_expression || 'N/A'}
- Composition: ${thumbnailMeta?.composition || 'N/A'}
- Color Scheme: ${thumbnailMeta?.color_scheme || 'N/A'}
- Text Overlays: ${thumbnailMeta?.text_overlays || 'Minimal'}
- Key Elements: ${JSON.stringify(thumbnailMeta?.key_elements || [])}

HOOK SCRIPT STRUCTURE (First ${hookScript?.total_duration_seconds || 60} seconds):
${hookScript?.structure ? JSON.stringify(hookScript.structure, null, 2) : 'Standard hook -> pivot -> thesis'}

NARRATIVE BEATS:
${narrativeStructure?.acts ? JSON.stringify(narrativeStructure.acts, null, 2) : 'Standard 3-act structure'}

=== YOUR TASK ===

Topic: "${topic_name}"
Context: "${context_summary || 'No additional context provided'}"

Generate a production-ready video blueprint following the EXACT constraints above. Do NOT invent your own structure. Fill in the template.

Respond with ONLY valid JSON in this exact format:
{
  "title": "The exact viral title using the title_syntax formula",
  "thumbnail_description": "Specific visual instructions based on thumbnail_meta rules",
  "hook_script": {
    "0:00-0:03": "Opening visual/audio hook",
    "0:03-0:15": "The setup/context",
    "0:15-0:30": "The pivot/tension",
    "0:30-0:45": "The thesis/promise",
    "0:45-1:00": "Transition to main content"
  },
  "structure_notes": "Pacing and tone advice based on the archetype",
  "full_outline": [
    "Section 1: ...",
    "Section 2: ...",
    "Section 3: ..."
  ]
}`;

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate blueprint', details: error },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse blueprint', raw: text },
        { status: 500 }
      );
    }

    const blueprint: BlueprintResponse = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      archetype: {
        id: archetype.archetype_id,
        name: archetype.archetype_name,
        category: archetype.category,
      },
      blueprint,
    });
  } catch (error) {
    console.error('Blueprint generation error:', error);
    return NextResponse.json(
      { error: 'Blueprint generation failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to list all archetypes
export async function GET() {
  const archetypes = playbooks.archetypes as Record<string, any>;

  const list = Object.entries(archetypes).map(([key, value]) => ({
    key,
    id: value.archetype_id,
    name: value.archetype_name,
    category: value.category,
    sub_category: value.sub_category,
    difficulty: value.difficulty_to_produce,
    faceless_score: value.faceless_adaptability?.score,
  }));

  return NextResponse.json({
    total: list.length,
    archetypes: list,
  });
}
