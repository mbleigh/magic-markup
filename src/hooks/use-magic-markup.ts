
'use client';

import { useRef, useCallback, ChangeEvent, useEffect, useReducer } from 'react';
import { useToast } from '@/hooks/use-toast';
import { type Tool, type BrushSize, type CanvasObject, type Annotation, type Highlight, type SessionHistoryItem } from '@/lib/types';
import { resizeImage, dataUrlToBlob } from '@/lib/canvas-utils';
import { generateImageEdit } from '@/ai/flows/generate-image-edit';
import { generateBaseImage } from '@/ai/flows/generate-base-image';
import { reducer, initialState, Action, ActionPayloads } from '@/lib/state';


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
const ANNOTATION_FONT_SIZE_MEDIUM = BRUSH_SIZES['medium'] * 4;

export function useMagicMarkup() {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    isMounted,
    sessionHistory,
    activeHistoryId,
    apiKey,
    baseImage,
    baseImagePrompt,
    elementImages,
    elementImageUrls,
    elementNames,
    canvasObjects,
    tool,
    color,
    brushSize,
    customPrompt,
    isLoading,
    isElementUploadOpen,
    editingAnnotation,
    confirmingNewImage,
    isCameraRollOpen,
    isApiKeyDialogOpen,
  } = state;


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
  
  // -- ACTION DISPATCHERS --
  const dispatchAction = <T extends keyof ActionPayloads>(type: T, payload: ActionPayloads[T]) => {
      dispatch({ type, payload } as Action);
  }

  const setTool = (tool: Tool) => dispatchAction('SET_TOOL', tool);
  const setColor = (color: string) => dispatchAction('SET_COLOR', color);
  const setBrushSize = (brushSize: BrushSize) => dispatchAction('SET_BRUSH_SIZE', brushSize);
  const setCustomPrompt = (prompt: string) => dispatchAction('SET_CUSTOM_PROMPT', prompt);
  const setBaseImagePrompt = (prompt: string) => dispatchAction('SET_BASE_IMAGE_PROMPT', prompt);
  const setIsElementUploadOpen = (isOpen: boolean) => dispatchAction('SET_IS_ELEMENT_UPLOAD_OPEN', isOpen);
  const setEditingAnnotation = (annotation: Annotation | null) => dispatchAction('SET_EDITING_ANNOTATION', annotation);
  const setConfirmingNewImage = (image: string | null) => dispatchAction('SET_CONFIRMING_NEW_IMAGE', image);
  const setIsCameraRollOpen = (isOpen: boolean) => dispatchAction('SET_IS_CAMERA_ROLL_OPEN', isOpen);
  const setIsApiKeyDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_API_KEY_DIALOG_OPEN', isOpen);
  const setElementImages = (images: (File | null)[]) => dispatchAction('SET_ELEMENT_IMAGES', images);
  const setElementImageUrls = (urls: (string | null)[]) => dispatchAction('SET_ELEMENT_IMAGE_URLS', urls);
  const setElementNames = (names: string[]) => dispatchAction('SET_ELEMENT_NAMES', names);

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
  
  const loadStateFromHistoryItem = (item: SessionHistoryItem | null) => {
    dispatchAction('LOAD_STATE_FROM_HISTORY', item);
  }

  const startNewSession = useCallback((newBaseImage: string) => {
    const newItem = createNewHistoryItem(newBaseImage);
    dispatchAction('START_NEW_SESSION', newItem);
  }, [createNewHistoryItem]);
  
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
      dispatchAction('SET_CANVAS_OBJECTS', history.current[historyPointer.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      historyPointer.current++;
      dispatchAction('SET_CANVAS_OBJECTS', history.current[historyPointer.current]);
    }
  }, []);

  const handleClear = () => {
    dispatchAction('SET_CANVAS_OBJECTS', []);
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
        fontSize: ANNOTATION_FONT_SIZE_MEDIUM * ((canvasRef.current?.width || MAX_DIMENSION) / MAX_DIMENSION)
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
          dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.map(obj => obj.id === hitObject.id ? obj : { ...obj, selected: false }));
          return;
        }
        
        dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.map(obj => {
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
              dragOffset: { x: x - (hitObject as Annotation).position.x, y: y - (hitObject as Annotation).position.y }
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
        dispatchAction('ADD_CANVAS_OBJECT', newHighlight);
    } else if (tool === 'erase') {
        erase(x, y);
    }
  };

  const handleSaveAnnotation = (text: string, id: string, newPosition?: {x: number, y: number}) => {
    if (text) {
      dispatchAction('SAVE_ANNOTATION', { id, text, position: newPosition, color });
      saveHistory();
    }
    setEditingAnnotation(null);
  };
  
  const erase = (x: number, y: number) => {
    const hitObject = hitTest(x, y);
    if(hitObject) {
      dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.filter(obj => obj.id !== hitObject.id));
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { isDrawing, isDragging } = interactionState.current;
    if (!isDrawing && !isDragging) return;

    const { x, y } = getCanvasCoordinates(e);

    if (isDragging && tool === 'select') {
      const { dragOffset } = interactionState.current;
      dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.map(obj => {
          if (obj.selected && obj.type === 'annotation' && dragOffset) {
              return { ...obj, position: { x: x - dragOffset.x, y: y - dragOffset.y } };
          }
          return obj;
      }));
      return;
    }

    if (tool === 'highlight' && isDrawing) {
        dispatchAction('UPDATE_LAST_HIGHLIGHT_POINT', {x,y});
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

  const handleGenerateBaseImage = async () => {
    if (!apiKey) {
      setIsApiKeyDialogOpen(true);
      return;
    }
    if (!baseImagePrompt) return;

    dispatchAction('SET_IS_LOADING', true);
    try {
      const result = await generateBaseImage(apiKey, { prompt: baseImagePrompt });
      const resizedUrl = await resizeImage(result.generatedImage, MAX_DIMENSION, MAX_DIMENSION);
      startNewSession(resizedUrl);
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'The AI could not generate the image. Please try again.',
      });
    } finally {
      dispatchAction('SET_IS_LOADING', false);
    }
  }

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

    dispatchAction('SET_IS_LOADING', true);

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
        startNewSession(result.editedImage);
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
      dispatchAction('SET_IS_LOADING', false);
    }
  };
  
  const copyImageToClipboard = async (imageUrl: string) => {
    try {
      const blob = await dataUrlToBlob(imageUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      toast({ title: 'Image copied to clipboard!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy image to clipboard.' });
    }
  };

  const handleCopyBaseImage = () => {
    if (!baseImage) return;
    copyImageToClipboard(baseImage);
  }

  const handleCopyHistoryItem = (id: string) => {
    const item = sessionHistory.find(item => item.id === id);
    if (item) {
        copyImageToClipboard(item.baseImage);
    }
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
    dispatchAction('DELETE_HISTORY_ITEM', idToDelete);
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
        dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.filter(o => !o.selected));
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
    dispatchAction('SET_API_KEY', key);
    localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, key);
    setIsApiKeyDialogOpen(false);
    toast({ title: "API Key saved!"});
  }

  useEffect(() => {
    dispatchAction('SET_IS_MOUNTED', true);
    try {
      const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY);
      if(savedKey) dispatchAction('SET_API_KEY', savedKey);

      const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION);
      if (savedSession) {
        const { history, activeId } = JSON.parse(savedSession);
        if (history && Array.isArray(history) && history.length > 0) {
          dispatchAction('SET_SESSION_HISTORY', history);
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
    // State
    isMounted,
    sessionHistory,
    activeHistoryId,
    apiKey,
    baseImage,
    baseImagePrompt,
    elementImageUrls,
    canvasObjects,
    tool,
    color,
    brushSize,
    customPrompt,
    isLoading,
    isElementUploadOpen,
    editingAnnotation,
    confirmingNewImage,
    isCameraRollOpen,
    isApiKeyDialogOpen,
    elementImages,
    elementNames,

    // Refs
    canvasRef,
    fileInputRef,
    elementFileInputRef,

    // State Setters (dispatchers)
    setTool,
    setColor,
    setBrushSize,
    setCustomPrompt,
    setBaseImagePrompt,
    setIsElementUploadOpen,
    setEditingAnnotation,
    setConfirmingNewImage,
    setIsCameraRollOpen,
    setIsApiKeyDialogOpen,
    setElementImages,
    setElementImageUrls,
    setElementNames,

    // Functions
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
    handleGenerateBaseImage,
    handleCopyBaseImage,
    handleCopyHistoryItem,
    handleRemoveElementImage,
    handleDeleteHistoryItem,
    handleNewSession,
    handlePromptKeyDown,
    handleSaveApiKey,

    // Constants
    EDITOR_COLORS,
  };
}
