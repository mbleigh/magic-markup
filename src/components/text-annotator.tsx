'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Check, X } from 'lucide-react';
import type { Annotation } from '@/lib/types';


interface TextAnnotatorProps {
  annotation: Annotation;
  onSave: (text: string, id: string, newPosition?: {x: number, y: number}) => void;
  onCancel: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function TextAnnotator({
  annotation,
  onSave,
  onCancel,
  containerRef,
  canvasRef,
}: TextAnnotatorProps) {
  const [text, setText] = useState(annotation.text);
  
  const getUiPosition = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (annotation.position.x / canvas.width) * rect.width + rect.left;
    const y = (annotation.position.y / canvas.height) * rect.height + rect.top;
    return { x, y };
  }

  const [position, setPosition] = useState(getUiPosition());
  const annotatorRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPosition(getUiPosition());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotation.position.x, annotation.position.y, canvasRef.current]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag when clicking the div itself, not the textarea or buttons
    if (e.target === annotatorRef.current) {
      isDragging.current = true;
      dragStartPos.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging.current) {
          setPosition({
            x: e.clientX - dragStartPos.current.x,
            y: e.clientY - dragStartPos.current.y,
          });
        }
      };
  
      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const getCanvasCoordinatesFromUIPosition = (uiPosition: {x: number, y: number}) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (uiPosition.x - rect.left) * (canvas.width / rect.width);
    const y = (uiPosition.y - rect.top) * (canvas.height / rect.height);
    return { x, y };
  }

  const handleSave = () => {
    const newCanvasPos = getCanvasCoordinatesFromUIPosition(position);

    if (text.trim()) {
      onSave(text.trim(), annotation.id, newCanvasPos);
    } else {
      onCancel();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
    }
    if (e.key === 'Escape') {
        onCancel();
    }
  }

  return (
    <div
      ref={annotatorRef}
      className="absolute z-20 flex cursor-move flex-col gap-2 rounded-lg border bg-card p-2 shadow-xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(-50%, ${annotation.text ? '-50%' : '0%'})`,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()} // Prevent click from propagating to canvas
    >
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add annotation..."
        className="font-marker font-bold"
        style={{
          color: annotation.color,
          fontSize: `${annotation.fontSize}px`,
          lineHeight: 1.2,
          minHeight: '40px',
        }}
      />
      <div className="flex justify-end gap-2">
        <Button size="icon" variant="ghost" onClick={onCancel}>
          <X className="size-4" />
        </Button>
        <Button size="icon" onClick={handleSave}>
          <Check className="size-4" />
        </Button>
      </div>
    </div>
  );
}
