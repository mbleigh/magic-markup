export interface CanvasObject {
  id: string;
  type: 'highlight' | 'annotation';
  selected?: boolean;
}

export interface Highlight extends CanvasObject {
  type: 'highlight';
  color: string;
  points: { x: number; y: number }[];
  strokeWidth: number;
}

export interface Annotation extends CanvasObject {
  type: 'annotation';
  color: string;
  text: string;
  position: { x: number; y: number };
  fontSize: number;
  width?: number;
  height?: number;
}

export type Tool = 'highlight' | 'annotate' | 'erase' | 'select';

export type BrushSize = 'small' | 'medium' | 'large';

export interface SessionHistoryItem {
  id: string;
  baseImage: string;
  annotations: CanvasObject[];
  elementImageUrls: (string | null)[];
  elementNames: string[];
  prompt: string;
  createdAt: string;
}
