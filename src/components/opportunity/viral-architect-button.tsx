'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { ViralArchitect } from '@/components/viral-architect';

interface ViralArchitectButtonProps {
  topicName: string;
  contextSummary?: string;
}

export function ViralArchitectButton({ topicName, contextSummary }: ViralArchitectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Viral Architect
      </Button>

      {isOpen && (
        <ViralArchitect
          topicName={topicName}
          contextSummary={contextSummary}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
