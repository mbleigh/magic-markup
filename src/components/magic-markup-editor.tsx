'use client';

import { useState, useRef, useCallback, ChangeEvent, useEffect } from 'react';
import Image from 'next/image';
import {
  Annotation,
  Brush,
  ClipboardCopy,
  Download,
  Eraser,
  Eye,
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
} from 'lucide-react';
import { generateImageEdit } from '@/ai/flows/generate-image-edit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type CanvasObject, type Tool } from '@/lib/types';
import { ColorPicker } from './color-picker';
import { Header } from './header';
import { IconButton } from './icon-button';
import { dataUrlToBlob, toPng } from '@/lib/canvas-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

const EDITOR_COLORS = ['#D35898', '#3B82F6', '#22C55E', '#EAB308'] as const;

export function MagicMarkupEditor() {
  const { toast } = useToast();

  // State
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [elementImages, setElementImages] = useState<(File | null)[]>([null, null, null]);
  const [elementImageUrls, setElementImageUrls] = useState<(string | null)[]>([null, null, null]);
  const [elementNames, setElementNames] = useState<string[]>(['', '', '']);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [tool, setTool] = useState<Tool>('highlight');
  const [color, setColor] = useState<string>(EDITOR_COLORS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isElementUploadOpen, setIsElementUploadOpen] = useState(false);

  // Canvas interaction refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPosition = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<CanvasObject[][]>([]);
  const historyPointer = useRef(-1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const elementFileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleBaseImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await readFileAsDataURL(file);
      setBaseImage(url);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error reading file',
        description: 'Could not read the selected image file.',
      });
    }
  };

  const handleElementImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addElementImage(file);
  };
  
  const addElementImage = async (file: File) => {
    const emptyIndex = elementImageUrls.findIndex(el => el === null);
    if (emptyIndex === -1) {
      toast({ variant: 'destructive', title: 'Cannot add more elements', description: 'You can only add up to 3 elements.' });
      return;
    }
    
    try {
      const url = await readFileAsDataURL(file);
      const newImages = [...elementImages];
      newImages[emptyIndex] = file;
      setElementImages(newImages);

      const newUrls = [...elementImageUrls];
      newUrls[emptyIndex] = url;
      setElementImageUrls(newUrls);
      setIsElementUploadOpen(false);
      toast({ title: `Element ${emptyIndex + 1} added.` });
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error reading file',
        description: 'Could not read the selected image file.',
      });
    }
  };


  const saveHistory = () => {
    // Clear redo stack
    if (historyPointer.current < history.current.length - 1) {
      history.current = history.current.slice(0, historyPointer.current + 1);
    }
    // For simplicity, we just save a snapshot of highlights and annotations
    history.current.push([...highlights, ...annotations]);
    historyPointer.current++;
  };
  
  const undo = () => {
    if (historyPointer.current > 0) {
      historyPointer.current--;
      const prevState = history.current[historyPointer.current];
      setHighlights(prevState.filter(o => 'points' in o));
      setAnnotations(prevState.filter(o => 'text' in o));
      redrawCanvas();
    }
  }

  const redo = () => {
    if (historyPointer.current < history.current.length - 1) {
      historyPointer.current++;
      const nextState = history.current[historyPointer.current];
      setHighlights(nextState.filter(o => 'points' in o));
      setAnnotations(nextState.filter(o => 'text' in o));
      redrawCanvas();
    }
  }

  const handleClear = () => {
    setHighlights([]);
    setAnnotations([]);
    history.current = [];
    historyPointer.current = -1;
    saveHistory();
    redrawCanvas();
  }
  
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (baseImage) {
        const img = new window.Image();
        img.src = baseImage;
        img.onload = () => {
            if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
            }
            ctx.drawImage(img, 0, 0);

            // Redraw highlights
            highlights.forEach(h => {
                ctx.strokeStyle = h.color;
                ctx.lineWidth = 10;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                h.points.forEach((p: {x: number, y: number}, i: number) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
            });

            // Redraw annotations
            ctx.globalAlpha = 1.0;
            annotations.forEach(a => {
                ctx.font = `bold 24px "Source Code Pro", monospace`;
                ctx.fillStyle = a.color;
                ctx.fillText(a.text, a.position.x, a.position.y);
            });
        };
    }
  }, [baseImage, highlights, annotations]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    if (tool === 'highlight') {
        isDrawing.current = true;
        setHighlights(prev => [...prev, { id: Date.now().toString(), color, points: [{x, y}] }]);
    } else if (tool === 'annotate') {
        const text = prompt('Enter annotation text:');
        if (text) {
            setAnnotations(prev => [...prev, { id: Date.now().toString(), color, text, position: {x, y} }]);
            saveHistory();
        }
    } else if (tool === 'erase') {
        isDrawing.current = true;
    }
    lastPosition.current = { x, y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (tool === 'highlight') {
        setHighlights(prev => {
            const newHighlights = [...prev];
            newHighlights[newHighlights.length - 1].points.push({x,y});
            return newHighlights;
        });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing.current && (tool === 'highlight' || tool === 'erase')) {
      saveHistory();
    }
    isDrawing.current = false;
  };


  const handleGenerate = async () => {
    if (!baseImage) {
      toast({
        variant: 'destructive',
        title: 'No Base Image',
        description: 'Please upload a base image to edit.',
      });
      return;
    }
    setIsLoading(true);

    try {
      const elementImage1 = elementImageUrls[0];
      const elementImage2 = elementImageUrls[1];
      const elementImage3 = elementImageUrls[2];

      const result = await generateImageEdit({
        baseImage,
        elementImage1,
        elementImage2,
        elementImage3,
        highlights: JSON.stringify(highlights.map(h => ({ color: h.color, path: h.points}))),
        annotations: JSON.stringify(annotations.map(a => ({ color: a.color, text: a.text, position: a.position}))),
        customPrompt,
      });
      setGeneratedImage(result.editedImage);
    } catch (error) {
      console.error('AI Generation Error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: 'The AI could not process the image. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopy = async () => {
    if (!generatedImage) return;
    try {
      const blob = await dataUrlToBlob(generatedImage);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      toast({ title: 'Copied to clipboard!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy image to clipboard.' });
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'magic-markup-output.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleRemoveElementImage = (index: number) => {
    const newImages = [...elementImages];
    newImages.splice(index, 1);
    newImages.push(null);
    setElementImages(newImages);

    const newUrls = [...elementImageUrls];
    newUrls.splice(index, 1);
    newUrls.push(null);
    setElementImageUrls(newUrls);
    
    const newNames = [...elementNames];
    newNames.splice(index, 1);
    newNames.push('');
    setElementNames(newNames);
  };
  
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === -1) continue;

      const file = items[i].getAsFile();
      if (!file) continue;

      if (isElementUploadOpen) {
        await addElementImage(file);
      } else {
        try {
          const url = await readFileAsDataURL(file);
          if (!baseImage) {
            setBaseImage(url);
            toast({ title: 'Base image pasted!' });
          } else {
            toast({ variant: 'destructive', title: 'Base image already present', description: 'You can paste an element by opening the element upload dialog.' });
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Error reading pasted image',
            description: 'Could not read the image from the clipboard.',
          });
        }
      }
      // Stop after handling the first image
      break;
    }
  }, [baseImage, toast, isElementUploadOpen]);


  useEffect(() => {
      window.addEventListener('paste', handlePaste);
      return () => {
          window.removeEventListener('paste', handlePaste);
      };
  }, [handlePaste]);

  useEffect(() => {
    redrawCanvas();
  }, [baseImage, redrawCanvas]);

  useEffect(() => {
    if(baseImage) redrawCanvas();
  }, [highlights, annotations, redrawCanvas, baseImage]);


  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[1fr_350px]">
        {/* Center - Editor */}
        <main className="flex flex-col items-center justify-center bg-background/50 p-4">
          {baseImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
                 <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                 />
            </div>
          ) : (
            <div className="flex w-full h-full max-w-2xl max-h-[70vh] items-center justify-center rounded-2xl border-2 border-dashed border-border">
              <div className="text-center">
                <UploadCloud className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Upload or Paste Base Image</h3>
                <p className="mt-1 text-sm text-muted-foreground">Start by uploading or pasting the image you want to edit.</p>
                <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                  Browse Files
                </Button>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleBaseImageUpload} />
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Tools & Prompt */}
        <aside className="flex flex-col gap-4 border-l bg-card p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Tools</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                          <IconButton icon={Brush} tooltip="Highlight" isActive={tool === 'highlight'} onClick={() => setTool('highlight')} />
                          <IconButton icon={Type} tooltip="Annotate" isActive={tool === 'annotate'} onClick={() => setTool('annotate')} />
                          <IconButton icon={Eraser} tooltip="Erase" isActive={tool === 'erase'} onClick={() => setTool('erase')} />
                      </div>
                      <div className="flex items-center gap-1">
                          <IconButton icon={Undo2} tooltip="Undo" onClick={undo} />
                          <IconButton icon={Redo2} tooltip="Redo" onClick={redo} />
                          <IconButton icon={Trash2} tooltip="Clear All" onClick={handleClear} />
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                        <Palette className="size-5 text-muted-foreground" />
                        <ColorPicker colors={EDITOR_COLORS} selectedColor={color} onColorChange={setColor} />
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

            <Card className="flex-1">
                <CardHeader>
                    <CardTitle className="text-lg">Prompt</CardTitle>
                </CardHeader>
                <CardContent className="h-full flex flex-col">
                    <Label htmlFor="custom-prompt">Add custom instructions</Label>
                    <Textarea 
                      id="custom-prompt"
                      className="mt-2 flex-1 font-code"
                      placeholder="e.g., 'make the sky dramatic and moody'"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                    />
                </CardContent>
            </Card>

            <Button size="lg" onClick={handleGenerate} disabled={isLoading || !baseImage}>
                {isLoading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}
                Generate Image
            </Button>
        </aside>
      </div>

        <Dialog open={!!generatedImage} onOpenChange={(open) => !open && setGeneratedImage(null)}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Generated Image</DialogTitle>
                     <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogClose>
                </DialogHeader>
                <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                        <h3 className="font-semibold mb-2 text-center">Original</h3>
                        <Image src={baseImage || ''} alt="Original" width={800} height={800} className="rounded-lg object-contain" />
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2 text-center">Generated</h3>
                        <Image src={generatedImage || ''} alt="Generated" width={800} height={800} className="rounded-lg object-contain" data-ai-hint="abstract art"/>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCopy}><ClipboardCopy className="mr-2" /> Copy</Button>
                    <Button onClick={handleDownload}><Download className="mr-2" /> Download</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
