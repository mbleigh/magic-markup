'use client';

import { useState, useRef, useCallback, ChangeEvent, useEffect } from 'react';
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
  History,
  Check,
  ChevronLeft,
} from 'lucide-react';
import { generateImageEdit } from '@/ai/flows/generate-image-edit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type Tool, type BrushSize, type CanvasObject, type Annotation, type Highlight, type SessionHistoryItem } from '@/lib/types';
import { ColorPicker } from './color-picker';
import { Header } from './header';
import { IconButton } from './icon-button';
import { dataUrlToBlob, resizeImage } from '@/lib/canvas-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { TextAnnotator } from './text-annotator';
import { ScrollArea } from './ui/scroll-area';

const EDITOR_COLORS = ['#D35898', '#3B82F6', '#22C55E', '#EAB308'] as const;
const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};
const MAX_DIMENSION = 1000;
const SELECTION_PADDING = 10;
const LOCAL_STORAGE_KEY = 'magic-markup-session';

export function MagicMarkupEditor() {
  const { toast } = useToast();

  // State
  const [isMounted, setIsMounted] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [elementImages, setElementImages] = useState<(File | null)[]>([null, null, null]);
  const [elementImageUrls, setElementImageUrls] = useState<(string | null)[]>([null, null, null]);
  const [elementNames, setElementNames] = useState<string[]>(['', '', '']);
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [tool, setTool] = useState<Tool>('highlight');
  const [color, setColor] = useState<string>(EDITOR_COLORS[0]);
  const [brushSize, setBrushSize] = useState<BrushSize>('medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isElementUploadOpen, setIsElementUploadOpen] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [confirmingNewImage, setConfirmingNewImage] = useState<string | null>(null);
  const [isCameraRollOpen, setIsCameraRollOpen] = useState(true);

  // Canvas interaction refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const interactionState = useRef<{
    isDrawing?: boolean;
    isDragging?: boolean;
    dragOffset?: { x: number, y: number };
    lastPosition?: { x: number, y: number };
    lastClickTime?: number;
  }>({});

  const history = useRef<any[]>([]);
  const historyPointer = useRef(-1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const elementFileInputRef = useRef<HTMLInputElement>(null);
  
  // -- SESSION & HISTORY MANAGEMENT --
  
  const createNewHistoryItem = useCallback((newBaseImage: string, prompt?: string) => {
    const newItem: SessionHistoryItem = {
      id: `session-${Date.now()}`,
      baseImage: newBaseImage,
      annotations: [],
      elementImageUrls: [null, null, null],
      elementNames: ['', '', ''],
      prompt: prompt || '',
      createdAt: new Date().toISOString()
    };
    return newItem;
  }, []);

  const startNewSession = useCallback((newBaseImage: string) => {
    const newItem = createNewHistoryItem(newBaseImage);
    const newHistory = [...sessionHistory, newItem];
    setSessionHistory(newHistory);
    setActiveHistoryId(newItem.id);
    loadStateFromHistoryItem(newItem);
  }, [createNewHistoryItem, sessionHistory]);
  
  const loadStateFromHistoryItem = (item: SessionHistoryItem | null) => {
    if (!item) {
      setBaseImage(null);
      setCanvasObjects([]);
      setElementImageUrls([null, null, null]);
      setElementImages([null, null, null]);
      setElementNames(['', '', '']);
      setCustomPrompt('');
      setActiveHistoryId(null);
      return;
    }
    setBaseImage(item.baseImage);
    setCanvasObjects(item.annotations);
    setElementImageUrls(item.elementImageUrls || [null, null, null]);
    setElementImages([null, null, null]); // Files can't be stored, need re-upload
    setElementNames(item.elementNames || ['', '', '']);
    setCustomPrompt(item.prompt || '');
    setActiveHistoryId(item.id);
  }
  
  const handleConfirmNewImage = (confirmed: boolean) => {
    if (confirmed && confirmingNewImage) {
      startNewSession(confirmingNewImage);
    }
    setConfirmingNewImage(null);
  }

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
      const resizedUrl = await resizeImage(url, MAX_DIMENSION, MAX_DIMENSION);
      if (baseImage) {
        setConfirmingNewImage(resizedUrl);
      } else {
        startNewSession(resizedUrl);
      }
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
  
  const addElementImage = useCallback(async (file: File) => {
    const emptyIndex = elementImageUrls.findIndex(el => el === null);
    if (emptyIndex === -1) {
      toast({ variant: 'destructive', title: 'Cannot add more elements', description: 'You can only add up to 3 elements.' });
      return;
    }
    
    try {
      const url = await readFileAsDataURL(file);
      const resizedUrl = await resizeImage(url, MAX_DIMENSION, MAX_DIMENSION);

      const newImages = [...elementImages];
      newImages[emptyIndex] = file;
      setElementImages(newImages);

      const newUrls = [...elementImageUrls];
      newUrls[emptyIndex] = resizedUrl;
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
  }, [elementImageUrls, elementImages, toast]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };
  
  const saveHistory = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      history.current.splice(historyPointer.current + 1);
    }
    history.current.push(JSON.parse(JSON.stringify(canvasObjects)));
    historyPointer.current++;
  }, [canvasObjects]);

  const undo = useCallback(() => {
    if (historyPointer.current > 0) {
      historyPointer.current--;
      setCanvasObjects(history.current[historyPointer.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      historyPointer.current++;
      setCanvasObjects(history.current[historyPointer.current]);
    }
  }, []);

  const handleClear = () => {
    setCanvasObjects([]);
    history.current = [[]];
    historyPointer.current = 0;
  };
  
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawObject = (obj: CanvasObject) => {
        // Don't draw the object being edited, the annotator will render it
        if (editingAnnotation && editingAnnotation.id === obj.id) return;

        if (obj.type === 'highlight') {
            const h = obj as Highlight;
            ctx.strokeStyle = h.color;
            ctx.lineWidth = h.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            h.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            if (h.selected) {
                ctx.strokeStyle = '#007AFF'; // Selection color
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.2;
                ctx.stroke();
            }

        } else if (obj.type === 'annotation') {
            const a = obj as Annotation;
            ctx.globalAlpha = 1.0;
            ctx.font = `bold ${a.fontSize}px "Patrick Hand", cursive`;
            ctx.fillStyle = a.color;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = a.fontSize / 15;
            ctx.strokeText(a.text, a.position.x, a.position.y);
            ctx.fillText(a.text, a.position.x, a.position.y);

            // Update width/height for hit testing
            if(!a.width || !a.height) {
              const metrics = ctx.measureText(a.text);
              a.width = metrics.width;
              a.height = a.fontSize;
            }

            if (a.selected) {
                ctx.strokeStyle = '#007AFF'; // Selection color
                ctx.lineWidth = 2;
                ctx.globalAlpha = 1.0;
                ctx.strokeRect(
                    a.position.x - SELECTION_PADDING,
                    a.position.y - a.height - SELECTION_PADDING,
                    a.width + SELECTION_PADDING * 2,
                    a.height + SELECTION_PADDING * 2
                );
            }
        }
    };

    canvasObjects.forEach(drawObject);

  }, [canvasObjects, editingAnnotation]);
  
  const hitTest = (x: number, y: number): CanvasObject | null => {
      // Iterate backwards to select the top-most object
      for (let i = canvasObjects.length - 1; i >= 0; i--) {
          const obj = canvasObjects[i];
          if (obj.type === 'annotation') {
              const a = obj as Annotation;
              if(a.width && a.height) {
                if (x >= a.position.x && x <= a.position.x + a.width && y >= a.position.y - a.height && y <= a.position.y) {
                    return obj;
                }
              }
          } else if (obj.type === 'highlight') {
              const h = obj as Highlight;
              const isNear = h.points.some(p => Math.hypot(p.x - x, p.y - y) < h.strokeWidth / 2 + 5);
              if (isNear) return obj;
          }
      }
      return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);

    if (tool === 'annotate') {
      setEditingAnnotation({
        id: Date.now().toString(),
        type: 'annotation',
        text: '',
        color: color,
        position: {x, y},
        fontSize: BRUSH_SIZES[brushSize] * 4 * ((canvasRef.current?.width || MAX_DIMENSION) / MAX_DIMENSION)
      });
      return;
    }

    if (tool === 'select') {
        const now = Date.now();
        const doubleClick = (now - (interactionState.current.lastClickTime || 0)) < 300;
        interactionState.current.lastClickTime = now;
        
        const hitObject = hitTest(x, y);

        if (doubleClick && hitObject?.type === 'annotation') {
          setEditingAnnotation(hitObject as Annotation);
          // Unselect all other objects
          setCanvasObjects(prev => prev.map(obj => obj.id === hitObject.id ? obj : { ...obj, selected: false }));
          return;
        }
        
        setCanvasObjects(prev => prev.map(obj => {
          const isSelected = obj.id === hitObject?.id;
          if (obj.selected !== isSelected) {
              return { ...obj, selected: isSelected };
          }
          return obj;
        }));

        if (hitObject && hitObject.type === 'annotation') {
            interactionState.current = { 
              ...interactionState.current,
              isDragging: true, 
              dragOffset: { x: x - hitObject.position.x, y: y - hitObject.position.y }
            };
        }
        return;
    }
    
    interactionState.current = { isDrawing: true, lastPosition: { x, y } };

    if (tool === 'highlight') {
        const newHighlight: Highlight = { 
          id: Date.now().toString(), 
          type: 'highlight',
          color, 
          points: [{ x, y }], 
          strokeWidth: BRUSH_SIZES[brushSize] * (canvasRef.current!.width / MAX_DIMENSION) 
        };
        setCanvasObjects(prev => [...prev, newHighlight]);
    } else if (tool === 'erase') {
        erase(x, y);
    }
  };

  const handleSaveAnnotation = (text: string, id: string, newPosition?: {x: number, y: number}) => {
    if (text) {
      const existing = canvasObjects.find(o => o.id === id);
      if (existing) {
        // Update existing
        setCanvasObjects(prev => prev.map(o => o.id === id ? { ...o, text, position: newPosition || (o as Annotation).position, width: undefined, height: undefined } as Annotation : o));
      } else {
        // Create new
        const newAnnotation: Annotation = {
          id: id,
          type: 'annotation',
          color: color,
          text: text,
          position: newPosition || {x: 0, y: 0},
          fontSize: BRUSH_SIZES[brushSize] * 4 * ((canvasRef.current?.width || MAX_DIMENSION) / MAX_DIMENSION)
        };
        setCanvasObjects(prev => [...prev, newAnnotation]);
      }
      saveHistory();
    }
    setEditingAnnotation(null);
  };
  
  const erase = (x: number, y: number) => {
    const hitObject = hitTest(x, y);
    if(hitObject) {
      setCanvasObjects(prev => prev.filter(obj => obj.id !== hitObject.id));
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { isDrawing, isDragging } = interactionState.current;
    if (!isDrawing && !isDragging) return;

    const { x, y } = getCanvasCoordinates(e);

    if (isDragging && tool === 'select') {
      const { dragOffset } = interactionState.current;
      setCanvasObjects(prev => prev.map(obj => {
          if (obj.selected && obj.type === 'annotation' && dragOffset) {
              return { ...obj, position: { x: x - dragOffset.x, y: y - dragOffset.y } };
          }
          return obj;
      }));
      return;
    }

    if (tool === 'highlight' && isDrawing) {
        setCanvasObjects(prev => {
            const newObjects = [...prev];
            const lastObj = newObjects[newObjects.length - 1] as Highlight;
            if (lastObj && lastObj.type === 'highlight') {
              lastObj.points.push({x,y});
            }
            return newObjects;
        });
    } else if (tool === 'erase' && isDrawing) {
        erase(x, y);
    }
  };

  const handleCanvasMouseUp = () => {
    const { isDrawing, isDragging } = interactionState.current;
    if (isDrawing || isDragging) {
      saveHistory();
    }
    interactionState.current.isDrawing = false;
    interactionState.current.isDragging = false;
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
    
    const highlights = canvasObjects.filter(o => o.type === 'highlight') as Highlight[];
    const annotations = canvasObjects.filter(o => o.type === 'annotation') as Annotation[];
    
    if (highlights.length === 0 && annotations.length === 0 && !customPrompt) {
      toast({
        variant: 'destructive',
        title: 'Nothing to Generate',
        description: 'Please add highlights, annotations, or a prompt.',
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

      const elementImageUrlsPayload = elementImageUrls
        .map((url, i) => ({ url, name: elementNames[i] || `element${i+1}` }))
        .filter(el => el.url) as { name: string; url: string }[];

      const result = await generateImageEdit({
        baseImage,
        annotatedImage,
        elementImages: elementImageUrlsPayload,
        customPrompt,
      });

      if (result.editedImage) {
        setGeneratedImage(result.editedImage);
      } else {
        throw new Error('The AI model did not return an image.');
      }
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

  const handleKeepEditing = () => {
    if (!generatedImage) return;
    startNewSession(generatedImage);
    setGeneratedImage(null);
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

  const handleDeleteHistoryItem = (idToDelete: string) => {
    const newHistory = sessionHistory.filter(item => item.id !== idToDelete)
    setSessionHistory(newHistory);
    
    if (activeHistoryId === idToDelete) {
      // If we deleted the active item, load the latest one or clear the canvas
      if (newHistory.length > 0) {
        loadStateFromHistoryItem(newHistory[newHistory.length - 1]);
      } else {
        loadStateFromHistoryItem(null);
      }
    }
  };

  const handleNewSession = () => {
    loadStateFromHistoryItem(null);
  }
  
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

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
          const resizedUrl = await resizeImage(url, MAX_DIMENSION, MAX_DIMENSION);
          if (!baseImage) {
            startNewSession(resizedUrl);
            toast({ title: 'Base image pasted!' });
          } else {
            setConfirmingNewImage(resizedUrl);
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Error reading pasted image',
            description: 'Could not read the image from the clipboard.',
          });
        }
      }
      break;
    }
  }, [baseImage, toast, isElementUploadOpen, addElementImage, startNewSession]);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // If an input is focused, don't handle key events
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || editingAnnotation) {
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const hasSelection = canvasObjects.some(o => o.selected);
      if (hasSelection) {
        e.preventDefault();
        setCanvasObjects(prev => prev.filter(o => !o.selected));
        saveHistory();
      }
    }
  }, [canvasObjects, saveHistory, editingAnnotation]);

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Load from local storage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedSession) {
        const { history, activeId } = JSON.parse(savedSession);
        if (history && Array.isArray(history) && history.length > 0) {
          setSessionHistory(history);
          const activeItem = history.find((item: SessionHistoryItem) => item.id === activeId) || history[history.length -1];
          loadStateFromHistoryItem(activeItem);
        }
      }
    } catch (e) {
      console.error("Failed to load session from local storage", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (!isMounted) return;
    try {
      const activeItem = sessionHistory.find(item => item.id === activeHistoryId);
      if (activeItem) {
         // Create a new object for the current state to save
        const updatedActiveItem: SessionHistoryItem = {
          ...activeItem,
          annotations: canvasObjects,
          elementImageUrls: elementImageUrls,
          elementNames: elementNames,
          prompt: customPrompt
        };

        const newHistory = sessionHistory.map(item => item.id === activeHistoryId ? updatedActiveItem : item);
        
        const dataToSave = JSON.stringify({ history: newHistory, activeId: activeHistoryId });
        localStorage.setItem(LOCAL_STORAGE_KEY, dataToSave);
      } else if (sessionHistory.length === 0 && !baseImage) {
        // Clear local storage if everything is empty
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }

    } catch(e) {
      console.error("Failed to save session to local storage", e);
    }
  }, [isMounted, canvasObjects, elementImageUrls, elementNames, customPrompt, sessionHistory, activeHistoryId, baseImage]);


  useEffect(() => {
    history.current.push([]);
    historyPointer.current = 0;

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('paste', handlePaste);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePaste, handleKeyDown]);

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
  }, [canvasObjects, redrawCanvas]);


  if (!isMounted) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[auto_1fr_350px]">
        {/* Left Sidebar - Camera Roll */}
        <aside 
          className={`flex flex-col gap-4 border-r bg-card p-2 transition-all duration-300 ${isCameraRollOpen ? 'w-48' : 'w-12'}`}
        >
          <div className="flex items-center justify-between">
              {isCameraRollOpen && <CardTitle className="text-lg">History</CardTitle>}
              <IconButton 
                icon={isCameraRollOpen ? ChevronLeft : History} 
                tooltip={isCameraRollOpen ? "Collapse History" : "Expand History"} 
                onClick={() => setIsCameraRollOpen(!isCameraRollOpen)} 
              />
          </div>
          {isCameraRollOpen && (
            <>
              <Button size="sm" variant="outline" onClick={handleNewSession}><Plus className="mr-2" /> New Session</Button>
              <Separator />
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-2 pr-2">
                {sessionHistory.slice().reverse().map(item => (
                  <div key={item.id} className="relative group">
                    <button 
                      onClick={() => loadStateFromHistoryItem(item)} 
                      className={`w-full rounded-md border-2 overflow-hidden ${activeHistoryId === item.id ? 'border-primary' : 'border-transparent hover:border-muted-foreground'}`}
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
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain"
                    style={{
                      width: 'auto',
                      height: 'auto',
                      cursor: tool === 'select' ? 'default' : 'crosshair'
                    }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                 />
                 {editingAnnotation && (
                   <TextAnnotator
                    annotation={editingAnnotation}
                    onSave={handleSaveAnnotation}
                    onCancel={() => setEditingAnnotation(null)}
                    canvasRef={canvasRef}
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
                          <IconButton icon={MousePointer2} tooltip="Select" isActive={tool === 'select'} onClick={() => setTool('select')} />
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

        <AlertDialog open={!!confirmingNewImage} onOpenChange={(open) => !open && setConfirmingNewImage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace Base Image?</AlertDialogTitle>
              <AlertDialogDescription>
                This will start a new session with the new image. All current annotations will be cleared. Element images will be kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleConfirmNewImage(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleConfirmNewImage(true)}>Replace</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                    <Button variant="outline" onClick={handleDownload}><Download className="mr-2" /> Download</Button>
                    <Button onClick={handleKeepEditing}><Check className="mr-2" /> Keep Editing</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
