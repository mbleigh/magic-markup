
'use client';

import Image from 'next/image';
import {
  History,
  ChevronLeft,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconButton } from './icon-button';
import { SessionHistoryItem } from '@/lib/types';

interface HistorySidebarProps {
  isCameraRollOpen: boolean;
  setIsCameraRollOpen: (isOpen: boolean) => void;
  handleNewSession: () => void;
  sessionHistory: SessionHistoryItem[];
  activeHistoryId: string | null;
  loadStateFromHistoryItem: (item: SessionHistoryItem) => void;
  handleDeleteHistoryItem: (id: string) => void;
}

export function HistorySidebar({
  isCameraRollOpen,
  setIsCameraRollOpen,
  handleNewSession,
  sessionHistory,
  activeHistoryId,
  loadStateFromHistoryItem,
  handleDeleteHistoryItem,
}: HistorySidebarProps) {
  return (
    <aside
      className={`flex flex-col gap-4 border-r bg-card p-2 transition-all duration-300 ${
        isCameraRollOpen ? 'w-48' : 'w-12'
      }`}
    >
      <div className="flex items-center justify-between">
        {isCameraRollOpen && <CardTitle className="text-lg">History</CardTitle>}
        <IconButton
          icon={isCameraRollOpen ? ChevronLeft : History}
          tooltip={isCameraRollOpen ? 'Collapse History' : 'Expand History'}
          onClick={() => setIsCameraRollOpen(!isCameraRollOpen)}
        />
      </div>
      {isCameraRollOpen && (
        <>
          <Button size="sm" variant="outline" onClick={handleNewSession}>
            <Plus className="mr-2" /> New Session
          </Button>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 pr-2">
              {sessionHistory
                .slice()
                .reverse()
                .map((item) => (
                  <div key={item.id} className="relative group">
                    <button
                      onClick={() => loadStateFromHistoryItem(item)}
                      className={`w-full rounded-md border-2 overflow-hidden ${
                        activeHistoryId === item.id
                          ? 'border-primary'
                          : 'border-transparent hover:border-muted-foreground'
                      }`}
                    >
                      <Image
                        src={item.baseImage}
                        alt={`History item from ${item.createdAt}`}
                        width={150}
                        height={150}
                        className="object-cover w-full aspect-square"
                      />
                    </button>
                    <IconButton
                      icon={Trash2}
                      tooltip="Delete"
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteHistoryItem(item.id);
                      }}
                      className="absolute top-1 right-1 size-7 opacity-0 group-hover:opacity-100"
                    />
                  </div>
                ))}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  );
}
