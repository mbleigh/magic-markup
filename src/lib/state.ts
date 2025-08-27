
import { SessionHistoryItem, CanvasObject, Tool, BrushSize, Annotation, Highlight } from './types';

const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};
const MAX_DIMENSION = 1000;

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
  generatedImage: string | null;
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
  generatedImage: null,
  isElementUploadOpen: false,
  editingAnnotation: null,
  confirmingNewImage: null,
  isCameraRollOpen: true,
  isApiKeyDialogOpen: false,
};

export enum ActionType {
  SET_IS_MOUNTED = 'SET_IS_MOUNTED',
  SET_SESSION_HISTORY = 'SET_SESSION_HISTORY',
  SET_ACTIVE_HISTORY_ID = 'SET_ACTIVE_HISTORY_ID',
  SET_API_KEY = 'SET_API_KEY',
  SET_BASE_IMAGE = 'SET_BASE_IMAGE',
  SET_ELEMENT_IMAGES = 'SET_ELEMENT_IMAGES',
  SET_ELEMENT_IMAGE_URLS = 'SET_ELEMENT_IMAGE_URLS',
  SET_ELEMENT_NAMES = 'SET_ELEMENT_NAMES',
  SET_CANVAS_OBJECTS = 'SET_CANVAS_OBJECTS',
  ADD_CANVAS_OBJECT = 'ADD_CANVAS_OBJECT',
  UPDATE_LAST_HIGHLIGHT_POINT = 'UPDATE_LAST_HIGHLIGHT_POINT',
  SAVE_ANNOTATION = 'SAVE_ANNOTATION',
  SET_TOOL = 'SET_TOOL',
  SET_COLOR = 'SET_COLOR',
  SET_BRUSH_SIZE = 'SET_BRUSH_SIZE',
  SET_CUSTOM_PROMPT = 'SET_CUSTOM_PROMPT',
  SET_IS_LOADING = 'SET_IS_LOADING',
  SET_GENERATED_IMAGE = 'SET_GENERATED_IMAGE',
  SET_IS_ELEMENT_UPLOAD_OPEN = 'SET_IS_ELEMENT_UPLOAD_OPEN',
  SET_EDITING_ANNOTATION = 'SET_EDITING_ANNOTATION',
  SET_CONFIRMING_NEW_IMAGE = 'SET_CONFIRMING_NEW_IMAGE',
  SET_IS_CAMERA_ROLL_OPEN = 'SET_IS_CAMERA_ROLL_OPEN',
  SET_IS_API_KEY_DIALOG_OPEN = 'SET_IS_API_KEY_DIALOG_OPEN',
  LOAD_STATE_FROM_HISTORY = 'LOAD_STATE_FROM_HISTORY',
  START_NEW_SESSION = 'START_NEW_SESSION',
  DELETE_HISTORY_ITEM = 'DELETE_HISTORY_ITEM',
}

