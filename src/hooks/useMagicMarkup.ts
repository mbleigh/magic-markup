
'use client';

import { useState, useRef, useCallback, ChangeEvent, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { type Tool, type BrushSize, type CanvasObject, type Annotation, type Highlight, type SessionHistoryItem } from '@/lib/types';
import { resizeImage, dataUrlToBlob } from '@/lib/canvas-utils';
import { generateImageEdit } from '@/ai/flows/generate-image-edit';

const EDITOR_COLORS = ['#D35898', '#3B82F6', '#22C55E', '#EAB308'] as const;
const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};
const MAX_DIMENSION = 1000;
const SELECTION_PADDING = 10;
const LOCAL_STORAGE_KEY_SESSION = 'magic-markup-session';
const LOCAL_STORAGE_KEY_API_KEY = 'magic-markup-api-key';

export function useMagicMarkup() {
  const { toast } = useToast();

  // State
  const [isMounted, setIsMounted] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

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
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);

  // Canvas interaction refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    // When starting a new session, clear annotations and elements, but keep the prompt.
    setCanvasObjects([]);
    setElementImageUrls([null, null, null]);
    setElementImages([null, null, null]);
    setElementNames(['','','']);

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
                ctx.strokeStyle = '#007AFF';
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

            if(!a.width || !a.height) {
              const metrics = ctx.measureText(a.text);
              a.width = metrics.width;
              a.height = a.fontSize;
            }

            if (a.selected) {
                ctx.strokeStyle = '#007AFF';
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
        setCanvasObjects(prev => prev.map(o => o.id === id ? { ...o, text, position: newPosition || (o as Annotation).position, width: undefined, height: undefined } as Annotation : o));
      } else {
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
    if (!apiKey) {
      setIsApiKeyDialogOpen(true);
      return;
    }

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

      const result = await generateImageEdit(apiKey, {
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

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, key);
    setIsApiKeyDialogOpen(false);
    toast({ title: "API Key saved!"});
  }

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY);
      if(savedKey) setApiKey(savedKey);

      const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION);
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
      localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const activeItem = sessionHistory.find(item => item.id === activeHistoryId);
      if (activeItem) {
        const updatedActiveItem: SessionHistoryItem = {
          ...activeItem,
          annotations: canvasObjects,
          elementImageUrls: elementImageUrls,
          elementNames: elementNames,
          prompt: customPrompt
        };

        const newHistory = sessionHistory.map(item => item.id === activeHistoryId ? updatedActiveItem : item);
        
        const dataToSave = JSON.stringify({ history: newHistory, activeId: activeHistoryId });
        localStorage.setItem(LOCAL_STORAGE_KEY_SESSION, dataToSave);
      } else if (sessionHistory.length === 0 && !baseImage) {
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
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

  return {
    isMounted,
    sessionHistory,
    activeHistoryId,
    apiKey,
    baseImage,
    elementImageUrls,
    canvasObjects,
    tool,
    setTool,
    color,
    setColor,
    brushSize,
    setBrushSize,
    customPrompt,
    setCustomPrompt,
    isLoading,
    generatedImage,
    setGeneratedImage,
    isElementUploadOpen,
    setIsElementUploadOpen,
    editingAnnotation,
    setEditingAnnotation,
    confirmingNewImage,
    setConfirmingNewImage,
    isCameraRollOpen,
    setIsCameraRollOpen,
    isApiKeyDialogOpen, 
    setIsApiKeyDialogOpen,
    canvasRef,
    fileInputRef,
    elementFileInputRef,
    loadStateFromHistoryItem,
    handleConfirmNewImage,
    handleBaseImageUpload,
    handleElementImageUpload,
    undo,
    redo,
    handleClear,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleSaveAnnotation,
    handleGenerate,
    handleKeepEditing,
    handleCopy,
    handleDownload,
    handleRemoveElementImage,
    handleDeleteHistoryItem,
    handleNewSession,
    handlePromptKeyDown,
    elementImages,
    setElementImages,
    setElementImageUrls,
    elementNames,
    setElementNames,
    EDITOR_COLORS,
    handleSaveApiKey
  };
}
