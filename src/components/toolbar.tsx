
'use client';

import Image from 'next/image';
import {
  MousePointer2,
  Brush,
  ClipboardCopy,
  Download,
  Eraser,
  Loader2,
  Palette,
  Redo2,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  UploadCloud,
  X,
  Plus,
  Paintbrush,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ColorPicker } from './color-picker';
import { IconButton } from './icon-button';
import { BrushSize, Tool } from '@/lib/types';
import { useMagicMarkup } from '@/hooks/use-magic-markup';

type ToolbarProps = ReturnType<typeof useMagicMarkup>;

export function Toolbar({
  tool,
  setTool,
  undo,
  redo,
  handleClear,
  color,
  setColor,
  brushSize,
  setBrushSize,
  isElementUploadOpen,
  setIsElementUploadOpen,
  elementImageUrls,
  elementFileInputRef,
  handleElementImageUpload,
  handleRemoveElementImage,
  customPrompt,
  setCustomPrompt,
  handlePromptKeyDown,
  handleGenerate,
  isLoading,
  baseImage,
  EDITOR_COLORS,
}: ToolbarProps) {
  return (
    <aside className="flex flex-col gap-4 border-l bg-card p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Tools</CardTitle>
          <div className="flex items-center gap-1">
            <IconButton icon={Undo2} tooltip="Undo" onClick={undo} />
            <IconButton icon={Redo2} tooltip="Redo" onClick={redo} />
            <IconButton icon={Trash2} tooltip="Clear All" onClick={handleClear} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-1">
            <IconButton icon={MousePointer2} tooltip="Select" isActive={tool === 'select'} onClick={() => setTool('select')} />
            <IconButton icon={Brush} tooltip="Highlight" isActive={tool === 'highlight'} onClick={() => setTool('highlight')} />
            <IconButton icon={Type} tooltip="Annotate" isActive={tool === 'annotate'} onClick={() => setTool('annotate')} />
            <IconButton icon={Eraser} tooltip="Erase" isActive={tool === 'erase'} onClick={() => setTool('erase')} />
          </div>
          <Separator />
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Palette className="size-5 text-muted-foreground" />
              <ColorPicker colors={EDITOR_COLORS} selectedColor={color} onColorChange={setColor} />
            </div>
            <div className="flex items-center gap-2">
              <Paintbrush className="size-5 text-muted-foreground" />
              <ToggleGroup type="single" value={brushSize} onValueChange={(value) => value && setBrushSize(value as BrushSize)}>
                <ToggleGroupItem value="small" aria-label="Small">
                  <div className="bg-foreground rounded-full size-2" />
                </ToggleGroupItem>
                <ToggleGroupItem value="medium" aria-label="Medium">
                  <div className="bg-foreground rounded-full size-3" />
                </ToggleGroupItem>
                <ToggleGroupItem value="large" aria-label="Large">
                  <div className="bg-foreground rounded-full size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Elements</CardTitle>
          <Dialog open={isElementUploadOpen} onOpenChange={setIsElementUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={elementImageUrls.every(url => url !== null)}>
                <Plus className="size-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Element Image</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <Button onClick={() => elementFileInputRef.current?.click()} className="w-full">
                  <UploadCloud className="mr-2" />
                  Upload from computer
                </Button>
                <p className="text-sm text-muted-foreground">or paste image (Cmd+V)</p>
                <input type="file" accept="image/*" className="hidden" ref={elementFileInputRef} onChange={handleElementImageUpload} />
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {elementImageUrls.some(url => url !== null) ? (
            <div className="grid grid-cols-3 gap-2">
              {elementImageUrls.map((url, i) =>
                url ? (
                  <div key={i} className="relative aspect-square w-full">
                    <Image src={url} alt={`Element ${i + 1}`} layout="fill" objectFit="cover" className="rounded-md" />
                    <Button variant="destructive" size="icon" className="absolute -right-2 -top-2 size-6 rounded-full" onClick={() => handleRemoveElementImage(i)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div key={i} />
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No elements added yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Prompt</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <Label htmlFor="custom-prompt">Add custom instructions</Label>
          <Textarea
            id="custom-prompt"
            className="mt-2 flex-1 font-code"
            placeholder="e.g., 'make the sky dramatic and moody'"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={handlePromptKeyDown}
          />
        </CardContent>
      </Card>

      <Button size="lg" onClick={handleGenerate} disabled={isLoading || !baseImage}>
        {isLoading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}
        Generate Image
      </Button>
    </aside>
  );
}
