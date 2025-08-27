
'use client';

import React from 'react';
import Image from 'next/image';
import { TextAnnotator } from './text-annotator';
import { Annotation, Tool } from '@/lib/types';

interface EditorCanvasProps {
  baseImage: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  tool: Tool;
  handleCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  editingAnnotation: Annotation | null;
  handleSaveAnnotation: (text: string, id: string, newPosition?: { x: number; y: number }) => void;
  setEditingAnnotation: (annotation: Annotation | null) => void;
}

export function EditorCanvas({
  baseImage,
  canvasRef,
  tool,
  handleCanvasMouseDown,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  editingAnnotation,
  handleSaveAnnotation,
  setEditingAnnotation,
}: EditorCanvasProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
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
          cursor: tool === 'select' ? 'default' : 'crosshair',
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
  );
}
