'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  colors: readonly string[];
  selectedColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ colors, selectedColor, onColorChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Select color ${color}`}
          onClick={() => onColorChange(color)}
          className={cn(
            'size-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            selectedColor === color ? 'border-primary' : 'border-transparent'
          )}
        >
          <div
            className="flex size-full items-center justify-center rounded-full"
            style={{ backgroundColor: color }}
          >
            {selectedColor === color && <Check className="size-4 text-white" />}
          </div>
        </button>
      ))}
    </div>
  );
}
