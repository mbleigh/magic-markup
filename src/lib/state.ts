
import { SessionHistoryItem, CanvasObject, Tool, BrushSize, Annotation, Highlight } from './types';

const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};
const MAX_DIMENSION = 1000;
const ANNOTATION_FONT_SIZE_MEDIUM = BRUSH_SIZES['medium'] * 4;

export interface AppState {
  isMounted: boolean;
  sessionHistory: SessionHistoryItem[];
  activeHistoryId: string | null;
  apiKey: string | null;
  baseImage: string | null;
  elementImages: (File | null)[];
  elementImageUrls: (string | null)[];
  elementNames: string[];
  canvasObjects: CanvasObject[];
  tool: Tool;
  color: string;
  brushSize: BrushSize;
  customPrompt: string;
  isLoading: boolean;
  isElementUploadOpen: boolean;
  editingAnnotation: Annotation | null;
  confirmingNewImage: string | null;
  isCameraRollOpen: boolean;
  isApiKeyDialogOpen: boolean;
}

export const initialState: AppState = {
  isMounted: false,
  sessionHistory: [],
  activeHistoryId: null,
  apiKey: null,
  baseImage: null,
  elementImages: [null, null, null],
  elementImageUrls: [null, null, null],
  elementNames: ['', '', ''],
  canvasObjects: [],
  tool: 'highlight',
  color: '#D35898',
  brushSize: 'medium',
  customPrompt: '',
  isLoading: false,
  isElementUploadOpen: false,
  editingAnnotation: null,
  confirmingNewImage: null,
  isCameraRollOpen: true,
  isApiKeyDialogOpen: false,
};

export type ActionPayloads = {
  SET_IS_MOUNTED: boolean;
  SET_SESSION_HISTORY: SessionHistoryItem[];
  SET_ACTIVE_HISTORY_ID: string | null;
  SET_API_KEY: string | null;
  SET_BASE_IMAGE: string | null;
  SET_ELEMENT_IMAGES: (File | null)[];
  SET_ELEMENT_IMAGE_URLS: (string | null)[];
  SET_ELEMENT_NAMES: string[];
  SET_CANVAS_OBJECTS: CanvasObject[];
  ADD_CANVAS_OBJECT: CanvasObject;
  UPDATE_LAST_HIGHLIGHT_POINT: { x: number; y: number };
  SAVE_ANNOTATION: { id: string, text: string, position?: { x: number, y: number }, color: string };
  SET_TOOL: Tool;
  SET_COLOR: string;
  SET_BRUSH_SIZE: BrushSize;
  SET_CUSTOM_PROMPT: string;
  SET_IS_LOADING: boolean;
  SET_IS_ELEMENT_UPLOAD_OPEN: boolean;
  SET_EDITING_ANNOTATION: Annotation | null;
  SET_CONFIRMING_NEW_IMAGE: string | null;
  SET_IS_CAMERA_ROLL_OPEN: boolean;
  SET_IS_API_KEY_DIALOG_OPEN: boolean;
  LOAD_STATE_FROM_HISTORY: SessionHistoryItem | null;
  START_NEW_SESSION: SessionHistoryItem;
  DELETE_HISTORY_ITEM: string;
};

export type Action = {
  [K in keyof ActionPayloads]: { type: K; payload: ActionPayloads[K] }
}[keyof ActionPayloads];


