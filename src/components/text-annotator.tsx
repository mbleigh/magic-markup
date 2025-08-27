'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Check, X } from 'lucide-react';

export interface TextAnnotation {
  text: string;
  position: { x: number; y: number };
  color: string;
  fontSize: number;
}

interface TextAnnotatorProps {
  initialPosition: { x: number; y: number };
  onSave: (text: string) => void;
  onCancel: () => void;
  color: string;
  fontSize: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function TextAnnotator({
  initialPosition,
  onSave,
  onCancel,
  color,
  fontSize,
  containerRef,
}: TextAnnotatorProps) {
  const [text, setText] = useState('');
  const [position, setPosition] = useState(initialPosition);
  const annotatorRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
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

    if (isDragging.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
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

  const handleSave = () => {
    if (text.trim()) {
      onSave(text.trim());
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
        transform: 'translate(-50%, -50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add annotation..."
        className="font-code"
        style={{
          color: color,
          fontSize: `${fontSize}px`,
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
