import type { LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonProps {
  icon: LucideIcon;
  tooltip: string;
  isActive?: boolean;
}

export function IconButton({ icon: Icon, tooltip, isActive, className, ...props }: IconButtonProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-lg',
              {
                'bg-accent/20 text-accent': isActive,
              },
              className
            )}
            {...props}
          >
            <Icon className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