type Action =
  | { type: ActionType.SET_IS_MOUNTED; payload: boolean }
  | { type: ActionType.SET_SESSION_HISTORY; payload: SessionHistoryItem[] }
  | { type: ActionType.SET_ACTIVE_HISTORY_ID; payload: string | null }
  | { type: ActionType.SET_API_KEY; payload: string | null }
  | { type: ActionType.SET_BASE_IMAGE; payload: string | null }
  | { type: ActionType.SET_ELEMENT_IMAGES; payload: (File | null)[] }
  | { type: ActionType.SET_ELEMENT_IMAGE_URLS; payload: (string | null)[] }
  | { type: ActionType.SET_ELEMENT_NAMES; payload: string[] }
  | { type: ActionType.SET_CANVAS_OBJECTS; payload: CanvasObject[] }
  | { type: ActionType.ADD_CANVAS_OBJECT; payload: CanvasObject }
  | { type: ActionType.UPDATE_LAST_HIGHLIGHT_POINT, payload: { x: number, y: number } }
  | { type: ActionType.SAVE_ANNOTATION, payload: { id: string, text: string, position?: { x: number, y: number }, color: string, brushSize: BrushSize, canvasWidth?: number } }
  | { type: ActionType.SET_TOOL; payload: Tool }
  | { type: ActionType.SET_COLOR; payload: string }
  | { type: ActionType.SET_BRUSH_SIZE; payload: BrushSize }
  | { type: ActionType.SET_CUSTOM_PROMPT; payload: string }
  | { type: ActionType.SET_IS_LOADING; payload: boolean }
  | { type: ActionType.SET_GENERATED_IMAGE; payload: string | null }
  | { type: ActionType.SET_IS_ELEMENT_UPLOAD_OPEN; payload: boolean }
  | { type: ActionType.SET_EDITING_ANNOTATION; payload: Annotation | null }
  | { type: ActionType.SET_CONFIRMING_NEW_IMAGE; payload: string | null }
  | { type: ActionType.SET_IS_CAMERA_ROLL_OPEN; payload: boolean }
  | { type: ActionType.SET_IS_API_KEY_DIALOG_OPEN; payload: boolean }
  | { type: ActionType.LOAD_STATE_FROM_HISTORY; payload: SessionHistoryItem | null }
  | { type: ActionType.START_NEW_SESSION; payload: SessionHistoryItem }
  | { type: ActionType.DELETE_HISTORY_ITEM; payload: string };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case ActionType.SET_IS_MOUNTED:
      return { ...state, isMounted: action.payload };
    case ActionType.SET_SESSION_HISTORY:
      return { ...state, sessionHistory: action.payload };
    case ActionType.SET_ACTIVE_HISTORY_ID:
      return { ...state, activeHistoryId: action.payload };
    case ActionType.SET_API_KEY:
      return { ...state, apiKey: action.payload };
    case ActionType.SET_BASE_IMAGE:
      return { ...state, baseImage: action.payload };
    case ActionType.SET_ELEMENT_IMAGES:
      return { ...state, elementImages: action.payload };
    case ActionType.SET_ELEMENT_IMAGE_URLS:
      return { ...state, elementImageUrls: action.payload };
    case ActionType.SET_ELEMENT_NAMES:
        return { ...state, elementNames: action.payload };
    case ActionType.SET_CANVAS_OBJECTS:
      return { ...state, canvasObjects: action.payload };
    case ActionType.ADD_CANVAS_OBJECT:
        return { ...state, canvasObjects: [...state.canvasObjects, action.payload] };
    case ActionType.UPDATE_LAST_HIGHLIGHT_POINT:
        const lastObj = state.canvasObjects[state.canvasObjects.length - 1] as Highlight;
        if (lastObj && lastObj.type === 'highlight') {
            lastObj.points.push(action.payload);
        }
        return { ...state, canvasObjects: [...state.canvasObjects] };
    case ActionType.SAVE_ANNOTATION:
        const { id, text, position, color, brushSize, canvasWidth } = action.payload;
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
                fontSize: BRUSH_SIZES[brushSize] * 4 * ((canvasWidth || MAX_DIMENSION) / MAX_DIMENSION)
            };
            newCanvasObjects = [...state.canvasObjects, newAnnotation];
        }
        return { ...state, canvasObjects: newCanvasObjects };

    case ActionType.SET_TOOL:
      return { ...state, tool: action.payload };
    case ActionType.SET_COLOR:
      return { ...state, color: action.payload };
    case ActionType.SET_BRUSH_SIZE:
      return { ...state, brushSize: action.payload };
    case ActionType.SET_CUSTOM_PROMPT:
      return { ...state, customPrompt: action.payload };
    case ActionType.SET_IS_LOADING:
      return { ...state, isLoading: action.payload };
    case ActionType.SET_GENERATED_IMAGE:
      return { ...state, generatedImage: action.payload };
    case ActionType.SET_IS_ELEMENT_UPLOAD_OPEN:
      return { ...state, isElementUploadOpen: action.payload };
    case ActionType.SET_EDITING_ANNOTATION:
      return { ...state, editingAnnotation: action.payload };
    case ActionType.SET_CONFIRMING_NEW_IMAGE:
      return { ...state, confirmingNewImage: action.payload };
    case ActionType.SET_IS_CAMERA_ROLL_OPEN:
      return { ...state, isCameraRollOpen: action.payload };
    case ActionType.SET_IS_API_KEY_DIALOG_OPEN:
      return { ...state, isApiKeyDialogOpen: action.payload };

    case ActionType.LOAD_STATE_FROM_HISTORY:
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
    
    case ActionType.START_NEW_SESSION:
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
        }
    
    case ActionType.DELETE_HISTORY_ITEM:
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

    