import { KeyRound, Sparkles } from 'lucide-react';
import { IconButton } from './icon-button';

interface HeaderProps {
  onApiKeyClick: () => void;
}

export function Header({ onApiKeyClick }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-6 text-primary" />
        <h1 className="font-headline text-xl font-semibold tracking-tight text-foreground">
          Magic Markup
        </h1>
      </div>
      <IconButton icon={KeyRound} tooltip="Change API Key" onClick={onApiKeyClick} />
    </header>
  );
}
