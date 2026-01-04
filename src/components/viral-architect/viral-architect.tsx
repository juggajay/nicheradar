'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArchetypeSelector } from './archetype-selector';
import { BlueprintDisplay } from './blueprint-display';
import { Sparkles, Loader2, X, Wand2 } from 'lucide-react';

interface Archetype {
  key: string;
  id: string;
  name: string;
  category: string;
  sub_category: string;
  difficulty: string;
  faceless_score: number;
}

interface Blueprint {
  title: string;
  thumbnail_description: string;
  hook_script: Record<string, string>;
  structure_notes: string;
  full_outline: string[];
}

interface ViralArchitectProps {
  topicName: string;
  contextSummary?: string;
  onClose?: () => void;
}

export function ViralArchitect({ topicName, contextSummary, onClose }: ViralArchitectProps) {
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedArchetype) return;

    setIsGenerating(true);
    setError(null);
    setBlueprint(null);

    try {
      const response = await fetch('/api/generate-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_name: topicName,
          context_summary: contextSummary || '',
          archetype_id: selectedArchetype.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setBlueprint(data.blueprint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate blueprint');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-visible border-slate-800/50 bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Viral Architect</h2>
              <p className="text-xs text-slate-500">Generate video blueprint for "{topicName}"</p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 overflow-visible">
          {!blueprint ? (
            <div className="space-y-4 min-h-[300px]">
              <div className="relative">
                <label className="text-sm text-slate-400 mb-2 block">
                  Select Viral Archetype
                </label>
                <ArchetypeSelector
                  onSelect={setSelectedArchetype}
                  selectedId={selectedArchetype?.id}
                />
              </div>

              {selectedArchetype && (
                <div className="rounded-lg bg-slate-800/50 p-4 mt-4">
                  <p className="text-sm text-slate-400 mb-2">Selected:</p>
                  <p className="font-medium text-white">{selectedArchetype.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedArchetype.category} • {selectedArchetype.sub_category} •
                    Difficulty: {selectedArchetype.difficulty}
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!selectedArchetype || isGenerating}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Blueprint...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Video Blueprint
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto">
              <BlueprintDisplay
                blueprint={blueprint}
                archetype={{
                  id: selectedArchetype!.id,
                  name: selectedArchetype!.name,
                  category: selectedArchetype!.category,
                }}
              />

              <Button
                variant="outline"
                onClick={() => {
                  setBlueprint(null);
                  setSelectedArchetype(null);
                }}
                className="w-full"
              >
                Generate Another Blueprint
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
