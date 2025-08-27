
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';

interface ApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (apiKey: string) => void;
  existingApiKey: string | null;
}

export function ApiKeyDialog({ isOpen, onOpenChange, onSave, existingApiKey }: ApiKeyDialogProps) {
  const [newApiKey, setNewApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewApiKey('');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (newApiKey.trim()) {
      onSave(newApiKey.trim());
    }
  };

  const getMaskedKey = () => {
    if (!existingApiKey) return 'None';
    return `••••••••••••${existingApiKey.slice(-4)}`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound /> Manage API Key
          </DialogTitle>
          <DialogDescription>
            Please enter your Google AI API key to generate images. You can get one from{' '}
            <Link href="https://ai.studio/apikey" target="_blank" className="underline">
              Google AI Studio
            </Link>
            . Your key will be stored securely in your browser's local storage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="existing-api-key" className="text-right">
                    Current Key
                </Label>
                <Input
                    id="existing-api-key"
                    value={getMaskedKey()}
                    className="col-span-3 font-code"
                    disabled
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="api-key" className="text-right">
                    New Key
                </Label>
                <Input
                    id="api-key"
                    type="text"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="Enter new API key..."
                    className="col-span-3"
                />
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={!newApiKey.trim()}>
            Save New Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