export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_IS_MOUNTED':
      return { ...state, isMounted: action.payload };
    case 'SET_SESSION_HISTORY':
      return { ...state, sessionHistory: action.payload };
    case 'SET_ACTIVE_HISTORY_ID':
      return { ...state, activeHistoryId: action.payload };
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };
    case 'SET_BASE_IMAGE':
      return { ...state, baseImage: action.payload };
    case 'SET_ELEMENT_IMAGES':
      return { ...state, elementImages: action.payload };
    case 'SET_ELEMENT_IMAGE_URLS':
      return { ...state, elementImageUrls: action.payload };
    case 'SET_ELEMENT_NAMES':
        return { ...state, elementNames: action.payload };
    case 'SET_CANVAS_OBJECTS':
      return { ...state, canvasObjects: action.payload };
    case 'ADD_CANVAS_OBJECT':
        return { ...state, canvasObjects: [...state.canvasObjects, action.payload] };
    case 'UPDATE_LAST_HIGHLIGHT_POINT':
        const lastObj = state.canvasObjects[state.canvasObjects.length - 1] as Highlight;
        if (lastObj && lastObj.type === 'highlight') {
            lastObj.points.push(action.payload);
        }
        return { ...state, canvasObjects: [...state.canvasObjects] };
    case 'SAVE_ANNOTATION':
        const { id, text, position, color } = action.payload;
        const existing = state.canvasObjects.find(o => o.id === id);
        let newCanvasObjects: CanvasObject[];
        if (existing) {
            newCanvasObjects = state.canvasObjects.map(o => o.id === id ? { ...o, text, position: position || (o as Annotation).position, width: undefined, height: undefined } as Annotation : o);
        } else {
            const newAnnotation: Annotation = {
                id: id,
                type: 'annotation',
                color: color,
                text: text,
                position: position || {x: 0, y: 0},
                fontSize: ANNOTATION_FONT_SIZE_MEDIUM * ((state.baseImage ? MAX_DIMENSION : 1) / MAX_DIMENSION)
            };
            newCanvasObjects = [...state.canvasObjects, newAnnotation];
        }
        return { ...state, canvasObjects: newCanvasObjects };

    case 'SET_TOOL':
      return { ...state, tool: action.payload };
    case 'SET_COLOR':
      return { ...state, color: action.payload };
    case 'SET_BRUSH_SIZE':
      return { ...state, brushSize: action.payload };
    case 'SET_CUSTOM_PROMPT':
      return { ...state, customPrompt: action.payload };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_IS_ELEMENT_UPLOAD_OPEN':
      return { ...state, isElementUploadOpen: action.payload };
    case 'SET_EDITING_ANNOTATION':
      return { ...state, editingAnnotation: action.payload };
    case 'SET_CONFIRMING_NEW_IMAGE':
      return { ...state, confirmingNewImage: action.payload };
    case 'SET_IS_CAMERA_ROLL_OPEN':
      return { ...state, isCameraRollOpen: action.payload };
    case 'SET_IS_API_KEY_DIALOG_OPEN':
      return { ...state, isApiKeyDialogOpen: action.payload };

    case 'LOAD_STATE_FROM_HISTORY':
      const item = action.payload;
      if (!item) {
        return {
            ...state,
            baseImage: null,
            canvasObjects: [],
            elementImageUrls: [null, null, null],
            elementImages: [null, null, null],
            elementNames: ['', '', ''],
            customPrompt: '',
            activeHistoryId: null
        }
      }
      return {
          ...state,
          baseImage: item.baseImage,
          canvasObjects: item.annotations,
          elementImageUrls: item.elementImageUrls || [null, null, null],
          elementImages: [null, null, null], // Files can't be stored, need re-upload
          elementNames: item.elementNames || ['', '', ''],
          customPrompt: item.prompt || '',
          activeHistoryId: item.id
      }
    
    case 'START_NEW_SESSION':
        const newItem = action.payload;
        return {
            ...state,
            sessionHistory: [...state.sessionHistory, newItem],
            activeHistoryId: newItem.id,
            baseImage: newItem.baseImage,
            canvasObjects: [],
            elementImageUrls: [null, null, null],
            elementImages: [null, null, null],
            elementNames: ['', '', ''],
            customPrompt: '',
        }
    
    case 'DELETE_HISTORY_ITEM':
        const idToDelete = action.payload;
        const newHistory = state.sessionHistory.filter(item => item.id !== idToDelete);
        let nextActiveItem = null;
        if(state.activeHistoryId === idToDelete) {
            if(newHistory.length > 0) {
                nextActiveItem = newHistory[newHistory.length - 1];
            }
        }

        const newState = { ...state, sessionHistory: newHistory };
        
        if (nextActiveItem) {
            return {
                ...newState,
                baseImage: nextActiveItem.baseImage,
                canvasObjects: nextActiveItem.annotations,
                elementImageUrls: nextActiveItem.elementImageUrls || [null, null, null],
                elementImages: [null, null, null],
                elementNames: nextActiveItem.elementNames || ['', '', ''],
                customPrompt: nextActiveItem.prompt || '',
                activeHistoryId: nextActiveItem.id,
            }
        } else if (state.activeHistoryId === idToDelete) {
            return {
                ...newState,
                baseImage: null,
                canvasObjects: [],
                elementImageUrls: [null, null, null],
                elementImages: [null, null, null],
                elementNames: ['', '', ''],
                customPrompt: '',
                activeHistoryId: null,
            }
        }
        return newState;

    default:
      return state;
  }
}
