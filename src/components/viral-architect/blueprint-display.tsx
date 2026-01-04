'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Image, Clock, List, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface Blueprint {
  title: string;
  thumbnail_description: string;
  hook_script: Record<string, string>;
  structure_notes: string;
  full_outline: string[];
}

interface BlueprintDisplayProps {
  blueprint: Blueprint;
  archetype: {
    id: string;
    name: string;
    category: string;
  };
}

export function BlueprintDisplay({ blueprint, archetype }: BlueprintDisplayProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CopyButton = ({ text, section }: { text: string; section: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, section)}
      className="h-8 w-8 p-0"
    >
      {copiedSection === section ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <Copy className="h-4 w-4 text-slate-500" />
      )}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-violet-400 font-medium uppercase tracking-wider">
            {archetype.name}
          </p>
          <p className="text-xs text-slate-500">{archetype.category}</p>
        </div>
      </div>

      {/* Title */}
      <Card className="border-slate-800/50 bg-slate-900/50 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> VIRAL TITLE
            </p>
            <h2 className="text-xl font-bold text-white">{blueprint.title}</h2>
          </div>
          <CopyButton text={blueprint.title} section="title" />
        </div>
      </Card>

      {/* Thumbnail */}
      <Card className="border-slate-800/50 bg-slate-900/50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Image className="h-3 w-3" /> THUMBNAIL BRIEF
            </p>
            <p className="text-slate-300">{blueprint.thumbnail_description}</p>
          </div>
          <CopyButton text={blueprint.thumbnail_description} section="thumbnail" />
        </div>
      </Card>

      {/* Hook Script */}
      <Card className="border-slate-800/50 bg-slate-900/50 p-4">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3" /> HOOK SCRIPT (First 60 Seconds)
          </p>
          <CopyButton
            text={Object.entries(blueprint.hook_script)
              .map(([time, text]) => `[${time}] ${text}`)
              .join('\n\n')}
            section="hook"
          />
        </div>
        <div className="space-y-3">
          {Object.entries(blueprint.hook_script).map(([timestamp, script]) => (
            <div key={timestamp} className="flex gap-3">
              <span className="text-xs font-mono text-violet-400 w-20 flex-shrink-0">
                {timestamp}
              </span>
              <p className="text-slate-300 text-sm">{script}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Structure Notes */}
      <Card className="border-slate-800/50 bg-slate-900/50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1">PACING & TONE</p>
            <p className="text-slate-300 text-sm">{blueprint.structure_notes}</p>
          </div>
          <CopyButton text={blueprint.structure_notes} section="notes" />
        </div>
      </Card>

      {/* Full Outline */}
      <Card className="border-slate-800/50 bg-slate-900/50 p-4">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <List className="h-3 w-3" /> FULL VIDEO OUTLINE
          </p>
          <CopyButton
            text={blueprint.full_outline.join('\n')}
            section="outline"
          />
        </div>
        <ol className="space-y-2">
          {blueprint.full_outline.map((section, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="text-violet-400 font-mono w-6">{i + 1}.</span>
              <span className="text-slate-300">{section}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Copy All */}
      <Button
        onClick={() => copyToClipboard(
          `TITLE: ${blueprint.title}\n\nTHUMBNAIL: ${blueprint.thumbnail_description}\n\nHOOK SCRIPT:\n${Object.entries(blueprint.hook_script).map(([t, s]) => `[${t}] ${s}`).join('\n')}\n\nPACING: ${blueprint.structure_notes}\n\nOUTLINE:\n${blueprint.full_outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
          'all'
        )}
        className="w-full bg-violet-600 hover:bg-violet-700"
      >
        {copiedSection === 'all' ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Copied Full Blueprint!
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Copy Full Blueprint
          </>
        )}
      </Button>
    </div>
  );
}
