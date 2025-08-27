'use client';

import { useState, useRef, useCallback, ChangeEvent, useEffect } from 'react';
import Image from 'next/image';
import {
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
} from 'lucide-react';
import { generateImageEdit } from '@/ai/flows/generate-image-edit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type Tool, type BrushSize } from '@/lib/types';
import { ColorPicker } from './color-picker';
import { Header } from './header';
import { IconButton } from './icon-button';
import { dataUrlToBlob } from '@/lib/canvas-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TextAnnotator, type TextAnnotation } from './text-annotator';

const EDITOR_COLORS = ['#D35898', '#3B82F6', '#22C55E', '#EAB308'] as const;
const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};

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
  const [brushSize, setBrushSize] = useState<BrushSize>('medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isElementUploadOpen, setIsElementUploadOpen] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationPosition, setAnnotationPosition] = useState({ x: 0, y: 0 });

  // Canvas interaction refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPosition = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<any[]>([]);
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


  const saveHistory = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      history.current.splice(historyPointer.current + 1);
    }
    const snapshot = {
      highlights: JSON.parse(JSON.stringify(highlights)),
      annotations: JSON.parse(JSON.stringify(annotations)),
    };
    history.current.push(snapshot);
    historyPointer.current++;
  }, [highlights, annotations]);

  const undo = useCallback(() => {
    if (historyPointer.current > 0) {
      historyPointer.current--;
      const snapshot = history.current[historyPointer.current];
      setHighlights(snapshot.highlights);
      setAnnotations(snapshot.annotations);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      historyPointer.current++;
      const snapshot = history.current[historyPointer.current];
      setHighlights(snapshot.highlights);
      setAnnotations(snapshot.annotations);
    }
  }, []);

  const handleClear = () => {
    setHighlights([]);
    setAnnotations([]);
    history.current = [{ highlights: [], annotations: [] }];
    historyPointer.current = 0;
  }
  
  const redrawCanvas = useCallback((forExport = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawContent = () => {
      // Redraw highlights
      highlights.forEach(h => {
          ctx.strokeStyle = h.color;
          ctx.lineWidth = h.strokeWidth;
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
          ctx.font = `bold ${a.fontSize}px "Patrick Hand", cursive`;
          ctx.fillStyle = a.color;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = a.fontSize / 15;
          ctx.strokeText(a.text, a.position.x, a.position.y);
          ctx.fillText(a.text, a.position.x, a.position.y);
      });
    }

    if (baseImage) {
        const img = new window.Image();
        img.src = baseImage;
        img.onload = () => {
            if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
            }
            if(forExport) {
              ctx.drawImage(img, 0, 0);
            }
            drawContent();
        };
    } else {
      drawContent();
    }
  }, [baseImage, highlights, annotations]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    if (tool === 'annotate') {
      setAnnotationPosition({ x: e.clientX, y: e.clientY });
      setIsAnnotating(true);
      return;
    }
    
    isDrawing.current = true;
    lastPosition.current = { x, y };

    if (tool === 'highlight') {
        setHighlights(prev => [...prev, { id: Date.now().toString(), color, points: [{x, y}], strokeWidth: BRUSH_SIZES[brushSize] }]);
    } else if (tool === 'erase') {
        erase(x, y);
    }
  };

  const handleSaveAnnotation = (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (annotationPosition.x - rect.left) * (canvas.width / rect.width);
    const y = (annotationPosition.y - rect.top) * (canvas.height / rect.height);

    if (text) {
      setAnnotations(prev => [...prev, {
        id: Date.now().toString(),
        color,
        text,
        position: { x, y },
        fontSize: BRUSH_SIZES[brushSize] * 2.5
      }]);
      saveHistory();
    }
    setIsAnnotating(false);
  };
  
  const erase = (x: number, y: number) => {
    const eraseRadius = BRUSH_SIZES[brushSize];
    let changed = false;

    const filteredHighlights = highlights.filter(h => {
        const isNear = h.points.some((p: { x: number, y: number }) => {
            const dist = Math.hypot(p.x - x, p.y - y);
            return dist < eraseRadius + h.strokeWidth;
        });
        if(isNear) changed = true;
        return !isNear;
    });

    const filteredAnnotations = annotations.filter(a => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return true;
        ctx.font = `bold ${a.fontSize}px "Patrick Hand", cursive`;
        const textMetrics = ctx.measureText(a.text);
        const textWidth = textMetrics.width;
        const textHeight = a.fontSize;
        
        const isInside = (
            x > a.position.x &&
            x < a.position.x + textWidth &&
            y > a.position.y - textHeight &&
            y < a.position.y
        );

        if(isInside) changed = true;
        return !isInside;
    });

    if(changed) {
      setHighlights(filteredHighlights);
      setAnnotations(filteredAnnotations);
      saveHistory();
    }
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
    } else if (tool === 'erase') {
        erase(x, y);
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
      let annotatedImage: string | undefined = undefined;
      
      if (highlights.length > 0 || annotations.length > 0) {
        const annotatedCanvas = document.createElement('canvas');
        const baseImg = new window.Image();
        baseImg.src = baseImage;
        await new Promise(resolve => { baseImg.onload = resolve; });

        annotatedCanvas.width = baseImg.naturalWidth;
        annotatedCanvas.height = baseImg.naturalHeight;
        const ctx = annotatedCanvas.getContext('2d');
        if(!ctx) throw new Error("Could not get canvas context");
        
        ctx.drawImage(baseImg, 0, 0);

        // Draw highlights
        highlights.forEach(h => {
            ctx.strokeStyle = h.color;
            ctx.lineWidth = h.strokeWidth;
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

        // Draw annotations
        ctx.globalAlpha = 1.0;
        annotations.forEach(a => {
            ctx.font = `bold ${a.fontSize}px "Patrick Hand", cursive`;
            ctx.fillStyle = a.color;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = a.fontSize / 15;
            ctx.strokeText(a.text, a.position.x, a.position.y);
            ctx.fillText(a.text, a.position.x, a.position.y);
        });
        
        annotatedImage = annotatedCanvas.toDataURL('image/png');
      }

      const elementImage1 = elementImageUrls[0];
      const elementImage2 = elementImageUrls[1];
      const elementImage3 = elementImageUrls[2];

      const result = await generateImageEdit({
        baseImage,
        annotatedImage,
        elementImage1,
        elementImage2,
        elementImage3,
        customPrompt,
      });
      setGeneratedImage(result.editedImage);
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'The AI could not process the image. Please try again.',
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

    // Do not interfere with text input pasting
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
    }

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
  }, [baseImage, toast, isElementUploadOpen, addElementImage]);

  useEffect(() => {
    history.current.push({ highlights: [], annotations: [] });
    historyPointer.current = 0;

    window.addEventListener('paste', handlePaste);
    return () => {
        window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;
    const img = new window.Image();
    img.src = baseImage;
    img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        redrawCanvas();
        saveHistory();
    }
  }, [baseImage, redrawCanvas, saveHistory]);

  useEffect(() => {
    redrawCanvas();
  }, [highlights, annotations, redrawCanvas]);


  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[1fr_350px]">
        {/* Center - Editor */}
        <main className="flex flex-col items-center justify-center bg-background/50 p-4">
          {baseImage ? (
             <div ref={canvasContainerRef} className="relative w-full h-full flex items-center justify-center">
                 <Image
                    src={baseImage}
                    alt="Base image"
                    width={1024}
                    height={1024}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg pointer-events-none"
                    style={{
                      width: 'auto',
                      height: 'auto',
                    }}
                 />
                 <canvas
                    ref={canvasRef}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain cursor-crosshair"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    style={{
                      width: 'auto',
                      height: 'auto',
                    }}
                 />
                 {isAnnotating && (
                   <TextAnnotator
                    initialPosition={annotationPosition}
                    onSave={handleSaveAnnotation}
                    onCancel={() => setIsAnnotating(false)}
                    color={color}
                    fontSize={BRUSH_SIZES[brushSize] * 2.5}
                    containerRef={canvasContainerRef}
                   />
                 )}
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
