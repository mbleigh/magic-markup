export interface Highlight {
  id: string;
  color: string;
  points: { x: number; y: number }[];
  strokeWidth: number;
}

export interface Annotation {
  id: string;
  color: string;
  text: string;
  position: { x: number; y: number };
  fontSize: number;
}

export type CanvasObject = Highlight | Annotation;

export type Tool = 'highlight' | 'annotate' | 'erase';

export type BrushSize = 'small' | 'medium' | 'large';

    