'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, Check, Zap, Film, Microscope, Trophy, Users } from 'lucide-react';

interface Archetype {
  key: string;
  id: string;
  name: string;
  category: string;
  sub_category: string;
  difficulty: string;
  faceless_score: number;
}

interface ArchetypeSelectorProps {
  onSelect: (archetype: Archetype) => void;
  selectedId?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'Entertainment': <Zap className="h-4 w-4" />,
  'Tech': <Microscope className="h-4 w-4" />,
  'Documentary': <Film className="h-4 w-4" />,
  'Competition': <Trophy className="h-4 w-4" />,
  'Lifestyle': <Users className="h-4 w-4" />,
};

export function ArchetypeSelector({ onSelect, selectedId }: ArchetypeSelectorProps) {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/generate-blueprint')
      .then(res => res.json())
      .then(data => {
        setArchetypes(data.archetypes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selected = archetypes.find(a => a.id === selectedId);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Low': return 'text-green-400';
      case 'Medium': return 'text-yellow-400';
      case 'High': return 'text-orange-400';
      case 'Very High': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-800 rounded-lg h-12 w-full" />
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between bg-slate-800/50 border-slate-700 hover:bg-slate-800"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            {categoryIcons[selected.category] || <Sparkles className="h-4 w-4" />}
            {selected.name}
          </span>
        ) : (
          <span className="text-slate-400">Select a viral archetype...</span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full max-h-[400px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {archetypes.map((archetype) => (
            <button
              key={archetype.id}
              onClick={() => {
                onSelect(archetype);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors flex items-center justify-between ${
                selectedId === archetype.id ? 'bg-slate-800' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-violet-400">
                  {categoryIcons[archetype.category] || <Sparkles className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-medium text-white">{archetype.name}</p>
                  <p className="text-xs text-slate-500">
                    {archetype.category} • {archetype.sub_category}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${getDifficultyColor(archetype.difficulty)}`}>
                  {archetype.difficulty}
                </span>
                {selectedId === archetype.id && (
                  <Check className="h-4 w-4 text-emerald-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
