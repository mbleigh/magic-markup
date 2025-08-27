
'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardCopy, Download, Check, X } from 'lucide-react';

interface GeneratedImageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  baseImage: string | null;
  generatedImage: string | null;
  handleCopy: () => void;
  handleDownload: () => void;
  handleKeepEditing: () => void;
}

export function GeneratedImageDialog({
  isOpen,
  onOpenChange,
  baseImage,
  generatedImage,
  handleCopy,
  handleDownload,
  handleKeepEditing,
}: GeneratedImageDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Generated Image</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2 text-center">Original</h3>
            <Image
              src={baseImage || ''}
              alt="Original"
              width={800}
              height={800}
              className="rounded-lg object-contain"
            />
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-center">Generated</h3>
            <Image
              src={generatedImage || ''}
              alt="Generated"
              width={800}
              height={800}
              className="rounded-lg object-contain"
              data-ai-hint="abstract art"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>
            <ClipboardCopy className="mr-2" /> Copy
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2" /> Download
          </Button>
          <Button onClick={handleKeepEditing}>
            <Check className="mr-2" /> Keep Editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
