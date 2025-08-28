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
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function TextAnnotator({
  annotation,
  onSave,
  onCancel,
  canvasRef,
}: TextAnnotatorProps) {
  const [text, setText] = useState(annotation.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const getUiPosition = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // The canvas is centered with "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    // So its parent's top-left is the reference.
    const parentRect = canvas.parentElement!.getBoundingClientRect();

    const x = parentRect.left + (rect.width / 2) + (annotation.position.x - (canvas.width / 2)) * (rect.width / canvas.width);
    const y = parentRect.top + (rect.height / 2) + (annotation.position.y - (canvas.height / 2)) * (rect.height / canvas.height);
    
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

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

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
    const parentRect = canvas.parentElement!.getBoundingClientRect();

    const x = ((uiPosition.x - parentRect.left - (rect.width/2)) * (canvas.width / rect.width)) + (canvas.width / 2);
    const y = ((uiPosition.y - parentRect.top - (rect.height/2)) * (canvas.height / rect.height)) + (canvas.height / 2);
    
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
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <div
      ref={annotatorRef}
      className="absolute z-20 flex cursor-move flex-col gap-2 rounded-lg border bg-card p-2 shadow-xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(-50%, ${annotation.text ? '-50%' : '0%'})`,
        maxWidth: '300px'
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()} // Prevent click from propagating to canvas
    >
      <Textarea
        autoFocus
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder="Type annotation..."
        className="font-marker font-bold resize-none"
        style={{
          color: annotation.color,
          fontSize: `${annotation.fontSize}px`,
          lineHeight: 1.2,
          minHeight: '40px',
          cursor: 'text',
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
